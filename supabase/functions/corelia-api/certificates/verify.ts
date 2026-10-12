import { json } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";
import { normalizeCertificateCode } from "./code.ts";

/** Best-effort per-isolate cost brake. Certificate code entropy is the security
 *  boundary; neither this bucket nor caller IP headers provide distributed limits. */
const RATE_LIMIT_MAX = 30;
const GLOBAL_RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
let globalRateLimitBucket = { count: 0, windowStart: 0 };

const MAX_BODY_BYTES = 8 * 1024;

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
  if (now - globalRateLimitBucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    globalRateLimitBucket = { count: 0, windowStart: now };
  }
  globalRateLimitBucket.count += 1;
  if (globalRateLimitBucket.count > GLOBAL_RATE_LIMIT_MAX) return true;
  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimitBuckets.delete(key);
  }
  const key = clientKey(req);
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

async function readLimitedJson(req: Request): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  if (!req.body) return {};
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** Public (no auth) — resolves a certificate code for the /verify page.
 *
 *  Returns only display fields; public.corelia_verify_certificate() never selects
 *  user_id or email, following the same rule as credentials/claim_lookup.ts.
 *
 *  A malformed code and an unknown code return the IDENTICAL 200 payload on purpose:
 *  differing status codes or messages would hand a prober an oracle. */
export async function handleVerifyCertificate(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    if (isRateLimited(req)) {
      // Built inline rather than via json(): this is the only response in the API
      // that needs Retry-After, not a reason to widen the shared helper.
      return new Response(
        JSON.stringify({ ok: false, message: "Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
      );
    }

    const body = await readLimitedJson(req);
    if (!body) {
      return new Response(
        JSON.stringify({ ok: false, message: "Yêu cầu quá lớn." }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    // Cap before normalizing so a huge body can't turn into wasted regex work.
    const raw = String(body.code ?? "").slice(0, 64);
    const code = normalizeCertificateCode(raw);
    if (!code) return json({ ok: true, status: "not_found" });

    const { data, error } = await db.rpc("corelia_verify_certificate", { p_code: code });
    if (error) {
      console.error("[corelia-api] certificates.verify db error", error);
      return json({ ok: false, message: "Không thể xác minh chứng nhận." }, 500);
    }

    return json({ ok: true, ...(data as Record<string, unknown> ?? { status: "not_found" }) });
  } catch (e) {
    console.error("[corelia-api] certificates.verify", e);
    return json({ ok: false, message: "Không thể xác minh chứng nhận." }, 500);
  }
}

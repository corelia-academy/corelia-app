import { json } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";
import { normalizeCertificateCode } from "./code.ts";

/** Best-effort per-isolate throttle. Deno Deploy recycles isolates and runs many of
 *  them, so this is a cost/scraping brake, NOT a security boundary — the real defense
 *  is the ~50 bits of entropy in a code (2^50 ≈ 1.1e15; a full sweep at 1000 req/s
 *  would take ~35,000 years). Do not build a DB-backed limiter unless abuse is
 *  actually observed. */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

function clientKey(req: Request): string {
  // The FIRST entry of X-Forwarded-For is whatever the original request claimed —
  // trivially spoofable by the caller, since nothing strips it before this function
  // sees it. Proxies APPEND to the chain as a request passes through them, so the
  // LAST entry is the one set by the hop closest to us (Deno Deploy's own edge),
  // which the caller cannot override. Still just a cost/scraping brake (see above),
  // not a security boundary — but taking the first entry made it bypassable with a
  // single spoofed header, which defeated even that modest purpose.
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
  return hops[hops.length - 1] || "unknown";
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
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

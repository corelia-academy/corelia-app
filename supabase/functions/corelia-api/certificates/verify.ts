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

/** The only thing this endpoint ever needs is `{"code": "<=64 chars>"}` — but that
 *  64-char cap is applied to `body.code` AFTER `req.json()` has already parsed the
 *  whole body, so it does nothing to stop a huge request from costing full parse time
 *  first. Confirmed live: a 5MB body was accepted (HTTP 200) and took ~2.3s to
 *  process. 8KB is generous — ~128x more than the code field could ever legitimately
 *  need — while still rejecting anything in that class before `req.json()` runs. */
const MAX_BODY_BYTES = 8 * 1024;

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
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

    // Content-Length is what curl/fetch send for a plain JSON POST (confirmed against
    // the live endpoint), so this catches the case actually tested. It is NOT
    // authoritative for a chunked-encoding request with no Content-Length header —
    // that case still reaches req.json() below uncapped. Not verified whether Deno
    // Deploy/Supabase's own gateway enforces a body-size ceiling ahead of this
    // function for that case; treat it as an open gap, not a covered one.
    const contentLength = Number(req.headers.get("content-length") ?? "");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, message: "Yêu cầu quá lớn." }),
        { status: 413, headers: { "Content-Type": "application/json" } },
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

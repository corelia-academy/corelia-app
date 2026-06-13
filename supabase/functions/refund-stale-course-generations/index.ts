import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type CleanupRequestBody = {
  olderThanMinutes?: unknown;
  limit?: unknown;
};

const CORS_METHODS = "POST, OPTIONS";
const CORS_HEADERS = "authorization, x-client-info, apikey, content-type, x-secret-key, x-supabase-api-version";

function normalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOriginsFromEnv(): Set<string> {
  const explicit = Deno.env.get("CORELIA_CORS_ALLOWED_ORIGINS")?.trim() ?? "";
  const app = Deno.env.get("CORELIA_APP_ORIGIN")?.trim() ?? "";
  const merged = explicit || app;
  const out = new Set<string>();
  if (!merged) return out;
  for (const item of merged.split(",")) {
    const origin = normalizeOrigin(item);
    if (origin) out.add(origin);
  }
  return out;
}

function corsHeadersForRequest(req: Request): Headers | null {
  const origin = req.headers.get("origin")?.trim() ?? "";
  if (!origin) return null;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;
  const allowed = allowedOriginsFromEnv();
  if (!allowed.has(normalized)) return null;
  return new Headers({
    "Access-Control-Allow-Origin": normalized,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    Vary: "Origin",
  });
}

function withCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeadersForRequest(req);
  if (cors) for (const [k, v] of cors.entries()) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readOptionalEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim() ?? "";
    if (value) return value;
  }
  return "";
}

function requireAnyEnv(...names: string[]): string {
  const value = readOptionalEnv(...names);
  if (value) return value;
  throw new Error(`Missing env: ${names.join(" | ")}`);
}

function readSupabaseSecretKey(): string {
  const raw = readOptionalEnv("CORELIA_SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Missing env: CORELIA_SUPABASE_SECRET_KEYS | SUPABASE_SECRET_KEYS");
  if (raw.startsWith("sb_secret_")) return raw;
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const direct = parsed.default;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  for (const value of Object.values(parsed)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new Error("Invalid Supabase secret key env");
}

function createServiceClient(): SupabaseClient {
  return createClient(
    requireAnyEnv("CORELIA_SUPABASE_URL", "SUPABASE_URL"),
    readSupabaseSecretKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function constantTimeEquals(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function readRequestSecret(req: Request): string {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  return bearer || req.headers.get("x-secret-key")?.trim() || "";
}

function verifyCronSecret(req: Request): void {
  const expected = readOptionalEnv("CORELIA_CRON_SECRET", "CORELIA_INTERNAL_SECRET");
  if (!expected) throw new Error("Missing env: CORELIA_CRON_SECRET | CORELIA_INTERNAL_SECRET");
  const actual = readRequestSecret(req);
  if (!actual || !constantTimeEquals(actual, expected)) throw new Error("Invalid cron secret");
}

async function parseBody(req: Request): Promise<{ olderThanMinutes: number; limit: number }> {
  if (!req.body) return { olderThanMinutes: 10, limit: 100 };
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return { olderThanMinutes: 10, limit: 100 };

  const body = (await req.json().catch(() => ({}))) as CleanupRequestBody;
  const rawMinutes = Number(body.olderThanMinutes);
  const rawLimit = Number(body.limit);

  const olderThanMinutes = Number.isSafeInteger(rawMinutes)
    ? Math.max(5, Math.min(rawMinutes, 1440))
    : 10;
  const limit = Number.isSafeInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 500)) : 100;

  return { olderThanMinutes, limit };
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") return withCors(req, new Response(null, { status: 204 }));
    if (req.method !== "POST") return withCors(req, json({ message: "Method not allowed" }, 405));

    verifyCronSecret(req);

    const { olderThanMinutes, limit } = await parseBody(req);
    const db = createServiceClient();
    const { data, error } = await db.rpc("refund_stale_course_generations", {
      p_older_than: `${olderThanMinutes} minutes`,
      p_limit: limit,
    });

    if (error) {
      console.error("[refund-stale-course-generations] rpc failed", error.message);
      return withCors(req, json({ message: "Cleanup failed" }, 500));
    }

    return withCors(req, json({ ok: true, olderThanMinutes, limit, result: data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled server error";
    const status =
      message === "Invalid cron secret"
        ? 401
        : message.startsWith("Missing env:")
          ? 500
          : 400;
    if (status >= 500) console.error("[refund-stale-course-generations]", message);
    return withCors(req, json({ message: status >= 500 ? "Server configuration error" : message }, status));
  }
});

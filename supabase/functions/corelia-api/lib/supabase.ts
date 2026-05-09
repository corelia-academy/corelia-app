import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { requireEnv } from "./env.ts";

export type { SupabaseClient, User };

function readSupabaseSecretKey(): string {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim() ?? "";
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw) as Record<string, unknown>;
      const directDefault = parsed.default;
      if (typeof directDefault === "string" && directDefault.trim()) return directDefault.trim();
      for (const v of Object.values(parsed)) {
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch (e) {
      console.error("[corelia-api] invalid SUPABASE_SECRET_KEYS JSON", e);
    }
  }
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function createServiceClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL").trim();
  const key = readSupabaseSecretKey();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function verifyBearerUser(req: Request, db: SupabaseClient): Promise<User> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) throw new Error("Missing Authorization header");
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Invalid Authorization header");
  const { data, error } = await db.auth.getUser(m[1]!);
  if (error || !data.user) throw new Error("Invalid or expired session");
  return data.user;
}

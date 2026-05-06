import { createClient } from "@supabase/supabase-js";

/** Prefer `VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase React quickstart); fall back to legacy `VITE_SUPABASE_ANON_KEY`. */
export function supabasePublicClientKey(): string {
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (publishable) return publishable;
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publicClientKey = supabasePublicClientKey();

if (import.meta.env.DEV && (!url || !publicClientKey)) {
  console.warn(
    "[Supabase] Thiếu VITE_SUPABASE_URL hoặc (VITE_SUPABASE_PUBLISHABLE_KEY | VITE_SUPABASE_ANON_KEY). Thêm vào .env.development.",
  );
}

export const supabase = createClient(url, publicClientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

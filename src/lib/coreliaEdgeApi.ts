import { supabasePublicClientKey } from "@/lib/supabase";

/**
 * Corelia backend on Supabase Edge Functions (single function `corelia-api`).
 * Routes are selected with the `op` query param (see supabase/functions/corelia-api).
 */
export function coreliaEdgeBaseUrl(): string {
  const explicit = import.meta.env.VITE_CORELIA_FUNCTIONS_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/corelia-api`;
}

export function coreliaEdgeUrl(op: string): string {
  const base = coreliaEdgeBaseUrl();
  if (!base) return "";
  const u = new URL(base);
  u.searchParams.set("op", op);
  return u.toString();
}

/** Headers required by Supabase Edge gateway + our handlers (Bearer = user access token). */
export function supabaseFunctionHeaders(accessToken?: string | null): Record<string, string> {
  const apikey = supabasePublicClientKey();
  const headers: Record<string, string> = {};
  if (apikey) headers.apikey = apikey;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

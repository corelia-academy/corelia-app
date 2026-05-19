import { supabase, supabasePublicClientKey } from "@/lib/supabase";

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

/**
 * Await an Edge call and return the parsed JSON response.
 * Throws on network error or non-2xx HTTP status.
 */
export async function callCoreliaApi<T = unknown>(
  op: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = coreliaEdgeUrl(op);
  if (!url) throw new Error("edge_url_not_configured");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("unauthenticated");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof json === "object" && json !== null && typeof (json as Record<string, unknown>).message === "string"
        ? (json as Record<string, unknown>).message as string
        : `http_error:${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

/** Fire-and-forget Edge call (e.g. transactional email); failures are ignored. */
export async function invokeCoreliaApi(op: string, body: Record<string, unknown>): Promise<void> {
  const url = coreliaEdgeUrl(op);
  if (!url) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseFunctionHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    /* non-blocking */
  }
}

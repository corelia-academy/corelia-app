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

// ┌─── Centralized token-refresh interceptor ───────────────────────────
//
// ROOT FIX for "app fails after long inactivity" bug.
//
// Problem: `supabase.auth.getSession()` only reads from the in-memory/localStorage
// cache. The `autoRefreshToken` background timer is throttled by the browser
// when the tab is inactive (e.g. left open overnight), so the token silently
// expires. The next user interaction sends an expired token and receives 401.
//
// Solution: patch `supabase.auth.getSession` at the client level so that EVERY
// caller in the codebase (aiVouchers.ts, payments.ts, courses.ts, credentialsEdge.ts,
// coraAi.ts, flashcards.ts, etc.) automatically gets a fresh token without any
// changes to those files.
//
// Concurrency: a `_pendingRefresh` singleton ensures that if several API calls
// fire simultaneously after a long idle period, only one refresh request is sent
// to Supabase — the rest await the same promise.

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
let _pendingRefresh: Promise<void> | null = null;

const _originalGetSession = supabase.auth.getSession.bind(supabase.auth);

supabase.auth.getSession = async () => {
  const result = await _originalGetSession();

  // No active session — user is logged out; return as-is.
  if (result.error || !result.data.session) return result;

  const nowSeconds = Math.floor(Date.now() / 1_000);
  const expiresAt = result.data.session.expires_at ?? 0;

  // Token is still fresh — fast path, no network call needed.
  if (expiresAt - nowSeconds >= TOKEN_EXPIRY_BUFFER_SECONDS) return result;

  // Token is expired or within the buffer window.
  // Trigger a single shared refresh and wait for it.
  if (!_pendingRefresh) {
    _pendingRefresh = supabase.auth
      .refreshSession()
      .then(({ error }) => {
        if (error) {
          // Refresh token itself is expired (many days of inactivity).
          // Signal AuthSync to sign the user out gracefully.
          console.warn("[supabase] Token refresh failed — session expired.", error.message);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("corelia:session-expired"));
          }
        } else if (import.meta.env.DEV) {
          console.debug("[supabase] Token refreshed proactively.");
        }
      })
      .finally(() => {
        _pendingRefresh = null;
      });
  }

  await _pendingRefresh;

  // Return the now-refreshed session from cache.
  return _originalGetSession();
};

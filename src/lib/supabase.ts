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

// ┌─── Request timeout for Auth/REST ────────────────────────────────────
//
// Some networks intermittently stall requests to `*.supabase.co` (TLS succeeds,
// no response ever arrives). `fetch` has no default timeout, and supabase-js
// holds its auth lock while a session/token request is in flight, so one stalled
// request blocked every later query and left pages on skeletons forever.
// Aborting Auth/REST requests after a bound turns the stall into a normal error
// that auth-js and TanStack Query already retry. Storage uploads and Edge
// Functions (AI generation, bulk work) can legitimately run longer, so they keep
// the caller's own signal only.

export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;
const TIMED_PATH_PREFIXES = ["/auth/v1/", "/rest/v1/"];

function requestPathname(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(raw).pathname;
  } catch {
    return "";
  }
}

export function createTimeoutFetch(
  baseFetch: typeof fetch = (...args) => fetch(...args),
  timeoutMs: number = SUPABASE_REQUEST_TIMEOUT_MS,
): typeof fetch {
  return (input, init) => {
    const pathname = requestPathname(input);
    if (!TIMED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return baseFetch(input, init);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new DOMException(`Supabase request timed out after ${timeoutMs}ms`, "TimeoutError"));
    }, timeoutMs);

    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) onCallerAbort();
    else callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    });
  };
}

export const supabase = createClient(url, publicClientKey, {
  global: {
    fetch: createTimeoutFetch(),
  },
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
// caller in the codebase (courses.ts, credentialsEdge.ts,
// descriptionGenerator.ts, questionGenerator.ts, etc.) automatically gets a fresh token without any
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
          console.warn("[supabase] Token refresh failed: session expired.", error.message);
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

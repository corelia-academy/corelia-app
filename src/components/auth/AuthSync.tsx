import { useEffect } from "react";
import { getAuthSession, subscribeToAuthState } from "@/lib/auth";
import { invokeCoreliaApi } from "@/lib/coreliaEdgeApi";
import { useAuthStore } from "@/stores/authStore";
import { currentProfileQueryOptions } from "@/features/auth/profileQueries";
import { clearPrivateQueryCache, queryClient } from "@/lib/queryClient";
import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { timedAsync } from "@/lib/perfTelemetry";


/**
 * Đồng bộ Supabase session vào Zustand. Profile là server state trong TanStack Query.
 */
export function AuthSync() {
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery);

  useEffect(() => {
    let mounted = true;
    let currentSeq = 0;
    let hasInitializedFromEvent = false;

    function syncFromSession(session: Session | null, recovery = false) {
      if (!mounted) return;
      const seq = ++currentSeq;
      const previousUserId = useAuthStore.getState().user?.id;
      const user = session?.user ?? null;

      if (user) {
        if (previousUserId && previousUserId !== user.id) {
          void clearPrivateQueryCache(previousUserId);
        }
        setAuthState(user, recovery ? "recovery" : "authenticated");

        const runSeq = seq;

        queueMicrotask(() => {
          if (!mounted || runSeq !== currentSeq) return;
          void (async () => {
            try {
              const PROFILE_TIMEOUT_MS = 10_000;
              const p = await timedAsync(
                "auth.profile.getProfileForUser",
                async () =>
                  Promise.race([
                    queryClient.fetchQuery(currentProfileQueryOptions(user)),
                    new Promise<null>((resolve) =>
                      setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS),
                    ),
                  ]),
                { userId: user.id },
              );
              if (!mounted || runSeq !== currentSeq) return;
              const locale = (p?.locale ?? DEFAULT_LANGUAGE) as SupportedLanguage;
              void i18n.changeLanguage(locale);
            } catch (error) {
              console.error("Failed to load profile:", error);
            }
          })();
        });
      } else {
        if (previousUserId) void clearPrivateQueryCache(previousUserId);
        setAuthState(null, "anonymous");
        try {
          localStorage.removeItem("i18nextLng");
        } catch {
          // ignore
        }

        const langs =
          (typeof navigator !== "undefined" && Array.isArray(navigator.languages)
            ? navigator.languages
            : typeof navigator !== "undefined" && navigator.language
              ? [navigator.language]
              : []) ?? [];
        const isVi = langs.some((l) => String(l).toLowerCase().startsWith("vi"));
        const publicLocale: SupportedLanguage = isVi ? "vi" : "en";
        void i18n.changeLanguage(publicLocale);
      }
    }

    // Safety fallback: if the INITIAL_SESSION event doesn't arrive, unblock guards.
    const INIT_TIMEOUT_MS = 4_000;
    const initTimeoutId = window.setTimeout(() => {
      if (!mounted || hasInitializedFromEvent) return;
      hasInitializedFromEvent = true;
      setAuthState(null, "anonymous");
    }, INIT_TIMEOUT_MS);

    // Immediate session check on mount for instant UI hydration
    void getAuthSession().then((session) => {
      if (!mounted || hasInitializedFromEvent) return;
      hasInitializedFromEvent = true;
      window.clearTimeout(initTimeoutId);
      syncFromSession(session);
    }).catch(() => undefined);

    const unsubscribeAuth = subscribeToAuthState((event: AuthChangeEvent, session) => {
      if (!hasInitializedFromEvent) {
        hasInitializedFromEvent = true;
        window.clearTimeout(initTimeoutId);
      }

      if (import.meta.env.DEV) {
        console.debug("[AuthSync] onAuthStateChange", event);
      }

      // Tab visibility sometimes emits TOKEN_REFRESHED and/or SIGNED_IN again with the same user.
      // Syncing a new `user` reference into Zustand retriggers profile fetch + downstream refetches.
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        const prevUser = useAuthStore.getState().user;
        const nextUser = session?.user ?? null;
        if (prevUser?.id != null && nextUser?.id === prevUser.id) {
          return;
        }
      }

      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        syncFromSession(session, true);
        return;
      }

      // Genuine new sign-in (not a session restore or same-user tab refresh).
      if (event === "SIGNED_IN" && session?.user) {
        queueMicrotask(() => {
          // Best-effort: picks up any credential_issuances left at
          // awaiting_holder_id (e.g. ghost-mint rows claimed by
          // private.handle_new_user() at signup) once the user has an OCID.
          // Usually a no-op right after signup — the real trigger point is
          // OCIDRedirect.tsx after they connect OCID — but harmless to try.
          invokeCoreliaApi("credentials.retryPending", {}).catch(() => {});
        });
      }

      syncFromSession(session);
    });

    // ┌─── Tab-focus proactive refresh ───────────────────────────────────────────────
    // When the browser throttles timers (inactive tab), `autoRefreshToken` may
    // miss its scheduled refresh window.  When the user returns to the tab, we
    // call `supabase.auth.getSession()` — now patched in supabase.ts — which
    // automatically refreshes an expired token before returning.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !mounted) return;
      void (async () => {
        try {
          const freshSession = await getAuthSession();
          if (!mounted) return;
          // If the session is gone after we had a user, the session-expired
          // event will have been dispatched by the patch; nothing more to do here.
          if (!freshSession) return;
          // Re-sync user if the identity changed (e.g., token rotated with new claims).
          const prevUser = useAuthStore.getState().user;
          if (prevUser?.id && freshSession.user.id !== prevUser.id) {
            syncFromSession(freshSession);
          }
        } catch {
          // Non-fatal — Supabase will retry on the next API call.
        }
      })();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ┌─── Session-expired forced sign-out ──────────────────────────────
    // Emitted by the patched supabase.auth.getSession() (in supabase.ts) when
    // refreshSession() itself fails (refresh token revoked or expired after
    // many days of inactivity).
    const handleSessionExpired = () => {
      if (!mounted) return;
      console.warn("[AuthSync] Session expired and could not be refreshed — signing out.");
      void useAuthStore.getState().signOut();
      // Redirect to login without reloading the SPA bundle.
      try {
        window.location.assign("/login");
      } catch {
        // ignore
      }
    };
    window.addEventListener("corelia:session-expired", handleSessionExpired);

    return () => {
      mounted = false;
      window.clearTimeout(initTimeoutId);
      unsubscribeAuth();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("corelia:session-expired", handleSessionExpired);
    };
  }, [setAuthState, setPasswordRecovery]);

  return null;
}

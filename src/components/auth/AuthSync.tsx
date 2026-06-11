import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getProfileForUser, invalidateCurrentProfileCache } from "@/lib/profile";
import { invokeCheckActivityMilestones } from "@/lib/credentialsEdge";
import { useAuthStore } from "@/stores/authStore";
import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { timedAsync } from "@/lib/perfTelemetry";


/**
 * Đồng bộ session + profile từ Supabase vào auth store.
 * Profile fetch chạy ngoài stack của `onAuthStateChange` để không block session / REST khác.
 */
export function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setProfileLoading = useAuthStore((s) => s.setProfileLoading);
  const setAuthInitialized = useAuthStore((s) => s.setAuthInitialized);
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery);

  useEffect(() => {
    let mounted = true;
    let currentSeq = 0;
    let hasInitializedFromEvent = false;

    function syncFromSession(session: { user?: unknown } | null) {
      if (!mounted) return;
      const seq = ++currentSeq;
      const user = (session as { user?: Parameters<typeof setUser>[0] } | null)?.user ?? null;
      setUser(user);
      setAuthInitialized(true);

      if (user) {
        const { profile: existingProfile } = useAuthStore.getState();
        if (existingProfile && existingProfile.id !== user.id) {
          setProfile(null);
        }
        const needSpinner = !useAuthStore.getState().profile || useAuthStore.getState().profile?.id !== user.id;
        if (needSpinner) setProfileLoading(true);

        const runSeq = seq;
        const u = user as User;

        queueMicrotask(() => {
          if (!mounted || runSeq !== currentSeq) return;
          void (async () => {
            try {
              const PROFILE_TIMEOUT_MS = 10_000;
              const p = await timedAsync(
                "auth.profile.getProfileForUser",
                async () =>
                  Promise.race([
                    getProfileForUser(u),
                    new Promise<null>((resolve) =>
                      setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS),
                    ),
                  ]),
                { userId: u.id },
              );
              if (!mounted || runSeq !== currentSeq) return;
              setProfile(p);
              void useAuthStore.getState().loadAiSubscription();
              const locale = (p?.locale ?? DEFAULT_LANGUAGE) as SupportedLanguage;
              void i18n.changeLanguage(locale);
            } catch (error) {
              console.error("Failed to load profile:", error);
              if (mounted && runSeq === currentSeq) setProfile(null);
            } finally {
              if (needSpinner && mounted && runSeq === currentSeq) setProfileLoading(false);
            }
          })();
        });
      } else {
        invalidateCurrentProfileCache();
        setProfile(null);
        setProfileLoading(false);
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
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      setAuthInitialized(true);
    }, INIT_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
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
        syncFromSession(session);
        return;
      }

      // Genuine new sign-in (not a session restore or same-user tab refresh):
      // fire login_streak check as background task.
      if (event === "SIGNED_IN" && session?.user) {
        queueMicrotask(() => {
          invokeCheckActivityMilestones("login_streak").catch(() => {});
        });
      }

      syncFromSession(session);
    });

    return () => {
      mounted = false;
      window.clearTimeout(initTimeoutId);
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setProfileLoading, setAuthInitialized, setPasswordRecovery]);

  return null;
}

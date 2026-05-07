import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getProfileForUser, invalidateCurrentProfileCache } from "@/lib/profile";
import { useAuthStore } from "@/stores/authStore";
import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n";
import type { User } from "@supabase/supabase-js";
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!hasInitializedFromEvent) {
        hasInitializedFromEvent = true;
        window.clearTimeout(initTimeoutId);
      }
      syncFromSession(session);
    });

    return () => {
      mounted = false;
      window.clearTimeout(initTimeoutId);
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setProfileLoading, setAuthInitialized]);

  return null;
}

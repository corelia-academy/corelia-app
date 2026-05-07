import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getProfileForUser, invalidateCurrentProfileCache } from "@/lib/profile";
import { useAuthStore } from "@/stores/authStore";
import i18n, { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/i18n";
import type { User } from "@supabase/supabase-js";
import { timedAsync } from "@/lib/perfTelemetry";

/**
 * Đồng bộ session + profile từ Supabase vào auth store.
 */
export function AuthSync() {
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setAuthInitialized = useAuthStore((s) => s.setAuthInitialized);

  useEffect(() => {
    let mounted = true;
    let currentSeq = 0;
    let hasInitializedFromEvent = false;

    async function syncFromSession(session: { user?: unknown } | null) {
      if (!mounted) return;
      const seq = ++currentSeq;
      const user = (session as { user?: Parameters<typeof setUser>[0] } | null)?.user ?? null;
      setUser(user);
      setAuthInitialized(true);

      if (user) {
        setLoading(true);
        try {
          const PROFILE_TIMEOUT_MS = 10_000;
          const p = await timedAsync(
            "auth.profile.getProfileForUser",
            async () =>
              Promise.race([
                getProfileForUser(user as User),
                new Promise<null>((resolve) =>
                  setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS),
                ),
              ]),
            { userId: user.id },
          );
          if (mounted && seq === currentSeq) {
            setProfile(p);
            const locale = (p?.locale ?? DEFAULT_LANGUAGE) as SupportedLanguage;
            void i18n.changeLanguage(locale);
          }
        } catch (error) {
          console.error("Failed to load profile:", error);
          if (mounted && seq === currentSeq) setProfile(null);
        } finally {
          if (mounted && seq === currentSeq) setLoading(false);
        }
      } else {
        invalidateCurrentProfileCache();
        setProfile(null);
        setLoading(false);
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
      setLoading(false);
      setAuthInitialized(true);
    }, INIT_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!hasInitializedFromEvent) {
        hasInitializedFromEvent = true;
        window.clearTimeout(initTimeoutId);
      }
      await syncFromSession(session);
    });

    return () => {
      mounted = false;
      window.clearTimeout(initTimeoutId);
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setLoading, setAuthInitialized]);

  return null;
}

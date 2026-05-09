import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { updateProfileForUser } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function useLocale() {
  const { i18n: i18nFromHook } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();

  const language = useMemo<SupportedLanguage>(() => {
    const lng = i18nFromHook.resolvedLanguage ?? i18nFromHook.language;
    if (lng && isSupportedLanguage(lng)) return lng;
    return DEFAULT_LANGUAGE;
  }, [i18nFromHook.language, i18nFromHook.resolvedLanguage]);

  const setLanguage = useCallback(
    async (lng: SupportedLanguage) => {
      await i18n.changeLanguage(lng);

      if (user) {
        try {
          await updateProfileForUser(user, { locale: lng });
          await refreshProfile(user);
        } catch {
          // If Firestore update fails, keep local preference (localStorage via i18next).
        }
        try {
          const { error } = await supabase.auth.updateUser({ data: { locale: lng } });
          if (error) console.warn("[useLocale] updateUser locale:", error.message);
        } catch {
          // Auth metadata is best-effort for email template personalization.
        }
      }
    },
    [user, refreshProfile],
  );

  const canPersistToProfile = Boolean(user && profile);

  return { language, setLanguage, canPersistToProfile };
}


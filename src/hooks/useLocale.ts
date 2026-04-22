import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { updateCurrentProfile } from "@/lib/profile";
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
          await updateCurrentProfile({ locale: lng });
          await refreshProfile();
        } catch {
          // If Firestore update fails, keep local preference (localStorage via i18next).
        }
      }
    },
    [user, refreshProfile],
  );

  const canPersistToProfile = Boolean(user && profile);

  return { language, setLanguage, canPersistToProfile };
}


import { useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { updateProfileForUser } from "@/lib/profile";
import { updateAuthLocale } from "@/lib/auth";
import { useAuth } from "@/stores/authStore";

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function useLocale() {
  const { i18n: i18nFromHook } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const persistMutation = useMutation({
    mutationFn: async ({ lng }: { lng: SupportedLanguage }) => {
      if (!user) return;
      await updateProfileForUser(user, { locale: lng });
      await updateAuthLocale(lng).catch((error) => {
        console.warn("[useLocale] update auth locale:", error);
      });
    },
    onSuccess: async () => {
      if (user) await refreshProfile(user);
    },
  });

  const language = useMemo<SupportedLanguage>(() => {
    const lng = i18nFromHook.resolvedLanguage ?? i18nFromHook.language;
    if (lng && isSupportedLanguage(lng)) return lng;
    return DEFAULT_LANGUAGE;
  }, [i18nFromHook.language, i18nFromHook.resolvedLanguage]);

  const setLanguage = useCallback(
    async (lng: SupportedLanguage) => {
      await i18n.changeLanguage(lng);

      if (user) {
        await persistMutation.mutateAsync({ lng }).catch(() => undefined);
      }
    },
    [persistMutation, user],
  );

  const canPersistToProfile = Boolean(user && profile);

  return { language, setLanguage, canPersistToProfile };
}

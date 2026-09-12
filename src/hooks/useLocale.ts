import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { updateProfileForUser } from "@/lib/profile";
import { updateAuthLocale } from "@/lib/auth";
import { useAuth } from "@/stores/authStore";
import { currentProfileQueryOptions } from "@/features/auth/profileQueries";
import {
  confirmManualLocaleSuccess,
  rollbackManualLocaleChange,
  startManualLocaleChange,
} from "@/lib/localeSyncGuard";
import type { Profile } from "@/types/database";

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function useLocale() {
  const { i18n: i18nFromHook } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const language = useMemo<SupportedLanguage>(() => {
    const lng = i18nFromHook.resolvedLanguage ?? i18nFromHook.language;
    if (lng && isSupportedLanguage(lng)) return lng;
    return DEFAULT_LANGUAGE;
  }, [i18nFromHook.language, i18nFromHook.resolvedLanguage]);

  const setLanguage = useCallback(
    async (lng: SupportedLanguage) => {
      const previousLng = language;
      const revision = startManualLocaleChange(lng);
      await i18n.changeLanguage(lng);

      if (user) {
        queryClient.setQueryData(
          currentProfileQueryOptions(user).queryKey,
          (old: Profile | null | undefined) => (old ? { ...old, locale: lng } : old),
        );

        try {
          await updateProfileForUser(user, { locale: lng });
          await updateAuthLocale(lng).catch((error) => {
            console.warn("[useLocale] update auth locale:", error);
          });
          confirmManualLocaleSuccess(revision, lng);
          await refreshProfile(user);
        } catch (error) {
          console.error("[useLocale] failed to persist locale:", error);
          const rolledBack = rollbackManualLocaleChange(revision, previousLng);
          if (rolledBack) {
            void i18n.changeLanguage(previousLng);
            queryClient.setQueryData(
              currentProfileQueryOptions(user).queryKey,
              (old: Profile | null | undefined) =>
                (old ? { ...old, locale: previousLng } : old),
            );
          }
          throw error;
        }
      } else {
        confirmManualLocaleSuccess(revision, lng);
      }
    },
    [language, queryClient, refreshProfile, user],
  );

  const canPersistToProfile = Boolean(user && profile);

  return { language, setLanguage, canPersistToProfile };
}

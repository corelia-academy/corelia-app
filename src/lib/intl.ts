import type { SupportedLanguage } from "@/i18n";
import i18n from "@/i18n";
import { intlLocaleFor, normalizeLocale, parseContentLocale } from "@/lib/locales";

/** Stored in Supabase Auth `user_metadata` for email templates (`{{ .Data.locale }}`). */
export function authMetadataLocaleFromUiLanguage(lang: string | undefined): SupportedLanguage {
  return parseContentLocale(lang) ?? "en";
}

export function intlLocale(): string {
  return intlLocaleFor(i18n.resolvedLanguage ?? i18n.language);
}

export function sortLocale(): string {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
}

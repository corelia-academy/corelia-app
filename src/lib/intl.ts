import type { SupportedLanguage } from "@/i18n";
import i18n from "@/i18n";

/** Stored in Supabase Auth `user_metadata` for email templates (`{{ .Data.locale }}`). */
export function authMetadataLocaleFromUiLanguage(lang: string | undefined): SupportedLanguage {
  const base = String(lang ?? "")
    .toLowerCase()
    .split("-")[0];
  return base === "vi" ? "vi" : "en";
}

export function intlLocale(): string {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  if (lng === "en") return "en-US";
  return "vi-VN";
}

export function sortLocale(): string {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  if (lng === "en") return "en";
  return "vi";
}


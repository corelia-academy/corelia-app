import type { Locale } from "@/types/database";
import type { EntityI18nConfig } from "@/types/entityLocales";

export function normalizeContentLocale(input?: string | null): Locale {
  return input === "en" ? "en" : "vi";
}

export function getSupportedContentLocales(config?: EntityI18nConfig | null): Locale[] {
  const list = config?.supported_locales;
  const fallback: Locale[] = ["vi", "en"];
  const supported: Locale[] =
    Array.isArray(list) && list.length ? list.map(normalizeContentLocale) : fallback;
  return Array.from(new Set<Locale>(supported));
}

export function getPrimaryContentLocale(config?: EntityI18nConfig | null): Locale {
  return normalizeContentLocale(config?.primary_content_locale);
}

export function pickContentLocale(config?: EntityI18nConfig | null, uiLocale?: string | null): Locale {
  const preferred = normalizeContentLocale(uiLocale);
  const supported = getSupportedContentLocales(config);
  if (supported.includes(preferred)) return preferred;
  return getPrimaryContentLocale(config);
}


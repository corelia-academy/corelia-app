import { LOCALE_PREFERENCE_COOKIE } from "@corelia/ui/locales";

/** Single source of truth for UI and content locales, in display order. */
export const CONTENT_LOCALES = ["en", "zh-CN", "ko", "es", "zh-TW", "vi", "ja"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

export const DEFAULT_CONTENT_LOCALE: ContentLocale = "vi";

type LocaleMeta = {
  /** Native name; never translated. */
  endonym: string;
  flag: string;
  /** BCP 47 tag for Intl formatting. */
  intl: string;
  /** Short badge text. */
  short: string;
};

export const LOCALE_META: Record<ContentLocale, LocaleMeta> = {
  en: { endonym: "English", flag: "🇺🇸", intl: "en-US", short: "EN" },
  "zh-CN": { endonym: "简体中文", flag: "🇨🇳", intl: "zh-CN", short: "简" },
  ko: { endonym: "한국어", flag: "🇰🇷", intl: "ko-KR", short: "KO" },
  es: { endonym: "Español", flag: "🇪🇸", intl: "es-ES", short: "ES" },
  "zh-TW": { endonym: "繁體中文", flag: "🇹🇼", intl: "zh-TW", short: "繁" },
  vi: { endonym: "Tiếng Việt", flag: "🇻🇳", intl: "vi-VN", short: "VI" },
  ja: { endonym: "日本語", flag: "🇯🇵", intl: "ja-JP", short: "JA" },
};

export function isContentLocale(value: unknown): value is ContentLocale {
  return typeof value === "string" && (CONTENT_LOCALES as readonly string[]).includes(value);
}

/**
 * Region-aware parser: zh-TW/zh-Hant/zh-HK/zh-MO map to zh-TW, any other zh to zh-CN.
 * Returns null when the tag is not a supported locale.
 */
export function parseContentLocale(input?: string | null): ContentLocale | null {
  if (typeof input !== "string") return null;
  const tag = input.trim().toLowerCase().replaceAll("_", "-");
  if (!tag) return null;
  if (["zh-tw", "zh-hk", "zh-mo", "zh-hant"].includes(tag) || tag.startsWith("zh-hant-")) return "zh-TW";
  const language = tag.split("-")[0];
  if (language === "zh") return "zh-CN";
  if (language === "vn") return "vi";
  return isContentLocale(language) ? language : null;
}

export function normalizeLocale(
  input?: string | null,
  fallback: ContentLocale = DEFAULT_CONTENT_LOCALE,
): ContentLocale {
  return parseContentLocale(input) ?? fallback;
}

/** Pick the first `navigator.languages` entry that maps to a supported locale. */
export function pickBrowserLocale(
  languages: readonly string[],
  fallback: ContentLocale = "en",
): ContentLocale {
  for (const language of languages) {
    const parsed = parseContentLocale(language);
    if (parsed) return parsed;
  }
  return fallback;
}

export function intlLocaleFor(locale?: string | null): string {
  return LOCALE_META[normalizeLocale(locale)].intl;
}

/**
 * Cookie holding the language a visitor picked explicitly. It is shared with the
 * landing site on the same domain, so a choice made on either side carries over.
 */
export { LOCALE_PREFERENCE_COOKIE };

export function readLocalePreference(cookie: string = typeof document === "undefined" ? "" : document.cookie): ContentLocale | null {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_PREFERENCE_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return parseContentLocale(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function writeLocalePreference(locale: ContentLocale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_PREFERENCE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

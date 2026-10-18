/**
 * Locales shared by the landing site and the learning app.
 *
 * The landing site puts the locale in the URL (English at the root, others under a
 * lowercase prefix such as /vi or /zh-cn); the app keeps it in i18next. An explicit
 * choice is stored in a cookie on the shared domain so both sides agree.
 */
export const SITE_LOCALES = ["en", "vi", "zh-CN", "zh-TW", "ko", "ja", "es"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export const DEFAULT_SITE_LOCALE: SiteLocale = "en";

/** Cookie holding the visitor's explicit language choice (read by the app's i18next detector). */
export const LOCALE_PREFERENCE_COOKIE = "corelia_lang";

/** localStorage key used by the app's i18next detector. */
export const I18NEXT_STORAGE_KEY = "i18nextLng";

export const SITE_LOCALE_META: Record<SiteLocale, { endonym: string; hreflang: string; slug: string }> = {
  en: { endonym: "English", hreflang: "en", slug: "" },
  vi: { endonym: "Tiếng Việt", hreflang: "vi", slug: "vi" },
  "zh-CN": { endonym: "简体中文", hreflang: "zh-Hans", slug: "zh-cn" },
  "zh-TW": { endonym: "繁體中文", hreflang: "zh-Hant", slug: "zh-tw" },
  ko: { endonym: "한국어", hreflang: "ko", slug: "ko" },
  ja: { endonym: "日本語", hreflang: "ja", slug: "ja" },
  es: { endonym: "Español", hreflang: "es", slug: "es" },
};

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === "string" && (SITE_LOCALES as readonly string[]).includes(value);
}

/** Locale from a landing URL path ("/zh-cn/courses" -> "zh-CN"); English when unprefixed. */
export function localeFromPath(pathname: string): SiteLocale {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  const match = SITE_LOCALES.find((locale) => SITE_LOCALE_META[locale].slug && SITE_LOCALE_META[locale].slug === first);
  return match ?? DEFAULT_SITE_LOCALE;
}

/** Path without its locale prefix ("/vi/courses" -> "/courses"). */
export function stripLocalePrefix(pathname: string): string {
  const locale = localeFromPath(pathname);
  const slug = SITE_LOCALE_META[locale].slug;
  if (!slug) return pathname || "/";
  const rest = pathname.replace(new RegExp(`^/${slug}(?=/|$)`, "i"), "");
  return rest || "/";
}

/** Landing path for a locale ("/courses", "vi" -> "/vi/courses"). */
export function localizePath(path: string, locale: SiteLocale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const slug = SITE_LOCALE_META[locale].slug;
  if (!slug) return clean;
  return clean === "/" ? `/${slug}` : `/${slug}${clean}`;
}

/** Persist an explicit language choice for both the landing site and the app. */
export function rememberLocale(locale: SiteLocale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_PREFERENCE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    window.localStorage.setItem(I18NEXT_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode); the cookie still carries the choice.
  }
}

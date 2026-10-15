export const CONTENT_LOCALES = ["en", "zh-CN", "ko", "es", "zh-TW", "vi", "ja"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

/** English language names for AI prompts. */
export const LANGUAGE_NAMES: Record<ContentLocale, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese (zh-CN)",
  ko: "Korean",
  es: "Spanish",
  "zh-TW": "Traditional Chinese (zh-TW)",
  vi: "Vietnamese",
  ja: "Japanese",
};

/** BCP 47 tags for Intl formatting. */
export const INTL_LOCALES: Record<ContentLocale, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  ko: "ko-KR",
  es: "es-ES",
  "zh-TW": "zh-TW",
  vi: "vi-VN",
  ja: "ja-JP",
};

export function isContentLocale(value: unknown): value is ContentLocale {
  return typeof value === "string" && (CONTENT_LOCALES as readonly string[]).includes(value);
}

/** Region-aware: zh-TW/Hant/HK/MO -> zh-TW; any other zh -> zh-CN. Returns null when unsupported. */
export function parseContentLocale(value?: unknown): ContentLocale | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  if (["zh-tw", "zh-hk", "zh-mo", "zh-hant"].includes(normalized) || normalized.startsWith("zh-hant-")) return "zh-TW";
  const language = normalized.split("-")[0];
  if (language === "zh") return "zh-CN";
  if (language === "vi" || language === "vn") return "vi";
  if (language === "en" || language === "ko" || language === "es" || language === "ja") return language;
  return null;
}

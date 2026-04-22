import i18n from "@/i18n";

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


import type { CourseLessonLocaleContent } from "@/types/courses";

type VideoCopy = Pick<CourseLessonLocaleContent, "video_primary_locale" | "has_subtitle" | "subtitle_locales">;
export function normalizeVideoLocale(input: VideoCopy): { value: VideoCopy; invalid: boolean } {
  const value: VideoCopy = {};
  let invalid = false;
  if (input.video_primary_locale !== undefined) {
    if (input.video_primary_locale === "vi" || input.video_primary_locale === "en") value.video_primary_locale = input.video_primary_locale;
    else invalid = true;
  }
  if (input.has_subtitle !== undefined) {
    if (typeof input.has_subtitle === "boolean") value.has_subtitle = input.has_subtitle;
    else invalid = true;
  }
  if (input.subtitle_locales !== undefined) {
    if (Array.isArray(input.subtitle_locales)) {
      value.subtitle_locales = input.subtitle_locales.filter(locale => locale === "vi" || locale === "en");
      invalid ||= value.subtitle_locales.length !== input.subtitle_locales.length;
    } else invalid = true;
  }
  return { value, invalid };
}

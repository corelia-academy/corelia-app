import type { CourseLesson, CourseLessonLocaleContent, SupportedCourseLocale } from "@/types/courses";
import { getLessonFormat } from "@/lib/lessonFormat";
import { validateLesson } from "./validation";

export type LessonLocales = Partial<Record<SupportedCourseLocale, Partial<CourseLessonLocaleContent>>>;
type OptionalLessonLocales = Partial<Record<SupportedCourseLocale, Partial<CourseLessonLocaleContent> | null>>;

/** Only changed fields are sent; merely viewing a missing translation is a no-op. */
export function changedLocaleFields<T extends object>(value: T, saved: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([key, field]) =>
    field !== undefined && JSON.stringify(field) !== JSON.stringify(saved[key as keyof T]),
  )) as Partial<T>;
}

export function changedLessonLocales(value: OptionalLessonLocales, saved: OptionalLessonLocales): LessonLocales {
  return Object.fromEntries(Object.entries(value ?? {}).flatMap(([locale, copy]) => {
    if (copy == null) return [];
    const patch = changedLocaleFields(copy, saved[locale as SupportedCourseLocale] ?? {});
    return Object.keys(patch).length ? [[locale, patch]] : [];
  }));
}

export function translationVideoIssues(lesson: CourseLesson, locales: OptionalLessonLocales, primaryLocale: SupportedCourseLocale) {
  if (getLessonFormat(lesson) !== "video") return [];
  return Object.entries(locales ?? {}).flatMap(([locale, copy]) => {
    if (copy == null || locale === primaryLocale || typeof copy.youtube_url !== "string" || !copy.youtube_url.trim()) return [];
    return validateLesson({ ...lesson, ...copy, youtube_start_seconds: copy.youtube_start_seconds ?? 0, youtube_end_seconds: copy.youtube_end_seconds ?? null })
      .filter(issue => issue.field === "youtube_url" || issue.field === "youtube_end_seconds")
      .map(issue => ({ ...issue, locale: locale as SupportedCourseLocale }));
  });
}

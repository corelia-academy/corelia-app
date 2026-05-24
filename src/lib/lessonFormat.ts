import type { CourseLesson, LessonFormat } from "@/types/courses";

export type { LessonFormat };

export function getLessonFormat(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description">,
): LessonFormat {
  if (lesson.lesson_format) return lesson.lesson_format;
  if (lesson.youtube_url?.trim()) return "video";
  if (lesson.description_markdown?.trim() || lesson.short_description?.trim()) {
    return "article";
  }
  return "video";
}

export function isArticleLesson(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description">,
): boolean {
  return getLessonFormat(lesson) === "article";
}

export function isVideoLesson(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url">,
): boolean {
  return getLessonFormat(lesson) === "video" && Boolean(lesson.youtube_url?.trim());
}

/** Lesson is visible to learners (not an empty draft). */
export function isLessonPublishedForLearners(
  lesson: Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description"
  >,
): boolean {
  const format = getLessonFormat(lesson);
  if (format === "quiz") return true;
  if (format === "article" || format === "practice") {
    return Boolean(lesson.description_markdown?.trim() || lesson.short_description?.trim());
  }
  return Boolean(lesson.youtube_url?.trim());
}

export function isLessonDraftForLearners(
  lesson: Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description"
  >,
): boolean {
  return !isLessonPublishedForLearners(lesson);
}

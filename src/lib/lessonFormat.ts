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

/** True if lesson is an activity (quiz / practice) rather than content (video / article). */
export function isActivityLesson(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description">,
): boolean {
  const format = getLessonFormat(lesson);
  return format === "quiz" || format === "practice";
}

/** Split lessons into content (video/article) and activity (quiz/practice) counts. */
export function splitLessonCounts<T extends Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description">>(
  lessons: T[],
): { contentCount: number; activityCount: number } {
  let contentCount = 0;
  let activityCount = 0;
  for (const lesson of lessons) {
    if (isActivityLesson(lesson)) activityCount += 1;
    else contentCount += 1;
  }
  return { contentCount, activityCount };
}

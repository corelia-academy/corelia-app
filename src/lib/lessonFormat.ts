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

export function getActivityLessonDisplayName(format: LessonFormat, index: number): string {
  const n = Math.max(1, Math.floor(index));
  if (format === "quiz") return `Quiz ${n}`;
  if (format === "practice") return `Practice ${n}`;
  return `Lesson ${n}`;
}

export function getNextActivityLessonTitle(
  format: LessonFormat,
  sectionLessons: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description">[],
): string {
  if (format !== "quiz" && format !== "practice") return "";
  const count = sectionLessons.filter((lesson) => getLessonFormat(lesson) === format).length;
  return getActivityLessonDisplayName(format, count + 1);
}

export interface LessonTypeCounts {
  videoCount: number;
  articleCount: number;
  quizCount: number;
  practiceCount: number;
  totalCount: number;
}

/** Count lessons by their resolved format, including legacy lessons without lesson_format. */
export function getDetailedLessonCounts<
  T extends Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description"
  >,
>(
  lessons: T[],
): LessonTypeCounts {
  let videoCount = 0;
  let articleCount = 0;
  let quizCount = 0;
  let practiceCount = 0;

  for (const lesson of lessons) {
    switch (getLessonFormat(lesson)) {
      case "video":
        videoCount += 1;
        break;
      case "article":
        articleCount += 1;
        break;
      case "quiz":
        quizCount += 1;
        break;
      case "practice":
        practiceCount += 1;
        break;
    }
  }

  return {
    videoCount,
    articleCount,
    quizCount,
    practiceCount,
    totalCount: lessons.length,
  };
}

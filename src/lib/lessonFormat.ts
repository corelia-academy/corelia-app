import { lessonText } from "@/features/learning/lessonCopy";
import type { CourseLesson, LessonFormat } from "@/types/courses";

export type { LessonFormat };

export function getLessonFormat(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config">,
): LessonFormat {
  if (lesson.lesson_format) return lesson.lesson_format;
  if (lessonText(lesson.youtube_url).trim()) return "video";
  if (lessonText(lesson.description_markdown).trim() || lessonText(lesson.short_description).trim()) {
    return "article";
  }
  return "video";
}

export function isArticleLesson(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config">,
): boolean {
  return getLessonFormat(lesson) === "article";
}

export function isVideoLesson(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url">,
): boolean {
  return getLessonFormat(lesson) === "video" && Boolean(lessonText(lesson.youtube_url).trim());
}

/** Explicit publication is authoritative; infer only for legacy records. */
export function isLessonPublishedForLearners(
  lesson: Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config"
  >,
): boolean {
  if (lesson.archived_at || lesson.published === false) return false;
  if (lesson.published === true) return true;
  const format = getLessonFormat(lesson);
  if (format === "code_exercise") return Boolean(lesson.code_exercise_config);
  if (format === "quiz") return true;
  if (format === "article" || format === "practice") {
    return Boolean(lessonText(lesson.description_markdown).trim() || lessonText(lesson.short_description).trim());
  }
  return Boolean(lessonText(lesson.youtube_url).trim());
}

export function isLessonDraftForLearners(
  lesson: Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config"
  >,
): boolean {
  return !isLessonPublishedForLearners(lesson);
}

/** True if lesson is an activity (quiz / practice) rather than content (video / article). */
export function isActivityLesson(
  lesson: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config">,
): boolean {
  const format = getLessonFormat(lesson);
  return format === "quiz" || format === "practice" || format === "code_exercise";
}

export function getActivityLessonDisplayName(format: LessonFormat, index: number): string {
  const n = Math.max(1, Math.floor(index));
  if (format === "quiz") return `Quiz ${n}`;
  if (format === "practice") return `Practice ${n}`;
  return `Lesson ${n}`;
}

export function getNextActivityLessonTitle(
  format: LessonFormat,
  sectionLessons: Pick<CourseLesson, "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config">[],
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
  codeCount: number;
  totalCount: number;
}

/** Count lessons by their resolved format, including legacy lessons without lesson_format. */
export function getDetailedLessonCounts<
  T extends Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config"
  >,
>(
  lessons: T[],
): LessonTypeCounts {
  let videoCount = 0;
  let articleCount = 0;
  let quizCount = 0;
  let practiceCount = 0;
  let codeCount = 0;

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
      case "code_exercise":
        codeCount += 1;
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
    codeCount,
    totalCount: lessons.length,
  };
}

/** Split lessons into content (video/article) and activity (quiz/practice) counts. */
export function splitLessonCounts<
  T extends Pick<
    CourseLesson,
    "lesson_format" | "youtube_url" | "description_markdown" | "short_description" | "published" | "archived_at" | "code_exercise_config"
  >,
>(lessons: T[]): { contentCount: number; activityCount: number } {
  let contentCount = 0;
  let activityCount = 0;
  for (const lesson of lessons) {
    if (isActivityLesson(lesson)) activityCount += 1;
    else contentCount += 1;
  }
  return { contentCount, activityCount };
}

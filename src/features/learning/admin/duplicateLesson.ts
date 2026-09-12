import type { CourseLesson, CourseLessonLocaleContent, SupportedCourseLocale } from "@/types/courses";
import type { SectionQuestion } from "@/types/questions";

export type LessonLocales = Partial<Record<SupportedCourseLocale, Partial<CourseLessonLocaleContent>>>;

/** Make an unsaved draft; new question identities keep attempts attached to the original. */
export function duplicateLesson(lesson: CourseLesson, questions: SectionQuestion[], locales: LessonLocales, order: number, title: (value: string, locale?: SupportedCourseLocale) => string) {
  const copy = structuredClone({ lesson, questions, locales });
  copy.lesson.id = crypto.randomUUID();
  copy.lesson.published = false;
  copy.lesson.archived_at = null;
  copy.lesson.order = order;
  copy.lesson.title = title(lesson.title);
  const questionIds = new Map<string, string>();
  for (const question of copy.questions) {
    const newId = crypto.randomUUID();
    questionIds.set(question.id, newId);
    question.id = newId;
    delete question.created_at;
    delete question.updated_at;
  }
  for (const locale of ["vi", "en"] as const) {
    const content = copy.locales[locale];
    if (!content) continue;
    if (content.title) content.title = title(content.title, locale);
    delete content.updated_at;
    if (content.question_copy) {
      content.question_copy = Object.fromEntries(Object.entries(content.question_copy)
        .filter(([id]) => questionIds.has(id))
        .map(([id, value]) => [questionIds.get(id)!, value]));
    }
  }
  return copy;
}

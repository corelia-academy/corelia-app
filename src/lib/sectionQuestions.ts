import { normalizeLessonCopy } from "@/features/learning/lessonCopy";
import { supabase } from "./supabase";
import type { SectionQuestion, SectionQuestionData } from "../types/questions";

type RawQuestionRow = {
  id: string;
  course_id: string;
  section_id: string;
  sort_order: number;
  data: SectionQuestionData;
  created_at: string;
  updated_at: string;
};

function rowToQuestion(row: RawQuestionRow): SectionQuestion {
  return {
    id: row.id,
    course_id: row.course_id,
    section_id: row.section_id,
    order: row.sort_order,
    type: row.data.type ?? "mcq",
    question: row.data.question ?? "",
    options: row.data.options ?? [],
    correct_index: row.data.correct_index ?? 0,
    explanation: row.data.explanation,
    locale: row.data.locale,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSectionQuestions(
  courseId: string,
  sectionId: string,
  locale?: string,
  signal?: AbortSignal,
): Promise<SectionQuestion[]> {
  let query = supabase
    .from("course_section_questions")
    .select("id,course_id,section_id,sort_order,data,created_at,updated_at")
    .eq("course_id", courseId)
    .eq("section_id", sectionId).is("lesson_id", null).is("archived_at", null);

  if (locale) {
    query = query.eq("data->>locale", locale);
  }

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query.order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as RawQuestionRow[]).map(rowToQuestion);
}

export async function setSectionQuestions(
  courseId: string,
  sectionId: string,
  questions: Array<SectionQuestionData & { id?: string }>,
  locale?: string,
): Promise<SectionQuestion[]> {
  const rows = questions.map(question => ({ ...question, id: question.id ?? crypto.randomUUID() }));
  const { data, error } = await supabase.rpc("learning_save_section_questions", {
    p_course: courseId, p_section: sectionId, p_questions: rows, p_locale: locale ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RawQuestionRow[]).map(rowToQuestion);
}

// ── Lesson-level quiz functions ───────────────────────────────────────────────

type RawLessonQuestionRow = RawQuestionRow & { lesson_id: string };

function lessonRowToQuestion(row: RawLessonQuestionRow): SectionQuestion {
  return {
    ...rowToQuestion(row as RawQuestionRow),
    section_id: row.lesson_id, // reuse section_id field to carry lesson_id for compatibility
  };
}

export async function getLessonQuestions(
  courseId: string,
  lessonId: string,
  locale?: string,
  signal?: AbortSignal,
): Promise<SectionQuestion[]> {
  let query = supabase.from("course_section_questions")
    .select("id,course_id,section_id,lesson_id,sort_order,data,created_at,updated_at")
    .eq("course_id", courseId).eq("lesson_id", lessonId).is("archived_at", null);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const questions = ((data ?? []) as RawLessonQuestionRow[]).map(lessonRowToQuestion);
  if (!locale) return questions;
  let copyQuery = supabase.from("course_lesson_locales").select("data").eq("course_id", courseId).eq("lesson_id", lessonId).eq("locale", locale);
  if (signal) copyQuery = copyQuery.abortSignal(signal);
  const { data: localized, error: copyError } = await copyQuery.maybeSingle();
  if (copyError) throw new Error(copyError.message);
  const copy = normalizeLessonCopy(localized?.data ?? {}).value.question_copy;
  return questions.map(question => ({ ...question,
    question: copy?.[question.id]?.question ?? question.question,
    explanation: copy?.[question.id]?.explanation ?? question.explanation,
    options: Array.isArray(question.options) && question.options.every(option => option && typeof option === "object") ? question.options.map(option => ({ ...option, text: copy?.[question.id]?.options?.[option.id] ?? option.text })) : question.options,
  }));
}

/** Legacy creation adapter. Existing question edits must supply stable IDs. */
export async function setLessonQuestions(
  courseId: string,
  lessonId: string,
  questions: Array<SectionQuestionData & { id?: string }>,
  locale?: string,
): Promise<SectionQuestion[]> {
  const [{ data: lesson, error: lessonError }, existing, { data: course, error: courseError }] = await Promise.all([
    supabase.from("course_lessons").select("*").eq("course_id", courseId).eq("id", lessonId).single(),
    getLessonQuestions(courseId, lessonId),
    supabase.from("courses").select("data").eq("id", courseId).single(),
  ]);
  if (lessonError) throw new Error(lessonError.message);
  if (courseError) throw new Error(courseError.message);
  const translating = Boolean(locale && locale !== (course.data?.i18n?.primary_content_locale ?? "vi"));
  if (existing.length && questions.some(question => !question.id)) throw new Error("Stable question IDs are required when updating a quiz.");
  const rows = questions.map((question, order) => ({ ...question, id: question.id ?? crypto.randomUUID(), order }));
  if (translating && (rows.length !== existing.length || new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => {
    const canonical = existing.find(question => question.id === row.id);
    return !canonical || row.correct_index !== canonical.correct_index || row.type !== canonical.type ||
      row.options.length !== canonical.options.length || row.options.some((option, index) => option.id !== canonical.options[index]?.id);
  }))) throw new Error("Question translations must preserve question IDs, options, and scoring.");
  const { error } = await supabase.rpc("learning_save_lesson", {
    p_course: courseId,
    p_lesson: { ...lesson.data, id: lesson.id, section_id: lesson.section_id, order: lesson.sort_order, published: lesson.published, archived_at: lesson.archived_at },
    p_questions: translating ? null : rows,
    p_locales: locale ? { [locale]: { question_copy: Object.fromEntries(rows.map(question => [question.id, { question: question.question, explanation: question.explanation, options: Object.fromEntries(question.options.map(option => [option.id, option.text])) }])) } } : null,
  });
  if (error) throw new Error(error.message);
  return getLessonQuestions(courseId, lessonId, locale);
}

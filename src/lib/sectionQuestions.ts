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
): Promise<SectionQuestion[]> {
  const { data, error } = await supabase
    .from("course_section_questions")
    .select("id,course_id,section_id,sort_order,data,created_at,updated_at")
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as RawQuestionRow[]).map(rowToQuestion);
}

export async function setSectionQuestions(
  courseId: string,
  sectionId: string,
  questions: SectionQuestionData[],
): Promise<SectionQuestion[]> {
  // Delete existing then insert new set — two separate calls (Supabase JS doesn't support transactions natively)
  const { error: deleteError } = await supabase
    .from("course_section_questions")
    .delete()
    .eq("course_id", courseId)
    .eq("section_id", sectionId);

  if (deleteError) throw new Error(deleteError.message);

  if (questions.length === 0) return [];

  const inserts = questions.map((q, i) => ({
    course_id: courseId,
    section_id: sectionId,
    sort_order: i,
    data: q,
  }));

  const { data, error } = await supabase
    .from("course_section_questions")
    .insert(inserts)
    .select("id,course_id,section_id,sort_order,data,created_at,updated_at");

  if (error) throw new Error(error.message);
  return ((data ?? []) as RawQuestionRow[]).map(rowToQuestion);
}

export async function addSectionQuestion(
  courseId: string,
  sectionId: string,
  questionData: SectionQuestionData,
  order: number,
): Promise<SectionQuestion> {
  const { data, error } = await supabase
    .from("course_section_questions")
    .insert({ course_id: courseId, section_id: sectionId, sort_order: order, data: questionData })
    .select("id,course_id,section_id,sort_order,data,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return rowToQuestion(data as RawQuestionRow);
}

export async function updateSectionQuestion(
  questionId: string,
  questionData: Partial<SectionQuestionData>,
): Promise<void> {
  const { error } = await supabase
    .from("course_section_questions")
    .update({ data: questionData, updated_at: new Date().toISOString() })
    .eq("id", questionId);

  if (error) throw new Error(error.message);
}

export async function deleteSectionQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from("course_section_questions")
    .delete()
    .eq("id", questionId);

  if (error) throw new Error(error.message);
}

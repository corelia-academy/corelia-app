import { supabase } from "./supabase";
import type { SectionQuestionAttempt, SectionQuizResult } from "../types/questions";

type SubmitAttemptParams = {
  courseId: string;
  sectionId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
};

export async function submitQuizAttempt(
  params: SubmitAttemptParams,
): Promise<SectionQuestionAttempt> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Bạn cần đăng nhập để làm bài.");

  const { data, error } = await supabase
    .from("section_question_attempts")
    .insert({
      user_id: user.id,
      course_id: params.courseId,
      section_id: params.sectionId,
      question_id: params.questionId,
      selected_index: params.selectedIndex,
      is_correct: params.isCorrect,
    })
    .select("id,user_id,course_id,section_id,question_id,selected_index,is_correct,attempted_at")
    .single();

  if (error) throw new Error(error.message);
  return data as SectionQuestionAttempt;
}

export async function submitSectionQuizAttempts(
  attempts: SubmitAttemptParams[],
): Promise<SectionQuestionAttempt[]> {
  if (attempts.length === 0) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Bạn cần đăng nhập để làm bài.");

  const rows = attempts.map((a) => ({
    user_id: user.id,
    course_id: a.courseId,
    section_id: a.sectionId,
    question_id: a.questionId,
    selected_index: a.selectedIndex,
    is_correct: a.isCorrect,
  }));

  const { data, error } = await supabase
    .from("section_question_attempts")
    .insert(rows)
    .select("id,user_id,course_id,section_id,question_id,selected_index,is_correct,attempted_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as SectionQuestionAttempt[];
}

export async function getSectionQuizResult(
  courseId: string,
  sectionId: string,
  totalQuestions: number,
): Promise<SectionQuizResult | null> {
  const { data, error } = await supabase
    .from("section_question_attempts")
    .select("id,user_id,course_id,section_id,question_id,selected_index,is_correct,attempted_at")
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .order("attempted_at", { ascending: false });

  if (error) throw new Error(error.message);
  const attempts = (data ?? []) as SectionQuestionAttempt[];
  if (attempts.length === 0) return null;

  // Keep only the most recent attempt per question
  const latestByQuestion = new Map<string, SectionQuestionAttempt>();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.question_id)) {
      latestByQuestion.set(attempt.question_id, attempt);
    }
  }

  const latest = Array.from(latestByQuestion.values());
  const correct = latest.filter((a) => a.is_correct).length;

  return {
    section_id: sectionId,
    total: totalQuestions,
    correct,
    completed: latestByQuestion.size >= totalQuestions,
    attempts: latest,
  };
}

// ── Lesson-level quiz attempts ────────────────────────────────────────────────

type SubmitLessonAttemptParams = {
  courseId: string;
  lessonId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
};

export async function submitLessonQuizAttempts(
  attempts: SubmitLessonAttemptParams[],
): Promise<SectionQuestionAttempt[]> {
  if (attempts.length === 0) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Bạn cần đăng nhập để làm bài.");

  const rows = attempts.map((a) => ({
    user_id: user.id,
    course_id: a.courseId,
    lesson_id: a.lessonId,
    section_id: null as string | null,
    question_id: a.questionId,
    selected_index: a.selectedIndex,
    is_correct: a.isCorrect,
  }));

  const { data, error } = await supabase
    .from("section_question_attempts")
    .insert(rows)
    .select("id,user_id,course_id,section_id,question_id,selected_index,is_correct,attempted_at");

  if (error) throw new Error(error.message);
  return (data ?? []) as SectionQuestionAttempt[];
}

export async function getLessonQuizResult(
  courseId: string,
  lessonId: string,
  totalQuestions: number,
): Promise<SectionQuizResult | null> {
  const { data, error } = await supabase
    .from("section_question_attempts")
    .select("id,user_id,course_id,section_id,question_id,selected_index,is_correct,attempted_at")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .order("attempted_at", { ascending: false });

  if (error) throw new Error(error.message);
  const attempts = (data ?? []) as SectionQuestionAttempt[];
  if (attempts.length === 0) return null;

  const latestByQuestion = new Map<string, SectionQuestionAttempt>();
  for (const attempt of attempts) {
    if (!latestByQuestion.has(attempt.question_id)) {
      latestByQuestion.set(attempt.question_id, attempt);
    }
  }

  const latest = Array.from(latestByQuestion.values());
  const correct = latest.filter((a) => a.is_correct).length;

  return {
    section_id: lessonId,
    total: totalQuestions,
    correct,
    completed: latestByQuestion.size >= totalQuestions,
    attempts: latest,
  };
}

export async function getSectionQuizResults(courseId: string): Promise<SectionQuizResult[]> {
  const { data, error } = await supabase
    .from("section_question_attempts")
    .select("id,user_id,course_id,section_id,question_id,selected_index,is_correct,attempted_at")
    .eq("course_id", courseId)
    .order("attempted_at", { ascending: false });

  if (error) throw new Error(error.message);
  const attempts = (data ?? []) as SectionQuestionAttempt[];

  const bySectionQuestion = new Map<string, Map<string, SectionQuestionAttempt>>();
  for (const a of attempts) {
    if (!bySectionQuestion.has(a.section_id)) {
      bySectionQuestion.set(a.section_id, new Map());
    }
    const qMap = bySectionQuestion.get(a.section_id)!;
    if (!qMap.has(a.question_id)) {
      qMap.set(a.question_id, a);
    }
  }

  return Array.from(bySectionQuestion.entries()).map(([section_id, qMap]) => {
    const latest = Array.from(qMap.values());
    return {
      section_id,
      total: latest.length,
      correct: latest.filter((a) => a.is_correct).length,
      completed: true,
      attempts: latest,
    };
  });
}

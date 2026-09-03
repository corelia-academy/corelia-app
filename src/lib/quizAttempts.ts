import i18n from "@/i18n";

import { supabase } from "./supabase";
import type { SectionQuestionAttempt, SectionQuizResult } from "../types/questions";

type SubmitAttemptParams = {
  courseId: string;
  sectionId: string;
  questionId: string;
  selectedIndex: number;
};

export async function submitQuizAttempt(
  params: SubmitAttemptParams,
): Promise<SectionQuestionAttempt> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(i18n.t("courses:errors.mustLoginQuiz"));

  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_course_id: params.courseId,
    p_section_id: params.sectionId || null,
    p_lesson_id: null,
    p_question_id: params.questionId,
    p_selected_index: params.selectedIndex,
  });

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
  if (!user) throw new Error(i18n.t("courses:errors.mustLoginQuiz"));

  const payload = attempts.map((a) => ({
    course_id: a.courseId,
    section_id: a.sectionId || null,
    lesson_id: null,
    question_id: a.questionId,
    selected_index: a.selectedIndex,
  }));

  const { data, error } = await supabase.rpc("submit_quiz_attempts", {
    p_attempts: payload,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as SectionQuestionAttempt[];
}

export async function getSectionQuizResult(
  courseId: string,
  sectionId: string,
  totalQuestions: number,
  signal?: AbortSignal,
): Promise<SectionQuizResult | null> {
  let query = supabase
    .from("section_question_attempts")
    .select("id,user_id,course_id,section_id,lesson_id,question_id,selected_index,is_correct,attempted_at")
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .is("lesson_id", null)
    .order("attempted_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

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
};

export async function submitLessonQuizAttempts(
  attempts: SubmitLessonAttemptParams[],
): Promise<SectionQuestionAttempt[]> {
  if (attempts.length === 0) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error(i18n.t("courses:errors.mustLoginQuiz"));

  const payload = attempts.map((a) => ({
    course_id: a.courseId,
    section_id: null,
    lesson_id: a.lessonId || null,
    question_id: a.questionId,
    selected_index: a.selectedIndex,
  }));

  const { data, error } = await supabase.rpc("submit_quiz_attempts", {
    p_attempts: payload,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as SectionQuestionAttempt[];
}

export async function getLessonQuizResult(
  courseId: string,
  lessonId: string,
  totalQuestions: number,
  signal?: AbortSignal,
): Promise<SectionQuizResult | null> {
  let query = supabase
    .from("section_question_attempts")
    .select("id,user_id,course_id,section_id,lesson_id,question_id,selected_index,is_correct,attempted_at")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .order("attempted_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

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
    .select("id,user_id,course_id,section_id,lesson_id,question_id,selected_index,is_correct,attempted_at")
    .eq("course_id", courseId)
    .not("section_id", "is", null)
    .is("lesson_id", null)
    .order("attempted_at", { ascending: false });

  if (error) throw new Error(error.message);
  const attempts = (data ?? []) as SectionQuestionAttempt[];

  const bySectionQuestion = new Map<string, Map<string, SectionQuestionAttempt>>();
  for (const a of attempts) {
    if (!a.section_id) continue;
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

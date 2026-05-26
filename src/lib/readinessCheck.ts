import { invokeGenerateQuestions } from "./questionGenerator";
import { supabase } from "./supabase";
import type { CourseLesson, SupportedCourseLocale } from "../types/courses";
import type { QuestionOption } from "../types/questions";

export type ReadinessQuestion = {
  id: string;
  question: string;
  options: QuestionOption[];
  correct_index: number;
  explanation?: string;
  source_lesson_id?: string;
};

export type ReadinessUserAnswer = {
  questionId: string;
  selectedIndex: number;
};

export type ReadinessCheck = {
  id: string;
  courseId: string;
  lessonId: string;
  locale: SupportedCourseLocale;
  questions: ReadinessQuestion[];
  sourceLessonIds: string[];
  userAnswers: ReadinessUserAnswer[];
  score: number | null;
  passed: boolean | null;
  skipped: boolean;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const READINESS_PASS_THRESHOLD = 0.7;
export const READINESS_QUESTION_COUNT = 3;
const MAX_PREREQ_SOURCES = 3;

type ReadinessRow = {
  id: string;
  course_id: string;
  lesson_id: string;
  locale: SupportedCourseLocale;
  questions: unknown;
  source_lesson_ids: string[] | null;
  user_answers: unknown;
  score: number | null;
  passed: boolean | null;
  skipped: boolean;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeQuestions(input: unknown): ReadinessQuestion[] {
  if (!Array.isArray(input)) return [];
  const out: ReadinessQuestion[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    const question = typeof obj.question === "string" ? obj.question : "";
    const correctIndex =
      typeof obj.correct_index === "number" ? obj.correct_index : -1;
    const rawOptions = Array.isArray(obj.options) ? obj.options : [];
    const options: QuestionOption[] = rawOptions
      .map((opt, idx) => {
        if (!opt || typeof opt !== "object") return null;
        const o = opt as Record<string, unknown>;
        const text = typeof o.text === "string" ? o.text : typeof o === "string" ? (o as unknown as string) : "";
        const oid = typeof o.id === "string" ? o.id : String(idx);
        return text ? { id: oid, text } : null;
      })
      .filter((o): o is QuestionOption => Boolean(o));
    if (!id || !question || options.length < 2 || correctIndex < 0) continue;
    out.push({
      id,
      question,
      options,
      correct_index: correctIndex,
      explanation: typeof obj.explanation === "string" ? obj.explanation : undefined,
      source_lesson_id:
        typeof obj.source_lesson_id === "string" ? obj.source_lesson_id : undefined,
    });
  }
  return out;
}

function normalizeAnswers(input: unknown): ReadinessUserAnswer[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const questionId = typeof o.questionId === "string" ? o.questionId : "";
      const selectedIndex =
        typeof o.selectedIndex === "number" ? o.selectedIndex : -1;
      if (!questionId || selectedIndex < 0) return null;
      return { questionId, selectedIndex };
    })
    .filter((v): v is ReadinessUserAnswer => Boolean(v));
}

function fromRow(row: ReadinessRow): ReadinessCheck {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    locale: row.locale,
    questions: normalizeQuestions(row.questions),
    sourceLessonIds: Array.isArray(row.source_lesson_ids) ? row.source_lesson_ids : [],
    userAnswers: normalizeAnswers(row.user_answers),
    score: row.score,
    passed: row.passed,
    skipped: row.skipped,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Pick up to `max` prior lesson IDs in the SAME section as `currentLesson`,
 * preferring those with lower `order` (closer to current). Excludes the
 * current lesson itself and any lesson whose format is quiz/practice (since
 * those aren't useful as "prior knowledge" sources).
 */
export function pickPrereqLessonIds(
  currentLesson: Pick<CourseLesson, "id" | "section_id" | "order" | "lesson_format">,
  allLessons: Array<Pick<CourseLesson, "id" | "section_id" | "order" | "lesson_format">>,
  max: number = MAX_PREREQ_SOURCES,
): string[] {
  if (!currentLesson.section_id) return [];
  const candidates = allLessons
    .filter(
      (l) =>
        l.id !== currentLesson.id &&
        l.section_id === currentLesson.section_id &&
        typeof l.order === "number" &&
        typeof currentLesson.order === "number" &&
        l.order < currentLesson.order &&
        l.lesson_format !== "quiz" &&
        l.lesson_format !== "practice",
    )
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0)); // closest first
  return candidates.slice(0, max).map((l) => l.id);
}

export async function fetchReadinessCheck(args: {
  userId: string;
  lessonId: string;
}): Promise<ReadinessCheck | null> {
  const { data, error } = await supabase
    .from("lesson_readiness_checks")
    .select(
      "id,course_id,lesson_id,locale,questions,source_lesson_ids,user_answers,score,passed,skipped,reviewed_at,created_at,updated_at",
    )
    .eq("user_id", args.userId)
    .eq("lesson_id", args.lessonId)
    .maybeSingle<ReadinessRow>();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

export async function generateReadinessCheck(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  prereqIds: string[];
  locale: SupportedCourseLocale;
  count?: number;
}): Promise<ReadinessCheck> {
  const count = Math.max(2, Math.min(5, args.count ?? READINESS_QUESTION_COUNT));
  const response = await invokeGenerateQuestions({
    courseId: args.courseId,
    lessonId: args.lessonId,
    sourceLessonIds: args.prereqIds,
    locale: args.locale,
    count,
  });

  const questions: ReadinessQuestion[] = response.questions
    .filter((q) => q.type === "mcq" && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, count)
    .map((q, idx) => ({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `q-${Date.now()}-${idx}`,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      source_lesson_id: response.sources[idx]?.lessonId,
    }));

  if (questions.length === 0) {
    throw new Error("Chưa đủ nội dung để Cora tạo câu hỏi kiểm tra.");
  }

  const { data, error } = await supabase
    .from("lesson_readiness_checks")
    .upsert(
      {
        user_id: args.userId,
        course_id: args.courseId,
        lesson_id: args.lessonId,
        locale: args.locale,
        questions,
        source_lesson_ids: args.prereqIds,
        user_answers: [],
        score: null,
        passed: null,
        skipped: false,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    )
    .select(
      "id,course_id,lesson_id,locale,questions,source_lesson_ids,user_answers,score,passed,skipped,reviewed_at,created_at,updated_at",
    )
    .single<ReadinessRow>();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

export function computeReadinessScore(
  questions: ReadinessQuestion[],
  answers: ReadinessUserAnswer[],
): { score: number; passed: boolean; correctCount: number } {
  if (questions.length === 0) return { score: 0, passed: false, correctCount: 0 };
  let correct = 0;
  for (const q of questions) {
    const a = answers.find((x) => x.questionId === q.id);
    if (a && a.selectedIndex === q.correct_index) correct += 1;
  }
  const score = correct / questions.length;
  return { score, passed: score >= READINESS_PASS_THRESHOLD, correctCount: correct };
}

export async function submitReadinessAnswers(args: {
  checkId: string;
  userAnswers: ReadinessUserAnswer[];
  score: number;
  passed: boolean;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("lesson_readiness_checks")
    .update({
      user_answers: args.userAnswers,
      score: args.score,
      passed: args.passed,
      reviewed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", args.checkId);
  if (error) throw new Error(error.message);
}

export async function skipReadinessCheck(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  locale: SupportedCourseLocale;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("lesson_readiness_checks")
    .upsert(
      {
        user_id: args.userId,
        course_id: args.courseId,
        lesson_id: args.lessonId,
        locale: args.locale,
        questions: [],
        source_lesson_ids: [],
        user_answers: [],
        skipped: true,
        reviewed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id,lesson_id" },
    );
  if (error) throw new Error(error.message);
}

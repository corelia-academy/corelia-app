import { normalizeLessonCopy } from "@/features/learning/lessonCopy";
import { isQuizQuestionShape } from "@/features/learning/quizShape";
import { supabase } from "@/lib/supabase";
import { applyCourseLessonLocaleContent, getCourse, getCourseLessons, getCourseSections, getCourseLessonLocaleContentMap, getCourseLocaleContent, getLessonProgressForCourse } from "@/lib/courses";
import { getLessonQuestions } from "@/lib/sectionQuestions";
import type { CourseLesson, CourseLessonLocaleContent, SupportedCourseLocale } from "@/types/courses";
import type { SectionQuestion, SectionQuestionAttempt } from "@/types/questions";
import type { PublishValidationIssue } from "@/features/learning/types";

export interface LearningQuizResult {
  attempt_group_id: string;
  total: number;
  correct: number;
  passing_ratio: number;
  passed: boolean;
  completed: boolean;
  attempts: SectionQuestionAttempt[];
}
export async function submitLearningQuiz(courseId: string, lessonId: string, requestId: string, answers: Record<string, number>): Promise<LearningQuizResult> {
  const { data, error } = await supabase.rpc("learning_quiz_submit", { p_course: courseId, p_lesson: lessonId, p_request: requestId, p_answers: answers });
  if (error) throw new Error(error.message);
  return data as LearningQuizResult;
}
export async function getLearningQuiz(courseId: string, lessonId: string, userId: string | undefined, locale: string, signal?: AbortSignal) {
  const [questions, copy, attempts, progress] = await Promise.all([
    getLessonQuestions(courseId, lessonId, undefined, signal),
    getCourseLessonLocaleContentMap(courseId, locale.startsWith("en") ? "en" : "vi"),
    userId ? supabase.from("section_question_attempts").select("*").eq("user_id", userId).eq("course_id", courseId).eq("lesson_id", lessonId).not("attempt_group_id", "is", null).order("attempted_at", { ascending: false }).order("id", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    userId ? getLessonProgressForCourse(userId, courseId) : Promise.resolve([]),
  ]);
  if (attempts.error) throw new Error(attempts.error.message);
  const all = (attempts.data ?? []) as (SectionQuestionAttempt & { attempt_group_id: string; group_total: number; group_correct: number; passing_ratio: number })[];
  const latest = all[0];
  if (questions.some(question => !isQuizQuestionShape(question))) throw new Error("INVALID_QUESTIONS");
  const translated = normalizeLessonCopy(copy.get(lessonId) ?? {}).value.question_copy;
  return {
    questions: questions.map(q => ({ ...q, question: translated?.[q.id]?.question ?? q.question, explanation: translated?.[q.id]?.explanation ?? q.explanation, options: q.options.map(o => ({ ...o, text: translated?.[q.id]?.options?.[o.id] ?? o.text })) })),
    result: latest ? { attempt_group_id: latest.attempt_group_id, total: latest.group_total, correct: latest.group_correct, passing_ratio: latest.passing_ratio, passed: latest.group_correct / latest.group_total >= latest.passing_ratio, completed: progress.some(row => row.lesson_id === lessonId && Boolean(row.completed_at)), attempts: all.filter(a => a.attempt_group_id === latest.attempt_group_id) } as LearningQuizResult : null,
  };
}
export async function saveLearningLesson(courseId: string, lesson: CourseLesson, questions?: SectionQuestion[], locales?: Partial<Record<SupportedCourseLocale, Partial<CourseLessonLocaleContent>>>): Promise<CourseLesson> {
  const { data, error } = await supabase.rpc("learning_save_lesson", { p_course: courseId, p_lesson: lesson, p_questions: questions ?? null, p_locales: locales ?? null });
  if (error) throw Object.assign(new Error(error.message), { details: error.details });
  return { ...data.data, id: data.id, section_id: data.section_id, order: data.sort_order, published: data.published, archived_at: data.archived_at } as CourseLesson;
}
export async function getLearningEditor(courseId: string) {
  const [course, sections, lessons, vi, en, viCourse, enCourse] = await Promise.all([getCourse(courseId), getCourseSections(courseId), getCourseLessons(courseId), getCourseLessonLocaleContentMap(courseId, "vi"), getCourseLessonLocaleContentMap(courseId, "en"), getCourseLocaleContent(courseId, "vi"), getCourseLocaleContent(courseId, "en")]);
  return { course, sections, lessons, locales: { vi, en }, courseLocales: { vi: viCourse, en: enCourse } };
}
export async function getLearningPreview(courseId: string, lessonId: string | undefined, locale: SupportedCourseLocale) {
  const data = await getLearningEditor(courseId);
  const lesson = data.lessons.find(l => l.id === lessonId) ?? data.lessons[0];
  return { course: data.course, lesson: lesson ? applyCourseLessonLocaleContent(lesson, data.locales[locale].get(lesson.id) ?? null) : null };
}
export interface LessonReadiness { lessonId: string; issues: string[] }
export async function getLearningReadiness(courseId: string, signal?: AbortSignal): Promise<LessonReadiness[]> {
  const query = supabase.rpc("learning_curriculum_readiness", { p_course: courseId });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function publishLearningReport(courseId: string): Promise<PublishValidationIssue[]> {
  const { data, error } = await supabase.rpc("learning_publish_report", { p_course: courseId });
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function archiveLearningCourse(courseId: string, archived = true) {
  const { error } = await supabase.from("courses").update({ published: false, archived_at: archived ? new Date().toISOString() : null }).eq("id", courseId).select("id").single();
  if (error) throw new Error(error.message);
}
export async function archiveLearningLesson(courseId: string, lessonId: string, archived = true) {
  const { error } = await supabase.from("course_lessons").update({ published: false, archived_at: archived ? new Date().toISOString() : null }).eq("course_id", courseId).eq("id", lessonId).select("id").single();
  if (error) throw new Error(error.message);
}
export async function recordLearningEvent(courseId: string, lessonId: string, event: "lesson_started" | "code_exercise_checked", passed?: boolean) {
  const { error } = await supabase.rpc("learning_event", { p_course: courseId, p_lesson: lessonId, p_event: event, p_passed: passed ?? null });
  // Telemetry is intentionally non-blocking and carries no learner source/content.
  if (error) console.warn("[learning] telemetry unavailable", error.code);
}
export async function learningReport(courseId: string): Promise<{ enrolled: number; started: number; completed: number; submitted: number; approved: number; lessons: { id: string; title: string; format: string; started: number; dropoff: number; completed: number; quiz_attempts: number; quiz_passes: number }[] }> {
  const { data, error } = await supabase.rpc("learning_report", { p_course: courseId });
  if (error) throw new Error(error.message);
  return data;
}
export interface LearningCourseParticipant {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  progress_percent: number;
}
export async function getLearningCourseRoster(courseId: string, signal?: AbortSignal): Promise<LearningCourseParticipant[]> {
  let request = supabase.rpc("learning_course_roster", { p_course: courseId });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function searchLearningInstructors(search: string) {
  const { data, error } = await supabase.from("public_profiles").select("id,full_name,avatar_url,instructor_headline,instructor_organization").ilike("full_name", `%${search.replace(/[%_]/g, "")}%`).limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveLearningCourse(course: import("@/types/courses").Course, locales: Partial<Record<SupportedCourseLocale, Partial<import("@/types/courses").CourseLocaleContent>>>) {
  const { error } = await supabase.rpc("learning_save_course", { p_course: course.id, p_data: course, p_slug: course.slug, p_published: course.published, p_locales: locales });
  if (error) throw new Error(error.message);
}

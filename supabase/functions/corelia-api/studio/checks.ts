// Steps structure_check and journey_test: deterministic checks over every lesson of the run. No
// model call; a failure lists what is wrong and the run stops as a draft (nothing is repaired here).

import { diagramProblems, lessonRefs, TransientError, youtubeEmbeddable, type LessonRef } from "./lessons.ts";
import { evaluateCodeExercise, getYoutubeVideoId, validateCodeConfig, validateLesson, validateQuestion, validateResources } from "./lesson_ports.ts";
import type { LessonDraft } from "./lesson_types.ts";

interface Provenance {
  model_id: string | null;
  prompt_version: string | null;
}

/** An accepted lesson with the generations that produced and reviewed it. */
export interface LessonRecord {
  draft: LessonDraft;
  /** Newest accepted generation of the A5 step, and of the A6 step. */
  written: Provenance | null;
  reviewed: Provenance | null;
}

interface CurriculumOutcomes {
  outcomes: { id: string; check_lesson_ids: string[] }[];
}
interface ResearchSources {
  sources: { url: string; access: string }[];
}

const known = (p: Provenance | null) => Boolean(p?.model_id?.trim() && p.prompt_version?.trim());

// ---- structure_check ---------------------------------------------------------------------------

export function structureProblems(curriculum: unknown, research: unknown, records: Record<string, LessonRecord>): string[] {
  const problems: string[] = [];
  const refs = lessonRefs(curriculum);
  const ids = new Set(refs.map((r) => r.lesson.id));
  for (const id of Object.keys(records)) if (!ids.has(id)) problems.push(`lesson thừa không có trong curriculum: ${id}`);
  const readUrls = new Set((research as ResearchSources).sources.filter((s) => s.access === "read").map((s) => s.url));

  for (const { lesson: cl } of refs) {
    for (const id of cl.review_lesson_ids) if (!ids.has(id)) problems.push(`${cl.id}: review_lesson_ids trỏ tới lesson không có (${id})`);
    for (const id of cl.prerequisite_lesson_ids) if (!ids.has(id)) problems.push(`${cl.id}: prerequisite_lesson_ids trỏ tới lesson không có (${id})`);
    const record = records[cl.id];
    if (!record) {
      problems.push(`${cl.id}: chưa có lesson được nhận`);
      continue;
    }
    const { lesson, questions, diagrams, source_ids } = record.draft;
    const at = (p: string) => problems.push(`${cl.id}: ${p}`);
    if (lesson.id !== cl.id) at(`id lesson ${lesson.id} không khớp curriculum`);
    if (lesson.lesson_format !== cl.type) at(`format ${lesson.lesson_format} không khớp curriculum (${cl.type})`);
    for (const { field, code } of validateLesson(lesson)) at(`${field}: ${code}`);
    questions.forEach((q, i) => validateQuestion(q).forEach((code) => at(`câu ${i + 1}: ${code}`)));
    if (cl.type === "quiz" && questions.length === 0) at("quiz không có câu hỏi");
    if (cl.type === "article") for (const p of diagramProblems(lesson.description_markdown ?? "", diagrams)) at(p);
    for (const code of validateResources(lesson.resources ?? [])) at(`resources: ${code}`);
    for (const r of lesson.resources ?? []) if (!readUrls.has(r.url)) at(`resource ${r.url} không thuộc nguồn đã đọc`);
    const allowed = new Set(cl.source_ids);
    for (const id of source_ids) if (!allowed.has(id)) at(`source_id ${id} ngoài curriculum`);
    if (!known(record.written)) at("thiếu model_id/prompt_version của bản viết");
    if (!known(record.reviewed)) at("chưa có review được nhận (model_id/prompt_version)");
  }
  return problems;
}

/** Checks a URL answers. Only a definite miss (404/410) is a problem; a server error or no answer is transient. */
async function urlProblem(url: string, fetchFn: typeof fetch): Promise<"ok" | "restricted" | "broken"> {
  const attempt = async (method: "HEAD" | "GET") => {
    try {
      const res = await fetchFn(url, { method, redirect: "follow", signal: AbortSignal.timeout(8000) });
      await res.body?.cancel();
      return res.status;
    } catch (e) {
      throw new TransientError(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  let status = await attempt("HEAD");
  if (status >= 400 && status !== 404 && status !== 410) status = await attempt("GET"); // some servers reject HEAD
  if (status === 404 || status === 410) return "broken";
  if (status < 400) return "ok";
  // 401/403/429: the page exists but refuses a bot; the learner's browser is not affected.
  if (status === 401 || status === 403 || status === 429) return "restricted";
  throw new TransientError(`${url}: HTTP ${status}`);
}

/**
 * Resources and videos still answer. Throws TransientError when only temporary failures stand in the
 * way. URLs that refuse the check (401/403/429) count as reachable and are added to `restricted`.
 */
export async function linkProblems(records: Record<string, LessonRecord>, fetchFn: typeof fetch = fetch, restricted: string[] = []): Promise<string[]> {
  const problems: string[] = [];
  let transient: TransientError | null = null;
  const checks: { where: string; run: () => Promise<boolean> }[] = [];
  const seen = new Set<string>();
  for (const [id, { draft }] of Object.entries(records)) {
    for (const r of draft.lesson.resources ?? []) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      checks.push({
        where: `${id}: resource ${r.url}`,
        run: async () => {
          const result = await urlProblem(r.url, fetchFn);
          if (result === "restricted") restricted.push(r.url);
          return result !== "broken";
        },
      });
    }
    const video = draft.lesson.youtube_url ? getYoutubeVideoId(draft.lesson.youtube_url) : null;
    if (video) checks.push({ where: `${id}: video ${video}`, run: () => youtubeEmbeddable(video, fetchFn) });
  }
  for (let i = 0; i < checks.length; i += 8) {
    const results = await Promise.allSettled(checks.slice(i, i + 8).map((c) => c.run()));
    results.forEach((res, k) => {
      const where = checks[i + k].where;
      if (res.status === "fulfilled") {
        if (!res.value) problems.push(`${where} không truy cập được`);
      } else if (res.reason instanceof TransientError) transient ??= res.reason;
      else throw res.reason;
    });
  }
  if (problems.length === 0 && transient) throw transient;
  return problems;
}

// ---- journey_test ------------------------------------------------------------------------------

/** Lesson purposes that teach an outcome; practice and checks come after them. */
const TEACHING_PURPOSES = ["explanation", "worked_example"];

/** Walks the lessons in curriculum order as a learner would. Every lesson counts: the app has no optional lesson. */
export function journeyProblems(curriculum: unknown, records: Record<string, LessonRecord>): string[] {
  const problems: string[] = [];
  const refs = lessonRefs(curriculum);
  const index = new Map(refs.map((r, i) => [r.lesson.id, i]));
  const at = (id: string, p: string) => problems.push(`${id}: ${p}`);
  const before = (a: string, b: string) => (index.get(a) ?? Infinity) < (index.get(b) ?? -1);

  // An outcome is taught by its explanation or worked_example lessons (Learning Principles: model
  // before practice) and checked by the lessons in check_lesson_ids, in whichever format can check
  // it (quiz, code_exercise, practice). A lesson may do both; at least one check comes after teaching.
  for (const o of (curriculum as CurriculumOutcomes).outcomes) {
    const checks = refs.filter((r) => o.check_lesson_ids.includes(r.lesson.id));
    const teachers = refs.filter((r) => r.lesson.outcome_ids.includes(o.id) && TEACHING_PURPOSES.includes(r.lesson.purpose));
    if (teachers.length === 0) problems.push(`outcome ${o.id}: không có lesson dạy`);
    else if (checks.length === 0) problems.push(`outcome ${o.id}: không có lesson kiểm tra`);
    else if (!checks.some((c) => teachers.some((t) => before(t.lesson.id, c.lesson.id)))) problems.push(`outcome ${o.id}: không lesson kiểm tra nào đứng sau lesson dạy`);
  }

  for (const { lesson: cl } of refs) {
    for (const p of cl.prerequisite_lesson_ids) if (!before(p, cl.id)) at(cl.id, `prerequisite ${p} không đứng trước`);
    if (cl.type === "quiz") {
      for (const r of cl.review_lesson_ids) if (!before(r, cl.id)) at(cl.id, `lesson ôn ${r} không đứng trước quiz`);
    }
    const draft = records[cl.id]?.draft;
    if (!draft) {
      at(cl.id, "chưa có lesson được nhận");
      continue;
    }
    const lesson = draft.lesson;
    if (cl.type === "quiz") {
      const total = draft.questions.length;
      const ratio = lesson.quiz_config?.passing_ratio ?? 0.7;
      // Answer every question with its correct option.
      const correct = draft.questions.filter((q) => Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length).length;
      if (total === 0) at(cl.id, "quiz không có câu hỏi");
      else if (!(ratio >= 0.01 && ratio <= 1)) at(cl.id, `ngưỡng ${ratio} ngoài (0.01, 1]`);
      else if (correct / total < ratio) at(cl.id, `trả lời đúng hết vẫn không đạt ngưỡng ${ratio}`);
    }
    if (cl.type === "code_exercise") {
      const config = lesson.code_exercise_config;
      const errors = validateCodeConfig(config, true);
      if (errors.length > 0) at(cl.id, `code: ${errors.join(", ")}`);
      else if (config) {
        const starter = config.mode === "fill" ? evaluateCodeExercise(config, { answers: {} }) : evaluateCodeExercise(config, { source: config.file.starter_source });
        if (starter.passed) at(cl.id, "starter_source đã đạt mọi test bắt buộc");
      }
    }
    if (cl.type === "practice") {
      const c = lesson.practice_config;
      if (c && (c.mode !== "instruction" && c.mode !== "checklist")) at(cl.id, `practice mode ${String(c.mode)} cần bài nộp`);
      if (c && (c.requires_review || "submission_fields" in c || "project_steps" in c)) at(cl.id, "practice có bài nộp hoặc chờ chấm");
    }
  }
  return problems;
}

export type { LessonRef };

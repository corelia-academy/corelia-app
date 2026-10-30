// Steps structure_check and journey_test: deterministic checks over every lesson of the run. No
// model call; a failure lists what is wrong and the run stops as a draft (nothing is repaired here).

import { diagramProblems, lessonRefs, lessonVideoCandidates, TransientError, youtubeEmbeddable, type LessonRef } from "./lessons.ts";
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

export interface CodeCheck {
  id: string;
  passed: number;
  total: number;
  failed_refs?: string[];
  warning_refs?: string[];
}

function addCodeCheck(
  target: CodeCheck[] | undefined,
  id: string,
  total: number,
  failedRefs: string[] = [],
  warningRefs: string[] = [],
  uniqueFailures = true,
) {
  if (!target) return;
  const failed = uniqueFailures ? [...new Set(failedRefs)] : failedRefs;
  target.push({
    id,
    passed: Math.max(0, total - failed.length),
    total,
    ...(failed.length ? { failed_refs: failed } : {}),
    ...(warningRefs.length ? { warning_refs: [...new Set(warningRefs)] } : {}),
  });
}

interface CurriculumOutcomes {
  outcomes: { id: string; check_lesson_ids: string[] }[];
}
type ResearchSources = Parameters<typeof lessonVideoCandidates>[0] & {
  sources: { url: string; access: string }[];
};

const known = (p: Provenance | null) => Boolean(p?.model_id?.trim() && p.prompt_version?.trim());

// ---- structure_check ---------------------------------------------------------------------------

export function structureProblems(curriculum: unknown, research: unknown, records: Record<string, LessonRecord>, evidence?: CodeCheck[]): string[] {
  const problems: string[] = [];
  const refs = lessonRefs(curriculum);
  const ids = new Set(refs.map((r) => r.lesson.id));
  const extraRecords = Object.keys(records).filter((id) => !ids.has(id));
  for (const id of extraRecords) problems.push(`lesson thừa không có trong curriculum: ${id}`);
  const researchData = research as ResearchSources;
  const readUrls = new Set(researchData.sources.filter((s) => s.access === "read").map((s) => s.url));
  const matchFailed = [...extraRecords];
  const acceptedFailed: string[] = [];
  const reviewRefsFailed: string[] = [];
  const prerequisiteRefsFailed: string[] = [];
  const lessonRulesFailed: string[] = [];
  let reviewRefsTotal = 0;
  let prerequisiteRefsTotal = 0;

  for (const { lesson: cl } of refs) {
    reviewRefsTotal += cl.review_lesson_ids.length;
    for (const id of cl.review_lesson_ids) if (!ids.has(id)) {
      problems.push(`${cl.id}: review_lesson_ids trỏ tới lesson không có (${id})`);
      reviewRefsFailed.push(`${cl.id}->${id}`);
    }
    prerequisiteRefsTotal += cl.prerequisite_lesson_ids.length;
    for (const id of cl.prerequisite_lesson_ids) if (!ids.has(id)) {
      problems.push(`${cl.id}: prerequisite_lesson_ids trỏ tới lesson không có (${id})`);
      prerequisiteRefsFailed.push(`${cl.id}->${id}`);
    }
    const record = records[cl.id];
    if (!record) {
      problems.push(`${cl.id}: chưa có lesson được nhận`);
      acceptedFailed.push(cl.id);
      matchFailed.push(cl.id);
      lessonRulesFailed.push(cl.id);
      continue;
    }
    const { lesson, questions, diagrams, source_ids } = record.draft;
    const at = (p: string) => problems.push(`${cl.id}: ${p}`);
    if (lesson.id !== cl.id) {
      at(`id lesson ${lesson.id} không khớp curriculum`);
      matchFailed.push(cl.id);
    }
    if (lesson.lesson_format !== cl.type) {
      at(`format ${lesson.lesson_format} không khớp curriculum (${cl.type})`);
      matchFailed.push(cl.id);
    }
    const ruleStart = problems.length;
    for (const { field, code } of validateLesson(lesson)) at(`${field}: ${code}`);
    questions.forEach((q, i) => validateQuestion(q).forEach((code) => at(`câu ${i + 1}: ${code}`)));
    if (cl.type === "quiz" && questions.length === 0) at("quiz không có câu hỏi");
    if (cl.type === "article") for (const p of diagramProblems(lesson.description_markdown ?? "", diagrams)) at(p);
    for (const code of validateResources(lesson.resources ?? [])) at(`resources: ${code}`);
    const candidateById = new Map<string, { title: string; channel: string }>();
    for (const candidate of lessonVideoCandidates(researchData, cl.source_ids)) {
      const videoId = getYoutubeVideoId(candidate.url);
      if (videoId && !candidateById.has(videoId)) candidateById.set(videoId, candidate);
    }
    for (const r of lesson.resources ?? []) {
      const videoId = getYoutubeVideoId(r.url);
      if (videoId) {
        const candidate = candidateById.get(videoId);
        const expectedUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const expectedTitle = candidate ? `Video: ${candidate.title} — ${candidate.channel}` : "";
        if (!candidate || r.url !== expectedUrl || r.title !== expectedTitle) {
          at(`resource ${r.url} không phải video xem thêm hợp lệ của lesson`);
        }
      } else if (!readUrls.has(r.url)) {
        at(`resource ${r.url} không thuộc nguồn đã đọc`);
      }
    }
    const allowed = new Set(cl.source_ids);
    for (const id of source_ids) if (!allowed.has(id)) at(`source_id ${id} ngoài curriculum`);
    if (!known(record.written)) at("thiếu model_id/prompt_version của bản viết");
    if (!known(record.reviewed)) at("chưa có review được nhận (model_id/prompt_version)");
    if (problems.length > ruleStart) lessonRulesFailed.push(cl.id);
  }
  addCodeCheck(evidence, "structure.curriculum_match", refs.length + extraRecords.length, matchFailed);
  addCodeCheck(evidence, "structure.review_refs", reviewRefsTotal, reviewRefsFailed, [], false);
  addCodeCheck(evidence, "structure.prerequisite_refs", prerequisiteRefsTotal, prerequisiteRefsFailed, [], false);
  addCodeCheck(evidence, "structure.accepted_lessons", refs.length, acceptedFailed);
  addCodeCheck(evidence, "structure.lesson_rules", refs.length, lessonRulesFailed);
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
export async function linkProblems(records: Record<string, LessonRecord>, fetchFn: typeof fetch = fetch, restricted: string[] = [], evidence?: CodeCheck[]): Promise<string[]> {
  const problems: string[] = [];
  let transient: TransientError | null = null;
  const checks: { where: string; run: () => Promise<boolean> }[] = [];
  const seen = new Set<string>();
  const failedRefs: string[] = [];
  let resolved = 0;
  for (const [id, { draft }] of Object.entries(records)) {
    for (const r of draft.lesson.resources ?? []) {
      // YouTube candidates were checked with oEmbed before the draft was accepted; watch pages
      // are not a reliable target for a generic HEAD/GET reachability check.
      if (getYoutubeVideoId(r.url)) continue;
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
    if (video) checks.push({ where: `${id}: video ${video}`, run: async () => Boolean(await youtubeEmbeddable(video, fetchFn)) });
  }
  for (let i = 0; i < checks.length; i += 8) {
    const results = await Promise.allSettled(checks.slice(i, i + 8).map((c) => c.run()));
    results.forEach((res, k) => {
      const where = checks[i + k].where;
      if (res.status === "fulfilled") {
        resolved++;
        if (!res.value) {
          problems.push(`${where} không truy cập được`);
          failedRefs.push(where);
        }
      } else if (res.reason instanceof TransientError) transient ??= res.reason;
      else throw res.reason;
    });
  }
  if (problems.length === 0 && transient) throw transient;
  addCodeCheck(evidence, "structure.links", resolved, failedRefs, restricted);
  return problems;
}

// ---- journey_test ------------------------------------------------------------------------------

/** Lesson purposes that teach an outcome; practice and checks come after them. */
const TEACHING_PURPOSES = ["explanation", "worked_example"];

/** Walks the lessons in curriculum order as a learner would. Every lesson counts: the app has no optional lesson. */
export function journeyProblems(curriculum: unknown, records: Record<string, LessonRecord>, evidence?: CodeCheck[]): string[] {
  const problems: string[] = [];
  const refs = lessonRefs(curriculum);
  const index = new Map(refs.map((r, i) => [r.lesson.id, i]));
  const at = (id: string, p: string) => problems.push(`${id}: ${p}`);
  const before = (a: string, b: string) => (index.get(a) ?? Infinity) < (index.get(b) ?? -1);
  const failedOutcomes: string[] = [];
  const failedOrder: string[] = [];
  const failedAccepted: string[] = [];
  const failedQuizzes: string[] = [];
  const failedCodeExercises: string[] = [];
  const failedPractices: string[] = [];
  let orderTotal = 0;
  let quizTotal = 0;
  let codeTotal = 0;
  let practiceTotal = 0;

  // An outcome is taught by its explanation or worked_example lessons (Learning Principles: model
  // before practice) and checked by the lessons in check_lesson_ids, in whichever format can check
  // it (quiz, code_exercise, practice). A lesson may do both; at least one check comes after teaching.
  for (const o of (curriculum as CurriculumOutcomes).outcomes) {
    const checks = refs.filter((r) => o.check_lesson_ids.includes(r.lesson.id));
    const teachers = refs.filter((r) => r.lesson.outcome_ids.includes(o.id) && TEACHING_PURPOSES.includes(r.lesson.purpose));
    if (teachers.length === 0) {
      problems.push(`outcome ${o.id}: không có lesson dạy`);
      failedOutcomes.push(o.id);
    } else if (checks.length === 0) {
      problems.push(`outcome ${o.id}: không có lesson kiểm tra`);
      failedOutcomes.push(o.id);
    } else if (!checks.some((c) => teachers.some((t) => before(t.lesson.id, c.lesson.id)))) {
      problems.push(`outcome ${o.id}: không lesson kiểm tra nào đứng sau lesson dạy`);
      failedOutcomes.push(o.id);
    }
  }

  for (const { lesson: cl } of refs) {
    orderTotal += cl.prerequisite_lesson_ids.length;
    for (const p of cl.prerequisite_lesson_ids) if (!before(p, cl.id)) {
      at(cl.id, `prerequisite ${p} không đứng trước`);
      failedOrder.push(`${cl.id}->prerequisite:${p}`);
    }
    if (cl.type === "quiz") {
      orderTotal += cl.review_lesson_ids.length;
      for (const r of cl.review_lesson_ids) if (!before(r, cl.id)) {
        at(cl.id, `lesson ôn ${r} không đứng trước quiz`);
        failedOrder.push(`${cl.id}->review:${r}`);
      }
    }
    const draft = records[cl.id]?.draft;
    if (!draft) {
      at(cl.id, "chưa có lesson được nhận");
      failedAccepted.push(cl.id);
      if (cl.type === "quiz") {
        quizTotal++;
        failedQuizzes.push(cl.id);
      }
      if (cl.type === "code_exercise") {
        codeTotal++;
        failedCodeExercises.push(cl.id);
      }
      if (cl.type === "practice") {
        practiceTotal++;
        failedPractices.push(cl.id);
      }
      continue;
    }
    const lesson = draft.lesson;
    if (cl.type === "quiz") {
      quizTotal++;
      const total = draft.questions.length;
      const ratio = lesson.quiz_config?.passing_ratio ?? 0.7;
      // Answer every question with its correct option.
      const correct = draft.questions.filter((q) => Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length).length;
      if (total === 0) {
        at(cl.id, "quiz không có câu hỏi");
        failedQuizzes.push(cl.id);
      } else if (!(ratio >= 0.01 && ratio <= 1)) {
        at(cl.id, `ngưỡng ${ratio} ngoài (0.01, 1]`);
        failedQuizzes.push(cl.id);
      } else if (correct / total < ratio) {
        at(cl.id, `trả lời đúng hết vẫn không đạt ngưỡng ${ratio}`);
        failedQuizzes.push(cl.id);
      }
    }
    if (cl.type === "code_exercise") {
      codeTotal++;
      const config = lesson.code_exercise_config;
      const errors = validateCodeConfig(config, true);
      if (errors.length > 0) {
        at(cl.id, `code: ${errors.join(", ")}`);
        failedCodeExercises.push(cl.id);
      }
      else if (config) {
        const starter = config.mode === "fill" ? evaluateCodeExercise(config, { answers: {} }) : evaluateCodeExercise(config, { source: config.file.starter_source });
        if (starter.passed) {
          at(cl.id, "starter_source đã đạt mọi test bắt buộc");
          failedCodeExercises.push(cl.id);
        }
      }
    }
    if (cl.type === "practice") {
      practiceTotal++;
      const c = lesson.practice_config;
      if (c && (c.mode !== "instruction" && c.mode !== "checklist")) {
        at(cl.id, `practice mode ${String(c.mode)} cần bài nộp`);
        failedPractices.push(cl.id);
      }
      if (c && (c.requires_review || "submission_fields" in c || "project_steps" in c)) {
        at(cl.id, "practice có bài nộp hoặc chờ chấm");
        failedPractices.push(cl.id);
      }
    }
  }
  addCodeCheck(evidence, "journey.outcome_order", (curriculum as CurriculumOutcomes).outcomes.length, failedOutcomes);
  addCodeCheck(evidence, "journey.lesson_order", orderTotal, failedOrder, [], false);
  addCodeCheck(evidence, "journey.accepted_lessons", refs.length, failedAccepted);
  addCodeCheck(evidence, "journey.quiz_thresholds", quizTotal, failedQuizzes);
  addCodeCheck(evidence, "journey.code_exercises", codeTotal, failedCodeExercises);
  addCodeCheck(evidence, "journey.practice_no_submission", practiceTotal, failedPractices);
  return problems;
}

export type { LessonRef };

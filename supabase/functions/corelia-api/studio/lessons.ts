// Step `lessons` (A5): one model call per curriculum lesson, in the format of that lesson.
// The model fills the block of its format; code builds the app's lesson record from it
// (toLessonDraft), validates that record with the app's publish rules (lesson_ports.ts) and
// checks what a rule can check: sources, resource URLs, quiz keys, code tests, diagram layout,
// video existence.

import { checkDiagram } from "./diagram.ts";
import { minQuizQuestions, type LessonDiagram, type LessonDraft, type LessonFormat, type QuestionData } from "./lesson_types.ts";
import {
  ENABLED_CODE_LANGUAGES,
  getCodeLanguageAdapter,
  getYoutubeVideoId,
  isEnabledCodeLanguage,
  resolveCodeLanguage,
  validateCodeConfig,
  validateLesson,
  validateQuestion,
  validateResources,
  validCodeFile,
  type CodeExerciseConfig,
  type CodeExerciseTest,
  type EnabledCodeLanguage,
} from "./lesson_ports.ts";
import type { Acceptance, ResearchVideoCandidate, RunContext } from "./steps.ts";
import {
  extractChannelHandle,
  findAllowedChannelByName,
  findChannelByHandle,
  isAllowedChannel,
} from "./channels.ts";
import { PLATFORM_FORMAT_GUIDE } from "./formats.ts";
import { normalizeReviewIssues } from "./review_policy.ts";

// ---- curriculum access -------------------------------------------------------------------------

interface CurriculumLesson {
  id: string;
  title: string;
  description: string;
  type: LessonFormat;
  purpose: string;
  code_mode?: "fill" | "edit" | null;
  outcome_ids: string[];
  prerequisites: string[];
  prerequisite_lesson_ids: string[];
  completion_rule: string;
  pass_threshold: number | null;
  review_lesson_ids: string[];
  source_ids: string[];
  new_knowledge: string;
  opening_question: string;
  next_question: string | null;
}
interface CurriculumFull {
  outcomes: { id: string; text: string }[];
  modules: { id: string; title: string; description: string; recap: string; lessons: CurriculumLesson[] }[];
}

/** Error for a curriculum written before new_knowledge, opening_question, next_question and recap existed. */
export const STALE_KNOWLEDGE_MESSAGE =
  "Curriculum của lượt này được tạo trước khi có new_knowledge, opening_question, next_question và recap, nên không dùng được cho bước tiếp theo. Hãy tạo lại curriculum cho khóa.";

/** A string with some text after trimming: the text fields the curriculum and lessons must fill. */
export function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * True when the curriculum carries the fields the lesson and review steps need. A curriculum written
 * before these fields existed has none of them, so it cannot be reviewed or written from: it must be created again.
 */
export function hasKnowledgeFields(curriculum: unknown): boolean {
  const c = curriculum as Partial<CurriculumFull> | null;
  if (!c || !Array.isArray(c.modules)) return false;
  return c.modules.every((m) =>
    hasText(m.recap) && Array.isArray(m.lessons) && m.lessons.every((l) =>
      hasText(l.new_knowledge) && hasText(l.opening_question) && (l.next_question === null || hasText(l.next_question))
    )
  );
}

/**
 * Why a curriculum cannot be written from, or null when it can: the knowledge fields are missing, or a
 * code lesson has no code_mode (a curriculum from before code_mode). The run stops with this message
 * before any model call.
 */
export function curriculumStaleReason(curriculum: unknown): string | null {
  if (!hasKnowledgeFields(curriculum)) return STALE_KNOWLEDGE_MESSAGE;
  const c = curriculum as CurriculumFull;
  for (const l of c.modules.flatMap((m) => m.lessons)) {
    if (l.type === "code_exercise" && l.code_mode !== "fill" && l.code_mode !== "edit") {
      return `Bài code "${l.id}" của khóa này được lập trước khi có code_mode; cần tạo lại khóa.`;
    }
  }
  return null;
}

/** A recap written in one lesson: the module it belongs to, where it goes, and its text. */
export interface RecapPlacement {
  module_id: string;
  placement: "opening" | "closing";
  text: string;
}

const PROSE_LESSON_TYPES: readonly string[] = ["article", "video", "code_exercise"];
const TEACHING_PURPOSES_FOR_RECAP: readonly string[] = ["explanation", "worked_example"];

/**
 * Which lesson carries each module's recap (decision 03/11/2026, log 3.9). A module that ends with prose
 * (article, video or code_exercise, optional_hands_on not counted) closes with its recap in that lesson.
 * A module that ends with a quiz has no prose to close in: its recap opens the first teaching lesson of
 * the next module. The last module closes in its last prose lesson before the first final_check.
 * A quiz never carries a recap. Pure.
 */
export function recapCarriers(curriculum: unknown): Map<string, RecapPlacement[]> {
  const out = new Map<string, RecapPlacement[]>();
  const modules = (curriculum as Partial<CurriculumFull> | null)?.modules;
  if (!Array.isArray(modules)) return out;
  const add = (lessonId: string, placement: RecapPlacement) => out.set(lessonId, [...(out.get(lessonId) ?? []), placement]);
  modules.forEach((module, index) => {
    const lessons = module.lessons.filter((l) => l.purpose !== "optional_hands_on");
    if (index < modules.length - 1) {
      const last = lessons.at(-1);
      if (last && PROSE_LESSON_TYPES.includes(last.type)) {
        add(last.id, { module_id: module.id, placement: "closing", text: module.recap });
      } else {
        const opening = modules[index + 1].lessons.find((l) => TEACHING_PURPOSES_FOR_RECAP.includes(l.purpose));
        if (opening) add(opening.id, { module_id: module.id, placement: "opening", text: module.recap });
      }
    } else {
      const firstFinal = lessons.findIndex((l) => l.purpose === "final_check");
      const before = firstFinal < 0 ? lessons : lessons.slice(0, firstFinal);
      const carrier = before.filter((l) => PROSE_LESSON_TYPES.includes(l.type)).at(-1);
      if (carrier) add(carrier.id, { module_id: module.id, placement: "closing", text: module.recap });
    }
  });
  return out;
}

/** Longest article body, counted without code blocks. Past it A5 must write the lesson shorter (A3 plans the split). */
export const ARTICLE_MAX_PROSE_CHARS = 9000;
/** How many leaked lesson IDs are listed in one refusal; the rest are counted. */
const LEAK_REPORT_LIMIT = 4;

/** Characters of article text a learner reads: fenced code blocks are left out, the rest is counted as written. */
export function articleProseLength(markdown: string): number {
  // An unclosed fence runs to the end of the text, so the code after it is not counted either.
  return markdown.replace(/```[\s\S]*?(?:```|$)/g, "").length;
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Curriculum lesson IDs that appear in learner-facing text. A whole token only, ignoring case: "L04-02"
 * in "see L04-02" is a leak; "intro" inside "introduction" is not. A short ID that is also an ordinary
 * English word can match it, so IDs should be codes such as "L04-02".
 */
export function lessonIdLeaks(texts: { location: string; text: string }[], ids: string[]): { location: string; id: string }[] {
  const unique = [...new Set(ids.filter((id) => id.trim().length > 0))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_-])(${unique.map(escapeForRegExp).join("|")})(?![\\p{L}\\p{N}_-])`, "giu");
  const leaks: { location: string; id: string }[] = [];
  for (const field of texts) {
    for (const match of field.text.matchAll(pattern)) leaks.push({ location: field.location, id: match[1] });
  }
  return leaks;
}
interface ResearchFull {
  sources: { source_id: string; title: string; url: string; access: string }[];
  topics: { topic: string; why: string; source_ids: string[]; key_points: { point: string; source_ids: string[] }[] }[];
  videos?: ResearchVideoCandidate[];
  misconceptions: { topic: string; misconception: string; correction: string; source_ids: string[] }[];
  tool_versions?: { tool: string; version: string; source_ids: string[] }[];
  stack_choice?: {
    tools: {
      tool_type: string;
      selected: string;
      alternatives_considered: string[];
      basis: "source_recommended" | "context_rule";
      reason: string;
      source_ids: string[];
    }[];
  };
  open_questions?: { question: string; impact: string; blocking: boolean; action: string }[];
}
interface BriefFull {
  locale?: string;
  code_language?: EnabledCodeLanguage | null;
}

/** Trim research topic labels for matching without changing their case or meaning. */
export function normalizeResearchTopic(topic: string): string {
  return topic.trim();
}

/** Videos are available only when their research topic overlaps the lesson's cited sources. */
export function lessonVideoCandidates(
  research: {
    topics: { topic: string; source_ids: string[] }[];
    videos?: ResearchVideoCandidate[];
  },
  lessonSourceIds: string[],
): ResearchVideoCandidate[] {
  const sourceIds = new Set(lessonSourceIds);
  const topicNames = new Set(research.topics
    .filter((topic) => topic.source_ids.some((id) => sourceIds.has(id)))
    .map((topic) => normalizeResearchTopic(topic.topic)));
  return (research.videos ?? []).filter((video) => topicNames.has(normalizeResearchTopic(video.topic)) && isAllowedChannel(video.channel));
}

/**
 * Resolves usable video candidates for a lesson by verifying each candidate through oEmbed.
 * A candidate is usable iff oEmbed returns HTTP 200, provides author_name and author_url,
 * extracts a handle, and that handle matches the channel in ALLOWED_CHANNELS for candidate.channel.
 * Transient errors (5xx, network error) are rethrown so the check is retried instead of treated as dead.
 * Uses cache to avoid redundant oEmbed calls for the same video ID.
 */
export async function usableLessonVideoCandidates(
  candidates: ResearchVideoCandidate[],
  fetchFn: typeof fetch,
  cache: Map<string, Promise<YoutubeOEmbed | null>> = new Map(),
): Promise<ResearchVideoCandidate[]> {
  const usable: ResearchVideoCandidate[] = [];
  for (const c of candidates) {
    const videoId = getYoutubeVideoId(c.url);
    if (!videoId) continue;
    let embedPromise = cache.get(videoId);
    if (!embedPromise) {
      embedPromise = youtubeEmbeddable(videoId, fetchFn);
      cache.set(videoId, embedPromise);
    }
    const embed = await embedPromise;
    if (!embed) continue;
    const expected = findAllowedChannelByName(c.channel);
    if (expected && embed.handle.toLowerCase() === expected.handle.toLowerCase()) {
      usable.push(c);
    }
  }
  return usable;
}

export interface LessonRef {
  lesson: CurriculumLesson;
  moduleId: string;
  /** Position inside its module. */
  order: number;
}

/** Curriculum lessons in teaching order. */
export function lessonRefs(curriculum: unknown): LessonRef[] {
  return (curriculum as CurriculumFull).modules.flatMap((m) => m.lessons.map((lesson, order) => ({ lesson, moduleId: m.id, order })));
}

export function lessonIds(curriculum: unknown): string[] {
  return lessonRefs(curriculum).map((r) => r.lesson.id);
}

function findLesson(ctx: RunContext, lessonId: string): { refs: LessonRef[]; index: number } {
  const refs = lessonRefs(ctx.outputs.curriculum);
  const index = refs.findIndex((r) => r.lesson.id === lessonId);
  if (index < 0) throw new Error(`lesson ${lessonId} không có trong curriculum`);
  return { refs, index };
}

// ---- output schema -----------------------------------------------------------------------------

const str = { type: "string" };
const strList = { type: "array", items: str };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const DIAGRAM = object({
  id: str,
  alt: str,
  title: str,
  nodes: { type: "array", items: object({ id: str, label: str, col: { type: "integer" }, row: { type: "integer" }, shape: { type: "string", enum: ["box", "ellipse"] } }) },
  edges: {
    type: "array",
    items: object({
      from: str,
      to: str,
      style: { type: "string", enum: ["solid", "dashed"] },
      route: { type: "string", enum: ["straight", "arc_above", "arc_below"] },
      label: str,
      crossed: { type: "boolean" },
    }),
  },
});

const CODE_TEST = object({
  id: str,
  type: { type: "string", enum: ["source_equals", "contains", "not_contains"] },
  description: str,
  required: { type: "boolean" },
  value: str,
  accepted_sources: strList,
  failure_message: str,
  hint: str,
});

const CODE_BLANK = object({
  id: str,
  accepted_answers: strList,
  feedback: str,
});

/**
 * The code block of a code_exercise lesson has one mode, the one the curriculum set (code_mode).
 * blanks are filled for fill and tests for edit; the list of the other mode stays empty.
 */
const CODE_BLOCK = object({
  instructions: str,
  language: { type: "string", enum: [...ENABLED_CODE_LANGUAGES] },
  mode: { type: "string", enum: ["fill", "edit"] },
  file_path: str,
  starter_source: str,
  reference_solution: str,
  hints: strList,
  blanks: { type: "array", items: CODE_BLANK },
  tests: { type: "array", items: CODE_TEST },
});

/**
 * One schema for all formats: the block of the lesson's format is filled and the others are null
 * (strict mode needs every key present). Lists are empty rather than null where a format has no use
 * for them; string fields that do not apply are empty strings.
 */
export const LESSON_SCHEMA = object({
  title: str,
  short_description: str,
  duration_seconds: { type: "integer" },
  resources: { type: "array", items: object({ title: str, url: str }) },
  suggested_videos: strList,
  source_ids: strList,
  summary: str,
  article: nullable(object({ description_markdown: str, diagrams: { type: "array", items: DIAGRAM } })),
  quiz: nullable(object({
    questions: {
      type: "array",
      items: object({
        question: str,
        options: { type: "array", items: object({ id: str, text: str }) },
        correct_index: { type: "integer" },
        explanation: str,
      }),
    },
  })),
  code: nullable(CODE_BLOCK),
  practice: nullable(object({
    description_markdown: str,
    mode: { type: "string", enum: ["instruction"] },
    checklist_items: { type: "array", items: object({ id: str, label: str }) },
  })),
  video: nullable(object({
    youtube_url: str,
    start_seconds: { type: "integer" },
    /** 0 plays to the end of the video. */
    end_seconds: { type: "integer" },
    description_markdown: str,
  })),
});

export interface LessonOutput {
  title: string;
  short_description: string;
  duration_seconds: number;
  resources: { title: string; url: string }[];
  suggested_videos: string[];
  source_ids: string[];
  summary: string;
  article: { description_markdown: string; diagrams: (LessonDiagram)[] } | null;
  quiz: { questions: { question: string; options: { id: string; text: string }[]; correct_index: number; explanation: string }[] } | null;
  code: {
    instructions: string;
    language: string;
    mode: "fill" | "edit";
    file_path: string;
    starter_source: string;
    reference_solution: string;
    hints: string[];
    blanks: { id: string; accepted_answers: string[]; feedback: string }[];
    tests: { id: string; type: "source_equals" | "contains" | "not_contains"; description: string; required: boolean; value: string; accepted_sources: string[]; failure_message: string; hint: string }[];
  } | null;
  practice: { description_markdown: string; mode: "instruction"; checklist_items: { id: string; label: string }[] } | null;
  video: { youtube_url: string; start_seconds: number; end_seconds: number; description_markdown: string } | null;
}

const BLOCK_OF: Record<LessonFormat, keyof LessonOutput> = {
  article: "article",
  quiz: "quiz",
  code_exercise: "code",
  practice: "practice",
  video: "video",
};

// ---- input -------------------------------------------------------------------------------------

/** Where one lesson stands in its draft/review loop; the accepted outputs are the newest of each. */
export interface LessonContext {
  /** Accepted drafts and reviews so far. */
  drafts: number;
  reviews: number;
  draft: unknown | null;
  review: unknown | null;
}

/** Blocking items of an A6 review output. */
export function reviewBlocking(review: unknown): string[] {
  const r = review as { issues?: unknown } | null;
  const { issues } = normalizeReviewIssues(r?.issues);
  return issues.filter((i) => i.severity === "blocking").map((i) => `${i.location ?? "?"}: ${i.problem ?? ""}`);
}

/** Prefix the A6 prompt requires on a blocking issue the previous review missed. */
const NEW_ISSUE_PREFIX = "Mới ở vòng này:";

/**
 * True when `review` has a blocking issue that `previous` did not flag: its location is new, or A6
 * marks it as new. Whole-lesson issues share one location, so the location alone cannot tell them apart.
 */
export function hasUnseenBlocking(review: unknown, previous: unknown): boolean {
  const blocking = (r: unknown) =>
    normalizeReviewIssues((r as { issues?: unknown } | null)?.issues).issues.filter((i) => i.severity === "blocking");
  const seen = new Set(blocking(previous).map((i) => i.location ?? "?"));
  return blocking(review).some((i) => !seen.has(i.location ?? "?") || i.problem?.trimStart().startsWith(NEW_ISSUE_PREFIX));
}

/**
 * Review feedback a lesson is being rewritten against: the newest accepted draft was reviewed and
 * the review has blocking items. Null while the draft waits for review or has passed.
 */
export function lessonRevision(lc: LessonContext | null | undefined): { round: number; issues: unknown[] } | null {
  if (!lc || lc.drafts < 1 || lc.reviews !== lc.drafts || !lc.review || reviewBlocking(lc.review).length === 0) return null;
  return { round: lc.reviews, issues: normalizeReviewIssues((lc.review as { issues?: unknown }).issues).issues };
}

/** The part of a lesson's input shared by writer and reviewer. */
/** The brief without what only the brief step needs (its status, assumptions, open questions). */
function lessonBrief(brief: BriefFull): Record<string, unknown> {
  const { status: _status, assumptions: _assumptions, open_questions: _questions, ...rest } = brief as BriefFull & Record<string, unknown>;
  return rest;
}

/** Keys that come first in every lesson input and are the same for all lessons of a run; keep them leading and in this order. */
export const LESSON_SHARED_KEYS = ["course_type", "brief", "code_language", "code_language_guide", "today"] as const;

export function effectiveLessonFormat(cl: CurriculumLesson, draft?: unknown): LessonFormat {
  if (cl.type === "video" && draft && typeof draft === "object") {
    const out = draft as LessonOutput;
    if (out.article && !out.video) return "article";
  }
  return cl.type;
}

export function lessonBase(ctx: RunContext, lessonId: string, draftOverride?: unknown) {
  const curriculum = ctx.outputs.curriculum as CurriculumFull;
  const research = ctx.outputs.research as ResearchFull;
  const brief = ctx.outputs.brief as BriefFull;
  const codeLanguage = resolveCodeLanguage(brief.code_language);
  const codeLanguageAdapter = codeLanguage ? getCodeLanguageAdapter(codeLanguage) : undefined;
  const { refs, index } = findLesson(ctx, lessonId);
  const { lesson, moduleId } = refs[index];
  // A curriculum accepted before code_mode existed is not re-checked on resume; stop before any model call.
  if (lesson.type === "code_exercise" && lesson.code_mode !== "fill" && lesson.code_mode !== "edit") {
    throw new Error(`Bài code "${lesson.id}" của khóa này được lập trước khi có code_mode; cần tạo lại khóa.`);
  }
  const revision = lessonRevision(ctx.lesson);
  const draft = draftOverride ?? (revision ? ctx.lesson?.draft : undefined);
  const effectiveFormat = effectiveLessonFormat(lesson, draft);
  const effectiveLesson: CurriculumLesson = effectiveFormat === lesson.type
    ? lesson
    : { ...lesson, type: effectiveFormat };
  // Checked before any model call that uses this input (the run stops earlier with the same message).
  if (!hasKnowledgeFields(curriculum)) throw new Error(STALE_KNOWLEDGE_MESSAGE);
  const mod = curriculum.modules.find((m) => m.id === moduleId)!;
  const mine = new Set(lesson.source_ids);
  const touches = (ids: string[]) => ids.some((id) => mine.has(id));
  const neighbour = (r: LessonRef | undefined) => r && { id: r.lesson.id, title: r.lesson.title, purpose: r.lesson.purpose, type: r.lesson.type };
  return {
    ref: refs[index],
    effectiveFormat,
    effectiveLesson,
    locale: brief.locale,
    // The fields of LESSON_SHARED_KEYS are the same for every lesson of the run and come first: they
    // are a separate cached block of the request, so the lesson-specific part must follow them.
    common: {
      course_type: "ai_generated",
      brief: { ...lessonBrief(brief), code_language: codeLanguage },
      code_language: codeLanguage,
      ...(codeLanguageAdapter ? { code_language_guide: codeLanguageAdapter.guide } : {}),
      today: ctx.today,
      platform_format: PLATFORM_FORMAT_GUIDE[effectiveFormat],
      lesson: effectiveLesson,
      module: {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        first_teaching_lesson_id: mod.lessons.find((candidate) => candidate.purpose === "explanation" || candidate.purpose === "worked_example")?.id,
      },
      outcomes: curriculum.outcomes.filter((o) => lesson.outcome_ids.includes(o.id)),
      research: {
        sources: research.sources.filter((s) => mine.has(s.source_id) && s.access === "read"),
        topics: research.topics
          .filter((t) => touches(t.source_ids))
          .map((t) => ({ ...t, key_points: t.key_points.filter((k) => touches(k.source_ids)) })),
        // The writer answers with video IDs, so the ID is given instead of left to be read out of the URL.
        videos: lessonVideoCandidates(research, lesson.source_ids).map((video) => ({ ...video, video_id: getYoutubeVideoId(video.url) })),
        ...(research.stack_choice ? { stack_choice: research.stack_choice } : {}),
        tool_versions: (research.tool_versions ?? []).filter((v) => touches(v.source_ids)),
        misconceptions: research.misconceptions.filter((m) => touches(m.source_ids)),
        open_questions: (research.open_questions ?? []).filter((q) => !q.blocking),
      },
    },
    neighbours: {
      previous_lesson: neighbour(refs[index - 1]) ?? null,
      next_lesson: neighbour(refs[index + 1]) ?? null,
      review_lessons: lesson.review_lesson_ids.flatMap((id) => {
        const r = refs.find((x) => x.lesson.id === id);
        return r ? [{ id, title: r.lesson.title }] : [];
      }),
      // Lessons referred to by title only: the text must not carry a lesson ID (see acceptLesson).
      prerequisite_lessons: lesson.prerequisite_lesson_ids.flatMap((id) => {
        const r = refs.find((x) => x.lesson.id === id);
        return r ? [{ title: r.lesson.title }] : [];
      }),
      // The recap this lesson writes, if it carries one (decision 03/11/2026): none for most lessons.
      recap_to_write: recapCarriers(curriculum).get(lessonId) ?? [],
    },
  };
}

export function buildLessonInput(ctx: RunContext, lessonId: string): Record<string, unknown> {
  const { common, neighbours } = lessonBase(ctx, lessonId);
  const revision = lessonRevision(ctx.lesson);
  return {
    ...common,
    ...neighbours,
    ...(revision ? { previous_draft: ctx.lesson!.draft, review: revision } : {}),
  };
}

/** Input of the lesson reviewer: the lesson as the app will store it, plus what the code already checked. */
export function buildLessonReviewInput(ctx: RunContext, lessonId: string): Record<string, unknown> {
  const lc = ctx.lesson;
  if (!lc?.draft) throw new Error(`lesson ${lessonId} chưa có bản nháp được nhận`);
  const { ref, effectiveFormat, locale, common, neighbours } = lessonBase(ctx, lessonId, lc.draft);
  return {
    ...common,
    ...neighbours,
    review_round: lc.reviews + 1,
    // The author rewrote the draft from these issues; the reviewer verifies them before raising new ones.
    ...(lc.reviews > 0 && lc.review ? { previous_review: { round: lc.reviews, issues: normalizeReviewIssues((lc.review as { issues?: unknown }).issues).issues } } : {}),
    lesson_draft: toLessonDraft(ref, lc.draft as LessonOutput, locale, ctx.outputs.research as ResearchFull),
    checks_already_run: checksAlreadyRun(
      effectiveFormat,
      resolveCodeLanguage((ctx.outputs.brief as BriefFull).code_language),
      ref.lesson.code_mode ?? null,
    ),
  };
}

/** What acceptLesson verified before the draft reached the reviewer, so the reviewer does not repeat it. */
export function checksAlreadyRun(format: LessonFormat, codeLanguage: EnabledCodeLanguage | null = "rust", codeMode: "fill" | "edit" | null = null): string[] {
  const common = [
    "Quy tắc publish của app cho lesson (validateLesson): tiêu đề, cấu hình theo format.",
    "source_ids nằm trong source_ids của lesson ở curriculum; resource do A5 viết thuộc nguồn research đã đọc; suggested video thuộc ứng viên lesson và oEmbed/handle kênh đã được kiểm.",
  ];
  const byFormat: Record<LessonFormat, string[]> = {
    article: ["Markdown và diagrams khớp hai chiều; bài explanation có ít nhất 1 sơ đồ; bố cục sơ đồ vẽ được (không chồng nét, không đi xuyên node)."],
    quiz: ["Mỗi câu có ≥ 2 phương án, id duy nhất, correct_index hợp lệ, có giải thích. CHƯA kiểm tra đáp án đúng về nội dung."],
    code_exercise: [
      `code_language=${codeLanguage ?? "null"}; tệp có đuôi hợp lệ.`,
      // V-55: the two modes are checked differently; a fill exercise has no tests, so no test claim applies to it.
      ...(codeMode === "fill"
        ? ["code_mode fill: đáp án mẫu khớp accepted_answers của từng chỗ trống (code kiểm khi publish); mỗi chỗ có feedback; tests rỗng. Starter chưa điền đạt hay không CHƯA được code kiểm."]
        : codeMode === "edit"
          ? ["code_mode edit: reference_solution đạt mọi test bắt buộc (code kiểm khi publish); blanks rỗng. Starter không đạt mọi test bắt buộc CHƯA được code kiểm."]
          : ["code_mode chưa xác định: không có kiểm tra code nào được ghi nhận."]),
      `CHƯA biên dịch hay chạy mã ${codeLanguage ?? "đã chọn"}; đúng/sai của mã và test chưa được kiểm chứng bằng công cụ.`,
      "Đã kiểm lộ đáp án dạng định danh nguyên từ trong hints, feedback, failure_message và hint của test theo accepted_answers/value của test contains.",
    ],
    practice: ["Chỉ mode instruction, không bài nộp; không checklist."],
    video: ["Video ID thuộc ứng viên research của lesson, oEmbed trả 200 và handle kênh khớp channel ứng viên. CHƯA kiểm tra nội dung, độ dài hay ngôn ngữ video."],
  };
  return [...common, ...byFormat[format]];
}

/** A5 uses only the video candidates supplied by research. */
export function lessonTools(lessonId: string, ctx: RunContext): Record<string, unknown>[] | undefined {
  findLesson(ctx, lessonId);
  return undefined;
}

/** The reviewer checks claims against sources and may need to search. */
/**
 * The reviewer checks the lesson against the sources the research step already read; a claim that
 * would need a new source is reported as unverified. It runs for every lesson of every revision, and
 * each search is billed per call plus its content tokens.
 */
export function reviewTools(): Record<string, unknown>[] | undefined {
  return undefined;
}

// ---- output -> app record ----------------------------------------------------------------------

/** quiz_config.passing_ratio from the curriculum's percentage (every quiz has one). */
export function quizPassingRatio(passThreshold: number): number {
  return passThreshold / 100;
}

function nonEmpty<T>(items: T[]): T[] | undefined {
  return items.length ? items : undefined;
}

function codeConfig(code: NonNullable<LessonOutput["code"]>): CodeExerciseConfig {
  // A draft saved before the one-mode contract (two-part code) has no mode; a new run cannot produce one.
  if (code.mode !== "fill" && code.mode !== "edit") {
    throw new Error("Bài code của lượt này theo định dạng hai phần đã bỏ; cần tạo lại khóa.");
  }
  const tests: CodeExerciseTest[] = code.tests.map((t) => ({
    id: t.id,
    description: t.description,
    required: t.required,
    ...(t.failure_message ? { failure_message: t.failure_message } : {}),
    ...(t.hint ? { hint: t.hint } : {}),
    ...(t.type === "source_equals"
      ? { type: "source_equals" as const, accepted_sources: t.accepted_sources }
      : { type: t.type, value: t.value }),
  }));
  const base = {
    schema_version: 1 as const,
    revision: 1,
    language: code.language,
    file: { path: code.file_path, starter_source: code.starter_source },
    reference_solution: code.reference_solution,
    ...(code.hints.length ? { hints: code.hints } : {}),
  };
  return code.mode === "fill"
    ? {
      ...base,
      mode: "fill",
      blanks: code.blanks.map((b) => ({ id: b.id, accepted_answers: b.accepted_answers, ...(b.feedback ? { feedback: b.feedback } : {}) })),
    }
    : { ...base, mode: "edit", tests };
}

/** The app's lesson record for one accepted (or candidate) model output. Pure. */
export function toLessonDraft(
  ref: LessonRef,
  out: LessonOutput,
  locale: string | undefined,
  research?: Parameters<typeof lessonVideoCandidates>[0],
): LessonDraft {
  const { lesson: cl, moduleId, order } = ref;
  const candidateById = new Map<string, ResearchVideoCandidate>();
  if (research) {
    for (const candidate of lessonVideoCandidates(research, cl.source_ids)) {
      const id = getYoutubeVideoId(candidate.url);
      if (id && !candidateById.has(id)) candidateById.set(id, candidate);
    }
  }
  const suggestedResources: { title: string; url: string }[] = [];
  const addedVideoIds = new Set<string>();
  for (const videoId of Array.isArray(out.suggested_videos) ? out.suggested_videos : []) {
    const candidate = candidateById.get(videoId);
    if (!candidate || addedVideoIds.has(videoId)) continue;
    addedVideoIds.add(videoId);
    suggestedResources.push({
      title: `Video: ${candidate.title} — ${candidate.channel}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  const resources = [...out.resources, ...suggestedResources];
  const lesson: LessonDraft["lesson"] = {
    id: cl.id,
    section_id: moduleId,
    title: out.title,
    short_description: out.short_description,
    ...(nonEmpty(resources) ? { resources } : {}),
    lesson_format: cl.type,
    duration_seconds: out.duration_seconds,
    order,
  };
  const questions: QuestionData[] = [];
  const diagrams: LessonDiagram[] = [];
  if (cl.type === "article" && out.article) {
    lesson.description_markdown = out.article.description_markdown;
    diagrams.push(...out.article.diagrams);
  } else if (cl.type === "quiz" && out.quiz) {
    lesson.quiz_config = { passing_ratio: quizPassingRatio(cl.pass_threshold!), allow_retry: true };
    questions.push(...out.quiz.questions.map((q) => ({
      type: "mcq" as const,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      ...(locale ? { locale } : {}),
    })));
  } else if (cl.type === "code_exercise" && out.code) {
    lesson.code_exercise_config = codeConfig(out.code);
    lesson.code_exercise_locale = { instructions: out.code.instructions };
  } else if (cl.type === "practice" && out.practice) {
    lesson.description_markdown = out.practice.description_markdown;
    lesson.practice_config = {
      mode: "instruction",
      requires_review: false,
    };
  } else if (cl.type === "video" && out.video) {
    const id = getYoutubeVideoId(out.video.youtube_url);
    // The publish gate wants https and a watch/embed/shorts/youtu.be URL, so store the canonical one.
    lesson.youtube_url = id ? `https://www.youtube.com/watch?v=${id}` : out.video.youtube_url;
    lesson.youtube_start_seconds = out.video.start_seconds;
    lesson.youtube_end_seconds = out.video.end_seconds > 0 ? out.video.end_seconds : null;
    lesson.description_markdown = out.video.description_markdown.trim();
  } else if (cl.type === "video" && out.article && !out.video) {
    lesson.lesson_format = "article";
    lesson.description_markdown = out.article.description_markdown;
    diagrams.push(...out.article.diagrams);
  }
  return { lesson, questions, diagrams, source_ids: out.source_ids, summary: out.summary };
}

// ---- acceptance --------------------------------------------------------------------------------

/** The check could not be made (network, 5xx); the response stays unread and is polled again. */
export class TransientError extends Error {}

export interface YoutubeOEmbed {
  author_name: string;
  author_url: string;
  handle: string;
}

/** HTTP 200 with author_name and author_url handle means the video exists and can be embedded. */
export async function youtubeEmbeddable(videoId: string, fetchFn: typeof fetch): Promise<YoutubeOEmbed | null> {
  const watch = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  let res: Response;
  try {
    res = await fetchFn(`https://www.youtube.com/oembed?url=${watch}&format=json`);
  } catch (e) {
    throw new TransientError(`oEmbed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status === 200) {
    try {
      const body: unknown = await res.json();
      if (
        body && typeof body === "object" &&
        "author_name" in body && typeof body.author_name === "string" && body.author_name.trim() &&
        "author_url" in body && typeof body.author_url === "string" && body.author_url.trim()
      ) {
        const handle = extractChannelHandle(body.author_url);
        if (handle) {
          return {
            author_name: body.author_name.trim(),
            author_url: body.author_url.trim(),
            handle,
          };
        }
      }
      return null;
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw new TransientError(`oEmbed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await res.body?.cancel();
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  throw new TransientError(`oEmbed: HTTP ${res.status}`);
}

const DIAGRAM_REF = /!\[[^\]]*\]\(diagram:([^)\s]+)\)/g;
const MARKDOWN_URL = /(?:https?:)?\/\/[^\s<>"')\]]+/gi;
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"]);

function youtubeLinks(text: string): { url: string; videoId: string | null }[] {
  const links: { url: string; videoId: string | null }[] = [];
  for (const match of text.matchAll(MARKDOWN_URL)) {
    const url = match[0].replace(/[.,!?;:]+$/, "");
    const parseableUrl = url.startsWith("//") ? `https:${url}` : url;
    let host: string;
    try {
      host = new URL(parseableUrl).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      const authority = /^https?:\/\/([^/?#]*)/i.exec(parseableUrl)?.[1] ?? "";
      host = (authority.split("@").at(-1) ?? "").split(":")[0].toLowerCase().replace(/^www\./, "");
    }
    if (YOUTUBE_HOSTS.has(host)) links.push({ url, videoId: getYoutubeVideoId(parseableUrl) });
  }
  return links;
}


/** Text saved in learner-visible fields; summary and code samples are not rendered as lesson copy. */
/** Diagram text a learner sees: the alt text, the title, node labels and edge labels. */
function diagramTextFields(diagrams: LessonDiagram[]): { location: string; text: string }[] {
  const fields: { location: string; text: string }[] = [];
  diagrams.forEach((diagram, index) => {
    const at = `diagrams[${index}]`;
    fields.push({ location: `${at}.alt`, text: diagram.alt ?? "" });
    fields.push({ location: `${at}.title`, text: diagram.title ?? "" });
    diagram.nodes.forEach((node, n) => fields.push({ location: `${at}.nodes[${n}].label`, text: node.label ?? "" }));
    diagram.edges.forEach((edge, e) => fields.push({ location: `${at}.edges[${e}].label`, text: edge.label ?? "" }));
  });
  return fields.filter((f) => f.text.length > 0);
}

function learnerTextFields(draft: LessonDraft): { location: string; text: string }[] {
  const fields: { location: string; text: string }[] = [];
  const add = (location: string, value: unknown) => {
    if (typeof value === "string" && value.length > 0) fields.push({ location, text: value });
  };
  const lesson = draft.lesson;
  add("lesson.title", lesson.title);
  add("lesson.short_description", lesson.short_description);
  add("lesson.description_markdown", lesson.description_markdown);
  add("lesson.code_exercise_locale.instructions", lesson.code_exercise_locale?.instructions);
  (lesson.resources ?? []).forEach((resource, index) => {
    add(`lesson.resources[${index}].title`, resource.title);
    add(`lesson.resources[${index}].url`, resource.url);
  });
  draft.questions.forEach((question, index) => {
    add(`questions[${index}].question`, question.question);
    question.options.forEach((option, optionIndex) => add(`questions[${index}].options[${optionIndex}].text`, option.text));
    add(`questions[${index}].explanation`, question.explanation);
  });
  const code = lesson.code_exercise_config;
  if (code) {
    (code.hints ?? []).forEach((hint, index) => add(`lesson.code_exercise_config.hints[${index}]`, hint));
    if (code.mode === "fill") {
      code.blanks.forEach((blank, index) => add(`lesson.code_exercise_config.blanks[${index}].feedback`, blank.feedback));
    }
    (code.tests ?? []).forEach((test, index) => {
      add(`lesson.code_exercise_config.tests[${index}].description`, test.description);
      add(`lesson.code_exercise_config.tests[${index}].failure_message`, test.failure_message);
      add(`lesson.code_exercise_config.tests[${index}].hint`, test.hint);
    });
  }
  return fields;
}

/** Markdown references and diagram specs must match both ways, and every layout must be drawable. */
export function diagramProblems(markdown: string, diagrams: LessonDiagram[]): string[] {
  const problems: string[] = [];
  const ids = diagrams.map((d) => d.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id)) problems.push("ID sơ đồ trống hoặc trùng");
  const referenced = [...markdown.matchAll(DIAGRAM_REF)].map((m) => m[1]);
  for (const id of referenced) if (!ids.includes(id)) problems.push(`markdown tham chiếu sơ đồ ${id} không có trong diagrams`);
  for (const id of ids) if (!referenced.includes(id)) problems.push(`sơ đồ ${id} không được tham chiếu trong markdown`);
  for (const d of diagrams) {
    if (!d.alt.trim()) problems.push(`sơ đồ ${d.id} thiếu alt`);
    for (const p of checkDiagram(d)) problems.push(`sơ đồ ${d.id}: ${p}`);
  }
  return problems;
}

function quizProblems(quiz: NonNullable<LessonOutput["quiz"]>, draft: LessonDraft, purpose: string): string[] {
  const problems: string[] = [];
  const minimum = minQuizQuestions(purpose);
  if (quiz.questions.length < minimum) problems.push(`quiz phải có ít nhất ${minimum} câu hỏi`);
  draft.questions.forEach((q, i) => {
    for (const code of validateQuestion(q)) problems.push(`câu ${i + 1}: ${code}`);
    if (!q.explanation?.trim()) problems.push(`câu ${i + 1}: thiếu giải thích`);
  });
  return problems;
}

function answerLeakProblems(code: NonNullable<LessonOutput["code"]>): string[] {
  const problems: string[] = [];

  const hasWholeIdentifier = (text: string, identifier: string): boolean => {
    for (let start = text.indexOf(identifier); start >= 0; start = text.indexOf(identifier, start + 1)) {
      const before = start > 0 ? text[start - 1] : "";
      const after = text[start + identifier.length] ?? "";
      if (!/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after)) return true;
    }
    return false;
  };

  const checkLeaks = (answers: Set<string>, texts: { location: string; value: string }[]) => {
    for (const { location, value } of texts) {
      if (typeof value !== "string" || !value) continue;
      for (const answer of answers) {
        if (hasWholeIdentifier(value, answer)) problems.push(`${location} lộ đáp án định danh "${answer}"`);
      }
    }
  };

  // Identifiers a blank or a contains test asks for must not appear in the words the learner reads.
  const answers = new Set<string>();
  for (const blank of code.blanks) {
    for (const answer of blank.accepted_answers) {
      const identifier = answer.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]{2,}$/.test(identifier)) answers.add(identifier);
    }
  }
  for (const test of code.tests) {
    if (test.type !== "contains") continue;
    const identifier = test.value.trim();
    if (/^[A-Za-z_][A-Za-z0-9_]{2,}$/.test(identifier)) answers.add(identifier);
  }

  const texts: { location: string; value: string }[] = [];
  code.hints.forEach((value, index) => texts.push({ location: `code.hints[${index}]`, value }));
  code.blanks.forEach((blank, index) => texts.push({ location: `code.blanks[${index}].feedback`, value: blank.feedback }));
  code.tests.forEach((test, index) => {
    texts.push({ location: `code.tests[${index}].failure_message`, value: test.failure_message });
    texts.push({ location: `code.tests[${index}].hint`, value: test.hint });
  });
  checkLeaks(answers, texts);

  return problems;
}

function codeProblems(
  code: NonNullable<LessonOutput["code"]>,
  config: CodeExerciseConfig,
  expectedLanguage: EnabledCodeLanguage | null,
): string[] {
  const problems: string[] = [];
  const adapter = getCodeLanguageAdapter(code.language);
  if (adapter?.status === "prepared") problems.push(`ngôn ngữ ${adapter.id} chưa hỗ trợ publish`);
  else if (!isEnabledCodeLanguage(code.language)) problems.push(`ngôn ngữ ${code.language} chưa hỗ trợ publish`);
  if (expectedLanguage === null) {
    problems.push("brief.code_language = null nên khóa không hỗ trợ code_exercise");
  } else if (code.language !== expectedLanguage) {
    problems.push(`language phải khớp code_language của khóa (${expectedLanguage})`);
  }
  if (!code.instructions?.trim()) problems.push("thiếu hướng dẫn (instructions)");
  if (adapter && !validCodeFile(code.file_path, code.language)) {
    problems.push(`file_path "${code.file_path}" phải là tên tệp trần có đuôi hợp lệ cho ${code.language}`);
  }
  if (code.mode === "fill") {
    if (code.blanks.length === 0) problems.push("mode fill phải có ít nhất 1 blank");
    if (code.tests.length > 0) problems.push("mode fill không có tests");
    // Translation sends each feedback and requires a translated one, so an empty feedback would fail later.
    for (const blank of code.blanks) {
      if (!blank.feedback?.trim()) problems.push(`blank ${blank.id} thiếu feedback`);
    }
  } else {
    if (code.blanks.length > 0) problems.push("mode edit không có blanks");
    if (code.tests.length === 0) problems.push("mode edit phải có ít nhất 1 test");
  }
  for (const t of code.tests) {
    if (t.type === "source_equals" ? t.accepted_sources.length === 0 : !t.value) {
      problems.push(`test ${t.id} thiếu ${t.type === "source_equals" ? "accepted_sources" : "value"}`);
    }
  }

  problems.push(...answerLeakProblems(code));
  if (problems.length > 0) return problems;

  const errors = validateCodeConfig(config, true);
  if (errors.length > 0) return errors.map((e) => `code_exercise_config: ${e}`);

  return problems;
}

export async function acceptLesson(output: unknown, ctx: RunContext, lessonId: string, fetchFn: typeof fetch = fetch): Promise<Acceptance> {
  const out = output as LessonOutput;
  const { refs, index } = findLesson(ctx, lessonId);
  const ref = refs[index];
  const research = ctx.outputs.research as ResearchFull;
  const candidates = lessonVideoCandidates(research, ref.lesson.source_ids);
  const oembedCache = new Map<string, Promise<YoutubeOEmbed | null>>();

  let isVideoArticleFallback = false;
  if (ref.lesson.type === "video" && out.article != null && out.video == null) {
    const usable = await usableLessonVideoCandidates(candidates, fetchFn, oembedCache);
    if (usable.length > 0) {
      return {
        ok: false,
        reason: `Lesson video "${lessonId}" vẫn còn video ứng viên dùng được trong research (${usable.map((c) => c.url).join(", ")}); không được tự ý chuyển sang article.`,
      };
    }
    isVideoArticleFallback = true;
  }

  const format: LessonFormat = isVideoArticleFallback ? "article" : ref.lesson.type;
  const problems: string[] = [];
  const candidateById = new Map<string, ResearchVideoCandidate>();
  for (const candidate of candidates) {
    const id = getYoutubeVideoId(candidate.url);
    if (id && !candidateById.has(id)) candidateById.set(id, candidate);
  }
  // Suggested videos are optional "Xem thêm" extras: one that cannot be used is dropped and noted, it is
  // not a reason to refuse a lesson that is otherwise sound.
  const droppedVideos: string[] = [];
  const keptVideoIds: string[] = [];
  if (out.suggested_videos !== undefined && !Array.isArray(out.suggested_videos)) droppedVideos.push("suggested_videos phải là mảng video ID");
  const suggestedVideoIds = Array.isArray(out.suggested_videos) ? out.suggested_videos : [];
  for (const [index, videoId] of suggestedVideoIds.entries()) {
    if (typeof videoId !== "string" || !videoId.trim()) droppedVideos.push(`suggested_videos[${index}] phải là video ID`);
    else if (keptVideoIds.includes(videoId)) droppedVideos.push(`suggested_videos[${index}] bị trùng video ID`);
    else if (!candidateById.has(videoId)) droppedVideos.push(`suggested_videos[${index}] ${videoId} không thuộc ứng viên của lesson`);
    else if (keptVideoIds.length >= 2) droppedVideos.push(`suggested_videos[${index}] vượt tối đa 2 video`);
    else keptVideoIds.push(videoId);
  }

  const blockKey = BLOCK_OF[format];
  if (out[blockKey] == null) problems.push(`thiếu khối ${blockKey} cho lesson ${format}`);
  for (const [f, key] of Object.entries(BLOCK_OF)) if (f !== format && out[key] != null) problems.push(`khối ${key} phải null cho lesson ${format}`);

  if (!(Number.isInteger(out.duration_seconds) && out.duration_seconds > 0)) problems.push("duration_seconds phải là số nguyên dương");
  if (!out.summary.trim()) problems.push("thiếu summary");
  const allowed = new Set(ref.lesson.source_ids);
  const strays = out.source_ids.filter((id) => !allowed.has(id));
  if (strays.length > 0) problems.push(`source_ids ngoài curriculum: ${strays.join(", ")}`);
  if (out.source_ids.length === 0) problems.push("thiếu source_ids");

  const readUrls = new Set(research.sources.filter((s) => s.access === "read").map((s) => s.url));
  for (const [index, r] of out.resources.entries()) {
    if (youtubeLinks(r.url).length > 0) {
      problems.push(`resources[${index}]: video xem thêm phải được chọn qua suggested_videos`);
    } else if (!readUrls.has(r.url)) {
      problems.push(`resource ${r.url} không thuộc nguồn đã đọc`);
    }
  }
  for (const code of validateResources(out.resources)) problems.push(`resources: ${code}`);

  if (problems.length > 0) return { ok: false, reason: `Lesson ${lessonId} chưa hợp lệ: ${list(problems)}` };

  const locale = (ctx.outputs.brief as BriefFull).locale;
  // Without the suggested videos: the resources the code builds from them are not text the model wrote.
  const draft = toLessonDraft(ref, { ...out, suggested_videos: [] }, locale, research);
  for (const { field, code } of validateLesson(draft.lesson)) problems.push(`${field}: ${code}`);
  // The learner reads the lesson's own text and diagram labels; a curriculum lesson ID there leaks internal codes.
  const idLeaks = lessonIdLeaks(
    [...learnerTextFields(draft), ...diagramTextFields(draft.diagrams)],
    lessonIds(ctx.outputs.curriculum),
  );
  for (const leak of idLeaks.slice(0, LEAK_REPORT_LIMIT)) {
    problems.push(`${leak.location}: lộ mã bài "${leak.id}" trong nội dung người học đọc; hãy viết tiêu đề bài thay cho mã`);
  }
  if (idLeaks.length > LEAK_REPORT_LIMIT) problems.push(`còn ${idLeaks.length - LEAK_REPORT_LIMIT} chỗ lộ mã bài khác`);
  if (format === "article") {
    problems.push(...diagramProblems(out.article!.description_markdown, out.article!.diagrams));
    if (ref.lesson.purpose === "explanation" && out.article!.diagrams.length === 0) {
      problems.push("lesson article mang purpose explanation phải có ít nhất 1 sơ đồ");
    }
    const prose = articleProseLength(out.article!.description_markdown);
    if (prose > ARTICLE_MAX_PROSE_CHARS) {
      problems.push(`bài đọc dài ${prose} ký tự (không tính code), vượt giới hạn ${ARTICLE_MAX_PROSE_CHARS}; viết gọn lại, giữ đủ ý chính và bỏ phần dư`);
    }
  }
  if (format === "quiz") problems.push(...quizProblems(out.quiz!, draft, ref.lesson.purpose));
  if (format === "code_exercise") {
    if (!out.code) {
      problems.push("thiếu khối code");
    } else {
      if (out.code.mode !== ref.lesson.code_mode) {
        problems.push(`code.mode "${out.code.mode}" phải khớp code_mode của lesson ("${ref.lesson.code_mode ?? "null"}")`);
      }
      problems.push(...codeProblems(
        out.code,
        draft.lesson.code_exercise_config!,
        resolveCodeLanguage((ctx.outputs.brief as BriefFull).code_language),
      ));
    }
  }
  if (format === "practice") {
    const p = out.practice!;
    if (p.mode !== "instruction") problems.push("practice của khóa AI chỉ hỗ trợ mode instruction");
    if (p.checklist_items.length > 0) problems.push("mode instruction không có checklist_items");
    if (ref.lesson.purpose !== "optional_hands_on") {
      problems.push("lesson practice phải có purpose optional_hands_on");
    }
  }
  if (problems.length > 0) return { ok: false, reason: `Lesson ${lessonId} chưa hợp lệ: ${list(problems)}` };

  const targets: { videoId: string; candidate: ResearchVideoCandidate; location: string }[] = [];
  const targetIds = new Set<string>();
  // A video the lesson itself needs (a video lesson, a link the model wrote in its text) must pass; a suggestion need not.
  const requiredIds = new Set<string>();
  const addTarget = (videoId: string, candidate: ResearchVideoCandidate, location: string) => {
    if (targetIds.has(videoId)) return;
    targetIds.add(videoId);
    targets.push({ videoId, candidate, location });
  };
  if (format === "video") {
    const v = out.video;
    if (!v) {
      problems.push("thiếu khối video cho lesson video");
    } else {
      if (v.start_seconds !== 0 || v.end_seconds !== 0) {
        problems.push("video: start_seconds và end_seconds phải bằng 0 (khóa AI không cắt đoạn video)");
      }
      if (!v.description_markdown.trim()) {
        problems.push("video: thiếu description_markdown (mục tiêu, ý chính)");
      } else if (/self-check|checklist|tự kiểm tra|tự đánh giá|tự thử|self-assessment/i.test(v.description_markdown)) {
        problems.push("video: không dùng checklist hoặc tự đánh giá dưới video");
      }
      const id = getYoutubeVideoId(v.youtube_url);
      const candidate = id ? candidateById.get(id) : null;
      if (!candidate) {
        problems.push(`video ${id ?? v.youtube_url} không có trong research.videos phù hợp với lesson`);
      } else if (!isAllowedChannel(candidate.channel)) {
        problems.push(`video ${id} thuộc kênh "${candidate.channel}" không nằm trong danh sách kênh cho phép`);
      } else {
        addTarget(id!, candidate, "lesson.youtube_url");
        requiredIds.add(id!);
      }
    }
  }
  for (const field of learnerTextFields(draft)) {
    for (const link of youtubeLinks(field.text)) {
      if (!link.videoId) {
        problems.push(`${field.location}: link YouTube không hợp lệ: ${link.url}`);
        continue;
      }
      const candidate = candidateById.get(link.videoId);
      if (!candidate) {
        problems.push(`${field.location}: video ${link.videoId} ngoài research.videos phù hợp với lesson`);
        continue;
      }
      addTarget(link.videoId, candidate, field.location);
      requiredIds.add(link.videoId);
    }
  }
  for (const [index, videoId] of keptVideoIds.entries()) addTarget(videoId, candidateById.get(videoId)!, `suggested_videos[${index}]`);
  if (problems.length > 0) return { ok: false, reason: `Lesson ${lessonId} chưa hợp lệ: ${list(problems)}` };

  const unusable = new Set<string>();
  for (const { videoId, candidate, location } of targets) {
    let embedPromise = oembedCache.get(videoId);
    if (!embedPromise) {
      embedPromise = youtubeEmbeddable(videoId, fetchFn);
      oembedCache.set(videoId, embedPromise);
    }
    const embed = await embedPromise;
    const expected = findAllowedChannelByName(candidate.channel);
    const problem = !embed
      ? `${location}: video ${videoId} không tồn tại, không nhúng được hoặc thiếu author_name/author_url (oEmbed)`
      : !expected || embed.handle.toLowerCase() !== expected.handle.toLowerCase()
      ? `${location}: handle kênh không khớp channel research cho video ${videoId} (nhận "${embed.author_name}" ${embed.handle}, cần "${candidate.channel}" ${expected?.handle ?? "unknown"})`
      : null;
    if (!problem) continue;
    if (requiredIds.has(videoId)) {
      if (format === "video" && location === "lesson.youtube_url") {
        const usable = await usableLessonVideoCandidates(candidates, fetchFn, oembedCache);
        if (usable.length === 0) {
          problems.push(`${problem}. Lesson video "${lessonId}" không có video ứng viên nào có thể nhúng được qua oEmbed; hãy chuyển sang viết bài dạng article với đầy đủ khối article và video: null`);
        } else {
          problems.push(`${problem}. Hãy chọn video ứng viên khác trong research có thể nhúng được: ${usable.map((c) => c.url).join(", ")}`);
        }
      } else {
        problems.push(problem);
      }
    } else {
      unusable.add(videoId);
      droppedVideos.push(problem);
    }
  }
  if (problems.length > 0) return { ok: false, reason: `Lesson ${lessonId} chưa hợp lệ: ${list(problems)}` };
  const note = droppedVideos.length > 0 ? ` Bỏ video xem thêm: ${list(droppedVideos)}.` : "";
  const formatLabel = isVideoArticleFallback ? "article (chuyển từ video)" : format;
  return {
    ok: true,
    summary: `${formatLabel} ${lessonId} đạt (${draft.lesson.title}).${note}`,
    ...(droppedVideos.length > 0 ? { normalizedOutput: { ...out, suggested_videos: keptVideoIds.filter((id) => !unusable.has(id)) } } : {}),
  };
}

function list(items: string[], max = 4): string {
  return items.slice(0, max).join("; ") + (items.length > max ? ` (+${items.length - max})` : "");
}


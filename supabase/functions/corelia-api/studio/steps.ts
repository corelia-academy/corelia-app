import { LESSONS_PER_TICK, planLessons, type LessonAction, type LessonGeneration } from "./lesson_flow.ts";
import { acceptLessonReview, LESSON_REVIEW_SCHEMA } from "./lesson_review.ts";
import {
  acceptLesson,
  buildLessonInput,
  buildLessonReviewInput,
  normalizeResearchTopic,
  LESSON_SCHEMA,
  lessonTools,
  reviewTools,
  type LessonContext,
} from "./lessons.ts";
import {
  ENABLED_CODE_LANGUAGES,
  getCodeLanguageAdapter,
  getYoutubeVideoId,
  resolveCodeLanguage,
  type EnabledCodeLanguage,
} from "./lesson_ports.ts";
import { PROMPTS, promptVersion, type AgentRole, type PromptKey } from "./prompts.ts";
import type { BriefCatalogResearch } from "./catalog_research_brief.ts";

export const STEP_ORDER = [
  "brief",
  "research",
  "curriculum",
  "curriculum_review",
  "lessons",
  "lesson_review",
  "structure_check",
  "journey_test",
  "publish",
] as const;
export type StepKey = typeof STEP_ORDER[number];
export type StepState = "pending" | "active" | "done" | "failed";

export const STEP_LABEL: Record<StepKey, string> = {
  brief: "Chuẩn bị brief",
  research: "Nghiên cứu",
  curriculum: "Curriculum",
  curriculum_review: "Kiểm tra curriculum",
  lessons: "Tạo lesson",
  lesson_review: "Kiểm tra lesson",
  structure_check: "Kiểm tra cấu trúc",
  journey_test: "Kiểm thử hành trình",
  publish: "Publish",
};

/**
 * Who runs each step: an agent role (one OpenAI key per role) or deterministic code (no key).
 * A1 Catalog Research belongs to the Catalog flow, not to a course run, so it owns no step here.
 */
export const STEP_OWNER: Record<StepKey, AgentRole | "code"> = {
  brief: "A2",
  research: "A2",
  curriculum: "A3",
  curriculum_review: "A4",
  lessons: "A5",
  lesson_review: "A6",
  structure_check: "code",
  journey_test: "code",
  publish: "code",
};

/** Agent names in flow order (Catalog first, then the course run); used in env var and key names. */
export const AGENT_NAME: Record<AgentRole, string> = {
  A1: "CATALOG_RESEARCH",
  A2: "COURSE_RESEARCH",
  A3: "CURRICULUM",
  A4: "CURRICULUM_REVIEW",
  A5: "LESSON",
  A6: "LESSON_REVIEW",
};

/** Env var holding the OpenAI key of each agent, so usage and billing are tracked per agent. */
export function agentKeyEnv(role: AgentRole): string {
  return `CORELIA_STUDIO_${role}_${AGENT_NAME[role]}_OPENAI_API_KEY`;
}

export { PLATFORM_FORMAT_GUIDE, PLATFORM_FORMATS } from "./formats.ts";
import { AI_CURRICULUM_FORMAT_GUIDE, AI_CURRICULUM_FORMATS, PLATFORM_FORMAT_GUIDE } from "./formats.ts";
import { canRetry, roundFailures, type FailureKind, type RoundFailures } from "./retry.ts";

export const MAX_RUN_MS = 24 * 60 * 60 * 1000;
export const SUBMIT_STALE_MS = 10 * 60 * 1000;
/** A submitted response that is still queued or running after this long is cancelled and retried (longest step measured: ~8 min). */
export const RESPONSE_STALE_MS = 30 * 60 * 1000;

export interface RunContext {
  course: { title: string; level: string | null };
  paths: { track: string; title: string }[];
  scopes: { track: string; audience: string; corelia_direction: string; locale: string }[];
  /** Validated output of each earlier step. */
  outputs: Partial<Record<StepKey, unknown>>;
  /** Current UTC date (YYYY-MM-DD). Models do not know it, so source check dates come from here. */
  today: string;
  /** Review feedback the curriculum is being revised against; null when it is not being revised. */
  revision: CurriculumRevision | null;
  /** Draft/review state of the lesson being written or reviewed; set only when a lesson id is given. */
  lesson?: LessonContext | null;
  /** Set while the research is being redone for a request of the curriculum. */
  researchGap?: ResearchGap | null;
  /** The A1 profile attached to this run by D6; absent on legacy runs. */
  catalogResearch?: BriefCatalogResearch | null;
}

export type Acceptance = { ok: true; summary: string } | { ok: false; reason: string };

export interface StepSpec {
  prompt: PromptKey;
  kind: "text" | "research" | "review";
  model: string;
  effort: string;
  /** Output budget (reasoning included) of one attempt; about twice the largest output seen in local runs. */
  maxOutputTokens: number;
  maxAttempts: number;
  tools?: Record<string, unknown>[];
  schema: Record<string, unknown>;
  /** Steps that run once per curriculum lesson (A5) pass the lesson id to the three functions below. */
  buildInput(ctx: RunContext, lessonId?: string): Record<string, unknown>;
  accept(output: unknown, ctx: RunContext, lessonId?: string): Acceptance | Promise<Acceptance>;
  lessonTools?(lessonId: string, ctx: RunContext): Record<string, unknown>[] | undefined;
}

const str = { type: "string" };
const strList = { type: "array", items: str };

function object(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

const BRIEF_SCHEMA = object({
  status: { type: "string", enum: ["ready", "needs_input"] },
  topic: str,
  audience: str,
  level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
  code_language: { type: ["string", "null"], enum: [...ENABLED_CODE_LANGUAGES, null] },
  locale: str,
  goals: strList,
  scope: strList,
  out_of_scope: strList,
  prerequisites: strList,
  tools: strList,
  duration_hint: str,
  assumptions: strList,
  open_questions: strList,
});

const RESEARCH_SCHEMA = object({
  status: { type: "string", enum: ["ready", "needs_research"] },
  audience: str,
  goals: strList,
  scope: strList,
  out_of_scope: strList,
  prerequisites: { type: "array", items: object({ prerequisite: str, remedial_source_ids: strList }) },
  topics: {
    type: "array",
    items: object({
      topic: str,
      why: str,
      source_ids: strList,
      key_points: { type: "array", items: object({ point: str, source_ids: strList }) },
    }),
  },
  sources: {
    type: "array",
    items: object({
      source_id: str,
      title: str,
      url: str,
      authority: { type: "string", enum: ["official", "supplementary"] },
      supports: str,
      version: str,
      checked_at: str,
      access: { type: "string", enum: ["read", "unreachable"] },
    }),
  },
  tool_versions: { type: "array", items: object({ tool: str, version: str, source_ids: strList }) },
  stack_choice: object({
    tools: {
      type: "array",
      items: object({
        tool_type: str,
        selected: str,
        alternatives_considered: strList,
        basis: { type: "string", enum: ["source_recommended", "context_rule"] },
        reason: str,
        source_ids: strList,
      }),
    },
  }),
  videos: {
    type: "array",
    items: object({
      topic: str,
      url: str,
      title: str,
      channel: str,
      channel_basis: str,
      evidence_source_ids: strList,
    }),
  },
  misconceptions: {
    type: "array",
    items: object({ topic: str, misconception: str, correction: str, source_ids: strList }),
  },
  open_questions: {
    type: "array",
    items: object({ question: str, impact: str, blocking: { type: "boolean" }, action: str }),
  },
  handoff_notes: strList,
});

/**
 * Role of a lesson in the learning sequence (Learning Principles): a self-check diagnostic start
 * whose resources are the review material for missing prerequisites, worked example then reduced
 * support, retrieval of earlier modules, and a final cumulative check. The app has no optional
 * lesson, so every lesson counts toward completion; there is no separate remedial lesson.
 */
export const LESSON_PURPOSES = [
  "diagnostic",
  "explanation",
  "worked_example",
  "guided_practice",
  "independent_practice",
  "retrieval",
  "final_check",
] as const;

const CURRICULUM_SCHEMA = object({
  status: { type: "string", enum: ["draft", "needs_research"] },
  missing: strList,
  outcomes: { type: "array", items: object({ id: str, text: str, check_lesson_ids: strList }) },
  modules: {
    type: "array",
    items: object({
      id: str,
      title: str,
      description: str,
      lessons: {
        type: "array",
        items: object({
          id: str,
          title: str,
          description: str,
          type: { type: "string", enum: [...AI_CURRICULUM_FORMATS] },
          purpose: { type: "string", enum: [...LESSON_PURPOSES] },
          outcome_ids: strList,
          prerequisites: strList,
          prerequisite_lesson_ids: strList,
          completion_rule: str,
          pass_threshold: { type: ["number", "null"] },
          review_lesson_ids: strList,
          source_ids: strList,
        }),
      },
    }),
  },
});

const REVIEW_SCHEMA = object({
  verdict: { type: "string", enum: ["pass", "needs_fix"] },
  issues: {
    type: "array",
    items: object({
      location: str,
      problem: str,
      principle: str,
      fix: str,
      severity: { type: "string", enum: ["blocking", "minor"] },
    }),
  },
  needs_research: strList,
  summary: str,
});

interface CurriculumReview {
  verdict: string;
  issues: { location: string; problem: string; severity: string }[];
  needs_research: string[];
}

export interface CurriculumRevision {
  /** Number of reviews that asked for this revision. */
  round: number;
  issues: unknown[];
  needs_research: string[];
}

interface Brief {
  status: string;
  open_questions: string[];
  code_language?: EnabledCodeLanguage | null;
}

interface Research {
  status: string;
  prerequisites: { prerequisite: string; remedial_source_ids: string[] }[];
  topics: { topic: string; source_ids: string[]; key_points: { point: string; source_ids: string[] }[] }[];
  sources: { source_id: string; authority: string; access: string; checked_at: string }[];
  videos?: ResearchVideoCandidate[];
  stack_choice: {
    tools: {
      tool_type: string;
      selected: string;
      alternatives_considered: string[];
      basis: "source_recommended" | "context_rule";
      reason: string;
      source_ids: string[];
    }[];
  };
  misconceptions: { topic: string; source_ids: string[] }[];
  open_questions: { question: string; blocking: boolean }[];
}

export interface ResearchVideoCandidate {
  topic: string;
  url: string;
  title: string;
  channel: string;
  channel_basis: string;
  evidence_source_ids: string[];
}

type LessonPurpose = typeof LESSON_PURPOSES[number];

interface CurriculumLesson {
  id: string;
  type: string;
  purpose: LessonPurpose;
  outcome_ids: string[];
  prerequisite_lesson_ids: string[];
  pass_threshold: number | null;
  review_lesson_ids: string[];
  source_ids: string[];
}

interface Curriculum {
  status: string;
  missing: string[];
  outcomes: { id: string; check_lesson_ids: string[] }[];
  modules: { id: string; lessons: CurriculumLesson[] }[];
}

export function list(items: string[], max = 3): string {
  return items.slice(0, max).join("; ") + (items.length > max ? ` (+${items.length - max})` : "");
}

export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function acceptBrief(output: unknown): Acceptance {
  const brief = output as Brief;
  if (brief.status !== "ready") return { ok: false, reason: `Brief thiếu dữ liệu: ${list(brief.open_questions)}` };
  const requestedLanguage = (brief as { code_language?: unknown }).code_language;
  if (requestedLanguage !== undefined && requestedLanguage !== null) {
    const adapter = getCodeLanguageAdapter(requestedLanguage);
    if (adapter?.status === "prepared") {
      return { ok: false, reason: `code_language "${adapter.id}" chưa hỗ trợ publish.` };
    }
    if (!adapter) {
      return { ok: false, reason: `code_language "${String(requestedLanguage)}" không hợp lệ hoặc chưa hỗ trợ publish.` };
    }
  }
  return { ok: true, summary: "brief sẵn sàng." };
}

function briefWithCodeLanguage(value: unknown): Record<string, unknown> {
  const brief = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return { ...brief, code_language: resolveCodeLanguage(brief.code_language) };
}

function stackChoiceProblems(value: unknown, sources: Research["sources"]): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["thiếu stack_choice"];
  const choice = value as Record<string, unknown>;
  if (!Array.isArray(choice.tools)) return ["stack_choice.tools phải là danh sách"];
  const tools = choice.tools as unknown[];

  const problems: string[] = [];
  const types = new Set<string>();
  const read = new Map(sources.filter((s) => s.access === "read").map((s) => [s.source_id, s]));
  tools.forEach((tool, index) => {
    const label = `stack_choice.tools[${index}]`;
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
      problems.push(`${label} phải là một lựa chọn công cụ`);
      return;
    }
    const item = tool as Record<string, unknown>;
    const toolType = typeof item.tool_type === "string" ? item.tool_type.trim() : "";
    const selected = typeof item.selected === "string" ? item.selected.trim() : "";
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    const itemLabel = toolType || label;
    if (!toolType) problems.push(`${label}: thiếu tool_type`);
    else if (types.has(toolType)) problems.push(`${itemLabel}: trùng tool_type`);
    else types.add(toolType);
    if (!selected) problems.push(`${itemLabel}: thiếu selected`);
    if (!reason) problems.push(`${itemLabel}: thiếu reason`);

    if (!Array.isArray(item.alternatives_considered) || item.alternatives_considered.some((x) => typeof x !== "string" || !x.trim())) {
      problems.push(`${itemLabel}: alternatives_considered phải là danh sách tên công cụ`);
    } else if (item.alternatives_considered.length === 0) {
      problems.push(`${itemLabel}: alternatives_considered cần ít nhất một phương án thay thế`);
    } else if (selected && item.alternatives_considered.some((x) => (x as string).trim() === selected)) {
      problems.push(`${itemLabel}: selected không được lặp trong alternatives_considered`);
    }

    if (item.basis !== "source_recommended" && item.basis !== "context_rule") {
      problems.push(`${itemLabel}: basis phải là source_recommended hoặc context_rule`);
    }
    if (!Array.isArray(item.source_ids) || item.source_ids.some((x) => typeof x !== "string" || !x.trim())) {
      problems.push(`${itemLabel}: source_ids phải là danh sách ID nguồn`);
      return;
    }
    const sourceIds = item.source_ids as string[];
    if (new Set(sourceIds).size !== sourceIds.length) problems.push(`${itemLabel}: source_ids bị trùng`);
    if (sourceIds.some((id) => !read.has(id))) problems.push(`${itemLabel}: source_ids phải trỏ tới nguồn đã đọc`);
    if (item.basis === "source_recommended") {
      if (sourceIds.length === 0) problems.push(`${itemLabel}: source_recommended cần source_ids`);
    }
  });
  return problems;
}

function researchVideoProblems(
  value: unknown,
  topics: Research["topics"],
  sources: Research["sources"],
): string[] {
  if (value === undefined) return []; // older accepted research has no video candidates
  if (!Array.isArray(value)) return ["videos phải là danh sách"];

  const knownTopics = new Set(topics.map((topic) => normalizeResearchTopic(topic.topic)));
  const readSources = new Set(sources.filter((source) => source.access === "read").map((source) => source.source_id));
  const videoIds = new Set<string>();
  const problems: string[] = [];

  value.forEach((candidate, index) => {
    const label = `videos[${index}]`;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      problems.push(`${label} phải là video ứng viên`);
      return;
    }
    const video = candidate as Record<string, unknown>;
    const topic = typeof video.topic === "string" ? normalizeResearchTopic(video.topic) : "";
    if (!topic) problems.push(`${label}: thiếu topic`);
    else if (!knownTopics.has(topic)) problems.push(`${label}: topic không có trong research`);

    const url = typeof video.url === "string" ? video.url.trim() : "";
    const videoId = url ? getYoutubeVideoId(url) : null;
    if (!videoId) problems.push(`${label}: url không phải link YouTube hợp lệ`);
    else if (videoIds.has(videoId)) problems.push(`${label}: trùng video ID`);
    else videoIds.add(videoId);

    for (const field of ["title", "channel", "channel_basis"] as const) {
      if (typeof video[field] !== "string" || !video[field].trim()) problems.push(`${label}: thiếu ${field}`);
    }

    if (!Array.isArray(video.evidence_source_ids) || video.evidence_source_ids.length === 0 ||
        video.evidence_source_ids.some((id) => typeof id !== "string" || !id.trim())) {
      problems.push(`${label}: evidence_source_ids phải có ít nhất một ID nguồn đã đọc`);
    } else {
      const evidenceIds = video.evidence_source_ids as string[];
      if (new Set(evidenceIds).size !== evidenceIds.length) problems.push(`${label}: evidence_source_ids bị trùng`);
      if (evidenceIds.some((id) => !readSources.has(id))) {
        problems.push(`${label}: evidence_source_ids phải trỏ tới nguồn access = read`);
      }
    }
  });
  return problems;
}

export function acceptResearch(output: unknown, today: string): Acceptance {
  const research = output as Research;
  if (research.status !== "ready") {
    const blocking = research.open_questions.filter((q) => q.blocking).map((q) => q.question);
    return { ok: false, reason: `Thiếu bằng chứng: ${list(blocking.length ? blocking : research.open_questions.map((q) => q.question))}` };
  }
  const stackProblems = stackChoiceProblems(research.stack_choice, Array.isArray(research.sources) ? research.sources : []);
  if (stackProblems.length > 0) {
    return { ok: false, reason: `Research stack_choice chưa hợp lệ: ${list(stackProblems)}` };
  }
  const videoProblems = researchVideoProblems(research.videos, research.topics, research.sources);
  if (videoProblems.length > 0) {
    return { ok: false, reason: `Research videos chưa hợp lệ: ${list(videoProblems)}` };
  }
  // Lessons are written from key points, so every point must rest on a source that was actually
  // read, and each topic needs an official source: community sources only supplement.
  const read = new Map(research.sources.filter((s) => s.access === "read").map((s) => [s.source_id, s]));
  if (read.size === 0) return { ok: false, reason: "Research brief không có nguồn đã đọc." };
  const cited = (ids: string[]) => ids.length > 0 && ids.every((id) => read.has(id));
  const problems = research.topics.flatMap((t) => {
    if (!cited(t.source_ids)) return [`${t.topic}: nguồn không hợp lệ hoặc chưa đọc`];
    if (!t.source_ids.some((id) => read.get(id)?.authority === "official")) return [`${t.topic}: không có nguồn chính thức`];
    if (t.key_points.length === 0) return [`${t.topic}: không có ý chính`];
    if (t.key_points.some((k) => !cited(k.source_ids))) return [`${t.topic}: ý chính thiếu nguồn đã đọc`];
    return [];
  });
  if (research.topics.length === 0) problems.push("không có chủ đề");
  // The model receives today's date in its input; a read source dated otherwise was not checked on
  // this run. The day before is accepted for a response that finished after midnight UTC.
  const yesterday = utcDate(Date.parse(today) - 24 * 60 * 60 * 1000);
  for (const s of read.values()) {
    if (s.checked_at !== today && s.checked_at !== yesterday) {
      problems.push(`nguồn ${s.source_id}: ngày kiểm tra ${s.checked_at || "trống"} không phải ngày chạy`);
    }
  }
  // Prerequisites need material to catch up with, and quiz distractors and feedback are built from
  // misconceptions, so both must rest on sources that were read.
  for (const p of research.prerequisites) {
    if (!cited(p.remedial_source_ids)) problems.push(`prerequisite "${p.prerequisite}": thiếu nguồn ôn đã đọc`);
  }
  for (const m of research.misconceptions) {
    if (!cited(m.source_ids)) problems.push(`lỗi hiểu sai về ${m.topic}: thiếu nguồn đã đọc`);
  }
  if (problems.length > 0) return { ok: false, reason: `Research chưa đạt: ${list(problems)}` };
  const points = research.topics.reduce((n, t) => n + t.key_points.length, 0);
  return {
    ok: true,
    summary: `${research.topics.length} chủ đề, ${points} ý chính, ${research.misconceptions.length} lỗi hiểu sai, ${read.size} nguồn đã đọc.`,
  };
}

export function acceptCurriculum(
  output: unknown,
  sourceIds: Set<string>,
  codeLanguage: EnabledCodeLanguage | null = "rust",
): Acceptance {
  const curriculum = output as Curriculum;
  if (curriculum.status === "needs_research") {
    // A request for more evidence: the research step is reopened for it (planRun), the curriculum is not used.
    if (curriculum.missing.length === 0) return { ok: false, reason: "Curriculum báo cần thêm nghiên cứu nhưng không nêu missing cụ thể." };
    return { ok: true, summary: `cần thêm nghiên cứu: ${list(curriculum.missing)}` };
  }
  if (curriculum.status !== "draft") return { ok: false, reason: `Curriculum có status không hợp lệ: ${curriculum.status}` };
  for (const module of curriculum.modules) {
    const legacyVideoLesson = module.lessons.find((lesson) => lesson.type === "video");
    if (legacyVideoLesson) {
      return { ok: false, reason: `lesson ${legacyVideoLesson.id}: type video không còn được hỗ trợ trong curriculum AI mới` };
    }
  }
  const problems: string[] = [];
  const lessons = curriculum.modules.flatMap((m) => m.lessons);
  if (codeLanguage === null && lessons.some((lesson) => lesson.type === "code_exercise")) {
    return { ok: false, reason: "Curriculum có code_exercise nhưng brief.code_language = null." };
  }
  const lessonIds = new Set(lessons.map((l) => l.id));
  const outcomeIds = new Set(curriculum.outcomes.map((o) => o.id));
  const ids = [...curriculum.modules.map((m) => m.id), ...lessons.map((l) => l.id), ...curriculum.outcomes.map((o) => o.id)];
  if (new Set(ids).size !== ids.length) problems.push("ID module/lesson/outcome bị trùng");
  if (lessons.length === 0) problems.push("không có lesson");
  for (const o of curriculum.outcomes) {
    if (o.check_lesson_ids.length === 0 || o.check_lesson_ids.some((id) => !lessonIds.has(id))) {
      problems.push(`outcome ${o.id} không có lesson kiểm tra hợp lệ`);
    }
  }
  const position = new Map(lessons.map((l, i) => [l.id, i]));
  for (const l of lessons) {
    // The diagnostic checks prerequisites, not course outcomes, so it may have none. It is a
    // self-check practice: the app has no optional lesson, and a threshold would gate completion.
    const diagnostic = l.purpose === "diagnostic";
    if ((!diagnostic && l.outcome_ids.length === 0) || l.outcome_ids.some((id) => !outcomeIds.has(id))) {
      problems.push(`lesson ${l.id} có outcome không hợp lệ`);
    }
    if (l.source_ids.length === 0 || l.source_ids.some((id) => !sourceIds.has(id))) problems.push(`lesson ${l.id} có source_id không có trong research`);
    if (diagnostic && l.type !== "practice") problems.push(`lesson ${l.id} (diagnostic) phải là practice`);
    // Feedback on a wrong answer points back to the lesson that teaches it again.
    if (l.type === "quiz") {
      if (l.pass_threshold === null || !(l.pass_threshold > 0 && l.pass_threshold <= 100)) problems.push(`quiz ${l.id} thiếu ngưỡng pass trong (0, 100]`);
      if (l.review_lesson_ids.length === 0) problems.push(`quiz ${l.id} không có lesson để ôn khi sai`);
    } else if (l.pass_threshold !== null) {
      problems.push(`lesson ${l.id} không phải quiz nhưng có ngưỡng pass`);
    }
    if (l.review_lesson_ids.some((id) => !lessonIds.has(id) || id === l.id)) problems.push(`lesson ${l.id} trỏ tới lesson ôn không hợp lệ`);
    for (const p of l.prerequisite_lesson_ids) {
      if (!lessonIds.has(p) || p === l.id) problems.push(`lesson ${l.id} có prerequisite_lesson_ids không hợp lệ (${p})`);
      else if (position.get(p)! > position.get(l.id)!) problems.push(`lesson ${l.id}: prerequisite ${p} đứng sau`);
    }
  }

  // Starting point: the first module opens with a self-check on prior knowledge.
  if (!curriculum.modules[0]?.lessons.some((l) => l.purpose === "diagnostic")) problems.push("module đầu không có lesson chẩn đoán đầu vào");

  // Transfer: the final_check lessons of the last module (a summary quiz, plus code_exercise or
  // practice for outcomes a quiz cannot check) together cover every outcome. There is no final
  // assignment in an ai_generated course (docs/course-types.md).
  const last = curriculum.modules[curriculum.modules.length - 1];
  const finals = (last?.lessons ?? []).filter((l) => l.purpose === "final_check");
  const covered = new Set(finals.flatMap((l) => l.outcome_ids));
  if (!finals.some((l) => l.type === "quiz")) problems.push("module cuối không có quiz tổng hợp");
  const uncovered = [...outcomeIds].filter((id) => !covered.has(id));
  if (uncovered.length > 0) problems.push(`các lesson final_check của module cuối chưa phủ outcome ${uncovered.join(", ")}`);

  // Spacing: with more than one module, a later module brings back an outcome taught earlier.
  if (curriculum.modules.length > 1) {
    const firstModule = new Map<string, number>();
    curriculum.modules.forEach((m, i) => {
      for (const l of m.lessons) {
        if (l.purpose === "diagnostic") continue;
        for (const o of l.outcome_ids) if (!firstModule.has(o)) firstModule.set(o, i);
      }
    });
    const recalls = curriculum.modules.some((m, i) =>
      m.lessons.some((l) => l.purpose === "retrieval" && l.outcome_ids.some((o) => (firstModule.get(o) ?? i) < i))
    );
    if (!recalls) problems.push("không có lesson ôn lại outcome của module trước");
  }

  if (problems.length > 0) return { ok: false, reason: `Curriculum chưa hợp lệ: ${list(problems)}` };
  return { ok: true, summary: `${curriculum.modules.length} module, ${lessons.length} lesson, ${curriculum.outcomes.length} outcome.` };
}

/** Blocking items of a review: blocking issues plus topics without a source, which also go back to the author. */
export function blockingItems(output: unknown): string[] {
  const review = output as CurriculumReview;
  return [
    ...review.issues.filter((i) => i.severity === "blocking").map((i) => `${i.location}: ${i.problem}`),
    ...review.needs_research.map((topic) => `thiếu nguồn: ${topic}`),
  ];
}

export function acceptCurriculumReview(output: unknown, curriculum: unknown): Acceptance {
  const review = output as CurriculumReview;
  const c = curriculum as Curriculum;
  const known = new Set([
    ...c.modules.map((m) => m.id),
    ...c.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    ...c.outcomes.map((o) => o.id),
  ]);
  const problems: string[] = [];
  for (const i of review.issues) {
    if (!known.has(i.location)) problems.push(`vị trí "${i.location}" không phải ID trong curriculum (location là đúng một ID module, lesson hoặc outcome; cùng lỗi ở nhiều nơi thì tách thành nhiều issue)`);
    if (!i.problem.trim()) problems.push(`vấn đề tại ${i.location} để trống`);
  }
  const blocking = blockingItems(output).length;
  if (review.verdict === "pass" && blocking > 0) problems.push("verdict pass nhưng còn lỗi blocking hoặc chủ đề thiếu nguồn");
  if (review.verdict === "needs_fix" && blocking === 0) problems.push("verdict needs_fix nhưng không có lỗi blocking hay chủ đề thiếu nguồn");
  if (problems.length > 0) return { ok: false, reason: `Review chưa hợp lệ: ${list(problems)}` };
  const minor = review.issues.filter((i) => i.severity === "minor").length;
  return { ok: true, summary: `${review.verdict}, ${blocking} lỗi blocking, ${minor} minor.` };
}

/** A review round is the A4 verdict on one accepted curriculum; at most this many per run. */
export const MAX_REVIEW_ROUNDS = 2;

/**
 * Progress of the curriculum/review loop, counted from accepted generations. Every accepted review
 * consumes one accepted curriculum: reviews === curricula means the curriculum waits for a revision,
 * reviews < curricula means the latest curriculum waits for its review.
 */
export interface RunProgress {
  /** Attempt number the current step's retry budget counts from (after its last accepted attempt). */
  firstAttempt: number;
  curricula: number;
  reviews: number;
  /** Blocking items of the latest accepted review; null until it is loaded. */
  blocking: string[] | null;
  /** Failed attempts of the current step's round; absent when unknown (counted from the attempt number). */
  failures?: RoundFailures;
  /** Accepted research briefs, and accepted curricula that asked for more research instead of being drafts. */
  researches?: number;
  researchRequests?: number;
  /** `missing` of the newest accepted curriculum when it is a research request; null when it is a draft or not loaded. */
  missing?: string[] | null;
}

/** A curriculum may ask for more research this many times in a run (as many review rounds as A4). */
export const MAX_RESEARCH_REQUESTS = 2;

export const NO_PROGRESS: RunProgress = { firstAttempt: 0, curricula: 0, reviews: 0, blocking: null };

export function buildProgress(
  /** `outcome` is output->>status: it tells a curriculum draft from a request for more research. */
  rows: { step_key: string; attempt: number; status: string; provider_request_id: string | null; failure_kind?: FailureKind | null; outcome?: string | null }[],
  current: StepKey,
  latestReview: unknown,
  latestCurriculum?: unknown,
): RunProgress {
  const done = rows.filter((r) => r.status === "completed");
  const attempts = done.filter((r) => r.step_key === current).map((r) => r.attempt);
  const firstAttempt = attempts.length ? Math.max(...attempts) + 1 : 0;
  const curricula = done.filter((r) => r.step_key === "curriculum");
  return {
    firstAttempt,
    failures: roundFailures(rows.filter((r) => r.step_key === current), firstAttempt),
    curricula: curricula.filter((r) => r.outcome !== "needs_research").length,
    reviews: done.filter((r) => r.step_key === "curriculum_review").length,
    blocking: latestReview ? blockingItems(latestReview) : null,
    researches: done.filter((r) => r.step_key === "research").length,
    researchRequests: curricula.filter((r) => r.outcome === "needs_research").length,
    missing: latestCurriculum ? researchRequest(latestCurriculum) : null,
  };
}

/** `missing` of a curriculum output that asks for more research; null for a draft. */
export function researchRequest(curriculum: unknown): string[] | null {
  const c = curriculum as { status?: string; missing?: string[] };
  return c.status === "needs_research" ? c.missing ?? [] : null;
}

export interface ResearchGap {
  /** Number of times the curriculum has asked for more research. */
  round: number;
  missing: string[];
  requested_by: "curriculum";
}

/**
 * What A2 is asked to add: the newest request of the curriculum, while the research has not been
 * redone for it (each accepted request consumes one accepted research brief).
 */
export function researchGap(counts: { researches: number; requests: number }, newestRequest: unknown): ResearchGap | null {
  if (counts.requests === 0 || counts.requests < counts.researches || !newestRequest) return null;
  const missing = researchRequest(newestRequest);
  return missing ? { round: counts.requests, missing, requested_by: "curriculum" } : null;
}

export function curriculumRevision(
  counts: { curricula: number; reviews: number },
  latestReview: unknown,
): CurriculumRevision | null {
  if (counts.reviews === 0 || counts.curricula > counts.reviews || !latestReview) return null;
  if (blockingItems(latestReview).length === 0) return null;
  const review = latestReview as CurriculumReview;
  return { round: counts.reviews, issues: review.issues, needs_research: review.needs_research };
}

function researchSourceIds(ctx: RunContext): Set<string> {
  const research = ctx.outputs.research as Research | undefined;
  return new Set((research?.sources ?? []).filter((s) => s.access === "read").map((s) => s.source_id));
}

export const MODEL = "gpt-6-luna";
/** Steps called once per run decide the shape of the whole course and keep the highest effort. */
export const EFFORT = "xhigh";
/**
 * Lesson writing runs dozens of times per course and reasoning tokens are most of its cost. The
 * lesson review keeps EFFORT: the checker is never weaker than what it checks, and nothing after it
 * catches content errors.
 */
const LESSON_EFFORT = "high";
/**
 * Flex processing: lower price for slower, best-effort capacity; runs are background work anyway.
 * When flex has no capacity the request falls back to the default tier (openai.ts).
 */
export const SERVICE_TIER = "flex";

/** Steps the runtime can execute. A step missing here ends the run as draft_failed. */
export const STEP_SPECS: Partial<Record<StepKey, StepSpec>> = {
  brief: {
    prompt: "a2-brief",
    kind: "text",
    model: MODEL,
    effort: EFFORT,
    maxOutputTokens: 8_000,
    maxAttempts: 2,
    schema: BRIEF_SCHEMA,
    buildInput: (ctx) => ({
      course_type: "ai_generated",
      course: ctx.course,
      paths: ctx.paths,
      tracks: ctx.scopes,
      ...(ctx.catalogResearch ? { catalog_research: ctx.catalogResearch } : {}),
      code_languages: ENABLED_CODE_LANGUAGES,
      platform_formats: PLATFORM_FORMAT_GUIDE,
    }),
    accept: acceptBrief,
  },
  research: {
    prompt: "a2-research",
    kind: "research",
    model: MODEL,
    effort: EFFORT,
    maxOutputTokens: 40_000,
    maxAttempts: 2,
    tools: [{ type: "web_search" }],
    schema: RESEARCH_SCHEMA,
    buildInput: (ctx) => ({
      course_type: "ai_generated",
      brief: briefWithCodeLanguage(ctx.outputs.brief),
      today: ctx.today,
      platform_formats: PLATFORM_FORMAT_GUIDE,
      ...(ctx.researchGap ? { research_gap: ctx.researchGap, previous_research: ctx.outputs.research } : {}),
    }),
    accept: (output, ctx) => acceptResearch(output, ctx.today),
  },
  curriculum: {
    prompt: "a3-curriculum",
    kind: "text",
    model: MODEL,
    effort: EFFORT,
    maxOutputTokens: 40_000,
    maxAttempts: 2,
    schema: CURRICULUM_SCHEMA,
    buildInput: (ctx) => ({
      course_type: "ai_generated",
      brief: briefWithCodeLanguage(ctx.outputs.brief),
      research_brief: ctx.outputs.research,
      platform_formats: AI_CURRICULUM_FORMAT_GUIDE,
      ...(ctx.revision ? { previous_curriculum: ctx.outputs.curriculum, review: ctx.revision } : {}),
    }),
    accept: (output, ctx) => acceptCurriculum(
      output,
      researchSourceIds(ctx),
      resolveCodeLanguage((ctx.outputs.brief as { code_language?: unknown }).code_language),
    ),
  },
  curriculum_review: {
    prompt: "a4-curriculum-review",
    kind: "review",
    model: MODEL,
    effort: EFFORT,
    maxOutputTokens: 20_000,
    maxAttempts: 2,
    schema: REVIEW_SCHEMA,
    buildInput: (ctx) => ({
      course_type: "ai_generated",
      brief: briefWithCodeLanguage(ctx.outputs.brief),
      research_brief: ctx.outputs.research,
      curriculum: ctx.outputs.curriculum,
      platform_formats: AI_CURRICULUM_FORMAT_GUIDE,
    }),
    accept: (output, ctx) => acceptCurriculumReview(output, ctx.outputs.curriculum),
  },
  lessons: {
    prompt: "a5-lesson",
    kind: "text",
    model: MODEL,
    effort: LESSON_EFFORT,
    maxOutputTokens: 40_000,
    maxAttempts: 2,
    schema: LESSON_SCHEMA,
    buildInput: (ctx, lessonId) => buildLessonInput(ctx, lessonId!),
    accept: (output, ctx, lessonId) => acceptLesson(output, ctx, lessonId!),
    lessonTools,
  },
  lesson_review: {
    prompt: "a6-lesson-review",
    kind: "review",
    model: MODEL,
    effort: EFFORT,
    maxOutputTokens: 20_000,
    maxAttempts: 2,
    schema: LESSON_REVIEW_SCHEMA,
    buildInput: (ctx, lessonId) => buildLessonReviewInput(ctx, lessonId!),
    accept: (output, ctx, lessonId) => acceptLessonReview(output, ctx, lessonId!),
    lessonTools: reviewTools,
  },
};

/** Steps the runtime executes itself, without a model. */
export const CODE_STEPS = ["structure_check", "journey_test"] as const satisfies readonly StepKey[];
export type CodeStep = typeof CODE_STEPS[number];

export function stepAgent(step: StepKey) {
  const spec = STEP_SPECS[step];
  return spec ? { role: PROMPTS[spec.prompt].role, promptVersion: promptVersion(spec.prompt) } : null;
}

export interface GenerationState {
  id: string;
  attempt: number;
  agent_role: AgentRole;
  status: "submitting" | "submitted" | "completed" | "failed";
  provider_request_id: string | null;
  failure_kind?: FailureKind | null;
  error: string | null;
  created_at: string;
  /** Set on generations of per-lesson steps. */
  lesson_id?: string | null;
}

export type TickAction =
  | { kind: "finish"; status: "published" | "draft_failed"; reason: string }
  | { kind: "submit"; attempt: number; parentId: string | null }
  | { kind: "poll"; generationId: string; requestId: string }
  | { kind: "expire_submitting"; generationId: string }
  | { kind: "mark_done"; generationId: string }
  | { kind: "reopen"; round: number; blocking: number }
  | { kind: "reopen_research"; round: number; missing: string[] }
  | { kind: "lessons"; actions: LessonAction[] }
  | { kind: "check"; check: CodeStep }
  | { kind: "publish" }
  | { kind: "wait" };

/** Next action for one running run. Pure: the handler executes it. */
export function planRun(input: {
  steps: Partial<Record<StepKey, StepState>>;
  latest: GenerationState | null;
  startedAt: string;
  now: number;
  progress?: RunProgress;
  /**
   * Curriculum lessons with their generations of both lesson steps and the blocking items of each
   * lesson's newest accepted review; required while the step is `lessons` or `lesson_review`.
   */
  lessons?: { ids: string[]; rows: LessonGeneration[]; blocking: Record<string, string[]> };
}): { step: StepKey | null; action: TickAction } {
  const current = STEP_ORDER.find((k) => input.steps[k] !== "done") ?? null;
  if (!current) return { step: null, action: { kind: "finish", status: "published", reason: "" } };
  if (input.now - Date.parse(input.startedAt) > MAX_RUN_MS) {
    return { step: current, action: { kind: "finish", status: "draft_failed", reason: "Lượt chạy vượt quá 24 giờ." } };
  }
  const label = STEP_LABEL[current];
  if (input.steps[current] === "failed") {
    return { step: current, action: { kind: "finish", status: "draft_failed", reason: `Bước ${label} thất bại.` } };
  }
  if (current === "structure_check" || current === "journey_test") return { step: current, action: { kind: "check", check: current } };
  if (current === "publish") return { step: current, action: { kind: "publish" } };
  const spec = STEP_SPECS[current];
  if (!spec) {
    const owner = STEP_OWNER[current] === "code" ? "code" : `agent ${STEP_OWNER[current]}`;
    return { step: current, action: { kind: "finish", status: "draft_failed", reason: `Bước ${label} (${owner}) chưa được triển khai.` } };
  }
  if (current === "lessons" || current === "lesson_review") {
    // Both steps run once per lesson and interleave: a lesson is written, reviewed, rewritten and
    // reviewed again independently of the others, so the step-level `latest` does not apply and the
    // pair finishes together (the second tick marks the other step done).
    if (!input.lessons) return { step: current, action: { kind: "finish", status: "draft_failed", reason: `Bước ${label}: không đọc được danh sách lesson.` } };
    const plan = planLessons({
      lessonIds: input.lessons.ids,
      rows: input.lessons.rows,
      blocking: input.lessons.blocking,
      now: input.now,
      maxAttempts: { lessons: STEP_SPECS.lessons!.maxAttempts, lesson_review: STEP_SPECS.lesson_review!.maxAttempts },
      submitStaleMs: SUBMIT_STALE_MS,
      limit: LESSONS_PER_TICK,
    });
    if (plan.outcome === "done") return { step: current, action: { kind: "mark_done", generationId: plan.lastGenerationId } };
    if (plan.outcome === "failed") {
      const failed = plan.exhausted.map((e) => `${e.lessonId} (${e.reason})`);
      return { step: current, action: { kind: "finish", status: "draft_failed", reason: `Bước ${label}: ${failed.length} lesson không đạt: ${list(failed)}` } };
    }
    return { step: current, action: plan.actions.length ? { kind: "lessons", actions: plan.actions } : { kind: "wait" } };
  }
  const latest = input.latest;
  const progress = input.progress ?? NO_PROGRESS;
  if (!latest) return { step: current, action: { kind: "submit", attempt: 0, parentId: null } };
  switch (latest.status) {
    case "submitting":
      return input.now - Date.parse(latest.created_at) > SUBMIT_STALE_MS
        ? { step: current, action: { kind: "expire_submitting", generationId: latest.id } }
        : { step: current, action: { kind: "wait" } };
    case "submitted":
      return { step: current, action: { kind: "poll", generationId: latest.id, requestId: latest.provider_request_id ?? "" } };
    case "completed":
      if (current === "research" && (progress.researchRequests ?? 0) > 0 && (progress.researchRequests ?? 0) >= (progress.researches ?? 0)) {
        // The curriculum asked for more evidence: research again, keeping what is already found.
        return { step: current, action: { kind: "submit", attempt: latest.attempt + 1, parentId: latest.id } };
      }
      if (current === "curriculum" && progress.missing) {
        // The newest curriculum is a request for more research.
        const requests = progress.researchRequests ?? 0;
        if (requests < (progress.researches ?? 0)) {
          // The research was redone since: write the curriculum again.
          return { step: current, action: { kind: "submit", attempt: latest.attempt + 1, parentId: null } };
        }
        if (requests >= MAX_RESEARCH_REQUESTS) {
          return {
            step: current,
            action: { kind: "finish", status: "draft_failed", reason: `Bước ${label}: vẫn cần thêm nghiên cứu sau ${requests} vòng: ${list(progress.missing)}` },
          };
        }
        return { step: current, action: { kind: "reopen_research", round: requests, missing: progress.missing } };
      }
      if (current === "curriculum" && progress.reviews > 0 && progress.curricula <= progress.reviews) {
        // The accepted curriculum was already reviewed and sent back: write the revision.
        return { step: current, action: { kind: "submit", attempt: latest.attempt + 1, parentId: latest.id } };
      }
      if (current === "curriculum_review") {
        if (progress.reviews < progress.curricula) {
          // A revised curriculum is waiting for its own review.
          return { step: current, action: { kind: "submit", attempt: latest.attempt + 1, parentId: null } };
        }
        const blocking = progress.blocking ?? [];
        if (blocking.length > 0) {
          if (progress.reviews >= MAX_REVIEW_ROUNDS) {
            return {
              step: current,
              action: { kind: "finish", status: "draft_failed", reason: `Bước ${label}: còn lỗi blocking sau ${progress.reviews} vòng: ${list(blocking)}` },
            };
          }
          return { step: current, action: { kind: "reopen", round: progress.reviews, blocking: blocking.length } };
        }
      }
      return { step: current, action: { kind: "mark_done", generationId: latest.id } };
    case "failed":
      // The retry budget is per round: attempts before the last accepted one do not count.
      if (canRetry(progress.failures ?? { model: latest.attempt + 1 - progress.firstAttempt, transport: 0 }, spec.maxAttempts)) {
        return { step: current, action: { kind: "submit", attempt: latest.attempt + 1, parentId: latest.id } };
      }
      return {
        step: current,
        action: { kind: "finish", status: "draft_failed", reason: `Bước ${label}: ${latest.error ?? "thất bại"}` },
      };
  }
}

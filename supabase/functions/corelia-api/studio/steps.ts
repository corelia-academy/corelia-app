import { PROMPTS, promptVersion, type AgentRole, type PromptKey } from "./prompts.ts";

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

/** Lesson formats the Corelia app can render and validate for ai_generated courses. */
export const PLATFORM_FORMATS = ["video", "article", "quiz", "code_exercise", "practice"] as const;

export const MAX_RUN_MS = 24 * 60 * 60 * 1000;
export const SUBMIT_STALE_MS = 10 * 60 * 1000;

export interface RunContext {
  course: { title: string; level: string | null };
  paths: { track: string; title: string }[];
  scopes: { track: string; audience: string; corelia_direction: string; locale: string }[];
  /** Validated output of each earlier step. */
  outputs: Partial<Record<StepKey, unknown>>;
  /** Current UTC date (YYYY-MM-DD). Models do not know it, so source check dates come from here. */
  today: string;
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
  buildInput(ctx: RunContext): Record<string, unknown>;
  accept(output: unknown, ctx: RunContext): Acceptance;
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
 * Role of a lesson in the learning sequence (Learning Principles): diagnostic start with remedial
 * material for missing prerequisites, worked example then reduced support, retrieval of earlier
 * modules, and a final cumulative check.
 */
export const LESSON_PURPOSES = [
  "diagnostic",
  "remedial",
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
          type: { type: "string", enum: [...PLATFORM_FORMATS] },
          purpose: { type: "string", enum: [...LESSON_PURPOSES] },
          required: { type: "boolean" },
          outcome_ids: strList,
          prerequisites: strList,
          completion_rule: str,
          pass_threshold: { type: ["number", "null"] },
          review_lesson_ids: strList,
          source_ids: strList,
        }),
      },
    }),
  },
});

interface Brief {
  status: string;
  open_questions: string[];
}

interface Research {
  status: string;
  prerequisites: { prerequisite: string; remedial_source_ids: string[] }[];
  topics: { topic: string; source_ids: string[]; key_points: { point: string; source_ids: string[] }[] }[];
  sources: { source_id: string; authority: string; access: string; checked_at: string }[];
  misconceptions: { topic: string; source_ids: string[] }[];
  open_questions: { question: string; blocking: boolean }[];
}

type LessonPurpose = typeof LESSON_PURPOSES[number];

interface CurriculumLesson {
  id: string;
  type: string;
  purpose: LessonPurpose;
  required: boolean;
  outcome_ids: string[];
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

function list(items: string[], max = 3): string {
  return items.slice(0, max).join("; ") + (items.length > max ? ` (+${items.length - max})` : "");
}

export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function acceptBrief(output: unknown): Acceptance {
  const brief = output as Brief;
  if (brief.status !== "ready") return { ok: false, reason: `Brief thiếu dữ liệu: ${list(brief.open_questions)}` };
  return { ok: true, summary: "brief sẵn sàng." };
}

export function acceptResearch(output: unknown, today: string): Acceptance {
  const research = output as Research;
  if (research.status !== "ready") {
    const blocking = research.open_questions.filter((q) => q.blocking).map((q) => q.question);
    return { ok: false, reason: `Thiếu bằng chứng: ${list(blocking.length ? blocking : research.open_questions.map((q) => q.question))}` };
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

export function acceptCurriculum(output: unknown, sourceIds: Set<string>): Acceptance {
  const curriculum = output as Curriculum;
  if (curriculum.status !== "draft") return { ok: false, reason: `Curriculum cần thêm nghiên cứu: ${list(curriculum.missing)}` };
  const problems: string[] = [];
  const lessons = curriculum.modules.flatMap((m) => m.lessons);
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
  for (const l of lessons) {
    // Diagnostic and remedial lessons serve prerequisites, not course outcomes. They orient the
    // learner and must never gate completion, so they are optional and carry no pass threshold.
    const orientation = l.purpose === "diagnostic" || l.purpose === "remedial";
    if ((!orientation && l.outcome_ids.length === 0) || l.outcome_ids.some((id) => !outcomeIds.has(id))) {
      problems.push(`lesson ${l.id} có outcome không hợp lệ`);
    }
    if (l.source_ids.length === 0 || l.source_ids.some((id) => !sourceIds.has(id))) problems.push(`lesson ${l.id} có source_id không có trong research`);
    if (orientation) {
      if (l.required) problems.push(`lesson ${l.id} (${l.purpose}) phải là optional`);
      if (l.pass_threshold !== null) problems.push(`lesson ${l.id} (${l.purpose}) không được có ngưỡng pass`);
    }
    // Feedback on a wrong answer points back to the lesson that teaches it again.
    if (l.type === "quiz") {
      if (!orientation && (l.pass_threshold === null || !(l.pass_threshold > 0 && l.pass_threshold <= 100))) {
        problems.push(`quiz ${l.id} thiếu ngưỡng pass trong (0, 100]`);
      }
      if (l.review_lesson_ids.length === 0) problems.push(`quiz ${l.id} không có lesson để ôn khi sai`);
    } else if (!orientation && l.pass_threshold !== null) {
      problems.push(`lesson ${l.id} không phải quiz nhưng có ngưỡng pass`);
    }
    if (l.review_lesson_ids.some((id) => !lessonIds.has(id) || id === l.id)) problems.push(`lesson ${l.id} trỏ tới lesson ôn không hợp lệ`);
  }
  if (!lessons.some((l) => l.required)) problems.push("không có lesson bắt buộc");

  // Starting point: the first module checks prior knowledge.
  if (!curriculum.modules[0]?.lessons.some((l) => l.purpose === "diagnostic")) problems.push("module đầu không có lesson chẩn đoán đầu vào");

  // Transfer: a required final quiz in the last module covers every outcome.
  const last = curriculum.modules[curriculum.modules.length - 1];
  const finals = (last?.lessons ?? []).filter((l) => l.purpose === "final_check" && l.type === "quiz" && l.required);
  const covered = new Set(finals.flatMap((l) => l.outcome_ids));
  if (finals.length === 0) problems.push("module cuối không có quiz tổng hợp bắt buộc");
  else if ([...outcomeIds].some((id) => !covered.has(id))) problems.push("quiz tổng hợp không phủ mọi outcome");

  // Spacing: with more than one module, a later module brings back an outcome taught earlier.
  if (curriculum.modules.length > 1) {
    const firstModule = new Map<string, number>();
    curriculum.modules.forEach((m, i) => {
      for (const l of m.lessons) {
        if (l.purpose === "diagnostic" || l.purpose === "remedial") continue;
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

function researchSourceIds(ctx: RunContext): Set<string> {
  const research = ctx.outputs.research as Research | undefined;
  return new Set((research?.sources ?? []).filter((s) => s.access === "read").map((s) => s.source_id));
}

const MODEL = "gpt-6-luna";
const EFFORT = "xhigh";

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
      platform_formats: PLATFORM_FORMATS,
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
      brief: ctx.outputs.brief,
      today: ctx.today,
      platform_formats: PLATFORM_FORMATS,
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
      brief: ctx.outputs.brief,
      research_brief: ctx.outputs.research,
      platform_formats: PLATFORM_FORMATS,
    }),
    accept: (output, ctx) => acceptCurriculum(output, researchSourceIds(ctx)),
  },
};

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
  error: string | null;
  created_at: string;
}

export type TickAction =
  | { kind: "finish"; status: "published" | "draft_failed"; reason: string }
  | { kind: "submit"; attempt: number; parentId: string | null }
  | { kind: "poll"; generationId: string; requestId: string }
  | { kind: "expire_submitting"; generationId: string }
  | { kind: "mark_done"; generationId: string }
  | { kind: "wait" };

/** Next action for one running run. Pure: the handler executes it. */
export function planRun(input: {
  steps: Partial<Record<StepKey, StepState>>;
  latest: GenerationState | null;
  startedAt: string;
  now: number;
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
  const spec = STEP_SPECS[current];
  if (!spec) {
    const owner = STEP_OWNER[current] === "code" ? "code" : `agent ${STEP_OWNER[current]}`;
    return { step: current, action: { kind: "finish", status: "draft_failed", reason: `Bước ${label} (${owner}) chưa được triển khai.` } };
  }
  const latest = input.latest;
  if (!latest) return { step: current, action: { kind: "submit", attempt: 0, parentId: null } };
  switch (latest.status) {
    case "submitting":
      return input.now - Date.parse(latest.created_at) > SUBMIT_STALE_MS
        ? { step: current, action: { kind: "expire_submitting", generationId: latest.id } }
        : { step: current, action: { kind: "wait" } };
    case "submitted":
      return { step: current, action: { kind: "poll", generationId: latest.id, requestId: latest.provider_request_id ?? "" } };
    case "completed":
      return { step: current, action: { kind: "mark_done", generationId: latest.id } };
    case "failed":
      if (latest.attempt + 1 < spec.maxAttempts) {
        return { step: current, action: { kind: "submit", attempt: latest.attempt + 1, parentId: latest.id } };
      }
      return {
        step: current,
        action: { kind: "finish", status: "draft_failed", reason: `Bước ${label}: ${latest.error ?? "thất bại"}` },
      };
  }
}

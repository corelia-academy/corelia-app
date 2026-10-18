import { PROMPTS, promptVersion, type PromptKey } from "./prompts.ts";

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
}

export type Acceptance = { ok: true; summary: string } | { ok: false; reason: string };

export interface StepSpec {
  prompt: PromptKey;
  kind: "text" | "research" | "review";
  model: string;
  effort: string;
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
  prerequisites: strList,
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
  open_questions: {
    type: "array",
    items: object({ question: str, impact: str, blocking: { type: "boolean" }, action: str }),
  },
  handoff_notes: strList,
});

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
          outcome_ids: strList,
          prerequisites: strList,
          completion_rule: str,
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
  topics: { topic: string; source_ids: string[]; key_points: { point: string; source_ids: string[] }[] }[];
  sources: { source_id: string; authority: string; access: string }[];
  open_questions: { question: string; blocking: boolean }[];
}

interface Curriculum {
  status: string;
  missing: string[];
  outcomes: { id: string; check_lesson_ids: string[] }[];
  modules: { id: string; lessons: { id: string; outcome_ids: string[]; source_ids: string[] }[] }[];
}

function list(items: string[], max = 3): string {
  return items.slice(0, max).join("; ") + (items.length > max ? ` (+${items.length - max})` : "");
}

export function acceptBrief(output: unknown): Acceptance {
  const brief = output as Brief;
  if (brief.status !== "ready") return { ok: false, reason: `Brief thiếu dữ liệu: ${list(brief.open_questions)}` };
  return { ok: true, summary: "brief sẵn sàng." };
}

export function acceptResearch(output: unknown): Acceptance {
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
  if (problems.length > 0) return { ok: false, reason: `Research chưa đạt: ${list(problems)}` };
  const points = research.topics.reduce((n, t) => n + t.key_points.length, 0);
  return { ok: true, summary: `${research.topics.length} chủ đề, ${points} ý chính, ${read.size} nguồn đã đọc.` };
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
    if (l.outcome_ids.length === 0 || l.outcome_ids.some((id) => !outcomeIds.has(id))) problems.push(`lesson ${l.id} có outcome không hợp lệ`);
    if (l.source_ids.length === 0 || l.source_ids.some((id) => !sourceIds.has(id))) problems.push(`lesson ${l.id} có source_id không có trong research`);
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
    maxAttempts: 2,
    tools: [{ type: "web_search" }],
    schema: RESEARCH_SCHEMA,
    buildInput: (ctx) => ({
      course_type: "ai_generated",
      brief: ctx.outputs.brief,
      platform_formats: PLATFORM_FORMATS,
    }),
    accept: acceptResearch,
  },
  curriculum: {
    prompt: "a3-curriculum",
    kind: "text",
    model: MODEL,
    effort: EFFORT,
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
    return { step: current, action: { kind: "finish", status: "draft_failed", reason: `Bước ${label} chưa được triển khai.` } };
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

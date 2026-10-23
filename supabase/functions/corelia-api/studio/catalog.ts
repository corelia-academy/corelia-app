// Catalog Research Agent (A1): output schema, acceptance check, input and the tick decision of a
// catalog job. Pure code; catalog_run.ts does the database and provider calls.
// Contract: corelia-studio/docs/agents/catalog-research-agent.md.
import { PLATFORM_FORMAT_GUIDE } from "./formats.ts";
import { canRetry, roundFailures, type AttemptRow, type RoundFailures } from "./retry.ts";
import { EFFORT, list, MAX_RUN_MS, MODEL, SUBMIT_STALE_MS, utcDate, type Acceptance } from "./steps.ts";

export const SHARED_CRITERIA = ["trend", "demand", "ai_feasibility", "maintainability"] as const;
export const GROUP_CRITERIA = ["corelia_fit", "catalog_gap"] as const;
const CONFIDENCE = ["high", "medium", "low"] as const;
const GROUP_KINDS = ["skill", "role", "ecosystem"] as const;
/** Input fields of a group that a criterion can rest on. */
export const INPUT_REF_FIELDS = ["audience", "corelia_direction", "other_courses", "paths"] as const;

const str = { type: "string" };
const strList = { type: "array", items: str };

function object(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

const criterion = (names: readonly string[]) =>
  object({
    criterion: { type: "string", enum: [...names] },
    level: { type: ["integer", "null"] },
    evidence_ids: strList,
    confidence: { type: "string", enum: [...CONFIDENCE] },
    missing_data: str,
    conflicts: str,
  });

export const CATALOG_RESEARCH_SCHEMA = object({
  status: { type: "string", enum: ["evidence_ok", "needs_more_sources"] },
  shared: { type: "array", items: criterion(SHARED_CRITERIA) },
  by_group: {
    type: "array",
    items: object({
      group_kind: { type: "string", enum: [...GROUP_KINDS] },
      criteria: { type: "array", items: criterion(GROUP_CRITERIA) },
    }),
  },
  // One evidence_id space for both arrays.
  web_evidence: {
    type: "array",
    items: object({ evidence_id: str, url: str, metric: str, period: str, checked_at: str }),
  },
  input_evidence: {
    type: "array",
    items: object({ evidence_id: str, input_ref: str, note: str }),
  },
  open_questions: {
    type: "array",
    items: object({ question: str, impact: str, blocking: { type: "boolean" }, action: str }),
  },
});

/** Model call of one attempt. The model, effort and output budget follow the course research step (A2) until A1 is measured. */
export const CATALOG_SPEC = {
  prompt: "a1-catalog-research",
  model: MODEL,
  effort: EFFORT,
  maxOutputTokens: 40_000,
  /** Attempts the model answered and that were refused, per research round (as the steps of a run). */
  maxAttempts: 2,
  /**
   * web_search calls of one attempt (every action counts). Measured on a real course: 9 to 13 per
   * attempt, so 16 leaves a margin and bounds the tool cost of one attempt at $0.16.
   */
  maxToolCalls: 16,
  tools: [{ type: "web_search" }],
} as const;

/** Research rounds after the first, while trend or demand is still missing (as MAX_RESEARCH_REQUESTS of a run). */
export const MAX_CATALOG_RESEARCH_ROUNDS = 2;

/**
 * Hard cap on the estimated cost of one catalog job (USD). Measured on one real course (Rust,
 * 23/10/2026): $0.29 to $0.51 with the upper-bound pricing below. Checked before every new attempt.
 */
export const CATALOG_JOB_BUDGET_USD = 0.75;

/** USD per 1M tokens, input / output (docs/stack/0004-llm-provider-and-models.md, list prices). */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "gpt-6-astra": { input: 10, output: 50 },
  "gpt-6.1-sol": { input: 2, output: 10 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
};
/** web_search: $10 per 1,000 calls. */
export const WEB_SEARCH_USD_PER_CALL = 10 / 1000;

export interface PricedGeneration {
  model_id?: string | null;
  usage?: Record<string, unknown> | null;
}

/**
 * Upper-bound cost of one generation: every input token at the full input price (cached tokens and
 * the flex discount are not applied) and every web_search action as one call. A model without a
 * listed price is priced as the most expensive one, so an unknown model cannot slip under the budget.
 */
export function generationCostUsd(g: PricedGeneration): number {
  if (!g.usage) return 0;
  const model = g.model_id ?? "";
  const price = MODEL_PRICES[Object.keys(MODEL_PRICES).find((k) => model === k || model.startsWith(`${k}-`)) ?? ""] ??
    Object.values(MODEL_PRICES).reduce((a, b) => (b.output > a.output ? b : a));
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return (n(g.usage.input_tokens) * price.input + n(g.usage.output_tokens) * price.output) / 1e6 + n(g.usage.web_search_calls) * WEB_SEARCH_USD_PER_CALL;
}

export function catalogJobCostUsd(generations: PricedGeneration[]): number {
  return generations.reduce((sum, g) => sum + generationCostUsd(g), 0);
}

export type CatalogStatus = "evidence_ok" | "needs_more_sources";
export type GroupKind = typeof GROUP_KINDS[number];

export interface CatalogCriterion {
  criterion: string;
  level: number | null;
  evidence_ids: string[];
  confidence: string;
  missing_data: string;
  conflicts: string;
}

export interface WebEvidence {
  evidence_id: string;
  url: string;
  metric: string;
  period: string;
  checked_at: string;
}

export interface InputEvidence {
  evidence_id: string;
  input_ref: string;
  note: string;
}

export interface CatalogResearch {
  status: string;
  shared: CatalogCriterion[];
  by_group: { group_kind: string; criteria: CatalogCriterion[] }[];
  web_evidence: WebEvidence[];
  input_evidence: InputEvidence[];
  open_questions: { question: string; impact: string; blocking: boolean; action: string }[];
}

export interface CatalogAcceptContext {
  today: string;
  /** group_kind of every group in the input: by_group has exactly these. */
  groupKinds: string[];
}

export type CatalogAcceptance = Acceptance;

/** The hard gate (D2): a course without trend or demand cannot be ranked, whatever the model said. */
export function catalogStatus(output: unknown): CatalogStatus {
  return catalogGap(output).length > 0 ? "needs_more_sources" : "evidence_ok";
}

/** What blocks scoring: one line per missing trend/demand level, with what the model searched for. */
export function catalogGap(output: unknown): string[] {
  const research = output as CatalogResearch;
  return research.shared
    .filter((c) => (c.criterion === "trend" || c.criterion === "demand") && c.level === null)
    .map((c) => `${c.criterion}: ${c.missing_data.trim() || "không có dữ liệu"}`);
}

function sameSet(label: string, actual: string[], expected: readonly string[], problems: string[]) {
  const seen = new Set<string>();
  for (const a of actual) {
    if (seen.has(a)) problems.push(`${label} có "${a}" nhiều lần`);
    seen.add(a);
    if (!expected.includes(a)) problems.push(`${label} có "${a}" không thuộc đầu vào`);
  }
  const absent = expected.filter((e) => !seen.has(e));
  if (absent.length > 0) problems.push(`${label} thiếu ${absent.join(", ")}`);
}

export function acceptCatalogResearch(output: unknown, ctx: CatalogAcceptContext): CatalogAcceptance {
  const research = output as CatalogResearch;
  const problems: string[] = [];

  const web = new Map<string, WebEvidence>();
  const input = new Map<string, InputEvidence>();
  const seen = new Set<string>();
  const claim = (id: string): boolean => {
    if (!id.trim()) problems.push("bằng chứng có evidence_id trống");
    else if (seen.has(id)) problems.push(`evidence_id ${id} bị trùng`);
    else {
      seen.add(id);
      return true;
    }
    return false;
  };
  for (const e of research.web_evidence) if (claim(e.evidence_id)) web.set(e.evidence_id, e);
  for (const e of research.input_evidence) if (claim(e.evidence_id)) input.set(e.evidence_id, e);

  // The model receives today's date in its input; a web source dated otherwise was not checked on this
  // run. The day before is accepted for a response that finished after midnight UTC (as acceptResearch).
  const yesterday = utcDate(Date.parse(ctx.today) - 24 * 60 * 60 * 1000);
  for (const e of web.values()) {
    if (!e.url.trim()) problems.push(`bằng chứng ${e.evidence_id} (web) thiếu url`);
    if (e.checked_at !== ctx.today && e.checked_at !== yesterday) {
      problems.push(`bằng chứng ${e.evidence_id}: ngày kiểm tra ${e.checked_at || "trống"} không phải ngày chạy`);
    }
  }
  for (const e of input.values()) {
    if (!e.input_ref.trim()) {
      problems.push(`bằng chứng ${e.evidence_id} (input) thiếu input_ref`);
      continue;
    }
    const [root, kind, field, ...rest] = e.input_ref.split(".");
    if (root !== "groups" || !kind || !field || rest.length > 0 || !(INPUT_REF_FIELDS as readonly string[]).includes(field)) {
      problems.push(`bằng chứng ${e.evidence_id}: input_ref "${e.input_ref}" phải có dạng groups.<group_kind>.<${INPUT_REF_FIELDS.join("|")}>`);
    } else if (!ctx.groupKinds.includes(kind)) {
      problems.push(`bằng chứng ${e.evidence_id}: input_ref "${e.input_ref}" trỏ tới nhóm ${kind} không có trong đầu vào`);
    }
  }

  const checkCriterion = (where: string, c: CatalogCriterion, own: "web" | "input") => {
    const label = `${where}/${c.criterion}`;
    const missing = c.missing_data.trim() !== "";
    if (c.level === null) {
      if (!missing) problems.push(`${label}: level null nhưng missing_data trống`);
      if (c.confidence !== "low") problems.push(`${label}: level null thì confidence phải là low`);
    } else {
      if (missing) problems.push(`${label}: có missing_data nhưng level khác null`);
      if (!Number.isInteger(c.level) || c.level < 1 || c.level > 5) problems.push(`${label}: level ${c.level} ngoài khoảng 1–5`);
      if (c.evidence_ids.length === 0) problems.push(`${label}: có level nhưng không có evidence_ids`);
    }
    const unknown = c.evidence_ids.filter((id) => !web.has(id) && !input.has(id));
    for (const id of unknown) problems.push(`${label}: evidence_id ${id} không có trong web_evidence hoặc input_evidence`);
    if (own === "web") {
      // The four shared criteria are measured on the open web only.
      if (c.evidence_ids.some((id) => input.has(id))) problems.push(`${label}: tiêu chí chung chỉ được dẫn bằng chứng web`);
    } else if (c.level !== null && !c.evidence_ids.some((id) => input.has(id))) {
      problems.push(`${label}: cần ít nhất một bằng chứng input`);
    }
  };

  sameSet("shared", research.shared.map((c) => c.criterion), SHARED_CRITERIA, problems);
  for (const c of research.shared) checkCriterion("shared", c, "web");

  sameSet("by_group", research.by_group.map((g) => g.group_kind), ctx.groupKinds, problems);
  for (const g of research.by_group) {
    sameSet(`by_group.${g.group_kind}`, g.criteria.map((c) => c.criterion), GROUP_CRITERIA, problems);
    for (const c of g.criteria) checkCriterion(`by_group.${g.group_kind}`, c, "input");
  }

  if (problems.length > 0) return { ok: false, reason: `Hồ sơ catalog chưa đạt: ${list(problems, 5)}` };
  const status = catalogStatus(output);
  const rated = [...research.shared, ...research.by_group.flatMap((g) => g.criteria)];
  return {
    ok: true,
    summary: `${rated.filter((c) => c.level !== null).length}/${rated.length} tiêu chí có mức, ${web.size} bằng chứng web, ${input.size} bằng chứng input, ${status}.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------

export class CatalogInputError extends Error {
  constructor(readonly code: "course_not_found" | "course_has_no_path" | "scope_missing", message: string) {
    super(message);
  }
}

export interface CatalogGroup {
  group_kind: string;
  audience: string;
  corelia_direction: string;
  locale: string;
  paths: string[];
  other_courses: { title: string; level: string | null; status: string }[];
}

export interface CatalogBase {
  course: { title: string; level: string | null };
  groups: CatalogGroup[];
  research_period_days: number;
}

export interface CatalogRows {
  course: { title: string; level: string | null };
  /** Paths of the course. */
  paths: { group_kind: string; title: string }[];
  scopes: { group_kind: string; audience: string; corelia_direction: string; locale: string; research_period_days: number }[];
  /** Courses with a path in one of the groups, the course itself included; a course in several paths of a group repeats. */
  neighbours: { group_kind: string; id: string; title: string; level: string | null; status: string }[];
  courseId: string;
}

/**
 * One group per group_kind in which the course has a path, in a fixed order. `other_courses` are the
 * other courses of the group, each once. The measuring period is the longest of the groups' periods
 * (the research is shared by all groups of the course).
 */
export function assembleCatalogBase(rows: CatalogRows): CatalogBase {
  if (rows.paths.length === 0) throw new CatalogInputError("course_has_no_path", "Khóa chưa thuộc path nào nên không có phạm vi để nghiên cứu.");
  const kinds = GROUP_KINDS.filter((k) => rows.paths.some((p) => p.group_kind === k));
  const groups = kinds.map((kind): CatalogGroup => {
    const scope = rows.scopes.find((s) => s.group_kind === kind);
    if (!scope) throw new CatalogInputError("scope_missing", `Nhóm ${kind} chưa có scope (audience, định hướng Corelia).`);
    const others = new Map<string, CatalogGroup["other_courses"][number]>();
    for (const n of rows.neighbours) {
      if (n.group_kind === kind && n.id !== rows.courseId) others.set(n.id, { title: n.title, level: n.level, status: n.status });
    }
    return {
      group_kind: kind,
      audience: scope.audience,
      corelia_direction: scope.corelia_direction,
      locale: scope.locale,
      paths: rows.paths.filter((p) => p.group_kind === kind).map((p) => p.title),
      other_courses: [...others.values()],
    };
  });
  const period = Math.max(...kinds.map((k) => rows.scopes.find((s) => s.group_kind === k)!.research_period_days));
  return { course: rows.course, groups, research_period_days: period };
}

export interface CatalogResearchGap {
  round: number;
  missing: string[];
}

/** The previous record and what it still lacks, when its round was accepted but trend or demand is still null. */
export function catalogResearchGap(rounds: number, latest: unknown): { previous_research: unknown; research_gap: CatalogResearchGap } | null {
  if (rounds === 0 || !latest) return null;
  const missing = catalogGap(latest);
  return missing.length > 0 ? { previous_research: latest, research_gap: { round: rounds, missing } } : null;
}

export function buildCatalogInput(
  base: CatalogBase,
  today: string,
  followUp: ReturnType<typeof catalogResearchGap>,
  rejectedBecause: { attempt: number; reason: string } | null,
): Record<string, unknown> {
  return {
    course: base.course,
    groups: base.groups,
    research_period_days: base.research_period_days,
    today,
    platform_formats: PLATFORM_FORMAT_GUIDE,
    ...(followUp ?? {}),
    ...(rejectedBecause ? { previous_attempt: { attempt: rejectedBecause.attempt, rejected_because: rejectedBecause.reason } } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Tick decision
// ---------------------------------------------------------------------------------------------

export interface CatalogGeneration extends AttemptRow, PricedGeneration {
  id: string;
  error: string | null;
  created_at: string;
}

export type CatalogAction =
  | { kind: "finish"; status: CatalogStatus | "failed"; reason: string }
  | { kind: "submit"; attempt: number; parentId: string | null }
  | { kind: "poll"; generationId: string; requestId: string }
  | { kind: "expire_submitting"; generationId: string }
  | { kind: "wait" };

/** Next action for one running catalog job. Pure: catalog_run.ts executes it. */
export function planCatalogJob(input: {
  /** Every generation of the job. */
  generations: CatalogGeneration[];
  startedAt: string;
  now: number;
  /** Outcome of the newest generation when it is completed (read from its output); null otherwise. */
  latestResult: { status: CatalogStatus; missing: string[] } | null;
}): CatalogAction {
  if (input.now - Date.parse(input.startedAt) > MAX_RUN_MS) {
    return { kind: "finish", status: "failed", reason: "Lượt nghiên cứu vượt quá 24 giờ." };
  }
  const rows = [...input.generations].sort((a, b) => a.attempt - b.attempt);
  const latest = rows.at(-1);
  // Every new attempt (first, retry or next round) is checked against the budget first.
  const spent = catalogJobCostUsd(rows);
  const submit = (attempt: number, parentId: string | null): CatalogAction =>
    spent >= CATALOG_JOB_BUDGET_USD
      ? { kind: "finish", status: "failed", reason: `Vượt ngân sách $${CATALOG_JOB_BUDGET_USD.toFixed(2)} cho một job (đã tiêu ước lượng $${spent.toFixed(2)}).` }
      : { kind: "submit", attempt, parentId };
  if (!latest) return submit(0, null);
  switch (latest.status) {
    case "submitting":
      return input.now - Date.parse(latest.created_at) > SUBMIT_STALE_MS
        ? { kind: "expire_submitting", generationId: latest.id }
        : { kind: "wait" };
    case "submitted":
      return { kind: "poll", generationId: latest.id, requestId: latest.provider_request_id ?? "" };
    case "completed": {
      const result = input.latestResult;
      if (!result) return { kind: "finish", status: "failed", reason: "Không đọc được kết quả của lượt nghiên cứu." };
      if (result.status === "evidence_ok") return { kind: "finish", status: "evidence_ok", reason: "" };
      const rounds = rows.filter((r) => r.status === "completed").length;
      if (rounds > MAX_CATALOG_RESEARCH_ROUNDS) {
        return { kind: "finish", status: "needs_more_sources", reason: `Vẫn thiếu bằng chứng sau ${rounds} vòng nghiên cứu: ${list(result.missing, 5)}` };
      }
      // Research again for what is missing; the accepted record is passed on (previous_research).
      return submit(latest.attempt + 1, latest.id);
    }
    case "failed": {
      if (canRetry(failuresOfRound(rows), CATALOG_SPEC.maxAttempts)) return submit(latest.attempt + 1, latest.id);
      return { kind: "finish", status: "failed", reason: latest.error ?? "Lượt nghiên cứu thất bại." };
    }
    default:
      return { kind: "finish", status: "failed", reason: `Trạng thái lượt sinh không hợp lệ: ${latest.status}` };
  }
}

/** The retry budget is per round: attempts up to the last accepted one do not count (as buildProgress). */
export function failuresOfRound(rows: AttemptRow[]): RoundFailures {
  const accepted = rows.filter((r) => r.status === "completed").map((r) => r.attempt);
  return roundFailures(rows, accepted.length ? Math.max(...accepted) + 1 : 0);
}

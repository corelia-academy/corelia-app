// Catalog scoring and ranking (roadmap 3.1, stage 3): group scores, group rankings and the
// production order. Pure code; ranking_run.ts reads the inputs and saves the result.
import { GROUP_CRITERIA, SHARED_CRITERIA, type CatalogCriterion, type CatalogResearch, type GroupKind } from "./catalog.ts";

/** Written on every pass (studio_catalog_rankings.algorithm_version). Bump when a rule below changes. */
export const RANKING_ALGORITHM_VERSION = "rank@v1";

/** Order of the group rankings, and the tie order when two groups give a course the same MAX score. */
export const RANKING_GROUPS: readonly GroupKind[] = ["skill", "role", "ecosystem"];
/** Statuses of a course that can enter the production order. */
const PRODUCTION_STATUSES = ["idea", "not_passed", "needs_update"];
/** Only these candidates hold back the courses that depend on them while they are left out. */
const BLOCKING_STATUSES = ["idea", "not_passed"];
const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export type Confidence = "high" | "medium" | "low";
export type ExcludedReason =
  | "not_researched"
  | "missing_core_criteria"
  | "no_path"
  | "prerequisite_cycle"
  | "blocked_by_prerequisite";
export type Weights = Record<string, number>;

export interface RankingCourse {
  id: string;
  status: string;
  policy_tier: string;
  created_at: string;
  paths: { path_id: string; group_kind: GroupKind; learning_order: number }[];
}

/** The accepted record of the latest finished job of a course. */
export interface CourseResearch {
  job_id: string;
  research: CatalogResearch;
}

export interface ManualOrder {
  course_id: string;
  position: number;
  created_at: string;
}

export interface RankingInput {
  courses: RankingCourse[];
  /** By course id; a course without an entry has not been researched. */
  research: Record<string, CourseResearch>;
  weights: Weights;
  /** Active manual orders. */
  manualOrders: ManualOrder[];
}

export type Component = { level: number; weight_used: number; confidence: string } | { missing: true };

export interface ScoreRow {
  course_id: string;
  job_id: string | null;
  components: Record<string, Component>;
  total: number | null;
  confidence: Confidence | null;
  rank: number | null;
  excluded_reason: ExcludedReason | null;
  placement_reason: "prerequisite_of" | "manual" | null;
  placement_for: string | null;
}

export interface RankingPass {
  /** null = production order. */
  group_kind: GroupKind | null;
  rows: ScoreRow[];
}

/** Payload of studio_save_ranking: the rows of a pass travel under the key "scores". */
export function rankingPayload(passes: RankingPass[]): { group_kind: GroupKind | null; scores: ScoreRow[] }[] {
  return passes.map((p) => ({ group_kind: p.group_kind, scores: p.rows }));
}

export type ManualOrderRejection = "not_ranked" | "violates_prerequisite";

interface GroupScore {
  components: Record<string, Component>;
  /** null when trend or demand has no level. */
  total: number | null;
  confidence: Confidence | null;
}

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const validLevel = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

function levelsOf(criteria: CatalogCriterion[], names: readonly string[]) {
  return names.map((name) => ({ name, found: criteria.find((c) => c.criterion === name) }));
}

function hasCoreLevels(research: CatalogResearch): boolean {
  return ["trend", "demand"].every((n) => validLevel(research.shared.find((c) => c.criterion === n)?.level));
}

/**
 * Score of one course in one group, or null when the research has no entry for the group (the group
 * was assigned after the research). Weights are renormalised over the criteria that have a level;
 * the total is rounded once, at the end. A missing level is left out, never counted as 0.
 */
export function scoreGroup(research: CatalogResearch, kind: GroupKind, weights: Weights): GroupScore | null {
  const group = research.by_group.find((g) => g.group_kind === kind);
  if (!group) return null;

  const entries = [...levelsOf(research.shared, SHARED_CRITERIA), ...levelsOf(group.criteria, GROUP_CRITERIA)];
  const used = entries.flatMap(({ name, found }) => (found && validLevel(found.level) ? [{ name, level: found.level, confidence: found.confidence }] : []));
  const components: Record<string, Component> = {};
  for (const { name } of entries) components[name] = { missing: true };
  if (used.length === 0) return { components, total: null, confidence: null };

  const weightSum = used.reduce((s, u) => s + (weights[u.name] ?? 0), 0);
  if (weightSum <= 0) throw new Error("weights_unusable");
  for (const u of used) {
    components[u.name] = { level: u.level, weight_used: Math.round(((weights[u.name] ?? 0) / weightSum) * 1e4) / 1e4, confidence: u.confidence };
  }

  const mean = used.reduce((s, u) => s + (weights[u.name] ?? 0) * u.level, 0) / weightSum;
  const lowest = used.reduce((m, u) => ((CONFIDENCE_RANK[u.confidence] ?? 0) < (CONFIDENCE_RANK[m] ?? 0) ? u.confidence : m), used[0].confidence);
  return { components, total: hasCoreLevels(research) ? round2(((mean - 1) / 4) * 100) : null, confidence: lowest as Confidence };
}

interface Scored {
  course: RankingCourse;
  job_id: string;
  total: number;
  confidence: Confidence;
  components: Record<string, Component>;
}

/** Highest rounded score first, then the earlier created_at, then id. */
function compareScored(a: Scored, b: Scored): number {
  return b.total - a.total || cmp(Date.parse(a.course.created_at), Date.parse(b.course.created_at)) || cmp(a.course.id, b.course.id);
}

const row = (course_id: string, over: Partial<ScoreRow>): ScoreRow => ({
  course_id,
  job_id: null,
  components: {},
  total: null,
  confidence: null,
  rank: null,
  excluded_reason: null,
  placement_reason: null,
  placement_for: null,
  ...over,
});

function rankGroup(kind: GroupKind, input: RankingInput): RankingPass {
  const ranked: Scored[] = [];
  const excluded: ScoreRow[] = [];
  for (const course of input.courses) {
    if (!course.paths.some((p) => p.group_kind === kind)) continue;
    const found = input.research[course.id];
    if (!found) {
      excluded.push(row(course.id, { excluded_reason: "not_researched" }));
      continue;
    }
    const score = scoreGroup(found.research, kind, input.weights);
    if (!score) continue;
    if (score.total === null || score.confidence === null) {
      excluded.push(row(course.id, { job_id: found.job_id, components: score.components, excluded_reason: "missing_core_criteria" }));
    } else {
      ranked.push({ course, job_id: found.job_id, total: score.total, confidence: score.confidence, components: score.components });
    }
  }
  ranked.sort(compareScored);
  const rows = ranked.map((s, i) => row(s.course.id, { job_id: s.job_id, components: s.components, total: s.total, confidence: s.confidence, rank: i + 1 }));
  excluded.sort((a, b) => cmp(a.course_id, b.course_id));
  return { group_kind: kind, rows: [...rows, ...excluded] };
}

/** prerequisites.get(b) = courses that must come before b, with the largest learning_order they have in a path shared with b. */
function prerequisiteGraph(courses: RankingCourse[]): Map<string, Map<string, number>> {
  const known = new Set(courses.map((c) => c.id));
  const byPath = new Map<string, { course_id: string; lo: number }[]>();
  for (const c of courses) {
    for (const p of c.paths) byPath.set(p.path_id, [...(byPath.get(p.path_id) ?? []), { course_id: c.id, lo: p.learning_order }]);
  }
  const prerequisites = new Map<string, Map<string, number>>(courses.map((c) => [c.id, new Map()]));
  for (const members of byPath.values()) {
    for (const base of members) {
      for (const dependent of members) {
        if (base.lo < dependent.lo && known.has(base.course_id) && known.has(dependent.course_id)) {
          const map = prerequisites.get(dependent.course_id)!;
          map.set(base.course_id, Math.max(map.get(base.course_id) ?? -1, base.lo));
        }
      }
    }
  }
  return prerequisites;
}

/** Courses that sit in a prerequisite cycle (strongly connected component with more than one course). */
function cycleMembers(prerequisites: Map<string, Map<string, number>>): Set<string> {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const members = new Set<string>();
  let counter = 0;
  const visit = (v: string) => {
    index.set(v, counter);
    low.set(v, counter++);
    stack.push(v);
    onStack.add(v);
    for (const w of prerequisites.get(v)?.keys() ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) component.forEach((c) => members.add(c));
    }
  };
  for (const v of [...prerequisites.keys()].sort()) if (!index.has(v)) visit(v);
  return members;
}

interface Production {
  /** Candidate ids in computed order (before manual orders). */
  order: string[];
  reasons: Map<string, { placement_for: string }>;
  scored: Map<string, Scored>;
  excluded: ScoreRow[];
  prerequisites: Map<string, Map<string, number>>;
}

function buildProduction(input: RankingInput): Production {
  const prerequisites = prerequisiteGraph(input.courses);
  const cycles = cycleMembers(prerequisites);
  const candidates = input.courses.filter((c) => PRODUCTION_STATUSES.includes(c.status));

  const scored = new Map<string, Scored>();
  const own = new Map<string, ExcludedReason>();
  for (const course of candidates) {
    const found = input.research[course.id];
    let reason: ExcludedReason | null = null;
    if (!found) reason = "not_researched";
    else if (!hasCoreLevels(found.research)) reason = "missing_core_criteria";
    else if (course.paths.length === 0) reason = "no_path";

    if (!reason && found) {
      // MAX over the groups the course has a path in and the research covers; the first group wins a tie.
      let best: Scored | null = null;
      for (const kind of RANKING_GROUPS) {
        if (!course.paths.some((p) => p.group_kind === kind)) continue;
        const s = scoreGroup(found.research, kind, input.weights);
        if (s && s.total !== null && s.confidence !== null && (!best || s.total > best.total)) {
          best = { course, job_id: found.job_id, total: s.total, confidence: s.confidence, components: s.components };
        }
      }
      // Paths exist but none of their groups was part of the research: nothing to score yet.
      if (best) scored.set(course.id, best);
      else reason = "not_researched";
    }
    if (!reason && cycles.has(course.id)) reason = "prerequisite_cycle";
    if (reason) own.set(course.id, reason);
  }

  // A course left out blocks its dependents only while it is idea or not_passed; the blocked set is
  // closed over dependents, so it is built to a fixpoint and the blocker named afterwards.
  const out = new Set(own.keys());
  const blockers = () => candidates.filter((c) => out.has(c.id) && BLOCKING_STATUSES.includes(c.status)).map((c) => c.id);
  const blockedBy = new Map<string, string>();
  for (let changed = true; changed;) {
    changed = false;
    const blocking = new Set(blockers());
    for (const course of candidates) {
      if (out.has(course.id)) continue;
      if ([...(prerequisites.get(course.id)?.keys() ?? [])].some((p) => blocking.has(p))) {
        out.add(course.id);
        blockedBy.set(course.id, "");
        changed = true;
      }
    }
  }
  const finalBlocking = new Set(blockers());
  for (const id of blockedBy.keys()) {
    const [first] = [...(prerequisites.get(id) ?? [])].filter(([p]) => finalBlocking.has(p)).sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
    blockedBy.set(id, first[0]);
  }

  const excluded: ScoreRow[] = candidates.filter((c) => out.has(c.id)).map((c) => {
    const blocker = blockedBy.get(c.id);
    const job_id = input.research[c.id]?.job_id ?? null;
    return blocker
      ? row(c.id, { job_id, excluded_reason: "blocked_by_prerequisite", placement_for: blocker })
      : row(c.id, { job_id, excluded_reason: own.get(c.id)! });
  }).sort((a, b) => cmp(a.course_id, b.course_id));

  // Order: pilot before standard, then score. A course is preceded by the ranked courses it depends
  // on that are not placed yet ("pulled up"), each in its own order, recursively.
  const ranked = [...scored.values()].filter((s) => !out.has(s.course.id));
  const rankedIds = new Set(ranked.map((s) => s.course.id));
  const compare = (a: Scored, b: Scored) =>
    (a.course.policy_tier === "pilot" ? 0 : 1) - (b.course.policy_tier === "pilot" ? 0 : 1) || compareScored(a, b);
  const order: string[] = [];
  const reasons = new Map<string, { placement_for: string }>();
  const seen = new Set<string>();
  const place = (s: Scored, pulledFor: string | null) => {
    if (seen.has(s.course.id)) return;
    seen.add(s.course.id);
    const bases = [...(prerequisites.get(s.course.id)?.keys() ?? [])]
      .filter((p) => rankedIds.has(p) && !seen.has(p))
      .map((p) => scored.get(p)!)
      .sort(compare);
    for (const base of bases) place(base, s.course.id);
    if (pulledFor) reasons.set(s.course.id, { placement_for: pulledFor });
    order.push(s.course.id);
  };
  for (const s of [...ranked].sort(compare)) place(s, null);

  return { order, reasons, scored, excluded, prerequisites };
}

/** True when no ranked course stands before a ranked course it depends on. */
function respectsPrerequisites(order: string[], prerequisites: Map<string, Map<string, number>>): boolean {
  const position = new Map(order.map((id, i) => [id, i]));
  return order.every((id) => [...(prerequisites.get(id)?.keys() ?? [])].every((p) => !position.has(p) || position.get(p)! < position.get(id)!));
}

function placeManual(base: string[], accepted: { course_id: string; position: number }[]): string[] {
  const moved = new Set(accepted.map((m) => m.course_id));
  const order = base.filter((id) => !moved.has(id));
  // Orders of the same position follow each other, the better one first.
  accepted.forEach((m, i) => {
    const sameBefore = accepted.slice(0, i).filter((a) => a.position === m.position).length;
    order.splice(Math.min(m.position + sameBefore, order.length + 1) - 1, 0, m.course_id);
  });
  return order;
}

/**
 * Applies the manual orders to the computed order, lowest position first (the same position: the
 * scoring tie-break). An order for a course that has no rank is ignored; an order that would put a
 * course before one of its prerequisites is rejected and the computed order is kept for that course.
 */
function applyManualOrders(production: Production, manualOrders: ManualOrder[]) {
  const latest = new Map<string, ManualOrder>();
  for (const m of [...manualOrders].sort((a, b) => cmp(Date.parse(a.created_at), Date.parse(b.created_at)))) latest.set(m.course_id, m);
  const candidates = [...latest.values()]
    .filter((m) => production.scored.has(m.course_id) && production.order.includes(m.course_id))
    .sort((a, b) => a.position - b.position || compareScored(production.scored.get(a.course_id)!, production.scored.get(b.course_id)!));

  const accepted: { course_id: string; position: number }[] = [];
  const rejected: { course_id: string; reason: ManualOrderRejection }[] = [];
  for (const m of candidates) {
    const trial = [...accepted, { course_id: m.course_id, position: m.position }];
    if (respectsPrerequisites(placeManual(production.order, trial), production.prerequisites)) accepted.push(trial.at(-1)!);
    else rejected.push({ course_id: m.course_id, reason: "violates_prerequisite" });
  }
  return { order: placeManual(production.order, accepted), manual: new Set(accepted.map((a) => a.course_id)), rejected };
}

function productionPass(input: RankingInput): RankingPass {
  const production = buildProduction(input);
  const { order, manual } = applyManualOrders(production, input.manualOrders);
  const rows = order.map((id, i) => {
    const s = production.scored.get(id)!;
    const pulled = production.reasons.get(id);
    return row(id, {
      job_id: s.job_id,
      components: s.components,
      total: s.total,
      confidence: s.confidence,
      rank: i + 1,
      ...(manual.has(id)
        ? { placement_reason: "manual" as const }
        : pulled ? { placement_reason: "prerequisite_of" as const, placement_for: pulled.placement_for } : {}),
    });
  });
  return { group_kind: null, rows: [...rows, ...production.excluded] };
}

/** One pass: the group rankings in RANKING_GROUPS order, then the production order. */
export function computeRankings(input: RankingInput): RankingPass[] {
  return [...RANKING_GROUPS.map((kind) => rankGroup(kind, input)), productionPass(input)];
}

/**
 * Check for a manual order before it is saved: the same logic as the production order. The course
 * must have a rank, and with the other active orders applied it must not stand before a course it
 * depends on (nor push a course with an active order of its own before one).
 */
export function checkManualOrder(input: RankingInput, courseId: string, position: number): { ok: true } | { ok: false; reason: ManualOrderRejection } {
  const production = buildProduction(input);
  if (!production.order.includes(courseId)) return { ok: false, reason: "not_ranked" };
  const others = input.manualOrders.filter((m) => m.course_id !== courseId);
  const { manual } = applyManualOrders(production, [...others, { course_id: courseId, position, created_at: new Date(8.64e15).toISOString() }]);
  return manual.has(courseId) ? { ok: true } : { ok: false, reason: "violates_prerequisite" };
}

/** Microseconds of a timestamptz as PostgREST prints it (the fraction can have 0-6 digits). */
function micros(ts: string): number {
  const fraction = /\.(\d+)/.exec(ts)?.[1] ?? "";
  return Date.parse(ts.replace(/\.\d+/, "")) * 1000 + Number(fraction.slice(0, 6).padEnd(6, "0"));
}

/** The later of two marks (null = none). */
export function laterMark(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return a ?? b;
  return micros(b) > micros(a) ? b : a;
}

/**
 * Whether the production order must be computed again. `mark` is the newest finished research,
 * manual order, course update, or course-path update now (null: no research has finished); `latest`
 * is the newest production ranking, with the mark it was computed from.
 */
export function isRankingStale(mark: string | null, latest: { source_as_of: string | null } | null): boolean {
  if (mark === null) return false;
  if (!latest || latest.source_as_of === null) return true;
  return micros(mark) > micros(latest.source_as_of);
}

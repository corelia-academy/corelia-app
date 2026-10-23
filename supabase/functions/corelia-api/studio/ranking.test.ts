import { describe, expect, it } from "vitest";

import type { CatalogCriterion, CatalogResearch, GroupKind } from "./catalog.ts";
import {
  checkManualOrder,
  computeRankings,
  isRankingStale,
  laterMark,
  RANKING_ALGORITHM_VERSION,
  rankingPayload,
  scoreGroup,
  type ManualOrder,
  type RankingCourse,
  type RankingInput,
  type RankingPass,
  type ScoreRow,
  type Weights,
} from "./ranking.ts";

const W1: Weights = { trend: 0.25, demand: 0.25, corelia_fit: 0.2, catalog_gap: 0.15, ai_feasibility: 0.1, maintainability: 0.05 };

type Level = number | null;
interface Levels {
  trend?: Level;
  demand?: Level;
  ai?: Level;
  maint?: Level;
  /** [corelia_fit, catalog_gap] per group present in the research. */
  groups?: Partial<Record<GroupKind, [Level, Level]>>;
}

const crit = (criterion: string, level: Level, confidence = "medium"): CatalogCriterion => ({
  criterion,
  level,
  evidence_ids: [],
  confidence,
  missing_data: "",
  conflicts: "",
});

function research(l: Levels = {}, confidence = "medium"): CatalogResearch {
  const has = (k: keyof Levels) => (k in l ? (l[k] as Level) : 4);
  return {
    status: "evidence_ok",
    shared: [crit("trend", has("trend"), confidence), crit("demand", has("demand"), confidence), crit("ai_feasibility", has("ai"), confidence), crit("maintainability", has("maint"), confidence)],
    by_group: Object.entries(l.groups ?? { skill: [4, 4] }).map(([group_kind, [fit, gap]]) => ({
      group_kind,
      criteria: [crit("corelia_fit", fit, confidence), crit("catalog_gap", gap, confidence)],
    })),
    web_evidence: [],
    input_evidence: [],
    open_questions: [],
  };
}

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;

function course(name: string, over: Partial<RankingCourse> & { order?: number; path?: string; kind?: GroupKind } = {}): RankingCourse {
  const { order, path, kind, ...rest } = over;
  return {
    id: id(name),
    status: "idea",
    policy_tier: "standard",
    created_at: "2026-10-01T00:00:00Z",
    paths: [{ path_id: path ?? "p1", group_kind: kind ?? "skill", learning_order: order ?? 0 }],
    ...rest,
  };
}

/** Research entry for a course: job id derived from the course id. */
const withResearch = (courses: RankingCourse[], levels: Record<string, Levels>) =>
  Object.fromEntries(courses.filter((c) => levels[c.id] !== undefined).map((c) => [c.id, { job_id: `job-${c.id}`, research: research(levels[c.id]) }]));

function input(courses: RankingCourse[], levels: Record<string, Levels>, manualOrders: ManualOrder[] = []): RankingInput {
  return { courses, research: withResearch(courses, levels), weights: W1, manualOrders };
}

const pass = (passes: RankingPass[], kind: RankingPass["group_kind"]) => passes.find((p) => p.group_kind === kind)!;
const production = (i: RankingInput) => pass(computeRankings(i), null).rows;
const ranked = (rows: ScoreRow[]) => rows.filter((r) => r.rank !== null).sort((a, b) => a.rank! - b.rank!);
const names = (rows: ScoreRow[]) => ranked(rows).map((r) => Number(r.course_id.slice(-12)));
const rowOf = (rows: ScoreRow[], name: string) => rows.find((r) => r.course_id === id(name))!;

/** Levels giving a total of exactly `total` is awkward; shared 4 with group [fit, gap] gives these. */
const L = (fit: Level, gap: Level, extra: Levels = {}): Levels => ({ groups: { skill: [fit, gap] }, ...extra });

describe("scoreGroup", () => {
  it("KB1: weighted mean mapped to 0-100 per group, production takes the MAX", () => {
    const c = course("1", { paths: [
      { path_id: "p1", group_kind: "skill", learning_order: 0 },
      { path_id: "p2", group_kind: "ecosystem", learning_order: 0 },
    ] });
    const i = input([c], { [c.id]: { trend: 4, demand: 4, ai: 4, maint: 5, groups: { skill: [5, 5], ecosystem: [3, 1] } } });
    const passes = computeRankings(i);
    expect(rowOf(pass(passes, "skill").rows, "1").total).toBe(85);
    expect(rowOf(pass(passes, "ecosystem").rows, "1").total).toBe(60);
    expect(pass(passes, "role").rows).toEqual([]);
    const prod = rowOf(pass(passes, null).rows, "1");
    expect(prod.total).toBe(85);
    expect(prod.rank).toBe(1);
    expect(prod.job_id).toBe(`job-${c.id}`);
  });

  it("KB2b: catalog_gap 5 in a group with no other course scores without error", () => {
    const r = research({ groups: { role: [3, 5] } });
    expect(scoreGroup(r, "role", W1)?.total).not.toBeNull();
  });

  it("KB6: a missing level leaves the criterion out and renormalises the weights", () => {
    const r = research({ maint: null, groups: { skill: [5, 5] } });
    const s = scoreGroup(r, "skill", W1)!;
    // (0.25*4 + 0.25*4 + 0.1*4 + 0.2*5 + 0.15*5) / 0.95 = 4.368421 -> 84.21
    expect(s.total).toBe(84.21);
    expect(s.components.maintainability).toEqual({ missing: true });
    expect(s.components.trend).toMatchObject({ level: 4, weight_used: 0.2632 });
  });

  it("T3: a missing group criterion renormalises inside that group only", () => {
    const c = course("1", { paths: [
      { path_id: "p1", group_kind: "skill", learning_order: 0 },
      { path_id: "p2", group_kind: "ecosystem", learning_order: 0 },
    ] });
    const i = input([c], { [c.id]: { groups: { skill: [null, 5], ecosystem: [4, 4] } } });
    const passes = computeRankings(i);
    // skill: (1 + 1 + 0.4 + 0.2 + 0.75) / 0.8 = 4.1875 -> 79.69 ; ecosystem unchanged: 4 -> 75
    expect(rowOf(pass(passes, "skill").rows, "1").total).toBe(79.69);
    expect(rowOf(pass(passes, "ecosystem").rows, "1").total).toBe(75);
  });

  it("the confidence of a row is the lowest among the criteria with a level", () => {
    const r = research({ groups: { skill: [4, 4] } });
    r.shared[2].confidence = "low";
    r.by_group[0].criteria[0].confidence = "high";
    expect(scoreGroup(r, "skill", W1)?.confidence).toBe("low");
  });

  it("ignores a level outside 1-5 instead of counting it", () => {
    const r = research({ groups: { skill: [9, 4] } });
    expect(scoreGroup(r, "skill", W1)?.components.corelia_fit).toEqual({ missing: true });
  });
});

describe("group rankings", () => {
  it("KB3: ties go to the earlier created_at, then id; the result does not depend on input order", () => {
    const a = course("1", { created_at: "2026-10-01T00:00:00Z" });
    const c = course("3", { created_at: "2026-10-05T00:00:00Z" });
    const b = course("2", { created_at: "2026-10-15T00:00:00Z" });
    const d = course("4", { created_at: "2026-10-05T00:00:00Z" });
    const levels = Object.fromEntries([a, b, c, d].map((x) => [x.id, L(4, 4)]));
    const rows = pass(computeRankings(input([d, b, c, a], levels)), "skill").rows;
    expect(names(rows)).toEqual([1, 3, 4, 2]);
    expect(computeRankings(input([a, b, c, d], levels))).toEqual(computeRankings(input([d, c, b, a], levels)));
  });

  it("T4: a path in a Type the research did not cover gives no row there; production uses the covered Types", () => {
    const c = course("1", { paths: [
      { path_id: "p1", group_kind: "skill", learning_order: 0 },
      { path_id: "p2", group_kind: "role", learning_order: 0 },
    ] });
    const passes = computeRankings(input([c], { [c.id]: L(4, 4) }));
    expect(pass(passes, "role").rows).toEqual([]);
    expect(rowOf(pass(passes, "skill").rows, "1").rank).toBe(1);
    expect(rowOf(pass(passes, null).rows, "1")).toMatchObject({ rank: 1, total: 75 });
  });

  it("includes courses of any status; an unresearched course is listed as not_researched", () => {
    const pub = course("1", { status: "published" });
    const fresh = course("2");
    const rows = pass(computeRankings(input([pub, fresh], { [pub.id]: L(4, 4) })), "skill").rows;
    expect(rowOf(rows, "1").rank).toBe(1);
    expect(rowOf(rows, "2")).toMatchObject({ rank: null, excluded_reason: "not_researched", job_id: null });
  });

  it("T2: missing trend or demand leaves the course unranked in every group and in production", () => {
    for (const missing of ["trend", "demand"] as const) {
      const c = course("1", { paths: [
        { path_id: "p1", group_kind: "skill", learning_order: 0 },
        { path_id: "p2", group_kind: "role", learning_order: 0 },
      ] });
      const passes = computeRankings(input([c], { [c.id]: { [missing]: null, groups: { skill: [4, 4], role: [4, 4] } } }));
      for (const kind of ["skill", "role", null] as const) {
        expect(rowOf(pass(passes, kind).rows, "1")).toMatchObject({ rank: null, total: null, excluded_reason: "missing_core_criteria" });
      }
    }
  });
});

describe("production order", () => {
  it("pilot courses come before standard ones regardless of score", () => {
    const std = course("1");
    const pilot = course("2", { policy_tier: "pilot" });
    const rows = production(input([std, pilot], { [std.id]: L(5, 5), [pilot.id]: L(1, 1) }));
    expect(names(rows)).toEqual([2, 1]);
  });

  it("only idea, not_passed and needs_update courses have a row", () => {
    const list = ["idea", "not_passed", "needs_update", "queued", "generating", "published"].map((status, n) => course(String(n + 1), { status }));
    const rows = production(input(list, Object.fromEntries(list.map((c) => [c.id, L(4, 4)]))));
    expect(rows.map((r) => Number(r.course_id.slice(-12))).sort()).toEqual([1, 2, 3]);
  });

  it("KB4: the base course stands right before its dependent and says why", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2 });
    const rows = production(input([base, dep], { [base.id]: L(3, 3, { trend: 3, demand: 3 }), [dep.id]: L(5, 5) }));
    expect(names(rows)).toEqual([1, 2]);
    expect(rowOf(rows, "1")).toMatchObject({ placement_reason: "prerequisite_of", placement_for: dep.id });
    expect(rowOf(rows, "2").placement_reason).toBeNull();
  });

  it("pulling up keeps unrelated courses in score order: base, dependent, then the independent one", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2 });
    const other = course("3", { path: "p2" });
    const rows = production(input([base, dep, other], {
      [base.id]: L(2, 2),
      [dep.id]: L(5, 5, { trend: 5, demand: 5 }),
      [other.id]: L(4, 4),
    }));
    expect(names(rows)).toEqual([1, 2, 3]);
  });

  it("a base that already stands first by its own score is not marked as pulled", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2 });
    const rows = production(input([base, dep], { [base.id]: L(5, 5), [dep.id]: L(3, 3) }));
    expect(names(rows)).toEqual([1, 2]);
    expect(rowOf(rows, "1").placement_reason).toBeNull();
  });

  it("a chain of three courses is placed base first, each pulled for its direct dependent", () => {
    const a = course("1", { order: 1 });
    const b = course("2", { order: 2 });
    const c = course("3", { order: 3 });
    const rows = production(input([a, b, c], { [a.id]: L(1, 1), [b.id]: L(2, 2), [c.id]: L(5, 5, { trend: 5, demand: 5 }) }));
    expect(names(rows)).toEqual([1, 2, 3]);
    expect(rowOf(rows, "1")).toMatchObject({ placement_reason: "prerequisite_of", placement_for: b.id });
    expect(rowOf(rows, "2")).toMatchObject({ placement_reason: "prerequisite_of", placement_for: c.id });
  });

  it("a prerequisite wins the tier: a pilot dependent pulls its standard base ahead of other pilots", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2, policy_tier: "pilot" });
    const otherPilot = course("3", { path: "p2", policy_tier: "pilot" });
    const rows = production(input([base, dep, otherPilot], { [base.id]: L(3, 3), [dep.id]: L(5, 5), [otherPilot.id]: L(4, 4) }));
    expect(names(rows)).toEqual([1, 2, 3]);
  });

  it("an equal learning_order in one path is not a dependency", () => {
    const a = course("1", { order: 1 });
    const b = course("2", { order: 1 });
    const rows = production(input([a, b], { [a.id]: L(2, 2), [b.id]: L(5, 5) }));
    expect(names(rows)).toEqual([2, 1]);
    expect(rows.every((r) => r.placement_reason === null)).toBe(true);
  });

  it("KB5: a base left out and not yet published blocks the dependent, naming the base", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2 });
    const rows = production(input([base, dep], { [base.id]: { trend: null, groups: { skill: [4, 4] } }, [dep.id]: L(5, 5) }));
    expect(rowOf(rows, "1")).toMatchObject({ rank: null, excluded_reason: "missing_core_criteria" });
    expect(rowOf(rows, "2")).toMatchObject({ rank: null, excluded_reason: "blocked_by_prerequisite", placement_for: base.id, placement_reason: null });
  });

  it("KB5: a published, queued, generating or needs_update base never blocks", () => {
    for (const status of ["published", "queued", "generating", "needs_update"]) {
      const base = course("1", { order: 1, status });
      const dep = course("2", { order: 2 });
      const rows = production(input([base, dep], { [dep.id]: L(5, 5) }));
      expect(rowOf(rows, "2")).toMatchObject({ rank: 1, placement_reason: null });
    }
  });

  it("blocking spreads to dependents of a blocked course", () => {
    const a = course("1", { order: 1 });
    const b = course("2", { order: 2 });
    const c = course("3", { order: 3 });
    const rows = production(input([a, b, c], { [b.id]: L(4, 4), [c.id]: L(4, 4) }));
    expect(rowOf(rows, "1").excluded_reason).toBe("not_researched");
    expect(rowOf(rows, "2")).toMatchObject({ excluded_reason: "blocked_by_prerequisite", placement_for: a.id });
    expect(rowOf(rows, "3")).toMatchObject({ excluded_reason: "blocked_by_prerequisite", placement_for: b.id });
  });

  it("a course blocked through several bases names the one with the largest learning_order", () => {
    const low = course("1", { order: 1 });
    const high = course("2", { order: 2 });
    const dep = course("3", { order: 3 });
    const rows = production(input([low, high, dep], { [dep.id]: L(4, 4) }));
    expect(rowOf(rows, "3").placement_for).toBe(high.id);
  });

  it("a base left out as needs_update does not block, and its dependent is ranked without being pulled", () => {
    const base = course("1", { order: 1, status: "needs_update" });
    const dep = course("2", { order: 2 });
    const rows = production(input([base, dep], { [dep.id]: L(5, 5) }));
    expect(rowOf(rows, "1")).toMatchObject({ rank: null, excluded_reason: "not_researched" });
    expect(rowOf(rows, "2")).toMatchObject({ rank: 1, placement_reason: null });
  });

  it("T1: courses in a cross-path prerequisite cycle are left out; unrelated courses are not affected", () => {
    const a = course("1", { paths: [
      { path_id: "p1", group_kind: "skill", learning_order: 1 },
      { path_id: "p2", group_kind: "skill", learning_order: 2 },
    ] });
    const b = course("2", { paths: [
      { path_id: "p1", group_kind: "skill", learning_order: 2 },
      { path_id: "p2", group_kind: "skill", learning_order: 1 },
    ] });
    const dependent = course("3", { path: "p1", order: 3 });
    const free = course("4", { path: "p9" });
    const rows = production(input([a, b, dependent, free], Object.fromEntries([a, b, dependent, free].map((x) => [x.id, L(4, 4)]))));
    expect(rowOf(rows, "1").excluded_reason).toBe("prerequisite_cycle");
    expect(rowOf(rows, "2").excluded_reason).toBe("prerequisite_cycle");
    expect(rowOf(rows, "3")).toMatchObject({ excluded_reason: "blocked_by_prerequisite" });
    expect(rowOf(rows, "4").rank).toBe(1);
  });

  it("T4: a course with no path is left out as no_path", () => {
    const c = course("1", { paths: [] });
    expect(rowOf(production(input([c], { [c.id]: L(4, 4) })), "1")).toMatchObject({ rank: null, excluded_reason: "no_path" });
  });

  it("a course whose paths are all in Types the research did not cover is left out as not_researched", () => {
    const c = course("1", { kind: "role" });
    expect(rowOf(production(input([c], { [c.id]: L(4, 4) })), "1").excluded_reason).toBe("not_researched");
  });

  it("every candidate has exactly one row", () => {
    const list = [course("1"), course("2", { paths: [] }), course("3", { status: "published" })];
    const rows = production(input(list, { [list[0].id]: L(4, 4) }));
    expect(rows.map((r) => r.course_id).sort()).toEqual([id("1"), id("2")]);
  });

  it("T6: the same input gives the same output, whatever the order the rows arrive in", () => {
    const list = [course("1", { order: 1 }), course("2", { order: 2 }), course("3", { path: "p2" }), course("4", { path: "p3", policy_tier: "pilot" })];
    const levels = Object.fromEntries(list.map((c, n) => [c.id, L(((n % 5) + 1) as number, 3)]));
    const forward = computeRankings(input(list, levels));
    expect(computeRankings(input([...list].reverse(), levels))).toEqual(forward);
    expect(computeRankings(input(list, levels))).toEqual(forward);
  });

  it("exports the algorithm version written with every pass", () => {
    expect(RANKING_ALGORITHM_VERSION).toBe("rank@v1");
  });
});

describe("manual orders", () => {
  const three = () => {
    const list = [course("1", { path: "p1" }), course("2", { path: "p2" }), course("3", { path: "p3" })];
    return { list, levels: { [list[0].id]: L(5, 5), [list[1].id]: L(4, 4), [list[2].id]: L(3, 3) } };
  };
  const manual = (name: string, position: number): ManualOrder => ({ course_id: id(name), position, created_at: "2026-10-23T00:00:00Z" });

  it("places the course at its position and marks it manual", () => {
    const { list, levels } = three();
    const rows = production(input(list, levels, [manual("3", 1)]));
    expect(names(rows)).toEqual([3, 1, 2]);
    expect(rowOf(rows, "3")).toMatchObject({ placement_reason: "manual", placement_for: null });
    expect(rowOf(rows, "1").placement_reason).toBeNull();
  });

  it("a position beyond the last row goes to the end; an order for an unranked course is ignored", () => {
    const { list, levels } = three();
    const ghost = course("9", { path: "p9" });
    const rows = production(input([...list, ghost], levels, [manual("1", 50), manual("9", 1)]));
    expect(names(rows)).toEqual([2, 3, 1]);
    expect(rowOf(rows, "9").excluded_reason).toBe("not_researched");
  });

  it("several orders keep their own positions; the same position falls back to the score tie-break", () => {
    const { list, levels } = three();
    expect(names(production(input(list, levels, [manual("3", 1), manual("1", 3)])))).toEqual([3, 2, 1]);
    expect(names(production(input(list, levels, [manual("3", 1), manual("2", 1)])))).toEqual([2, 3, 1]);
  });

  it("an order that puts a course before its prerequisite is ignored; the computed order stays", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2 });
    const other = course("3", { path: "p2" });
    const levels = { [base.id]: L(3, 3), [dep.id]: L(5, 5), [other.id]: L(4, 4) };
    const rows = production(input([base, dep, other], levels, [manual("2", 1)]));
    expect(names(rows)).toEqual([1, 2, 3]);
    expect(rowOf(rows, "2").placement_reason).toBeNull();
  });

  it("T5: the save check refuses a violating order and accepts a valid one", () => {
    const base = course("1", { order: 1 });
    const dep = course("2", { order: 2 });
    const other = course("3", { path: "p2" });
    const i = input([base, dep, other], { [base.id]: L(3, 3), [dep.id]: L(5, 5), [other.id]: L(4, 4) });
    expect(checkManualOrder(i, dep.id, 1)).toEqual({ ok: false, reason: "violates_prerequisite" });
    expect(checkManualOrder(i, other.id, 1)).toEqual({ ok: true });
    expect(checkManualOrder(i, id("99"), 1)).toEqual({ ok: false, reason: "not_ranked" });
  });
});

describe("isRankingStale", () => {
  const latest = { source_as_of: "2026-10-23T10:00:00.5+00:00" };

  it("recomputes when research exists and there is no production ranking", () => {
    expect(isRankingStale("2026-10-23T09:00:00+00:00", null)).toBe(true);
    expect(isRankingStale("2026-10-23T09:00:00+00:00", { source_as_of: null })).toBe(true);
  });

  it("does nothing when no research has finished", () => {
    expect(isRankingStale(null, null)).toBe(false);
    expect(isRankingStale(null, latest)).toBe(false);
  });

  it("does not recompute for the same mark, in any spelling of the fraction", () => {
    expect(isRankingStale("2026-10-23T10:00:00.500000+00:00", latest)).toBe(false);
    expect(isRankingStale("2026-10-23T11:00:00.5+01:00", latest)).toBe(false);
  });

  it("recomputes for a newer mark, down to one microsecond, and not for an older one", () => {
    expect(isRankingStale("2026-10-23T10:00:00.500001+00:00", latest)).toBe(true);
    expect(isRankingStale("2026-10-23T10:00:01+00:00", latest)).toBe(true);
    expect(isRankingStale("2026-10-23T10:00:00.499999+00:00", latest)).toBe(false);
  });

  it("laterMark picks the later of two marks and tolerates null", () => {
    expect(laterMark("2026-10-23T10:00:00.1+00:00", "2026-10-23T10:00:00.12+00:00")).toBe("2026-10-23T10:00:00.12+00:00");
    expect(laterMark(null, "2026-10-23T10:00:00+00:00")).toBe("2026-10-23T10:00:00+00:00");
    expect(laterMark("2026-10-23T10:00:00+00:00", null)).toBe("2026-10-23T10:00:00+00:00");
    expect(laterMark(null, null)).toBeNull();
  });
});

describe("rankingPayload", () => {
  it("carries every computed row under the key the RPC reads", () => {
    const a = course("1", { order: 1 });
    const b = course("2", { order: 2, paths: [{ path_id: "p1", group_kind: "skill", learning_order: 2 }, { path_id: "p2", group_kind: "role", learning_order: 0 }] });
    const c = course("3", { paths: [] });
    const passes = computeRankings(input([a, b, c], { [a.id]: L(4, 4), [b.id]: { groups: { skill: [4, 4], role: [3, 3] } } }));
    const payload = rankingPayload(passes);
    expect(payload.map((p) => p.group_kind)).toEqual(["skill", "role", "ecosystem", null]);
    payload.forEach((p, i) => {
      expect(Object.keys(p).sort()).toEqual(["group_kind", "scores"]);
      expect(p.scores).toEqual(passes[i].rows);
    });
    expect(payload.reduce((n, p) => n + p.scores.length, 0)).toBeGreaterThanOrEqual(6);
    expect(JSON.parse(JSON.stringify(payload)).every((p: { scores: unknown }) => Array.isArray(p.scores))).toBe(true);
  });
});

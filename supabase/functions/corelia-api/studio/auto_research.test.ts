import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import {
  queueAutoResearch,
  selectDueCourses,
  type AutoResearchCourse,
  type AutoResearchJob,
} from "./auto_research.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-25T12:00:00.000Z");
const courseId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";

function course(overrides: Partial<AutoResearchCourse> = {}): AutoResearchCourse {
  return { id: courseId, status: "idea", research_status: "evidence_ok", ...overrides };
}

function successfulJob(finishedAt: number, overrides: Partial<AutoResearchJob> = {}): AutoResearchJob {
  return {
    id: jobId,
    course_id: courseId,
    trigger: "manual",
    status: "evidence_ok",
    finished_at: new Date(finishedAt).toISOString(),
    created_at: new Date(finishedAt).toISOString(),
    ...overrides,
  };
}

function selectionInput(overrides: Partial<{
  courses: AutoResearchCourse[];
  paths: Array<{ course_id: string; group_kind: string }>;
  scopes: Array<{ group_kind: string; research_period_days: number }>;
  jobs: AutoResearchJob[];
}> = {}) {
  return {
    courses: [course()],
    paths: [{ course_id: courseId, group_kind: "skill" }],
    scopes: [{ group_kind: "skill", research_period_days: 90 }],
    jobs: [successfulJob(NOW - 91 * DAY_MS)],
    ...overrides,
  };
}

function pageQuery(result: unknown) {
  const query: Record<string, any> = {};
  for (const method of ["select", "eq", "gte", "lte", "in", "order", "range"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function autoDb(results: Record<string, unknown[]>, rpcResult: unknown = { data: { created: true }, error: null }) {
  const queries: Array<{ table: string; query: ReturnType<typeof pageQuery> }> = [];
  const from = vi.fn((table: string) => {
    const result = results[table]?.shift() ?? { data: [], error: null };
    const query = pageQuery(result);
    queries.push({ table, query });
    return query;
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { db: { from, rpc } as unknown as SupabaseClient, from, rpc, queries };
}

function env(value: string | undefined) {
  vi.stubGlobal("Deno", { env: { get: vi.fn(() => value) } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("selectDueCourses", () => {
  it("is not due just before the strictest group period, but is due at and after the threshold", () => {
    const period = 30 * DAY_MS;
    const input = selectionInput({
      paths: [
        { course_id: courseId, group_kind: "skill" },
        { course_id: courseId, group_kind: "role" },
      ],
      scopes: [
        { group_kind: "skill", research_period_days: 90 },
        { group_kind: "role", research_period_days: 30 },
      ],
    });
    const finishedAt = NOW - period;
    input.jobs = [successfulJob(finishedAt)];

    expect(selectDueCourses(input, NOW - 1).courseId).toBeNull();
    expect(selectDueCourses(input, NOW).courseId).toBe(courseId);
    expect(selectDueCourses(input, NOW + 1).courseId).toBe(courseId);
    input.jobs = [successfulJob(finishedAt, { status: "needs_more_sources" })];
    expect(selectDueCourses(input, NOW).courseId).toBe(courseId);
  });

  it.each(["not_passed", "needs_update"])("allows ranked course status %s", (status) => {
    expect(selectDueCourses(selectionInput({ courses: [course({ status })] }), NOW).courseId).toBe(courseId);
  });

  it("does not auto-run never-researched or non-ranked course statuses", () => {
    const validHistory = [successfulJob(NOW - 200 * DAY_MS)];
    const courses = [
      course({ id: "never", research_status: "idea" }),
      course({ id: "published", status: "published" }),
      course({ id: "queued", status: "queued" }),
      course({ id: "generating", status: "generating" }),
    ];
    const paths = courses.map((row) => ({ course_id: row.id, group_kind: "skill" }));
    const jobs = courses.map((row, index) => ({ ...validHistory[0], id: `job-${index}`, course_id: row.id }));
    expect(selectDueCourses({ courses, paths, scopes: [{ group_kind: "skill", research_period_days: 90 }], jobs }, NOW).courseId).toBeNull();
  });

  it("skips missing paths and any missing scope in a multi-group course", () => {
    const courses = [course(), course({ id: "missing-scope" })];
    const result = selectDueCourses({
      courses,
      paths: [{ course_id: "missing-scope", group_kind: "ecosystem" }],
      scopes: [],
      jobs: [successfulJob(NOW - 200 * DAY_MS), { ...successfulJob(NOW - 200 * DAY_MS), id: "job-2", course_id: "missing-scope" }],
    }, NOW);
    expect(result.courseId).toBeNull();
    expect(result.skippedMissingRequirements).toEqual([
      { courseId, reason: "course_has_no_path" },
      { courseId: "missing-scope", reason: "scope_missing" },
    ]);
  });

  it("skips running jobs and failed jobs completed within the last 24 hours", () => {
    const due = successfulJob(NOW - 200 * DAY_MS);
    const running = { ...due, id: "running", status: "running", finished_at: null };
    const recentlyFailed = { ...due, id: "failed", status: "failed", finished_at: new Date(NOW - DAY_MS).toISOString() };
    expect(selectDueCourses(selectionInput({ jobs: [due, running] }), NOW).courseId).toBeNull();
    expect(selectDueCourses(selectionInput({ jobs: [due, recentlyFailed] }), NOW).courseId).toBeNull();
    const pastCooldown = { ...recentlyFailed, finished_at: new Date(NOW - DAY_MS - 1).toISOString() };
    expect(selectDueCourses(selectionInput({ jobs: [due, pastCooldown] }), NOW).courseId).toBe(courseId);
  });

  it("selects only the most overdue course, with a stable id tie break", () => {
    const olderId = "00000000-0000-4000-8000-000000000001";
    const newerId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const courses = [course({ id: newerId }), course({ id: olderId })];
    const paths = courses.map((row) => ({ course_id: row.id, group_kind: "skill" }));
    const jobs = courses.map((row) => ({ ...successfulJob(NOW - 120 * DAY_MS), id: `job-${row.id}`, course_id: row.id }));
    expect(selectDueCourses({ courses, paths, scopes: [{ group_kind: "skill", research_period_days: 90 }], jobs }, NOW).courseId).toBe(olderId);
    const oldest = { ...jobs[0], finished_at: new Date(NOW - 150 * DAY_MS).toISOString() };
    expect(selectDueCourses({ courses, paths, scopes: [{ group_kind: "skill", research_period_days: 90 }], jobs: [oldest, jobs[1]] }, NOW).courseId).toBe(newerId);
  });
});

describe("queueAutoResearch", () => {
  it("does not read tables or call RPC when the flag is anything other than on", async () => {
    env("ON");
    const mock = autoDb({});

    expect(await queueAutoResearch(mock.db, NOW)).toEqual({ action: "disabled" });
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("starts one scheduled job with no actor for the selected due course", async () => {
    env("on");
    const mock = autoDb({
      studio_catalog_jobs: [{ data: [{ id: jobId, course_id: courseId, trigger: "manual", status: "evidence_ok", finished_at: new Date(NOW - 91 * DAY_MS).toISOString(), created_at: new Date(NOW - 91 * DAY_MS).toISOString() }], error: null }],
      studio_courses: [{ data: [course()], error: null }],
      studio_course_paths: [{ data: [{ course_id: courseId, studio_paths: { group_kind: "skill" } }], error: null }],
      studio_catalog_scopes: [{ data: [{ group_kind: "skill", research_period_days: 90 }], error: null }],
    });

    const result = await queueAutoResearch(mock.db, NOW);
    expect(result).toMatchObject({ action: "queued", course_id: courseId, job_id: expect.any(String) });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("studio_start_catalog_job", {
      p_course_id: courseId,
      p_job_id: expect.any(String),
      p_trigger: "scheduled",
      p_started_by: null,
    });
    expect(mock.from.mock.calls.map(([table]) => table)).not.toContain("studio_generations");
  });

  it("contains a unique-running-job race and fails closed on catalog-read errors", async () => {
    env("on");
    const dueResults = {
      studio_catalog_jobs: [{ data: [{ id: jobId, course_id: courseId, status: "evidence_ok", finished_at: new Date(NOW - 91 * DAY_MS).toISOString() }], error: null }],
      studio_courses: [{ data: [course()], error: null }],
      studio_course_paths: [{ data: [{ course_id: courseId, studio_paths: { group_kind: "skill" } }], error: null }],
      studio_catalog_scopes: [{ data: [{ group_kind: "skill", research_period_days: 90 }], error: null }],
    };
    const raced = autoDb(dueResults, { data: null, error: { code: "23505", message: "duplicate running job" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await queueAutoResearch(raced.db, NOW)).toMatchObject({ action: "start_failed", course_id: courseId, error: "23505" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();

    const failedRead = autoDb({ studio_catalog_jobs: [{ data: null, error: { message: "database unavailable" } }] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await queueAutoResearch(failedRead.db, NOW)).toEqual({ action: "read_failed", phase: "catalog" });
    expect(failedRead.rpc).not.toHaveBeenCalled();
  });

});

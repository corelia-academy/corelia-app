import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  verifyBearerUser: vi.fn(),
  rerankIfStale: vi.fn(),
  loadCatalogResearchForBrief: vi.fn(),
  advanceCatalogJobs: vi.fn(),
  purgeExpiredDrafts: vi.fn(),
}));

vi.mock("../lib/authz.ts", () => ({ getUserRole: mocks.getUserRole }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.verifyBearerUser }));
vi.mock("./ranking_run.ts", () => ({ rerankIfStale: mocks.rerankIfStale }));
vi.mock("./catalog_research_brief.ts", () => ({ loadCatalogResearchForBrief: mocks.loadCatalogResearchForBrief }));
vi.mock("./catalog_run.ts", () => ({ advanceCatalogJobs: mocks.advanceCatalogJobs }));
vi.mock("./drafts.ts", () => ({ purgeExpiredDrafts: mocks.purgeExpiredDrafts }));

import { advanceRun, handleStudioStart, handleStudioTick, loadContext } from "./handlers.ts";

const courseId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";

function request() {
  return new Request("http://local/functions/v1/corelia-api?op=studio.start", {
    method: "POST",
    headers: { authorization: "Bearer test" },
    body: JSON.stringify({ course_id: courseId, run_id: runId }),
  });
}

function query(result: unknown) {
  const q: Record<string, any> = {};
  for (const method of ["select", "is", "order", "limit", "eq"]) q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn().mockResolvedValue(result);
  return q;
}

function contextQuery(result: unknown) {
  const q: Record<string, any> = {};
  for (const method of ["select", "eq", "is", "order", "in"]) q[method] = vi.fn(() => q);
  q.single = vi.fn().mockResolvedValue(result);
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return q;
}

function tickQuery(result: unknown) {
  const q: Record<string, any> = {};
  for (const method of ["select", "eq", "order", "limit", "range", "gte", "lte", "in", "update"]) q[method] = vi.fn(() => q);
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return q;
}

function tickDb(results: Record<string, unknown[]>, rpcResult: unknown = { data: { created: true }, error: null }) {
  const tables: string[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    return tickQuery(results[table]?.shift() ?? { data: [], error: null });
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { db: { from, rpc } as unknown as SupabaseClient, from, rpc, tables };
}

function tickRequest() {
  return new Request("http://local/functions/v1/corelia-api?op=studio.tick", {
    method: "POST",
    headers: { "x-corelia-studio-cron-secret": "cron-test" },
  });
}

function stubTickEnv(autoResearch: string | undefined) {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string) => name === "CORELIA_STUDIO_CRON_SECRET" ? "cron-test" : name === "CORELIA_STUDIO_AUTO_RESEARCH" ? autoResearch : undefined,
    },
  });
}

function contextDb() {
  const tables: Record<string, unknown> = {
    studio_courses: { data: { title: "Solana", level: "beginner" }, error: null },
    studio_course_paths: { data: [{ studio_paths: { group_kind: "skill", title: "Blockchain" } }], error: null },
    studio_generations: { data: [], error: null },
    studio_catalog_scopes: { data: [], error: null },
  };
  const queries = Object.fromEntries(Object.entries(tables).map(([name, result]) => [name, contextQuery(result)]));
  return { db: { from: vi.fn((table: string) => queries[table]) } as unknown as SupabaseClient, queries };
}

describe("handleStudioStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyBearerUser.mockResolvedValue({ id: "admin-id" });
    mocks.getUserRole.mockResolvedValue("admin");
    mocks.rerankIfStale.mockResolvedValue({ action: "none" });
    mocks.advanceCatalogJobs.mockResolvedValue([]);
    mocks.purgeExpiredDrafts.mockResolvedValue({ purged: 0 });
  });

  it("checks start guards atomically in the RPC without loading A1 input or reranking", async () => {
    const order: string[] = [];
    const db = {
      rpc: vi.fn(async () => { order.push("rpc"); return { data: { run_id: runId, created: false }, error: null }; }),
    } as unknown as SupabaseClient;

    const response = await handleStudioStart(request(), db);

    expect(order).toEqual(["rpc"]);
    expect(response.status).toBe(200);
    expect(mocks.rerankIfStale).not.toHaveBeenCalled();
  });

  it.each([
    ["course_not_found", "P0002", 404],
    ["course_not_startable", "P0001", 409],
    ["course_has_no_path", "P0001", 409],
    ["scope_missing", "P0001", 409],
    ["run_id_conflict", "P0001", 409],
  ] as const)("maps the retained %s guard to HTTP %i", async (message, code, status) => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message, code } }) } as unknown as SupabaseClient;
    const response = await handleStudioStart(request(), db);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message });
  });

  it.each([
    ["running", "wait"],
    ["evidence_ok", "mark_done"],
    ["needs_more_sources", "mark_done"],
  ] as const)("advances step 0 from the catalog job status %s", async (jobStatus, expectedAction) => {
    const tables: string[] = [];
    const from = vi.fn((table: string) => {
      tables.push(table);
      const result = table === "studio_run_steps"
        ? { data: [{ step_key: "catalog_research", state: "pending" }], error: null }
        : { data: { course_id: courseId, status: jobStatus, reason: null }, error: null };
      const q: Record<string, any> = {};
      for (const method of ["select", "eq", "update"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue(result);
      q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return q;
    });
    const db = { from, rpc: vi.fn() } as unknown as SupabaseClient;

    const result = await advanceRun(db, {
      id: runId,
      course_id: courseId,
      started_at: new Date(Date.now() - 60_000).toISOString(),
      catalog_job_id: "33333333-3333-4333-8333-333333333333",
    });

    expect(result).toMatchObject({ step: "catalog_research", action: expectedAction });
    expect(tables).toEqual(expectedAction === "wait" ? ["studio_run_steps", "studio_catalog_jobs"] : ["studio_run_steps", "studio_catalog_jobs", "studio_run_steps"]);
    expect(tables).not.toContain("studio_generations");
  });

  it("V-02: loads the run-pinned A1 profile only for brief context", async () => {
    const { db } = contextDb();
    const run = { id: runId, course_id: courseId, started_at: "2026-10-24T00:00:00Z", catalog_job_id: "catalog-job-id" };
    const profile = { shared: [], by_group: [] };
    mocks.loadCatalogResearchForBrief.mockResolvedValue(profile);

    const brief = await loadContext(db, run, "brief");
    const curriculum = await loadContext(db, run, "curriculum");

    expect(mocks.loadCatalogResearchForBrief).toHaveBeenCalledTimes(1);
    expect(mocks.loadCatalogResearchForBrief).toHaveBeenCalledWith(db, "catalog-job-id", ["skill"]);
    expect(brief.catalogResearch).toEqual(profile);
    expect(curriculum.catalogResearch).toBeNull();
  });

  it("uses no A1 profile when a run has no catalog job", async () => {
    const { db } = contextDb();
    const run = { id: runId, course_id: courseId, started_at: "2026-10-24T00:00:00Z", catalog_job_id: null };

    const brief = await loadContext(db, run, "brief");

    expect(mocks.loadCatalogResearchForBrief).not.toHaveBeenCalled();
    expect(brief.catalogResearch).toBeNull();
  });

  it("keeps auto-research disabled without extra table reads or RPC when the flag is off", async () => {
    stubTickEnv("off");
    const mock = tickDb({ studio_runs: [{ data: [], error: null }] });

    const response = await handleStudioTick(tickRequest(), mock.db);

    expect(response.status).toBe(200);
    expect((await response.json()).auto_research).toEqual({ action: "disabled" });
    expect(mock.tables).toEqual(["studio_runs"]);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mocks.advanceCatalogJobs).toHaveBeenCalledOnce();
  });

  it("continues advancing running catalog jobs when auto-research catalog job reads fail", async () => {
    stubTickEnv("on");
    const mock = tickDb({
      studio_runs: [{ data: [], error: null }],
      studio_catalog_jobs: [{ data: null, error: { message: "database unavailable" } }],
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.advanceCatalogJobs.mockResolvedValue([{ job_id: "already-running", action: "wait" }]);

    const response = await handleStudioTick(tickRequest(), mock.db);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.auto_research).toEqual({ action: "read_failed", phase: "catalog" });
    expect(body.catalog).toEqual([{ job_id: "already-running", action: "wait" }]);
    expect(mocks.advanceCatalogJobs).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("continues advancing running catalog jobs when auto-research catalog reads fail", async () => {
    stubTickEnv("on");
    const mock = tickDb({
      studio_runs: [{ data: [], error: null }],
      studio_catalog_jobs: [{ data: [], error: null }],
      studio_courses: [{ data: null, error: { message: "catalog read unavailable" } }],
      studio_course_paths: [{ data: [], error: null }],
      studio_catalog_scopes: [{ data: [], error: null }],
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.advanceCatalogJobs.mockResolvedValue([{ job_id: "already-running", action: "wait" }]);

    const response = await handleStudioTick(tickRequest(), mock.db);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.auto_research).toEqual({ action: "read_failed", phase: "catalog" });
    expect(body.catalog).toEqual([{ job_id: "already-running", action: "wait" }]);
    expect(mocks.advanceCatalogJobs).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("starts exactly one scheduled catalog job in an enabled tick without reading generations", async () => {
    stubTickEnv("on");
    const courseId = "11111111-1111-4111-8111-111111111111";
    const mostOverdueCourseId = "33333333-3333-4333-8333-333333333333";
    const finishedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const mostOverdueFinishedAt = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const mock = tickDb({
      studio_runs: [{ data: [], error: null }],
      studio_catalog_jobs: [{ data: [
        { id: "prior-job", course_id: courseId, trigger: "manual", status: "evidence_ok", finished_at: finishedAt, created_at: finishedAt },
        { id: "older-job", course_id: mostOverdueCourseId, trigger: "manual", status: "evidence_ok", finished_at: mostOverdueFinishedAt, created_at: mostOverdueFinishedAt },
      ], error: null }],
      studio_courses: [{ data: [
        { id: courseId, status: "idea", research_status: "evidence_ok" },
        { id: mostOverdueCourseId, status: "idea", research_status: "evidence_ok" },
      ], error: null }],
      studio_course_paths: [{ data: [
        { course_id: courseId, studio_paths: { group_kind: "skill" } },
        { course_id: mostOverdueCourseId, studio_paths: { group_kind: "skill" } },
      ], error: null }],
      studio_catalog_scopes: [{ data: [{ group_kind: "skill", research_period_days: 90 }], error: null }],
    });

    const response = await handleStudioTick(tickRequest(), mock.db);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.auto_research).toMatchObject({ action: "queued", course_id: mostOverdueCourseId, job_id: expect.any(String) });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("studio_start_catalog_job", {
      p_course_id: mostOverdueCourseId,
      p_job_id: expect.any(String),
      p_trigger: "scheduled",
      p_started_by: null,
    });
    expect(mock.tables).not.toContain("studio_generations");
  });

  it("continues the tick after the scheduled-start RPC reports 23505", async () => {
    stubTickEnv("on");
    const now = Date.now();
    const courseId = "11111111-1111-4111-8111-111111111111";
    const mock = tickDb({
      studio_runs: [{ data: [], error: null }],
      studio_catalog_jobs: [{ data: [{ id: "prior-job", course_id: courseId, trigger: "manual", status: "evidence_ok", finished_at: new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString(), created_at: new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString() }], error: null }],
      studio_courses: [{ data: [{ id: courseId, status: "idea", research_status: "evidence_ok" }], error: null }],
      studio_course_paths: [{ data: [{ course_id: courseId, studio_paths: { group_kind: "skill" } }], error: null }],
      studio_catalog_scopes: [{ data: [{ group_kind: "skill", research_period_days: 90 }], error: null }],
    }, { data: null, error: { code: "23505", message: "one running job per course" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleStudioTick(tickRequest(), mock.db);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.auto_research).toMatchObject({ action: "start_failed", error: "23505", course_id: courseId });
    expect(mock.rpc).toHaveBeenCalledWith("studio_start_catalog_job", expect.objectContaining({ p_trigger: "scheduled", p_started_by: null }));
    expect(mocks.advanceCatalogJobs).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

import * as fs from "node:fs";
import * as pathMod from "node:path";
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

import { PROMPT_VERSIONS, promptVersion } from "./prompts.ts";
import { TRANSLATION_LOCALES } from "./translate.ts";
import { clearFontRegistry } from "./diagram_render.ts";
import { STEP_ORDER } from "./steps.ts";
import { activePauseDurationMs, advanceRun,
  runTranslate, handleStudioContinue, handleStudioPause, handleStudioStart, handleStudioTick, loadContext, pausedTickAction, stepRequestFailureMessage, stepRequestSentMessage, stepResponseFailureMessage, tickActionForRun } from "./handlers.ts";

const courseId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";

describe("studio generation event messages", () => {
  it("describes request actions without exposing a model name", () => {
    const failure = stepRequestFailureMessage("Chuẩn bị brief");
    const sent = stepRequestSentMessage("Chuẩn bị brief", 0);
    const responseFailure = stepResponseFailureMessage("Chuẩn bị brief", "gpt-6-luna rate limit", ["gpt-6-luna"]);

    expect(failure).toBe("Chuẩn bị brief: không gửi được yêu cầu.");
    expect(sent).toBe("Chuẩn bị brief: đã gửi yêu cầu (lượt 1).");
    expect(responseFailure).toBe("Chuẩn bị brief: yêu cầu trả lỗi (model hiện tại rate limit).");
    expect(`${failure} ${sent} ${responseFailure}`).not.toContain("gpt-6-luna");
  });
});

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

function runControlRequest(runId = "22222222-2222-4222-8222-222222222222") {
  return new Request("http://local/functions/v1/corelia-api?op=studio.pause", {
    method: "POST",
    headers: { authorization: "Bearer test", "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId }),
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
    studio_courses: { data: { title: "Solana", level: "beginner", audience: "Dev mới", corelia_direction: "Kỹ năng lõi", content_locale: "vi" }, error: null },
    studio_course_paths: { data: [{ studio_paths: { group_kind: "skill", title: "Blockchain" } }], error: null },
    studio_generations: { data: [], error: null },
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

  it("does not append a duplicate out-of-transaction resume note", async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: { run_id: runId, created: true, resume_skipped: "nothing_done" }, error: null }),
      from: vi.fn(),
    } as unknown as SupabaseClient;
    const req = new Request("http://local/functions/v1/corelia-api?op=studio.start", {
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: JSON.stringify({ course_id: courseId, run_id: runId, resume_from_run_id: "33333333-3333-4333-8333-333333333333" }),
    });

    const response = await handleStudioStart(req, db);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ run_id: runId, created: true });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("passes restart_from to the RPC together with the run to resume", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { run_id: runId, created: true }, error: null });
    const db = { rpc } as unknown as SupabaseClient;
    const resumeFrom = "33333333-3333-4333-8333-333333333333";
    const req = (body: Record<string, unknown>) => new Request("http://local/functions/v1/corelia-api?op=studio.start", {
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: JSON.stringify({ course_id: courseId, run_id: runId, ...body }),
    });

    expect((await handleStudioStart(req({ resume_from_run_id: resumeFrom, restart_from: "curriculum" }), db)).status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("studio_start_run", { p_course_id: courseId, p_run_id: runId, p_started_by: "admin-id", p_resume_from: resumeFrom, p_restart_from: "curriculum" });

    rpc.mockClear();
    expect((await handleStudioStart(req({ resume_from_run_id: resumeFrom }), db)).status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("studio_start_run", expect.objectContaining({ p_restart_from: null }));

    rpc.mockClear();
    // A restart needs a run to resume from, and only the steps the RPC can restart from.
    expect((await handleStudioStart(req({ restart_from: "curriculum" }), db)).status).toBe(400);
    expect((await handleStudioStart(req({ resume_from_run_id: resumeFrom, restart_from: "lessons" }), db)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
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
    ["failed", "finish"],
  ] as const)("advances step 0 from the catalog job status %s", async (jobStatus, expectedAction) => {
    const tables: string[] = [];
    const events: Record<string, unknown>[] = [];
    const stepTableCalls = { count: 0 };
    const output = {
      shared: [{ level: 1 }, { level: null }],
      by_group: [{ criteria: [{ level: 2 }] }],
      web_evidence: [{}, {}],
      input_evidence: [{}],
    };
    const from = vi.fn((table: string) => {
      tables.push(table);
      let result: { data: unknown; error: null | { message: string } };
      if (table === "studio_run_steps") {
        stepTableCalls.count++;
        result = stepTableCalls.count === 1
          ? { data: [{ step_key: "catalog_research", state: "pending" }], error: null }
          : { data: [{ step_key: "catalog_research" }], error: null };
      } else if (table === "studio_catalog_jobs") {
        result = { data: { id: "catalog-job-id", course_id: courseId, status: jobStatus, reason: jobStatus === "failed" ? "A1 provider failed" : jobStatus === "needs_more_sources" ? "Vẫn thiếu trend" : null }, error: null };
      } else if (table === "studio_generations") {
        result = { data: { output }, error: null };
      } else {
        result = { data: null, error: null };
      }
      const q: Record<string, any> = {};
      for (const method of ["select", "eq", "update", "neq", "order", "limit"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue(result);
      q.insert = vi.fn(async (event: Record<string, unknown>) => { events.push(event); return { error: null }; });
      q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return q;
    });
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const db = { from, rpc } as unknown as SupabaseClient;

    const result = await advanceRun(db, {
      id: runId,
      course_id: courseId,
      started_at: new Date(Date.now() - 60_000).toISOString(),
      catalog_job_id: "33333333-3333-4333-8333-333333333333",
    });

    expect(result).toMatchObject({ step: "catalog_research", action: expectedAction });
    if (jobStatus === "running") {
      expect(tables).toEqual(["studio_run_steps", "studio_catalog_jobs"]);
      expect(events).toEqual([]);
      expect(rpc).not.toHaveBeenCalled();
    } else if (jobStatus === "failed") {
      expect(tables).toEqual(["studio_run_steps", "studio_catalog_jobs", "studio_run_steps", "studio_run_events"]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ step_key: "catalog_research", kind: "error", agent_role: "A1" });
      expect(events[0].message).toContain("A1 provider failed");
      expect(rpc).toHaveBeenCalledOnce();
    } else {
      expect(tables).toEqual(["studio_run_steps", "studio_catalog_jobs", "studio_run_steps", "studio_generations", "studio_run_events"]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ run_id: runId, step_key: "catalog_research", attempt: 0, kind: "result", agent_role: "A1" });
      expect(events[0].message).toBe(`Nghiên cứu hoàn tất: ${jobStatus === "evidence_ok" ? "đủ bằng chứng" : "cần thêm nguồn"}; 2/3 tiêu chí có mức, 2 bằng chứng web, 1 bằng chứng input.`);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("does not write a second result event when another tick already completed catalog_research", async () => {
    const events: unknown[] = [];
    let stepCalls = 0;
    const from = vi.fn((table: string) => {
      const result = table === "studio_run_steps"
        ? ++stepCalls === 1
          ? { data: [{ step_key: "catalog_research", state: "pending" }], error: null }
          : { data: [], error: null }
        : table === "studio_catalog_jobs"
          ? { data: { id: "catalog-job-id", course_id: courseId, status: "evidence_ok", reason: null }, error: null }
          : { data: { output: {} }, error: null };
      const q: Record<string, any> = {};
      for (const method of ["select", "eq", "update", "neq", "order", "limit"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue(result);
      q.insert = vi.fn(async (event: unknown) => { events.push(event); return { error: null }; });
      q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return q;
    });
    const db = { from, rpc: vi.fn() } as unknown as SupabaseClient;

    await advanceRun(db, { id: runId, course_id: courseId, started_at: new Date().toISOString(), catalog_job_id: "job" });

    expect(events).toEqual([]);
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

  it("builds the agent tracks and course input from the course fields, one track per group", async () => {
    const { db } = contextDb();
    const run = { id: runId, course_id: courseId, started_at: "2026-10-24T00:00:00Z", catalog_job_id: null };

    const ctx = await loadContext(db, run, "brief");

    expect(ctx.scopes).toEqual([{ track: "skill", audience: "Dev mới", corelia_direction: "Kỹ năng lõi", locale: "vi" }]);
    expect(ctx.course).toEqual({ title: "Solana", level: "beginner" });
  });

  it("sends no tracks when the course has lost its audience or direction", async () => {
    const { db } = contextDb();
    const run = { id: runId, course_id: courseId, started_at: "2026-10-24T00:00:00Z", catalog_job_id: null };
    const incomplete = {
      from: vi.fn((table: string) => table === "studio_courses"
        ? contextQuery({ data: { title: "Solana", level: "beginner", audience: null, corelia_direction: "x", content_locale: "vi" }, error: null })
        : (db as unknown as { from: (t: string) => unknown }).from(table)),
    } as unknown as SupabaseClient;

    expect((await loadContext(incomplete, run, "brief")).scopes).toEqual([]);
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
        { id: courseId, status: "idea", research_status: "evidence_ok", research_period_days: 90 },
        { id: mostOverdueCourseId, status: "idea", research_status: "evidence_ok", research_period_days: 90 },
      ], error: null }],
      studio_course_paths: [{ data: [
        { course_id: courseId, studio_paths: { group_kind: "skill" } },
        { course_id: mostOverdueCourseId, studio_paths: { group_kind: "skill" } },
      ], error: null }],
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
      studio_courses: [{ data: [{ id: courseId, status: "idea", research_status: "evidence_ok", research_period_days: 90 }], error: null }],
      studio_course_paths: [{ data: [{ course_id: courseId, studio_paths: { group_kind: "skill" } }], error: null }],
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

describe("Studio pause and continue handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyBearerUser.mockResolvedValue({ id: "admin-id" });
    mocks.getUserRole.mockResolvedValue("admin");
  });

  it.each([
    ["pause", handleStudioPause, "studio_pause_run"],
    ["continue", handleStudioContinue, "studio_continue_run"],
  ] as const)("requires an admin and calls the %s RPC", async (_name, handler, rpcName) => {
    const rpc = vi.fn().mockResolvedValue({ data: { run_id: runId, changed: false }, error: null });
    const db = { rpc } as unknown as SupabaseClient;

    const response = await handler(runControlRequest(), db);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ run_id: runId, changed: false });
    expect(rpc).toHaveBeenCalledWith(rpcName, { p_run_id: runId });

    mocks.getUserRole.mockResolvedValueOnce("support_staff");
    const denied = await handler(runControlRequest(), db);
    expect(denied.status).toBe(403);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("rejects malformed run IDs without an RPC call", async () => {
    const rpc = vi.fn();
    const response = await handleStudioPause(runControlRequest("not-a-uuid"), { rpc } as unknown as SupabaseClient);
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["run_not_found", 404],
    ["run_not_running", 409],
  ] as const)("maps %s to HTTP %i", async (message, status) => {
    const response = await handleStudioContinue(runControlRequest(), {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message, code: "P0001" } }),
    } as unknown as SupabaseClient);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message });
  });
});

describe("paused Studio run tick gating", () => {
  it("treats malformed or future pause timestamps as zero elapsed time", () => {
    expect(activePauseDurationMs("invalid", 1_000)).toBe(0);
    expect(activePauseDurationMs(new Date(2_000).toISOString(), 1_000)).toBe(0);
  });

  it("blocks new submits and retries, filters lesson work to submitted-response polls, and resumes the original action", () => {
    const submit = { kind: "submit", attempt: 1, parentId: null } as const;
    const poll = { kind: "poll", generationId: "generation-1", requestId: "resp_1" } as const;
    const lessonActions = {
      kind: "lessons",
      actions: [
        { kind: "submit", step: "lessons", lessonId: "lesson-1", attempt: 1, parentId: null, previousError: null },
        {
          kind: "poll",
          step: "lesson_review",
          lessonId: "lesson-2",
          generation: { id: "generation-2", attempt: 0, agent_role: "A6", status: "submitted", provider_request_id: "resp_2", error: null, created_at: new Date().toISOString() },
        },
        { kind: "expire_submitting", step: "lessons", lessonId: "lesson-3", generationId: "generation-3" },
      ],
    } as const;

    expect(pausedTickAction(submit)).toEqual({ kind: "wait" });
    expect(pausedTickAction(lessonActions)).toEqual({ kind: "lessons", actions: [lessonActions.actions[1]] });
    expect(pausedTickAction(poll)).toEqual(poll);
    expect(tickActionForRun(null, submit)).toEqual(submit);
  });

  it("does not submit the first generation while paused, then submits after continue", async () => {
    const generationId = "33333333-3333-4333-8333-333333333333";
    const calls: string[] = [];
    const generationInserts: unknown[] = [];
    const from = vi.fn((table: string) => {
      calls.push(table);
      const readResult = table === "studio_run_steps"
        ? { data: [{ step_key: "brief", state: "active" }], error: null }
        : table === "studio_courses"
          ? { data: { title: "Fixture course", level: "beginner", scope_note: null, audience: "Fixture audience", corelia_direction: "Fixture direction", content_locale: "vi" }, error: null }
          : { data: [], error: null };
      const q: Record<string, any> = {};
      for (const method of ["select", "eq", "is", "order", "limit", "in", "update"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue(table === "studio_agent_prompts" ? { data: { version: PROMPT_VERSIONS["a2-brief"], system_prompt: "database prompt row" }, error: null } : { data: null, error: null });
      q.single = vi.fn().mockResolvedValue({ data: { id: generationId }, error: null });
      q.insert = vi.fn((value: unknown) => {
        if (table === "studio_generations") generationInserts.push(value);
        return table === "studio_run_events" ? Promise.resolve({ error: null }) : q;
      });
      q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(readResult).then(resolve, reject);
      return q;
    });
    const db = { from, rpc: vi.fn() } as unknown as SupabaseClient;
    const oldFetch = globalThis.fetch;
    const oldDeno = (globalThis as unknown as { Deno?: unknown }).Deno;
    const submittedInstructions: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      submittedInstructions.push(String(JSON.parse(String(init?.body ?? "{}")).input?.[0]?.content?.[0]?.text));
      return new Response(JSON.stringify({ id: "resp_after_continue" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("Deno", { env: { get: (name: string) => name.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const paused = await advanceRun(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: new Date().toISOString(),
      });
      expect(paused).toEqual({ step: "brief", action: "wait" });
      expect(generationInserts).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();

      const continued = await advanceRun(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });
      expect(continued).toEqual({ step: "brief", action: "submit" });
      expect(generationInserts).toHaveLength(1);
      expect(generationInserts[0]).toMatchObject({ agent_role: "A2", prompt_version: promptVersion("a2-brief", PROMPT_VERSIONS["a2-brief"]) });
      expect(submittedInstructions).toEqual(["database prompt row"]);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(calls).toContain("studio_courses");
    } finally {
      vi.stubGlobal("fetch", oldFetch);
      vi.stubGlobal("Deno", oldDeno);
    }
  });

  it("polls and saves an already submitted generation while paused without submitting another request", async () => {
    const generationId = "33333333-3333-4333-8333-333333333333";
    const generation = {
      id: generationId,
      attempt: 0,
      agent_role: "A2",
      status: "submitted",
      provider_request_id: "resp_paused",
      error: null,
      created_at: new Date().toISOString(),
      lesson_id: null,
    };
    const updates: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const methods: string[] = [];
    let generationQuery = 0;
    let stepQuery = 0;

    const makeQuery = (table: string, result: { data: unknown; error: null | { message: string } }) => {
      const q: Record<string, any> = {};
      for (const method of ["select", "eq", "is", "order", "limit", "in", "not", "range", "gte", "lte"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue(result);
      q.single = vi.fn().mockResolvedValue(result);
      q.update = vi.fn((value: Record<string, unknown>) => { updates.push({ table, ...value }); return q; });
      q.insert = vi.fn(async (value: Record<string, unknown>) => { events.push(value); return { error: null }; });
      q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return q;
    };
    const from = vi.fn((table: string) => {
      methods.push(table);
      if (table === "studio_run_steps") {
        const result = ++stepQuery === 1
          ? { data: [{ step_key: "brief", state: "active" }], error: null }
          : { data: null, error: null };
        return makeQuery(table, result);
      }
      if (table === "studio_generations") {
        const call = ++generationQuery;
        const result = call === 1
          ? { data: generation, error: null }
          : call === 2 || call === 3
          ? { data: [], error: null }
          : { data: [{ id: generationId }], error: null };
        return makeQuery(table, result);
      }
      if (table === "studio_courses") return makeQuery(table, { data: { title: "Fixture course", level: "beginner", scope_note: null, audience: "Fixture audience", corelia_direction: "Fixture direction", content_locale: "vi" }, error: null });
      if (table === "studio_course_paths") return makeQuery(table, { data: [{ studio_paths: { group_kind: "skill", title: "Fixture path" } }], error: null });
      if (table === "studio_run_events") return makeQuery(table, { data: [], error: null });
      throw new Error(`Unexpected table: ${table}`);
    });

    const oldFetch = globalThis.fetch;
    const oldDeno = (globalThis as unknown as { Deno?: unknown }).Deno;
    vi.stubGlobal("Deno", { env: { get: (name: string) => name.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return new Response(JSON.stringify({
        status: "completed",
        model: "mock-model",
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ status: "ready", title: "Fixture title", open_questions: [], code_language: null }) }] }],
        usage: { input_tokens: 12, output_tokens: 4 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    try {
      const result = await advanceRun({ from } as unknown as SupabaseClient, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: new Date().toISOString(),
      });

      expect(result).toEqual({ step: "brief", action: "poll" });
      expect(updates).toContainEqual(expect.objectContaining({ table: "studio_generations", status: "completed" }));
      expect(events).toContainEqual(expect.objectContaining({ run_id: runId, step_key: "brief", kind: "result" }));
      expect(methods.filter((method) => method === "POST")).toHaveLength(0);
    } finally {
      vi.stubGlobal("fetch", oldFetch);
      vi.stubGlobal("Deno", oldDeno);
    }
  });
});

describe("Studio translate step handling", () => {
  const briefOutput = { title: "Python Programming Course", topic: "Python Course", goals: ["Master Python"], locale: "en" };
  const curriculumOutput = {
    modules: [
      {
        id: "m1",
        title: "Module 1",
        description: "Desc 1",
        lessons: [
          { id: "l1", title: "Lesson 1", type: "article", duration_seconds: 300, outcome_ids: [] },
        ],
      },
    ],
    outcomes: [{ id: "o1", text: "Outcome 1" }],
  };

  const lessonGenRow = {
    step_key: "lessons",
    status: "completed",
    lesson_id: "l1",
    attempt: 0,
    model_id: "test-model",
    prompt_version: "v1",
    output: {
      title: "Lesson 1",
      lesson_format: "article",
      short_description: "Short desc 1",
      summary: "Summary of lesson 1",
      resources: [],
      content_markdown: "# Title\n\nContent",
      take_aways: ["Takeaway 1"],
      diagrams: [],
    },
  };

  const lessonDraftRow = {
    lesson_id: "l1",
    run_id: runId,
    draft: {
      lesson: { id: "l1", title: "Lesson 1", lesson_format: "article" },
      summary: "Summary of lesson 1",
      article: { content_markdown: "# Title\n\nContent", take_aways: ["Takeaway 1"], diagrams: [] },
    },
  };

  function createMockDb(options: {
    generations?: any[];
    stepState?: string;
    lessonDrafts?: any[];
    storageDownloads?: Record<string, Record<string, any>>;
    runEvents?: any[];
  }) {
    const insertedGens: any[] = [];
    const updatedGens: any[] = [];
    const insertedEvents: any[] = [];
    const dbEvents = [...(options.runEvents ?? [])];
    const stepUpdates: any[] = [];

    const dbGenerations = options.generations ? [...options.generations] : [
      { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
      { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
      lessonGenRow,
    ];

    const allSteps = STEP_ORDER.map((stepKey) => ({
      run_id: runId,
      step_key: stepKey,
      state: stepKey === "translate" ? (options.stepState || "active") : "done",
    }));

    const from = vi.fn((table: string) => {
      const q: Record<string, any> = {};
      for (const m of ["select", "eq", "is", "order", "limit", "in", "neq", "not"]) q[m] = vi.fn(() => q);

      q.maybeSingle = vi.fn().mockImplementation(async () => {
        if (table === "studio_agent_prompts") {
          return { data: { prompt_version: 1, version: PROMPT_VERSIONS["a7-translate"], system_prompt: "Translate test prompt" }, error: null };
        }
        if (table === "studio_generations") {
          // Check for completed aggregate row
          const comp = dbGenerations.find((g) => g.step_key === "translate" && (g.locale === null || g.locale === undefined) && (g.lesson_id === null || g.lesson_id === undefined) && g.status === "completed");
          return { data: comp || null, error: null };
        }
        return { data: null, error: null };
      });

      q.single = vi.fn().mockImplementation(async () => {
        if (table === "studio_courses") {
          return { data: { id: courseId, title: "Python Course", level: "beginner", audience: "All", corelia_direction: "Standard", content_locale: "en" }, error: null };
        }
        if (table === "studio_generations") {
          const target = dbGenerations.find((g) => g.id === "gen-rej-0") || insertedGens[insertedGens.length - 1] || { id: "gen-new", failure_kind: "rejected", status: "failed" };
          return { data: { id: target.id, failure_kind: target.failure_kind || "rejected", status: target.status || "failed" }, error: null };
        }
        return { data: {}, error: null };
      });

      q.insert = vi.fn().mockImplementation((val: any) => {
        if (table === "studio_generations") {
          const item = { id: `gen-${insertedGens.length + 1}`, ...val };
          insertedGens.push(item);
          dbGenerations.push(item);
        }
        if (table === "studio_run_events") {
          insertedEvents.push(val);
          dbEvents.push(val);
        }
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: insertedGens[insertedGens.length - 1], error: null }),
          })),
          then: (res: any) => Promise.resolve({ error: null }).then(res),
        };
      });

      q.update = vi.fn().mockImplementation((val: any) => {
        if (table === "studio_generations") updatedGens.push(val);
        if (table === "studio_run_steps") stepUpdates.push(val);
        return q;
      });

      q.then = (resolve: any, reject: any) => {
        let result: any = { data: [], error: null };
        if (table === "studio_courses") {
          result = { data: { id: courseId, title: "Python Course", level: "beginner", audience: "All", corelia_direction: "Standard", content_locale: "en" }, error: null };
        } else if (table === "studio_course_paths") {
          result = { data: [], error: null };
        } else if (table === "studio_run_steps") {
          result = { data: allSteps, error: null };
        } else if (table === "studio_generations") {
          result = { data: dbGenerations, error: null };
        } else if (table === "studio_lesson_drafts") {
          result = { data: options.lessonDrafts || [lessonDraftRow], error: null };
        } else if (table === "studio_run_events") {
          result = { data: dbEvents, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      };

      return q;
    });

    const uploadedFiles: any[] = [];
    const storage = {
      from: vi.fn((bucket: string) => ({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        upload: vi.fn().mockImplementation(async (p: string, b: any, opts: any) => {
          uploadedFiles.push({ bucket, path: p, body: b, opts });
          return { data: { path: p }, error: null };
        }),
        download: vi.fn().mockImplementation(async (p: string) => {
          if (options.storageDownloads && options.storageDownloads[bucket]?.[p] !== undefined) {
            const mock = options.storageDownloads[bucket][p];
            if (mock instanceof Error) throw mock;
            return mock;
          }
          return { data: null, error: { status: 404, message: "Object not found" } };
        }),
      })),
    };

    const rpc = vi.fn().mockImplementation(async (name: string, args: any) => {
      if (name === "studio_finish_run") return { data: true, error: null };
      return { data: true, error: null };
    });

    const db = { from, storage, rpc } as unknown as SupabaseClient;
    return { db, insertedGens, updatedGens, insertedEvents, stepUpdates, rpc, uploadedFiles };
  }

  it("submits translation units up to limit per tick when step is translate", async () => {
    const { db, insertedGens, updatedGens } = createMockDb({});
    const oldDeno = (globalThis as any).Deno;
    const oldFetch = globalThis.fetch;

    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify({ id: "resp_translate_1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    try {
      const res = await advanceRun(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      expect(res).toEqual({ step: "translate", action: "translate" });
      // TRANSLATE_LIMIT_PER_TICK = 6
      expect(insertedGens.length).toBe(6);
      expect(insertedGens[0]).toMatchObject({
        step_key: "translate",
        agent_role: "A7",
        status: "submitting",
      });
      expect(updatedGens).toContainEqual(expect.objectContaining({
        status: "submitted",
        provider_request_id: "resp_translate_1",
      }));
    } finally {
      vi.stubGlobal("Deno", oldDeno);
      vi.stubGlobal("fetch", oldFetch);
    }
  });

  it("polls and marks completed when valid translation is returned", async () => {
    const submittedGen = {
      id: "gen-sub-1",
      run_id: runId,
      step_key: "translate",
      attempt: 0,
      agent_role: "A7",
      status: "submitted",
      provider_request_id: "resp_sub_1",
      created_at: new Date().toISOString(),
      locale: "zh-CN",
      lesson_id: null, // course unit
    };

    const { db, updatedGens, insertedEvents } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        submittedGen,
      ],
    });

    const validCourseOutput = {
      course: {
        title: "Python 课程",
        short_description: "Python 基础",
        description: "掌握 Python",
        learning_outcomes: ["学习语法"],
      },
      sections: [
        { id: "m1", title: "第一单元", description: "基础概念" },
      ],
    };

    const oldDeno = (globalThis as any).Deno;
    const oldFetch = globalThis.fetch;

    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify({
        status: "completed",
        model: "gpt-4o",
        output: [{ content: [{ type: "output_text", text: JSON.stringify(validCourseOutput) }] }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    try {
      await runTranslate(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      expect(updatedGens).toContainEqual(expect.objectContaining({
        status: "completed",
      }));
      expect(insertedEvents).toContainEqual(expect.objectContaining({
        kind: "progress",
        step_key: "translate",
        agent_role: "A7",
      }));
    } finally {
      vi.stubGlobal("Deno", oldDeno);
      vi.stubGlobal("fetch", oldFetch);
    }
  });

  it("fails generation with rejected when translation violates integrity and marks draft_failed on attempt >= 3", async () => {
    const failedGenAttempt2 = {
      id: "gen-failed-2",
      run_id: runId,
      step_key: "translate",
      attempt: 2,
      agent_role: "A7",
      status: "submitted",
      provider_request_id: "resp_sub_invalid",
      created_at: new Date().toISOString(),
      locale: "zh-CN",
      lesson_id: null,
    };

    const { db, updatedGens, rpc, insertedEvents } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        failedGenAttempt2,
      ],
    });

    // Output thiếu module m1 -> vi phạm toàn vẹn
    const invalidCourseOutput = {
      course: {
        title: "Python 课程",
        short_description: "Python 基础",
        description: "掌握 Python",
        learning_outcomes: ["学习语法"],
      },
      sections: [], // thiếu m1
    };

    const oldDeno = (globalThis as any).Deno;
    const oldFetch = globalThis.fetch;

    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify({
        status: "completed",
        model: "gpt-4o",
        usage: { input_tokens: 123, output_tokens: 45 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify(invalidCourseOutput) }] }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    try {
      // Tick 1: Poll và fail với rejected
      await runTranslate(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      expect(updatedGens).toContainEqual(expect.objectContaining({
        status: "failed",
        failure_kind: "rejected",
        model_id: "gpt-4o",
        output: invalidCourseOutput,
        usage: expect.objectContaining({ input_tokens: 123, output_tokens: 45 }),
      }));
      expect(insertedEvents).toContainEqual(expect.objectContaining({
        kind: "warning",
        step_key: "translate",
        agent_role: "A7",
      }));
    } finally {
      vi.stubGlobal("Deno", oldDeno);
      vi.stubGlobal("fetch", oldFetch);
    }
  });

  it("resumes and completes step without re-translating when aggregate completed row exists", async () => {
    const fullTranslationMap: any = {};
    for (const loc of TRANSLATION_LOCALES) {
      fullTranslationMap[loc] = {
        course: { title: `Course ${loc}`, short_description: "desc", description: "desc", learning_outcomes: [] },
        sections: { m1: { id: "m1", title: "sec", description: "desc" } },
        lessons: { l1: { summary: "summary", article: { content_markdown: "content", take_aways: [] } } },
      };
    }

    const completedAggregateGen = {
      id: "gen-agg-completed",
      run_id: runId,
      step_key: "translate",
      locale: null,
      lesson_id: null,
      status: "completed",
      output: fullTranslationMap,
      attempt: 0,
    };

    const { db, stepUpdates } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        completedAggregateGen,
      ],
    });

    const oldFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await runTranslate(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      // Không gọi API dịch
      expect(fetchSpy).not.toHaveBeenCalled();
      // Đã đánh dấu hoàn thành step translate
      expect(stepUpdates).toContainEqual(expect.objectContaining({
        state: "done",
      }));
    } finally {
      vi.stubGlobal("fetch", oldFetch);
    }
  });
  const failedTranslation = (attempt: number, failure_kind: string) => ({
    id: `gen-failed-${attempt}`,
    run_id: runId,
    step_key: "translate",
    attempt,
    agent_role: "A7",
    status: "failed",
    failure_kind,
    error: "Bản dịch vi phạm toàn vẹn",
    created_at: new Date().toISOString(),
    locale: "zh-CN",
    lesson_id: null,
  });

  it("marks run as draft_failed when a unit fails 3 attempts", async () => {
    const { db, rpc } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        failedTranslation(0, "rejected"),
        failedTranslation(1, "rejected"),
        failedTranslation(2, "rejected"),
      ],
    });

    const oldDeno = (globalThis as any).Deno;
    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

    try {
      await runTranslate(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      expect(rpc).toHaveBeenCalledWith("studio_finish_run", expect.objectContaining({
        p_run_id: runId,
        p_status: "draft_failed",
      }));
    } finally {
      vi.stubGlobal("Deno", oldDeno);
    }
  });

  it.each([
    { kinds: ["provider", "provider", "rejected"], fails: false },
    { kinds: ["provider", "provider", "provider", "provider", "provider"], fails: true },
  ])("counts provider failures apart from the model's attempts: $kinds", async ({ kinds, fails }) => {
    const { db, rpc } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        ...kinds.map((kind, attempt) => failedTranslation(attempt, kind)),
      ],
    });

    const oldDeno = (globalThis as any).Deno;
    const oldFetch = globalThis.fetch;
    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    try {
      await runTranslate(db, { id: runId, course_id: courseId, started_at: new Date().toISOString(), paused_at: null }).catch(() => undefined);

      const finished = rpc.mock.calls.some(([name, args]: any[]) => name === "studio_finish_run" && args.p_status === "draft_failed");
      expect(finished).toBe(fails);
    } finally {
      vi.stubGlobal("fetch", oldFetch);
      vi.stubGlobal("Deno", oldDeno);
    }
  });

  it("V-25 Lỗi 1: loadContext ignores single-locale course unit attempts and returns the complete aggregate translation", async () => {
    const fullTranslationsMap = {
      "zh-CN": { course: { title: "Full ZH" }, sections: {}, lessons: {} },
      "en": { course: { title: "Full EN" }, sections: {}, lessons: {} },
    };
    const unitCourseAttempt1 = {
      id: "gen-unit-course-1",
      run_id: runId,
      step_key: "translate",
      locale: "zh-CN",
      lesson_id: null,
      attempt: 1,
      status: "completed",
      output: { course: { title: "Single Locale Only" } },
    };
    const aggregateCompletedGen = {
      id: "gen-agg-0",
      run_id: runId,
      step_key: "translate",
      locale: null,
      lesson_id: null,
      attempt: 0,
      status: "completed",
      output: fullTranslationsMap,
    };

    const { db } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        aggregateCompletedGen,
        unitCourseAttempt1,
      ],
    });

    const ctx = await loadContext(db, {
      id: runId,
      course_id: courseId,
      started_at: new Date().toISOString(),
      paused_at: null,
    });

    expect(ctx.outputs.translate).toEqual(fullTranslationsMap);
  });

  it("V-25 Lỗi 2: video lesson converted to article uses article schema and format from draft", async () => {
    const videoInCurriculum = {
      modules: [
        {
          id: "m1",
          title: "Module 1",
          description: "Desc 1",
          lessons: [
            { id: "l1", title: "Lesson 1", type: "video", duration_seconds: 300, outcome_ids: [] },
          ],
        },
      ],
      outcomes: [{ id: "o1", text: "Outcome 1" }],
    };

    // A5 đã chuyển sang article trong generation row
    const convertedLessonGenRow = {
      id: "gen-l1-converted",
      run_id: runId,
      step_key: "lessons",
      status: "completed",
      lesson_id: "l1",
      attempt: 0,
      model_id: "test-model",
      prompt_version: "v1",
      output: {
        title: "Lesson 1",
        lesson_format: "article",
        short_description: "Short desc 1",
        summary: "Summary of converted lesson",
        resources: [],
        article: {
          description_markdown: "# Article\n\nContent",
          diagrams: [],
        },
      },
    };

    const convertedDraftRow = {
      lesson_id: "l1",
      run_id: runId,
      draft: {
        lesson: { id: "l1", title: "Lesson 1", lesson_format: "article" },
        summary: "Summary of converted lesson",
        article: { content_markdown: "# Article\n\nContent", take_aways: ["Takeaway 1"], diagrams: [] },
      },
    };

    const { db } = createMockDb({
      lessonDrafts: [convertedDraftRow],
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: videoInCurriculum, attempt: 0 },
        convertedLessonGenRow,
        // Course unit already completed so it picks the lesson unit
        ...TRANSLATION_LOCALES.map((loc) => ({
          run_id: runId,
          step_key: "translate",
          locale: loc,
          lesson_id: null,
          status: "completed",
          output: { course: { title: "Title" }, sections: {} },
          attempt: 0,
        })),
      ],
    });

    const oldDeno = (globalThis as any).Deno;
    const oldFetch = globalThis.fetch;
    const submittedSchemas: string[] = [];
    const submittedInputs: any[] = [];

    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      submittedSchemas.push(body.text?.format?.name || "");
      const userText = body.input?.[1]?.content?.[0]?.text;
      submittedInputs.push(userText ? JSON.parse(userText) : null);
      return new Response(JSON.stringify({ id: "resp_converted_article" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    try {
      await runTranslate(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      // Kiểm tra schema gửi đi là translate_article chứ không phải translate_video
      expect(submittedSchemas.some((s) => s.includes("article"))).toBe(true);
      expect(submittedSchemas.every((s) => !s.includes("video"))).toBe(true);
      expect(submittedInputs.some((inp) => inp?.format === "article")).toBe(true);
    } finally {
      vi.stubGlobal("Deno", oldDeno);
      vi.stubGlobal("fetch", oldFetch);
    }
  });

  it("V-25 Lỗi 4: retry after rejected includes previous_attempt.rejected_because; provider failure does not", async () => {
    const failedRejectedGen = {
      id: "gen-rej-0",
      run_id: runId,
      step_key: "translate",
      attempt: 0,
      agent_role: "A7",
      status: "failed",
      failure_kind: "rejected",
      error: "Bản dịch vi phạm toàn vẹn",
      created_at: new Date().toISOString(),
      locale: "zh-CN",
      lesson_id: null,
    };

    const { db } = createMockDb({
      generations: [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenRow,
        failedRejectedGen,
      ],
    });

    const oldDeno = (globalThis as any).Deno;
    const oldFetch = globalThis.fetch;
    const submittedBodies: any[] = [];

    vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      submittedBodies.push(body);
      return new Response(JSON.stringify({ id: "resp_retry_1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    try {
      await runTranslate(db, {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      });

      const userText = submittedBodies[0]?.input?.[1]?.content?.[0]?.text;
      const parsedInput = userText ? JSON.parse(userText) : null;
      expect(parsedInput?.previous_attempt).toEqual({
        attempt: 0,
        rejected_because: "Bản dịch vi phạm toàn vẹn",
      });
    } finally {
      vi.stubGlobal("Deno", oldDeno);
      vi.stubGlobal("fetch", oldFetch);
    }
  });

  describe("V-29 Acceptance: CJK font storage resolver in runTranslate", () => {
    const fullTranslationMap: any = {};
    for (const loc of TRANSLATION_LOCALES) {
      fullTranslationMap[loc] = {
        course: { title: `Course ${loc}`, short_description: "desc", description: "desc", learning_outcomes: [] },
        sections: { m1: { id: "m1", title: "sec", description: "desc" } },
        lessons: {
          l1: {
            summary: "summary",
            article: {
              description_markdown: "![Diagram](diagram:d1)",
              diagrams: [
                {
                  id: "d1",
                  title: "CJK Diagram",
                  alt: "Alt",
                  nodes: [{ id: "n1", label: "CJK Label", col: 0, row: 0 }],
                  edges: [],
                },
              ],
            },
          },
        },
      };
    }

    const completedAggregateGen = {
      id: "gen-agg-completed",
      run_id: runId,
      step_key: "translate",
      locale: null,
      lesson_id: null,
      status: "completed",
      output: fullTranslationMap,
      attempt: 0,
    };

    const draftWithDiagram = {
      lesson_id: "l1",
      run_id: runId,
      draft: {
        lesson: { id: "l1", title: "Lesson 1", lesson_format: "article" },
        summary: "Summary of lesson 1",
        article: { content_markdown: "# Title\n\nContent", take_aways: ["Takeaway 1"] },
        diagrams: [
          {
            id: "d1",
            title: "CJK Diagram",
            alt: "Alt",
            nodes: [{ id: "n1", label: "CJK Label", col: 0, row: 0 }],
            edges: [],
          },
        ],
      },
    };

    const lessonGenWithDiagram = {
      id: "gen-l1-diag",
      run_id: runId,
      step_key: "lessons",
      status: "completed",
      lesson_id: "l1",
      attempt: 0,
      model_id: "test-model",
      prompt_version: "v1",
      output: {
        title: "Lesson 1",
        lesson_format: "article",
        short_description: "Short desc 1",
        summary: "Summary of lesson 1",
        resources: [],
        article: {
          description_markdown: "![Diagram](diagram:d1)",
          diagrams: [
            {
              id: "d1",
              title: "CJK Diagram",
              alt: "Alt",
              nodes: [{ id: "n1", label: "CJK Label", col: 0, row: 0 }],
              edges: [],
            },
          ],
        },
      },
    };

    beforeEach(() => {
      clearFontRegistry();
    });

    function completedUnitGenerations() {
      return TRANSLATION_LOCALES.flatMap((loc) => [
        {
          id: `gen-course-${loc}`,
          run_id: runId,
          step_key: "translate",
          locale: loc,
          lesson_id: null,
          status: "completed",
          attempt: 0,
          output: { course: fullTranslationMap[loc].course, sections: fullTranslationMap[loc].sections },
        },
        {
          id: `gen-lesson-${loc}`,
          run_id: runId,
          step_key: "translate",
          locale: loc,
          lesson_id: "l1",
          status: "completed",
          attempt: 0,
          output: fullTranslationMap[loc].lessons.l1,
        },
      ]);
    }

    function completedTranslateRunGenerations() {
      return [
        { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
        { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
        lessonGenWithDiagram,
        ...completedUnitGenerations(),
      ];
    }

    function cjkFontDownloads() {
      const fixtureDir = pathMod.join(__dirname, "fixtures");
      const fixtureFiles: Record<string, string> = {
        "fonts/NotoSansSC.ttf": "noto-sc-test.ttf",
        "fonts/NotoSansTC.ttf": "noto-tc-test.ttf",
        "fonts/NotoSansKR.ttf": "noto-kr-test.ttf",
        "fonts/NotoSansJP.ttf": "noto-ja-test.ttf",
      };
      return {
        "studio-assets": Object.fromEntries(Object.entries(fixtureFiles).map(([path, file]) => [
          path,
          { data: new Blob([fs.readFileSync(pathMod.join(fixtureDir, file))]), error: null },
        ])),
      };
    }

    function createRun() {
      return {
        id: runId,
        course_id: courseId,
        started_at: new Date().toISOString(),
        paused_at: null,
      };
    }

    it("V-37: aggregate row carries every field the completed-generation constraints require", async () => {
      const { db, insertedGens, stepUpdates } = createMockDb({
        lessonDrafts: [draftWithDiagram],
        generations: completedTranslateRunGenerations(),
        storageDownloads: cjkFontDownloads(),
      });

      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(db, createRun());

        expect(insertedGens).toHaveLength(1);
        expect(insertedGens[0]).toMatchObject({
          step_key: "translate",
          status: "completed",
          model_id: expect.any(String),
          provider_request_id: `translate-aggregate:${runId}`,
          input: { locales: TRANSLATION_LOCALES },
          output: expect.any(Object),
          completed_at: expect.any(String),
        });
        expect(stepUpdates).toContainEqual(expect.objectContaining({ state: "done" }));
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });

    it("V-29 Acceptance 1: storage has font -> renders CJK diagrams and uploads PNGs successfully", async () => {
      // Đọc 4 font fixture từ thư mục fixtures
      const fixtureDir = pathMod.join(__dirname, "fixtures");
      const fontFiles: Record<string, Uint8Array> = {
        "fonts/NotoSansSC.ttf": fs.readFileSync(pathMod.join(fixtureDir, "noto-sc-test.ttf")),
        "fonts/NotoSansTC.ttf": fs.readFileSync(pathMod.join(fixtureDir, "noto-tc-test.ttf")),
        "fonts/NotoSansKR.ttf": fs.readFileSync(pathMod.join(fixtureDir, "noto-kr-test.ttf")),
        "fonts/NotoSansJP.ttf": fs.readFileSync(pathMod.join(fixtureDir, "noto-ja-test.ttf")),
      };

      const storageDownloads: Record<string, Record<string, any>> = {
        "studio-assets": {},
      };
      for (const [fName, buf] of Object.entries(fontFiles)) {
        storageDownloads["studio-assets"][fName] = {
          data: new Blob([buf]),
          error: null,
        };
      }

      const { db, rpc, uploadedFiles, stepUpdates } = createMockDb({
        lessonDrafts: [draftWithDiagram],
        generations: [
          { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
          { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
          lessonGenWithDiagram,
          completedAggregateGen,
        ],
        storageDownloads,
      });

      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(db, {
          id: runId,
          course_id: courseId,
          started_at: new Date().toISOString(),
          paused_at: null,
        });

        // 1. Không gọi finishRun với draft_failed
        expect(rpc).not.toHaveBeenCalledWith("studio_finish_run", expect.anything());
        // 2. PNGs được upload vào bucket studio-drafts
        expect(uploadedFiles.some((f) => f.bucket === "studio-drafts" && f.path.includes("d1_zh-CN.png"))).toBe(true);
        // 3. Step translate được đánh dấu done
        expect(stepUpdates).toContainEqual(expect.objectContaining({ state: "done" }));
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });

    it("V-29 Acceptance 2: storage misses font file (404) -> fails run with draft_failed", async () => {
      const storageDownloads: Record<string, Record<string, any>> = {
        "studio-assets": {
          "fonts/NotoSansSC.ttf": { data: null, error: { status: 404, message: "Object not found" } },
        },
      };

      const { db, rpc } = createMockDb({
        lessonDrafts: [draftWithDiagram],
        generations: [
          { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
          { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
          lessonGenWithDiagram,
          completedAggregateGen,
        ],
        storageDownloads,
      });

      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(db, {
          id: runId,
          course_id: courseId,
          started_at: new Date().toISOString(),
          paused_at: null,
        });

        expect(rpc).toHaveBeenCalledWith("studio_finish_run", expect.objectContaining({
          p_run_id: runId,
          p_status: "draft_failed",
          p_reason: expect.stringContaining("Lỗi nạp font CJK"),
        }));
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });

    it("V-29 Acceptance 3: storage network error -> defers without changing run status; fails after retries", async () => {
      // 1. Lỗi mạng lần đầu: ném network error
      const storageDownloads: Record<string, Record<string, any>> = {
        "studio-assets": {
          "fonts/NotoSansSC.ttf": new Error("Storage connection timeout"),
        },
      };

      const { db, rpc, insertedEvents } = createMockDb({
        lessonDrafts: [draftWithDiagram],
        generations: [
          { step_key: "brief", status: "completed", output: briefOutput, attempt: 0 },
          { step_key: "curriculum", status: "completed", output: curriculumOutput, attempt: 0 },
          lessonGenWithDiagram,
          completedAggregateGen,
        ],
        storageDownloads,
      });

      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(db, {
          id: runId,
          course_id: courseId,
          started_at: new Date().toISOString(),
          paused_at: null,
        });

        // Không gọi studio_finish_run
        expect(rpc).not.toHaveBeenCalledWith("studio_finish_run", expect.anything());
        // Có ghi warning event về lỗi mạng
        expect(insertedEvents).toContainEqual(expect.objectContaining({
          kind: "warning",
          step_key: "translate",
          message: expect.stringContaining("Lỗi kết nối Storage khi tải font CJK"),
          payload: { font_render_retry: true },
        }));
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });

    it("V-29 main path: defers a network font failure after three integrity warnings, then renders on the next tick", async () => {
      const integrityWarnings = Array.from({ length: 3 }, (_, i) => ({
        kind: "warning",
        step_key: "translate",
        payload: { integrity_violation: true, index: i },
      }));
      const failed = createMockDb({
        generations: completedTranslateRunGenerations(),
        lessonDrafts: [draftWithDiagram],
        runEvents: integrityWarnings,
        storageDownloads: { "studio-assets": { "fonts/NotoSansSC.ttf": new Error("Storage connection timeout") } },
      });
      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(failed.db, createRun());

        expect(failed.rpc).not.toHaveBeenCalledWith("studio_finish_run", expect.anything());
        expect(failed.stepUpdates).toEqual([]);
        expect(failed.insertedEvents).toContainEqual(expect.objectContaining({
          attempt: 1,
          payload: { font_render_retry: true },
        }));

        const recovered = createMockDb({
          generations: completedTranslateRunGenerations(),
          lessonDrafts: [draftWithDiagram],
          runEvents: [...integrityWarnings, ...failed.insertedEvents],
          storageDownloads: cjkFontDownloads(),
        });
        await runTranslate(recovered.db, createRun());

        expect(recovered.rpc).not.toHaveBeenCalledWith("studio_finish_run", expect.anything());
        expect(recovered.stepUpdates).toContainEqual(expect.objectContaining({ state: "done" }));
        expect(recovered.uploadedFiles.some((file) => file.bucket === "studio-drafts" && file.path.includes("d1_zh-CN.png"))).toBe(true);
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });

    it("V-29 main path: fails only after the three marked font retries are exhausted", async () => {
      const { db, rpc, stepUpdates } = createMockDb({
        generations: completedTranslateRunGenerations(),
        lessonDrafts: [draftWithDiagram],
        runEvents: Array.from({ length: 3 }, (_, attempt) => ({
          kind: "warning",
          step_key: "translate",
          attempt: attempt + 1,
          payload: { font_render_retry: true },
        })),
        storageDownloads: { "studio-assets": { "fonts/NotoSansSC.ttf": new Error("Storage connection timeout") } },
      });
      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(db, createRun());

        expect(rpc).toHaveBeenCalledWith("studio_finish_run", expect.objectContaining({
          p_run_id: runId,
          p_status: "draft_failed",
          p_reason: expect.stringContaining("vượt quá giới hạn thử lại"),
        }));
        expect(stepUpdates).toContainEqual(expect.objectContaining({ state: "failed" }));
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });

    it("V-29 main path: missing CJK font fails immediately", async () => {
      const { db, rpc, insertedEvents, stepUpdates } = createMockDb({
        generations: completedTranslateRunGenerations(),
        lessonDrafts: [draftWithDiagram],
        storageDownloads: { "studio-assets": { "fonts/NotoSansSC.ttf": { data: null, error: { status: 404, message: "Object not found" } } } },
      });
      const oldDeno = (globalThis as any).Deno;
      vi.stubGlobal("Deno", { env: { get: (k: string) => k.endsWith("OPENAI_API_KEY") ? "mock-key" : undefined } });

      try {
        await runTranslate(db, createRun());

        expect(rpc).toHaveBeenCalledWith("studio_finish_run", expect.objectContaining({
          p_run_id: runId,
          p_status: "draft_failed",
          p_reason: expect.stringContaining("Lỗi nạp font CJK"),
        }));
        expect(insertedEvents).not.toContainEqual(expect.objectContaining({ payload: { font_render_retry: true } }));
        expect(stepUpdates).toContainEqual(expect.objectContaining({ state: "failed" }));
      } finally {
        vi.stubGlobal("Deno", oldDeno);
      }
    });
  });
});

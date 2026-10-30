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

import { activePauseDurationMs, advanceRun, handleStudioContinue, handleStudioPause, handleStudioStart, handleStudioTick, loadContext, pausedTickAction, stepRequestFailureMessage, stepRequestSentMessage, stepResponseFailureMessage, tickActionForRun } from "./handlers.ts";

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
          ? { data: { title: "Fixture course", level: "beginner", scope_note: null }, error: null }
          : { data: [], error: null };
      const q: Record<string, any> = {};
      for (const method of ["select", "eq", "is", "order", "limit", "in", "update"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue(table === "studio_agent_prompts" ? { data: { version: 8, system_prompt: "database prompt row" }, error: null } : { data: null, error: null });
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
      expect(generationInserts[0]).toMatchObject({ agent_role: "A2", prompt_version: "a2-brief@v8" });
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
      if (table === "studio_courses") return makeQuery(table, { data: { title: "Fixture course", level: "beginner", scope_note: null }, error: null });
      if (table === "studio_course_paths") return makeQuery(table, { data: [{ studio_paths: { group_kind: "skill", title: "Fixture path" } }], error: null });
      if (table === "studio_catalog_scopes") return makeQuery(table, { data: [], error: null });
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
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ status: "ready", open_questions: [], code_language: null }) }] }],
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

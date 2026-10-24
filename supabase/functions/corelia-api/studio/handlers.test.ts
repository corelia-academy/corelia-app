import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  verifyBearerUser: vi.fn(),
  rerankIfStale: vi.fn(),
  loadCatalogResearchForBrief: vi.fn(),
}));

vi.mock("../lib/authz.ts", () => ({ getUserRole: mocks.getUserRole }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.verifyBearerUser }));
vi.mock("./ranking_run.ts", () => ({ rerankIfStale: mocks.rerankIfStale }));
vi.mock("./catalog_research_brief.ts", () => ({ loadCatalogResearchForBrief: mocks.loadCatalogResearchForBrief }));

import { handleStudioStart, loadContext } from "./handlers.ts";

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

describe("handleStudioStart D6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyBearerUser.mockResolvedValue({ id: "admin-id" });
    mocks.getUserRole.mockResolvedValue("admin");
    mocks.rerankIfStale.mockResolvedValue({ action: "none" });
  });

  it("reranks before the RPC and keeps starting if reranking reports failure", async () => {
    const order: string[] = [];
    mocks.rerankIfStale.mockImplementation(async () => { order.push("rerank"); return { action: "failed" }; });
    const db = {
      rpc: vi.fn(async () => { order.push("rpc"); return { data: { run_id: runId, created: false }, error: null }; }),
    } as unknown as SupabaseClient;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleStudioStart(request(), db);

    expect(order).toEqual(["rerank", "rpc"]);
    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("ranking refresh failed; using the latest saved queue"));
    error.mockRestore();
  });

  it("maps course_not_researched to HTTP 409", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "course_not_researched", code: "P0001" } }) } as unknown as SupabaseClient;
    const response = await handleStudioStart(request(), db);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "course_not_researched" });
  });

  it("returns the queue reason from PostgreSQL DETAIL", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: {
      message: "course_not_in_queue", code: "P0001", details: "blocked_by_prerequisite",
    } }) } as unknown as SupabaseClient;
    const response = await handleStudioStart(request(), db);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "course_not_in_queue", reason: "blocked_by_prerequisite" });
    expect((db as unknown as { from?: unknown }).from).toBeUndefined();
  });

  it("looks up the latest production score when the RPC client omits DETAIL", async () => {
    const ranking = query({ data: { id: "ranking-1" }, error: null });
    const score = query({ data: { excluded_reason: "prerequisite_cycle" }, error: null });
    const from = vi.fn((table: string) => table === "studio_catalog_rankings" ? ranking : score);
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "course_not_in_queue", code: "P0001", details: "" } }),
      from,
    } as unknown as SupabaseClient;

    const response = await handleStudioStart(request(), db);

    expect(await response.json()).toEqual({ message: "course_not_in_queue", reason: "prerequisite_cycle" });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["studio_catalog_rankings", "studio_catalog_scores"]);
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
});

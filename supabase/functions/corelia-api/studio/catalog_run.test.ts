import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

vi.mock("../lib/authz.ts", () => ({ getUserRole: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: vi.fn() }));

import { catalogRetryWarning, catalogSafeReason, logCatalogRunEvent } from "./catalog_run.ts";

const runIds = ["run-1", "run-2"];
const generationId = "generation-1";

function eventDb({ runs = runIds, steps = runs, events = [], insertError = null }: {
  runs?: string[];
  steps?: string[];
  events?: { run_id: string; kind: string; payload: Record<string, unknown> }[];
  insertError?: { message: string } | null;
} = {}) {
  const storedEvents = [...events];
  const inserted: Record<string, unknown>[] = [];
  const tables: string[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    const query: Record<string, any> = {};
    for (const method of ["select", "eq", "in"]) query[method] = vi.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const data = table === "studio_runs"
        ? runs.map((id) => ({ id }))
        : table === "studio_run_steps"
          ? steps.map((run_id) => ({ run_id }))
          : table === "studio_run_events"
            ? storedEvents
            : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    query.insert = vi.fn(async (row: Record<string, unknown>) => {
      if (insertError) return { error: insertError };
      inserted.push(row);
      storedEvents.push({ run_id: row.run_id as string, kind: row.kind as string, payload: row.payload as Record<string, unknown> });
      return { error: null };
    });
    return query;
  });
  return { db: { from } as unknown as SupabaseClient, from, tables, inserted };
}

describe("A1 run event logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs each transition once for every running linked run", async () => {
    const { db, inserted } = eventDb();
    const sent = {
      generationId,
      attempt: 0,
      kind: "progress" as const,
      message: "Đã gửi yêu cầu nghiên cứu (lần 1).",
      payload: { submitted_at: "2026-10-30T04:00:00.000Z" },
    };

    await logCatalogRunEvent(db, "job-1", sent);
    await logCatalogRunEvent(db, "job-1", sent);
    expect(inserted).toHaveLength(2);
    expect(inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ run_id: "run-1", step_key: "catalog_research", kind: "progress", agent_role: "A1" }),
      expect.objectContaining({ run_id: "run-2", step_key: "catalog_research", kind: "progress", agent_role: "A1" }),
    ]));
    expect(inserted[0]?.payload).toEqual({ generation_id: generationId, attempt: 0, submitted_at: "2026-10-30T04:00:00.000Z" });

    const warning = {
      ...sent,
      kind: "warning" as const,
      message: "Nghiên cứu Catalog: yêu cầu trả lỗi; đang gửi lại.",
      payload: { reason: "rate limit" },
    };
    await logCatalogRunEvent(db, "job-1", warning);
    await logCatalogRunEvent(db, "job-1", warning);
    expect(inserted).toHaveLength(4);
    expect(inserted.filter((row) => row.kind === "warning")).toHaveLength(2);
  });

  it("returns quietly when the job has no running linked runs", async () => {
    const { db, tables, inserted } = eventDb({ runs: [] });
    await expect(logCatalogRunEvent(db, "standalone-job", {
      generationId,
      attempt: 0,
      kind: "progress",
      message: "Đã gửi yêu cầu nghiên cứu (lần 1).",
      payload: { submitted_at: "2026-10-30T04:00:00.000Z" },
    })).resolves.toBeUndefined();
    expect(tables).toEqual(["studio_runs"]);
    expect(inserted).toEqual([]);
  });

  it("swallows event insert errors so the job transition can continue", async () => {
    const { db } = eventDb({ insertError: { message: "forced event error" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logCatalogRunEvent(db, "job-1", {
      generationId,
      attempt: 0,
      kind: "progress",
      message: "Đã gửi yêu cầu nghiên cứu (lần 1).",
      payload: { submitted_at: "2026-10-30T04:00:00.000Z" },
    })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("removes configured and actual provider model IDs from retry reasons", () => {
    expect(catalogSafeReason("gpt-6-luna unavailable", ["gpt-6-luna", "actual/model"])).toBe("model hiện tại unavailable");
    expect(catalogSafeReason("actual/model unavailable", ["gpt-6-luna", "actual/model"])).toBe("model hiện tại unavailable");
    expect(catalogRetryWarning({ id: generationId, attempt: 1, error: "actual/model unavailable", model_id: "actual/model" })).toEqual({
      generationId,
      attempt: 1,
      kind: "warning",
      message: "Nghiên cứu Catalog: yêu cầu lần 2 trả lỗi; đang gửi lại. (model hiện tại unavailable)",
      payload: { reason: "model hiện tại unavailable" },
    });
  });
});

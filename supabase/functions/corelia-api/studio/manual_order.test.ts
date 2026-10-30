import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({
  getUserRole: vi.fn(),
  verifyBearerUser: vi.fn(),
  checkManualOrder: vi.fn(),
  loadRankingInput: vi.fn(),
  runRanking: vi.fn(),
}));

vi.mock("../lib/authz.ts", () => ({ getUserRole: mocks.getUserRole }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.verifyBearerUser }));
vi.mock("../lib/http.ts", () => ({
  json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
}));
vi.mock("./ranking.ts", () => ({ checkManualOrder: mocks.checkManualOrder }));
vi.mock("./ranking_run.ts", () => ({
  loadRankingInput: mocks.loadRankingInput,
  runRanking: mocks.runRanking,
}));

import {
  handleCatalogManualOrder,
  handleCatalogManualOrderReset,
  handleCatalogManualOrderRestore,
} from "./manual_order.ts";

const actor = "00000000-0000-4000-8000-000000000005";
const courseId = "00000000-0000-4000-8000-000000000001";
const snapshot = [{ course_id: courseId, position: 2, reason: "manual choice" }];

function request(body: unknown) {
  return new Request("http://localhost/studio", { method: "POST", body: JSON.stringify(body) });
}

function database(rpcResult: { data: unknown; error: { message: string } | null } = { data: "manual-id", error: null }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as unknown as SupabaseClient & { rpc: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyBearerUser.mockResolvedValue({ id: actor });
  mocks.getUserRole.mockResolvedValue("admin");
  mocks.checkManualOrder.mockReturnValue({ ok: true });
  mocks.loadRankingInput.mockResolvedValue({ input: { courses: [], research: {}, weights: {}, manualOrders: [] }, weightsVersion: 1 });
  mocks.runRanking.mockResolvedValue({ computed_at: "2026-10-30T00:00:00Z", ranking_ids: [], rows: 0 });
});

describe("manual catalog order API", () => {
  it("accepts a manual order without a reason and stores NULL", async () => {
    const db = database();
    const response = await handleCatalogManualOrder(request({ course_id: courseId, position: 2 }), db);

    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("studio_set_manual_order", {
      p_course_id: courseId,
      p_position: 2,
      p_reason: null,
      p_actor: actor,
    });
  });

  it("normalizes a whitespace-only reason to NULL", async () => {
    const db = database();
    const response = await handleCatalogManualOrder(request({ course_id: courseId, position: 2, reason: "   \t  " }), db);

    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("studio_set_manual_order", expect.objectContaining({ p_reason: null }));
  });

  it("still rejects a position that violates a prerequisite", async () => {
    const db = database();
    mocks.checkManualOrder.mockReturnValue({ ok: false, reason: "violates_prerequisite" });
    const response = await handleCatalogManualOrder(request({ course_id: courseId, position: 1 }), db);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "violates_prerequisite" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("returns the manual-order snapshot when resetting to score order", async () => {
    const db = database({ data: snapshot, error: null });
    const response = await handleCatalogManualOrderReset(request({}), db);

    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("studio_clear_manual_orders", { p_expected: null });
    expect(await response.json()).toMatchObject({ snapshot });
  });

  it("validates and restores an undo snapshot before reranking", async () => {
    const db = database({ data: snapshot, error: null });
    const response = await handleCatalogManualOrderRestore(request({ snapshot }), db);

    expect(response.status).toBe(200);
    expect(mocks.checkManualOrder).toHaveBeenCalledWith(
      expect.objectContaining({ manualOrders: [expect.objectContaining({ course_id: courseId, position: 2 })] }),
      courseId,
      2,
    );
    expect(db.rpc).toHaveBeenCalledWith("studio_restore_manual_orders", { p_snapshot: snapshot, p_actor: actor });
    expect(await response.json()).toMatchObject({ snapshot });
  });

  it("refuses to restore a snapshot that would put a course before its prerequisite", async () => {
    const db = database();
    mocks.checkManualOrder.mockReturnValue({ ok: false, reason: "violates_prerequisite" });
    const response = await handleCatalogManualOrderRestore(request({ snapshot }), db);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "violates_prerequisite" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("does not overwrite a manual-order change made after the reset snapshot", async () => {
    const db = database({ data: null, error: { message: "manual_order_conflict" } });
    const response = await handleCatalogManualOrderReset(request({ expected_snapshot: snapshot }), db);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "manual_order_conflict" });
    expect(mocks.runRanking).not.toHaveBeenCalled();
  });
});

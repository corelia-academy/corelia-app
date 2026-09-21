import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.auth }));
import { handleProjectTransferHackathon } from "./handlers.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const project = "22222222-2222-4222-8222-222222222222";
const db = { rpc: mocks.rpc } as unknown as SupabaseClient;
function request(extra: Record<string, unknown> = {}) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify({
    project_id: project, target_hackathon_id: "event", track_ids: ["track"], reason: "Review", ...extra,
  }) });
}

describe("hackathon project transfer boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ id: actor });
    mocks.rpc.mockResolvedValue({ data: [{ project_id: project, hackathon_id: "event" }], error: null });
  });
  it("uses the verified actor and returns the committed destination", async () => {
    const response = await handleProjectTransferHackathon(request({ actor_id: project, role: "admin" }), db);
    expect(await response.json()).toEqual({ project_id: project, hackathon_id: "event" });
    expect(mocks.rpc).toHaveBeenCalledWith("transfer_project_hackathon", {
      p_actor_id: actor, p_project_id: project, p_target_hackathon_id: "event", p_track_ids: ["track"], p_reason: "Review",
    });
  });
  it("rejects malformed requests and unauthenticated callers", async () => {
    expect((await handleProjectTransferHackathon(request({ track_ids: [] }), db)).status).toBe(400);
    mocks.auth.mockRejectedValue(new Error("Invalid or expired session"));
    expect((await handleProjectTransferHackathon(request(), db)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports ownership conflicts without hiding them", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "conflict:hackathon_project_exists" } });
    expect((await handleProjectTransferHackathon(request(), db)).status).toBe(409);
  });
});

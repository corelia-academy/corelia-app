import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.auth }));
import { handleProjectManage } from "./handlers.ts";
const db = { rpc: mocks.rpc } as unknown as SupabaseClient;
const id = "22222222-2222-4222-8222-222222222222";
const actor = "11111111-1111-4111-8111-111111111111";
function request(body: Record<string, unknown>) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify({ project_id: id, action: "block", reason: "Violation", ...body }) });
}
describe("project management boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: actor }); mocks.rpc.mockResolvedValue({ error: null }); });
  it("uses verified user identity and ignores caller actor/role claims", async () => {
    expect((await handleProjectManage(request({ actor_id: id, role: "admin" }), db)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("manage_project", { p_actor_id: actor, p_project_id: id, p_action: "block", p_reason: "Violation" });
  });
  it("requires a valid session before calling the privileged RPC", async () => {
    mocks.auth.mockRejectedValue(new Error("Invalid or expired session"));
    expect((await handleProjectManage(request({}), db)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{ project_id: {} }, { action: "promote" }, { reason: "x".repeat(1001) }])("rejects malformed requests", async body => {
    expect((await handleProjectManage(request(body), db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([["forbidden:project_manage", 403], ["not_found:project", 404], ["forbidden:project_blocked", 403]])("preserves authorization failures", async (message, status) => {
    mocks.rpc.mockResolvedValue({ error: { message } });
    expect((await handleProjectManage(request({}), db)).status).toBe(status);
  });
});

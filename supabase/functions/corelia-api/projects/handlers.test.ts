import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const mocks = vi.hoisted(() => ({ moderate: vi.fn(), links: vi.fn(), rpc: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: async () => ({ id: "11111111-1111-4111-8111-111111111111" }) }));
vi.mock("./openai.ts", () => ({
  moderateProjectText: mocks.moderate,
  verifyPublicProjectLinks: mocks.links,
  moderateProjectImage: vi.fn(),
  ProjectAiError: class extends Error {},
}));
import { handleProjectSave } from "./handlers.ts";
const db = {
  from: () => { const chain = { select: () => chain, lt: () => chain, limit: async () => ({ data: [], error: null }) }; return chain; },
  rpc: mocks.rpc,
} as unknown as SupabaseClient;
const base = { project_id: "22222222-2222-4222-8222-222222222222", slug: "project", title: "Project" };
function request(extra: Record<string,unknown>) { return new Request("http://localhost/projects", { method:"POST", body: JSON.stringify({...base,...extra}), headers:{"Content-Type":"application/json"} }); }
describe("project story save handler", () => {
  beforeEach(()=> { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: [{ project_id: base.project_id, project_slug: "project" }], error: null }); });
  it("moderates the complete story and persists both videos without sending videos to AI", async () => {
    const response = await handleProjectSave(request({ description: "Detailed story", progress:"Built a prototype", video_url:"https://youtu.be/demo", pitch_video_url:"https://youtu.be/pitch" }),db);
    expect(response.status).toBe(200);
    expect(mocks.moderate).toHaveBeenCalledWith(expect.arrayContaining([{field:"description",text:"Detailed story"},{field:"progress",text:"Built a prototype"}]));
    expect(JSON.stringify(mocks.moderate.mock.calls)).not.toContain("youtu.be");
    expect(JSON.stringify(mocks.links.mock.calls)).not.toContain("youtu.be");
    expect(mocks.rpc).toHaveBeenCalledWith("save_ai_gated_project",expect.objectContaining({p_description:"Detailed story",p_progress:"Built a prototype",p_pitch_video_url:"https://youtu.be/pitch"}));
  });
  it("preserves omitted story fields but forwards explicit clearing", async () => {
    await handleProjectSave(request({}),db);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_ai_gated_project",expect.objectContaining({p_description:null,p_progress:null,p_pitch_video_url:null}));
    await handleProjectSave(request({description:"",progress:"",pitch_video_url:""}),db);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_ai_gated_project",expect.objectContaining({p_description:"",p_progress:"",p_pitch_video_url:""}));
  });
  it.each([{description:"x".repeat(20001)},{progress:"x".repeat(10001)},{pitch_video_url:"javascript:alert(1)"}])("rejects invalid content before saving", async payload => {
    expect((await handleProjectSave(request(payload),db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

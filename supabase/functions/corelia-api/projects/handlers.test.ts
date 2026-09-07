import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const mocks = vi.hoisted(() => ({ moderate: vi.fn(), links: vi.fn(), rpc: vi.fn(), existing: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: async () => ({ id: "11111111-1111-4111-8111-111111111111" }) }));
vi.mock("./openai.ts", () => ({
  moderateProjectText: mocks.moderate,
  verifyPublicProjectLinks: mocks.links,
  moderateProjectImage: vi.fn(),
  ProjectAiError: class extends Error {},
}));
import { handleProjectSave } from "./handlers.ts";
const db = {
  from: () => { const chain = { select: () => chain, eq: () => chain, maybeSingle: mocks.existing, lt: () => chain, limit: async () => ({ data: [], error: null }) }; return chain; },
  rpc: mocks.rpc,
} as unknown as SupabaseClient;
const base = { project_id: "22222222-2222-4222-8222-222222222222", slug: "project", title: "Project", summary: "A project summary", description: "A detailed project story" };
function request(extra: Record<string,unknown>) { return new Request("http://localhost/projects", { method:"POST", body: JSON.stringify({...base,...extra}), headers:{"Content-Type":"application/json"} }); }
describe("project story save handler", () => {
  beforeEach(()=> { vi.clearAllMocks(); mocks.existing.mockResolvedValue({ data: null, error: null }); mocks.rpc.mockResolvedValue({ data: [{ project_id: base.project_id, project_slug: "project" }], error: null }); });
  it("moderates the complete story and persists both videos without sending videos to AI", async () => {
    const response = await handleProjectSave(request({ description: "Detailed story", progress:"Built a prototype", video_url:"https://youtu.be/demo", pitch_video_url:"https://youtu.be/pitch" }),db);
    expect(response.status).toBe(200);
    expect(mocks.moderate).toHaveBeenCalledWith(expect.arrayContaining([{field:"description",text:"Detailed story"},{field:"progress",text:"Built a prototype"}]));
    expect(JSON.stringify(mocks.moderate.mock.calls)).not.toContain("youtu.be");
    expect(JSON.stringify(mocks.links.mock.calls)).not.toContain("youtu.be");
    expect(mocks.rpc).toHaveBeenCalledWith("save_ai_gated_project",expect.objectContaining({p_description:"Detailed story",p_progress:"Built a prototype",p_pitch_video_url:"https://youtu.be/pitch"}));
  });
  it("preserves omitted story fields but forwards explicit clearing", async () => {
    await handleProjectSave(request({description:null,visibility:"private"}),db);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_ai_gated_project",expect.objectContaining({p_description:null,p_progress:null,p_pitch_video_url:null}));
    await handleProjectSave(request({description:"",progress:"",pitch_video_url:"",visibility:"private"}),db);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_ai_gated_project",expect.objectContaining({p_description:"",p_progress:"",p_pitch_video_url:""}));
  });
  it.each([{description:"x".repeat(20001)},{progress:"x".repeat(10001)},{pitch_video_url:"javascript:alert(1)"}])("rejects invalid content before saving", async payload => {
    expect((await handleProjectSave(request(payload),db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { summary: "" }, { summary: " \t\n" }, { summary: "..." },
    { description: "" }, { description: "\u200b" }, { description: "### ---" },
    { source_type: "hackathon", progress: "" },
    { source_type: "hackathon", progress: "Built a prototype" },
    { visibility: "unlisted", description: "" },
    { source_type: " hackathon ", visibility:"private", summary:"" },
  ])("rejects incomplete shared projects before moderation or persistence: %j", async payload => {
    const response = await handleProjectSave(request(payload), db);
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/^required_content:/);
    expect(mocks.moderate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("allows incomplete private standalone drafts", async () => {
    expect((await handleProjectSave(request({summary:"",description:"",visibility:"private"}),db)).status).toBe(200);
  });
  it("cannot exempt a hackathon by spoofing the source and private visibility", async () => {
    mocks.existing.mockResolvedValue({data:{source_type:"hackathon"},error:null});
    const response = await handleProjectSave(request({source_type:"standalone",visibility:"private",summary:""}),db);
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves a complete existing story for old clients but rejects explicitly clearing it", async () => {
    mocks.existing.mockResolvedValue({data:{source_type:"hackathon",description:"Existing story",progress:"Built prototype",pitch_video_url:"https://youtu.be/pitch"},error:null});
    expect((await handleProjectSave(request({description:null}),db)).status).toBe(200);
    mocks.rpc.mockClear();
    expect((await handleProjectSave(request({description:""}),db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("accepts a complete hackathon project with a video resource", async () => {
    expect((await handleProjectSave(request({source_type:"hackathon",progress:"Built prototype",video_url:"https://youtu.be/demo"}),db)).status).toBe(200);
  });

});

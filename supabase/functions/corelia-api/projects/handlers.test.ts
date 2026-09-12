import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const mocks = vi.hoisted(() => ({ moderate: vi.fn(), rpc: vi.fn(), existing: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: async () => ({ id: "11111111-1111-4111-8111-111111111111" }) }));
vi.mock("./openai.ts", () => ({
  moderateProjectText: mocks.moderate,
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
    expect(mocks.rpc).toHaveBeenCalledWith("save_ai_gated_project",expect.objectContaining({p_description:"Detailed story",p_progress:"Built a prototype",p_pitch_video_url:"https://youtu.be/pitch"}));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { source: "standalone", existing: false },
    { source: "standalone", existing: true },
    { source: "hackathon", existing: false },
    { source: "hackathon", existing: true },
  ])("saves external resource URLs without fetching destinations or sending them to AI: %j", async ({ source, existing }) => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("External access unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    mocks.existing.mockResolvedValue({ data: existing ? { source_type: source } : null, error: null });
    for (const slide of ["https://canva.link/uaa6hz3b6rgwlp3", "https://docs.google.com/presentation/d/example/edit?usp=sharing"]) {
      const resources = {
        demo_url: "https://demo.example.com/",
        repo_url: "https://github.com/corelia/app",
        slide_url: slide,
        video_url: "https://youtu.be/demo",
        pitch_video_url: "https://www.loom.com/share/pitch",
      };
      const response = await handleProjectSave(request({ source_type: source, ...resources }), db);
      expect(response.status).toBe(200);
      expect(mocks.rpc).toHaveBeenLastCalledWith("save_ai_gated_project", expect.objectContaining(
        Object.fromEntries(Object.entries(resources).map(([field, url]) => [`p_${field}`, url])),
      ));
      expect(mocks.moderate).toHaveBeenCalled();
      for (const url of Object.values(resources)) {
        expect(JSON.stringify(mocks.moderate.mock.calls)).not.toContain(url);
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
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

  it.each([undefined, null, "", "   "])("accepts a hackathon idea with optional progress (%j) and no resource links", async progress => {
    const response = await handleProjectSave(request({ source_type: "hackathon", progress }), db);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_ai_gated_project", expect.objectContaining({
      p_progress: progress == null ? null : "",
      p_demo_url: null, p_repo_url: null, p_slide_url: null, p_video_url: null, p_pitch_video_url: null,
    }));
  });

  it("allows clearing progress on an existing hackathon project", async () => {
    mocks.existing.mockResolvedValue({ data: { source_type: "hackathon", progress: "Previous progress" }, error: null });
    const response = await handleProjectSave(request({ progress: "" }), db);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_ai_gated_project", expect.objectContaining({ p_progress: "" }));
  });

  it.each([
    ["demo_url", "not a URL"],
    ["demo_url", "http://example.com"],
    ["slide_url", "javascript:alert(1)"],
    ["slide_url", "https://user:password@example.com/slides"],
    ["demo_url", "https://localhost/demo"],
    ["demo_url", "https://192.168.1.1/demo"],
    ["slide_url", "https://[::1]/slides"],
    ["repo_url", "https://github.com/corelia/app/issues"],
    ["repo_url", "https://gitlab.com/corelia/app"],
    ["video_url", "http://youtu.be/demo"],
    ["pitch_video_url", "http://youtu.be/pitch"],
    ["slide_url", `https://example.com/${"a".repeat(2048)}`],
  ])("rejects invalid optional %s before moderation or persistence", async (field, url) => {
    const response = await handleProjectSave(request({ source_type: "hackathon", [field]: url }), db);
  ])("rejects invalid optional %s before moderation or persistence", async (field, url) => {
    const response = await handleProjectSave(request({ source_type: "hackathon", [field]: url }), db);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: `invalid_url:${field}` });
    expect(mocks.moderate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

});

describe("bilingual project save", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.existing.mockResolvedValue({ data: null, error: null }); mocks.rpc.mockResolvedValue({ data: [{ project_id: base.project_id, project_slug: "project" }], error: null }); });
  it("takes canonical content from the primary locale and moderates every translated field", async () => {
    const response = await handleProjectSave(request({ primary_content_locale:"en", locales:{ en:{ title:"English",summary:"English summary",description:"English story",progress:"English progress" }, vi:{title:"Tên",summary:"Tóm tắt",description:"Mô tả",progress:"Tiến độ"} } }),db);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_ai_gated_project",expect.objectContaining({p_title:"English",p_primary_content_locale:"en",p_locales:expect.objectContaining({vi:expect.objectContaining({progress:"Tiến độ"})})}));
    expect(mocks.moderate).toHaveBeenCalledWith(expect.arrayContaining([{field:"vi.description",text:"Mô tả"},{field:"vi.progress",text:"Tiến độ"}]));
  });
  it.each([
    {primary_content_locale:"en"}, {locales:{vi:{}}}, {primary_content_locale:"en",locales:{vi:{title:"Title"}}},
    {primary_content_locale:"en",locales:{en:{title:"English",summary:"Summary",description:"Story"},vi:{progress:"x".repeat(10001)}}},
  ])("rejects invalid bilingual requests before moderation", async input => {
    expect((await handleProjectSave(request(input),db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.moderate).not.toHaveBeenCalled();
  });
  it("does not save any language if translated text fails moderation", async () => {
    mocks.moderate.mockRejectedValueOnce(new Error("moderation_blocked:vi.description"));
    const response = await handleProjectSave(request({primary_content_locale:"en",locales:{en:{title:"Title",summary:"Summary",description:"Story"},vi:{description:"Blocked"}}}),db);
    expect(response.status).not.toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects blocked projects before calling AI", async () => {
    mocks.existing.mockResolvedValue({data:{blocked:true},error:null});
    expect((await handleProjectSave(request({}),db)).status).toBe(403);
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
});

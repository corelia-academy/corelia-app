import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), translate: vi.fn(), moderate: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.auth }));
vi.mock("./openai.ts", () => ({ translateProjectText:mocks.translate, moderateProjectText:mocks.moderate, ProjectAiError:class extends Error {} }));
import { handleProjectTranslate } from "./handlers.ts";
const content = {title:"Title",summary:"Summary",description:"Story",progress:""};
const body = {project_id:"22222222-2222-4222-8222-222222222222",source_locale:"en",target_locale:"vi",content};
const db = {rpc:mocks.rpc} as unknown as SupabaseClient;
const request = (extra = {}) => new Request("http://localhost", {method:"POST",body:JSON.stringify({...body,...extra})});
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({id:"actor"}); mocks.rpc.mockResolvedValue({data:"request-id",error:null}); mocks.translate.mockResolvedValue({content,usage:{input_tokens:10,output_tokens:10}}); });
describe("project translation endpoint", () => {
  it("reserves server quota before calling AI and never saves content",async () => {
    expect((await handleProjectTranslate(request(),db)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reserve_project_translation",{p_actor_id:"actor",p_project_id:body.project_id});
    expect(mocks.translate).toHaveBeenCalledWith(content,"en","vi");
  });
  it.each([["rate_limited:project_translation",429],["forbidden:project_update",403],["forbidden:submission_deadline_passed",403],["forbidden:project_blocked",403]])("stops before AI when the database returns %s",async (message,status) => {
    mocks.rpc.mockResolvedValue({error:{message}});
    expect((await handleProjectTranslate(request(),db)).status).toBe(status);
    expect(mocks.translate).not.toHaveBeenCalled();
  });
  it("requires authentication",async () => {
    mocks.auth.mockRejectedValue(new Error("Missing Authorization header"));
    expect((await handleProjectTranslate(request(),db)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects same-language or empty requests without consuming quota",async () => {
    expect((await handleProjectTranslate(request({target_locale:"en"}),db)).status).toBe(400);
    expect((await handleProjectTranslate(request({content:{}}),db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

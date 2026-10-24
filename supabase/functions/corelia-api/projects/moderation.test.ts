import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), moderateTexts: vi.fn() }));
vi.mock("./openai.ts", () => ({
  MODERATION_MODEL: "omni-moderation-latest",
  moderateTexts: mocks.moderateTexts,
  ProjectAiError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

import { ProjectAiError } from "./openai.ts";
import { handleProjectModerationRun, moderateProjectTextCached, moderationTextHash } from "./moderation.ts";

const projectId = "22222222-2222-4222-8222-222222222222";
const db = { rpc: mocks.rpc } as unknown as SupabaseClient;
const verdict = (flagged: boolean) => ({ flagged, categories: flagged ? ["harassment"] : [] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Deno", { env: { get: (key: string) => key === "CORELIA_JOBS_CRON_SECRET" ? "cron-secret" : "" } });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe("cached synchronous moderation", () => {
  it("matches the SQL hash of the trimmed text", async () => {
    // printf 'hello' | shasum -a 256
    expect(await moderationTextHash("  hello \n")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("rejects text with a cached flagged verdict without calling the provider", async () => {
    const hash = await moderationTextHash("bad text");
    mocks.rpc.mockResolvedValue({ data: [{ content_hash: hash, flagged: true }], error: null });
    await expect(moderateProjectTextCached(db, projectId, [{ field: "title", text: "Fine" }, { field: "summary", text: "bad text" }]))
      .rejects.toMatchObject({ code: "moderation_blocked:summary" });
    expect(mocks.moderateTexts).not.toHaveBeenCalled();
  });

  it("sends only unseen text once and records every verdict", async () => {
    const known = await moderationTextHash("Known");
    mocks.rpc.mockImplementation(async (name: string) => name === "project_moderation_verdicts"
      ? { data: [{ content_hash: known, flagged: false }], error: null }
      : { data: null, error: null });
    mocks.moderateTexts.mockResolvedValue([verdict(false)]);
    await moderateProjectTextCached(db, projectId, [
      { field: "title", text: "Known" },
      { field: "summary", text: "New text" },
      { field: "vi.summary", text: " New text " },
      { field: "progress", text: "  " },
    ]);
    expect(mocks.moderateTexts).toHaveBeenCalledWith(["New text"]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("record_moderation_results", {
      p_results: [{ hash: await moderationTextHash("New text"), flagged: false, categories: [] }],
      p_model: "omni-moderation-latest",
    });
  });

  it("records and rejects newly flagged text", async () => {
    mocks.moderateTexts.mockResolvedValue([verdict(false), verdict(true)]);
    await expect(moderateProjectTextCached(db, projectId, [{ field: "title", text: "A" }, { field: "description", text: "B" }]))
      .rejects.toMatchObject({ code: "moderation_blocked:description" });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toContain("record_moderation_results");
  });
});

describe("background moderation worker", () => {
  const run = (secret?: string) => handleProjectModerationRun(new Request("http://localhost", {
    method: "POST", headers: secret ? { "x-corelia-jobs-cron-secret": secret } : {},
  }), db);
  const otherProject = "33333333-3333-4333-8333-333333333333";

  it("requires the scheduler secret", async () => {
    expect((await run()).status).toBe(401);
    expect((await run("nope")).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("checks uncached text in one batch and hides only projects with flagged text", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "claim_project_moderation") return { data: [
        { project_id: projectId, field: "title", content_hash: "a".repeat(64), text_value: null, flagged: false },
        { project_id: projectId, field: "en.summary", content_hash: "b".repeat(64), text_value: "New bad", flagged: null },
        { project_id: otherProject, field: "title", content_hash: "c".repeat(64), text_value: "New fine", flagged: null },
        { project_id: otherProject, field: null, content_hash: null, text_value: null, flagged: null },
      ], error: null };
      if (name === "finish_project_moderation") return { data: true, error: null };
      return { data: null, error: null };
    });
    mocks.moderateTexts.mockResolvedValue([verdict(true), verdict(false)]);
    const response = await run("cron-secret");
    expect(response.status).toBe(200);
    expect(mocks.moderateTexts).toHaveBeenCalledWith(["New bad", "New fine"]);
    expect(mocks.rpc).toHaveBeenCalledWith("finish_project_moderation", { p_project_id: projectId, p_flagged_fields: ["en.summary"] });
    expect(mocks.rpc).toHaveBeenCalledWith("finish_project_moderation", { p_project_id: otherProject, p_flagged_fields: [] });
  });

  it("releases every claimed project when the provider fails", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "claim_project_moderation"
      ? { data: [{ project_id: projectId, field: "title", content_hash: "a".repeat(64), text_value: "New", flagged: null }], error: null }
      : { data: null, error: null });
    mocks.moderateTexts.mockRejectedValue(new ProjectAiError("ai_unavailable:timeout"));
    expect((await run("cron-secret")).status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledWith("fail_project_moderation", { p_project_id: projectId, p_error: "ai_unavailable:timeout" });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain("finish_project_moderation");
  });
});

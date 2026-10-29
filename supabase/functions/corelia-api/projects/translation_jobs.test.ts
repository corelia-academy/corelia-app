import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), translate: vi.fn() }));

vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.auth }));
vi.mock("./openai.ts", () => ({
  translateProjectText: mocks.translate,
  ProjectAiError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

import { ProjectAiError } from "./openai.ts";
import {
  handleProjectTranslationRequest,
  handleProjectTranslationsRun,
  runTranslationJob,
} from "./translation_jobs.ts";

const projectId = "22222222-2222-4222-8222-222222222222";
const ownerId = "11111111-1111-4111-8111-111111111111";
const job = {
  project_id: projectId, target_locale: "ja", source_hash: "hash-1", attempts: 1, owner_id: ownerId,
  primary_locale: "en", title: "Title", summary: "Summary", description: "Story", progress: "",
};
const translated = { title: "タイトル", summary: "概要", description: "物語", progress: "" };
const db = { rpc: mocks.rpc } as unknown as SupabaseClient;
const names = () => mocks.rpc.mock.calls.map(([name]) => name);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Deno", { env: { get: (key: string) => key === "CORELIA_JOBS_CRON_SECRET" ? "cron-secret" : "" } });
  mocks.auth.mockResolvedValue({ id: ownerId });
  mocks.rpc.mockImplementation(async (name: string) => name === "complete_project_translation_job"
    ? { data: true, error: null }
    : { data: null, error: null });
  mocks.translate.mockResolvedValue({ content: translated, usage: { input_tokens: 1, output_tokens: 1 } });
});

describe("background project translation worker", () => {
  it("checks both budgets, translates from the primary locale and stores the result", async () => {
    expect(await runTranslationJob(db, job)).toBe("translated");
    expect(names()).toEqual(["consume_rate_limit", "consume_rate_limit", "complete_project_translation_job"]);
    expect(mocks.translate).toHaveBeenCalledWith({ title: "Title", summary: "Summary", description: "Story", progress: "" }, "en", "ja");
    expect(mocks.rpc).toHaveBeenLastCalledWith("complete_project_translation_job", {
      p_project_id: projectId, p_locale: "ja", p_source_hash: "hash-1", p_data: translated,
    });
  });

  it("reports a superseded job when the source changed during translation", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "complete_project_translation_job"
      ? { data: false, error: null }
      : { data: null, error: null });
    expect(await runTranslationJob(db, job)).toBe("superseded");
  });

  it("defers throttled jobs without spending an attempt or calling OpenAI", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "consume_rate_limit"
      ? { error: { message: "rate_limited:project_auto_translate" } }
      : { data: null, error: null });
    expect(await runTranslationJob(db, job)).toBe("throttled");
    expect(mocks.translate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenLastCalledWith("fail_project_translation_job", expect.objectContaining({
      p_retry_seconds: 3600, p_count_attempt: false,
    }));
  });

  it("backs off and counts the attempt when the provider fails", async () => {
    mocks.translate.mockRejectedValue(new ProjectAiError("ai_unavailable:timeout"));
    expect(await runTranslationJob(db, { ...job, attempts: 2 })).toBe("failed");
    expect(mocks.rpc).toHaveBeenLastCalledWith("fail_project_translation_job", {
      p_project_id: projectId, p_locale: "ja", p_error: "ai_unavailable:timeout", p_retry_seconds: 600, p_count_attempt: true,
    });
  });

  it("only runs with the scheduler secret", async () => {
    const run = (secret?: string) => handleProjectTranslationsRun(new Request("http://localhost", {
      method: "POST", headers: secret ? { "x-corelia-jobs-cron-secret": secret } : {},
    }), db);
    expect((await run()).status).toBe(401);
    expect((await run("wrong")).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockImplementation(async (name: string) => name === "claim_project_translation_jobs"
      ? { data: [job], error: null }
      : { data: name === "complete_project_translation_job" ? true : null, error: null });
    const response = await run("cron-secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ claimed: 1, translated: 1 });
  });
});

describe("owner translation request", () => {
  const request = (body: Record<string, unknown>) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });

  it("rate-limits then queues the locale", async () => {
    expect((await handleProjectTranslationRequest(request({ project_id: projectId, locale: "ja" }), db)).status).toBe(200);
    expect(names()).toEqual(["consume_rate_limit", "request_project_translation"]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("request_project_translation", { p_actor_id: ownerId, p_project_id: projectId, p_locale: "ja" });
  });

  it.each([
    [{ project_id: "nope", locale: "ja" }, 400],
    [{ project_id: projectId, locale: "xx" }, 400],
  ])("rejects invalid input %j", async (body, status) => {
    expect((await handleProjectTranslationRequest(request(body), db)).status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps database refusals", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "request_project_translation"
      ? { error: { message: "forbidden:project_update" } }
      : { data: null, error: null });
    expect((await handleProjectTranslationRequest(request({ project_id: projectId, locale: "ja" }), db)).status).toBe(403);
  });
});

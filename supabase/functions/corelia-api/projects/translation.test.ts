import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), translate: vi.fn(), moderate: vi.fn() }));

vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: mocks.auth }));
vi.mock("./openai.ts", () => ({
  translateProjectText: mocks.translate,
  moderateProjectText: mocks.moderate,
  ProjectAiError: class extends Error {
    readonly code: string;
    readonly status: number;
    readonly billed: boolean;
    constructor(code: string, status = 422, billed = false) {
      super(code);
      this.code = code;
      this.status = status;
      this.billed = billed;
    }
  },
}));

import { ProjectAiError } from "./openai.ts";
import { handleProjectTranslate } from "./handlers.ts";

const content = { title: "Title", summary: "Summary", description: "Story", progress: "" };
const body = { project_id: "22222222-2222-4222-8222-222222222222", source_locale: "en", target_locale: "vi", content };
const requestId = "33333333-3333-4333-8333-333333333333";
const db = { rpc: mocks.rpc } as unknown as SupabaseClient;
const request = (extra: Record<string, unknown> = {}) => new Request("http://localhost", {
  method: "POST",
  body: JSON.stringify({ ...body, ...extra }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "actor" });
  mocks.rpc.mockImplementation(async (name: string) => name === "reserve_project_translation_success"
    ? { data: requestId, error: null }
    : { data: null, error: null });
  mocks.translate.mockResolvedValue({ content, usage: { input_tokens: 10, output_tokens: 10 } });
  mocks.moderate.mockResolvedValue(undefined);
});

describe("project translation endpoint", () => {
  it("reserves, moderates, translates, then commits one successful quota slot", async () => {
    expect((await handleProjectTranslate(request(), db)).status).toBe(200);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "consume_rate_limit",
      "reserve_project_translation_success",
      "assert_project_translation_moderation_allowed",
      "commit_project_translation",
    ]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "consume_rate_limit", {
      p_bucket: "project_translation_daily", p_subject: "actor", p_limit: 40, p_window_seconds: 86_400,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "reserve_project_translation_success", {
      p_actor_id: "actor", p_project_id: body.project_id,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "commit_project_translation", {
      p_actor_id: "actor", p_request_id: requestId,
    });
    expect(mocks.translate).toHaveBeenCalledWith(content, "en", "vi");
  });

  it.each([
    ["rate_limited:project_translation", 429],
    ["forbidden:project_update", 403],
    ["forbidden:submission_deadline_passed", 403],
    ["forbidden:project_blocked", 403],
  ])("stops before AI when the database returns %s", async (message, status) => {
    mocks.rpc.mockImplementation(async (name: string) => name === "reserve_project_translation_success"
      ? { error: { message } }
      : { data: null, error: null });
    expect((await handleProjectTranslate(request(), db)).status).toBe(status);
    expect(mocks.translate).not.toHaveBeenCalled();
  });

  it("releases the reservation when the provider rejects the request unbilled", async () => {
    mocks.translate.mockRejectedValue(new ProjectAiError("ai_unavailable:provider_error", 503));
    expect((await handleProjectTranslate(request(), db)).status).toBe(503);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "consume_rate_limit",
      "reserve_project_translation_success",
      "assert_project_translation_moderation_allowed",
      "release_project_translation",
    ]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("release_project_translation", {
      p_actor_id: "actor", p_request_id: requestId,
    });
  });

  it("records a moderation block separately and releases the translation reservation", async () => {
    mocks.moderate.mockRejectedValue(new ProjectAiError("moderation_blocked:title"));
    expect((await handleProjectTranslate(request(), db)).status).toBe(422);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "consume_rate_limit",
      "reserve_project_translation_success",
      "assert_project_translation_moderation_allowed",
      "record_project_translation_moderation_block",
      "release_project_translation",
    ]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "record_project_translation_moderation_block", {
      p_actor_id: "actor", p_project_id: body.project_id,
    });
  });

  it.each(["ai_unavailable:invalid_response", "ai_unavailable:timeout"])(
    "keeps the quota slot when a billed provider call fails with %s",
    async code => {
      mocks.translate.mockRejectedValue(new ProjectAiError(code, 503, true));
      expect((await handleProjectTranslate(request(), db)).status).toBe(503);
      expect(mocks.rpc).toHaveBeenLastCalledWith("commit_project_translation", {
        p_actor_id: "actor", p_request_id: requestId,
      });
      expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain("release_project_translation");
    },
  );

  it("stops before reserving when the daily attempt ceiling is reached", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "consume_rate_limit"
      ? { error: { message: "rate_limited:project_translation_daily" } }
      : { data: requestId, error: null });
    expect((await handleProjectTranslate(request(), db)).status).toBe(429);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["consume_rate_limit"]);
    expect(mocks.translate).not.toHaveBeenCalled();
  });

  it("enforces the separate moderation abuse guard before calling AI", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "reserve_project_translation_success") return { data: requestId, error: null };
      if (name === "assert_project_translation_moderation_allowed") return { error: { message: "rate_limited:project_translation_moderation" } };
      return { data: null, error: null };
    });
    expect((await handleProjectTranslate(request(), db)).status).toBe(429);
    expect(mocks.moderate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenLastCalledWith("release_project_translation", {
      p_actor_id: "actor", p_request_id: requestId,
    });
  });

  it("requires authentication", async () => {
    mocks.auth.mockRejectedValue(new Error("Missing Authorization header"));
    expect((await handleProjectTranslate(request(), db)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects same-language or empty requests without consuming quota", async () => {
    expect((await handleProjectTranslate(request({ target_locale: "en" }), db)).status).toBe(400);
    expect((await handleProjectTranslate(request({ content: {} }), db)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

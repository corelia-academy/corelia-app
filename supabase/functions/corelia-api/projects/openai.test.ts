import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  moderateProjectImage,
  moderateProjectText,
  verifyPublicProjectLinks,
} from "./openai.ts";

function response(body: Record<string, unknown>, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

describe("project OpenAI gate", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "test-key" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the exact harmful text field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      results: [{ flagged: false }, { flagged: true }],
    })));
    await expect(moderateProjectText([
      { field: "title", text: "Safe title" },
      { field: "summary", text: "Blocked summary" },
    ])).rejects.toMatchObject({ code: "moderation_blocked:summary" });
  });

  it("hard-blocks an unverifiable link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      output_text: JSON.stringify({ checks: [{ field: "demo_url", verified: false, allowed: true, reason: "not found" }] }),
    })));
    await expect(verifyPublicProjectLinks([{ field: "demo_url", url: "https://example.com" }]))
      .rejects.toMatchObject({ code: "link_unverifiable:demo_url" });
  });

  it("hard-blocks provider errors and timeouts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({}, false)));
    await expect(moderateProjectText([{ field: "title", text: "Title" }]))
      .rejects.toMatchObject({ code: "ai_unavailable:provider_error" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new DOMException("timed out", "AbortError")));
    await expect(moderateProjectText([{ field: "title", text: "Title" }]))
      .rejects.toMatchObject({ code: "ai_unavailable:timeout" });
  });

  it("fails closed when moderation responses omit the flagged decision", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ results: [{}] })));
    await expect(moderateProjectText([{ field: "title", text: "Title" }]))
      .rejects.toMatchObject({ code: "ai_unavailable:invalid_response" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ results: [{}] })));
    await expect(moderateProjectImage(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"))
      .rejects.toMatchObject({ code: "ai_unavailable:invalid_response" });
  });

  it("uses web search, structured output and disables response storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      output_text: JSON.stringify({ checks: [{ field: "repo_url", verified: true, allowed: true, reason: "public repo" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await verifyPublicProjectLinks([{ field: "repo_url", url: "https://github.com/corelia/app" }]);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      model: "gpt-5.4-mini",
      store: false,
      tools: [{ type: "web_search" }],
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(JSON.stringify(request)).not.toContain("video_url");
  });
});

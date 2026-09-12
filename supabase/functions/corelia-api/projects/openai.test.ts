import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  translateProjectText,
  moderateProjectImage,
  moderateProjectText,
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
});

describe("project AI translation", () => {
  beforeEach(() => vi.stubGlobal("Deno", { env: { get: () => "test-key" } }));
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const content = {title:"Corelia",summary:"A summary",description:"## Story\n[Demo](https://example.com)\n`code`",progress:""};
  it("uses structured output without web tools, preserves source text and records token counts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({status:"completed",output_text:JSON.stringify({...content,summary:"Tóm tắt"}),usage:{input_tokens:100,output_tokens:80}}));
    vi.stubGlobal("fetch",fetchMock);
    const result = await translateProjectText(content,"en","vi");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.model).toBe("gpt-5.4-mini"); expect(payload.tools).toBeUndefined();
    expect(payload.text.format.strict).toBe(true);
    expect(JSON.parse(payload.input[1].content)).toEqual(content);
    expect(result.content.description).toBe(content.description);
    expect(result.usage).toEqual({input_tokens:100,output_tokens:80});
  });
  it.each([
    {status:"incomplete",output_text:JSON.stringify(content)},
    {status:"completed",output_text:"invalid JSON"},
    {status:"completed",output_text:JSON.stringify({title:"Only title"})},
    {status:"completed",output_text:JSON.stringify({...content,description:"x".repeat(20001)})},
    {status:"completed",output_text:JSON.stringify({...content,description:""})},
    {status:"completed",output_text:JSON.stringify({...content,description:"Changed https://other.example `new code`"})},
  ])("rejects unusable AI responses", async payload => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(response(payload)));
    await expect(translateProjectText(content,"en","vi")).rejects.toMatchObject({code:"ai_unavailable:invalid_response"});
  });
});

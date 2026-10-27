import { afterEach, describe, expect, it, vi } from "vitest";

import { inputBlocks, readResponse, submitResponse, type SubmitRequest } from "./openai.ts";

const request: SubmitRequest = {
  model: "gpt-6-luna",
  instructions: "x",
  input: {},
  effort: "high",
  maxOutputTokens: 100,
  schemaName: "s",
  schema: { type: "object" },
  serviceTier: "flex",
  metadata: {},
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Records the service_tier of every request and answers with the given responses in order. */
function stubFetch(...responses: Response[]) {
  const tiers: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    tiers.push(JSON.parse(String(init.body)).service_tier);
    return responses.shift()!;
  }));
  return tiers;
}

afterEach(() => vi.unstubAllGlobals());

describe("studio openai service tier", () => {
  it("submits on flex and keeps it when flex accepts", async () => {
    const tiers = stubFetch(reply(200, { id: "resp_1" }));
    expect(await submitResponse("k", request)).toBe("resp_1");
    expect(tiers).toEqual(["flex"]);
  });

  it("falls back to the default tier when flex has no capacity or is not offered", async () => {
    const busy = stubFetch(reply(429, { error: { message: "Resource unavailable" } }), reply(200, { id: "resp_2" }));
    expect(await submitResponse("k", request)).toBe("resp_2");
    expect(busy).toEqual(["flex", "default"]);

    const unsupported = stubFetch(reply(400, { error: { message: "Flex is not available for this model." } }), reply(200, { id: "resp_3" }));
    expect(await submitResponse("k", request)).toBe("resp_3");
    expect(unsupported).toEqual(["flex", "default"]);
  });

  it("does not resend other errors", async () => {
    const tiers = stubFetch(reply(400, { error: { message: "Invalid schema" } }));
    await expect(submitResponse("k", request)).rejects.toThrow("Invalid schema");
    expect(tiers).toEqual(["flex"]);
  });

  it("sends the instructions and input as blocks that join back to the original text", async () => {
    let body: Record<string, any> = {};
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return reply(200, { id: "resp_4" });
    }));
    const input = { course_type: "x", brief: { a: 1 }, today: "2026-10-27", lesson: { id: "l1" }, review: undefined, tail: [1, 2] };
    await submitResponse("k", { ...request, instructions: "system text", input, sharedInputKeys: ["course_type", "brief", "code_language_guide", "today"] });

    expect(body.instructions).toBeUndefined();
    expect(body.prompt_cache_options).toEqual({ mode: "explicit" });
    const [developer, user] = body.input;
    expect(developer).toEqual({ role: "developer", content: [{ type: "input_text", text: "system text", prompt_cache_breakpoint: { mode: "explicit" } }] });
    expect(user.content).toHaveLength(2);
    expect(user.content[0].prompt_cache_breakpoint).toEqual({ mode: "explicit" });
    expect(user.content[1].prompt_cache_breakpoint).toBeUndefined();
    expect(user.content.map((c: { text: string }) => c.text).join("")).toBe(JSON.stringify(input));
  });

  it("splits the input only after leading shared keys and never writes the call-specific part", () => {
    const joined = (input: Record<string, unknown>, keys?: readonly string[]) => inputBlocks(input, keys).join("");

    // no shared key leads, or every key is shared: one block
    expect(inputBlocks({ lesson: 1, brief: 2 }, ["brief"])).toEqual([JSON.stringify({ lesson: 1, brief: 2 })]);
    expect(inputBlocks({ brief: 2 }, ["brief"])).toEqual(['{"brief":2}']);
    expect(inputBlocks({ brief: 2, lesson: 1 })).toEqual(['{"brief":2,"lesson":1}']);
    // a shared key that is absent or undefined does not break the split
    const input = { course_type: "x", code_language_guide: undefined, today: "d", lesson: { id: "l" } };
    expect(inputBlocks(input, ["course_type", "code_language_guide", "today"])).toEqual(['{"course_type":"x","today":"d"', ',"lesson":{"id":"l"}}']);
    expect(joined(input, ["course_type", "code_language_guide", "today"])).toBe(JSON.stringify(input));
    // a shared key after a call-specific one stays in the call-specific block
    expect(inputBlocks({ brief: 1, lesson: 2, today: 3 }, ["brief", "today"])).toEqual(['{"brief":1', ',"lesson":2,"today":3}']);
  });

  it("keeps the serving tier with the usage, for pricing", () => {
    const done = readResponse({ status: "completed", model: "gpt-6-luna", output: [], usage: { input_tokens: 1 }, service_tier: "flex" });
    expect(done).toMatchObject({ state: "completed", usage: { input_tokens: 1, service_tier: "flex" } });
  });

  it("counts every web_search call of the response in the usage", () => {
    const output = [{ type: "reasoning" }, { type: "web_search_call" }, { type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text: "{}" }] }];
    const done = readResponse({ status: "completed", model: "gpt-6-luna", output, usage: { input_tokens: 1 } });
    expect(done).toMatchObject({ state: "completed", usage: { web_search_calls: 2 } });
    const cut = readResponse({ status: "incomplete", model: "gpt-6-luna", output, usage: { input_tokens: 1 }, incomplete_details: { reason: "max_output_tokens" } });
    expect(cut).toMatchObject({ state: "failed", usage: { web_search_calls: 2 } });
  });
});

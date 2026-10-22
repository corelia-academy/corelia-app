import { afterEach, describe, expect, it, vi } from "vitest";

import { readResponse, submitResponse, type SubmitRequest } from "./openai.ts";

const request: SubmitRequest = {
  model: "gpt-6-luna",
  instructions: "x",
  input: "{}",
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

  it("keeps the serving tier with the usage, for pricing", () => {
    const done = readResponse({ status: "completed", model: "gpt-6-luna", output: [], usage: { input_tokens: 1 }, service_tier: "flex" });
    expect(done).toMatchObject({ state: "completed", usage: { input_tokens: 1, service_tier: "flex" } });
  });
});

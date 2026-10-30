import { afterEach, describe, expect, it, vi } from "vitest";

import { pollOrExpire } from "./generations.ts";
import { RESPONSE_STALE_MS } from "./steps.ts";

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Answers the poll (GET) and the cancel (POST) of a response, and records which of them were sent. */
function stubProvider(poll: Response, cancel?: Response) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url.endsWith("/cancel") ? "cancel" : "poll");
    return url.endsWith("/cancel") ? cancel! : poll;
  }));
  return calls;
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

afterEach(() => vi.unstubAllGlobals());

describe("studio pollOrExpire", () => {
  it("keeps waiting for a response that is queued but not yet stale", async () => {
    const calls = stubProvider(reply(200, { status: "queued" }));
    expect(await pollOrExpire("k", "resp_1", ago(RESPONSE_STALE_MS - 60_000))).toEqual({ state: "running" });
    expect(calls).toEqual(["poll"]);
  });

  it("cancels a stale response and fails it as a provider error, keeping the usage", async () => {
    const calls = stubProvider(
      reply(200, { status: "queued" }),
      reply(200, { status: "cancelled", model: "m", usage: { input_tokens: 1, output_tokens: 0 } }),
    );
    const result = await pollOrExpire("k", "resp_1", ago(RESPONSE_STALE_MS + 60_000));
    expect(result).toMatchObject({ state: "failed", cause: "provider", model: "m", usage: { input_tokens: 1, output_tokens: 0, web_search_calls: 0 } });
    expect(result).toMatchObject({ error: expect.stringContaining("30 phút") });
    expect(calls).toEqual(["poll", "cancel"]);
  });

  it("does not count a paused interval toward the submitted-response timeout", async () => {
    const calls = stubProvider(reply(200, { status: "in_progress" }));
    expect(await pollOrExpire("k", "resp_1", ago(RESPONSE_STALE_MS + 15 * 60_000), 20 * 60_000)).toEqual({ state: "running" });
    expect(calls).toEqual(["poll"]);
  });

  it("does not cancel a stale response that already finished", async () => {
    const calls = stubProvider(reply(200, { status: "failed", error: { message: "boom" } }));
    expect(await pollOrExpire("k", "resp_1", ago(RESPONSE_STALE_MS + 60_000))).toMatchObject({ state: "failed", error: "failed: boom" });
    expect(calls).toEqual(["poll"]);
  });

  it("reads the result when the response finishes between the poll and the cancel", async () => {
    stubProvider(
      reply(200, { status: "in_progress" }),
      reply(200, { status: "completed", model: "m", output: [{ content: [{ type: "output_text", text: "{}" }] }] }),
    );
    expect(await pollOrExpire("k", "resp_1", ago(RESPONSE_STALE_MS + 60_000))).toMatchObject({ state: "completed", text: "{}" });
  });

  it("leaves the response to the next poll when the provider refuses the cancel", async () => {
    stubProvider(reply(200, { status: "queued" }), reply(400, { error: { message: "cannot cancel" } }));
    expect(await pollOrExpire("k", "resp_1", ago(RESPONSE_STALE_MS + 60_000))).toBeNull();
  });
});

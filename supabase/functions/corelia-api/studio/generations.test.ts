import { afterEach, describe, expect, it, vi } from "vitest";

import { fallBackToDefaultTier, pollOrExpire } from "./generations.ts";
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

/** Minimal studio_generations table: records every update and answers the select with one row. */
function fakeGenerations(row: { input: unknown; params: Record<string, unknown> }, claimable = true) {
  const updates: { values: Record<string, unknown>; filters: Record<string, unknown>; }[] = [];
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      update: (values: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const builder: any = {
          eq: (column: string, value: unknown) => { filters[column] = value; return builder; },
          select: async () => ({ data: claimable || values.status !== "submitting" ? [{ id: "g1" }] : [], error: null }),
          then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
        };
        updates.push({ values, filters });
        return builder;
      },
    }),
  };
  return { db: db as never, updates };
}

describe("studio fallBackToDefaultTier", () => {
  const row = { input: { course: "x" }, params: { service_tier: "flex", tools: [] } };

  it("sends the same request again on the default tier within the attempt, without failing it", async () => {
    const { db, updates } = fakeGenerations(row);
    const submit = vi.fn(async () => "resp_2");
    expect(await fallBackToDefaultTier(db, "g1", "resp_1", submit)).toEqual({ outcome: "resubmitted" });
    expect(submit).toHaveBeenCalledWith({ input: { course: "x" }, params: row.params });
    expect(updates[0]).toMatchObject({
      values: { status: "submitting", params: { service_tier: "default", tools: [] } },
      filters: { id: "g1", status: "submitted", provider_request_id: "resp_1" },
    });
    expect(updates[1]).toMatchObject({ values: { status: "submitted", provider_request_id: "resp_2" }, filters: { id: "g1", status: "submitting" } });
    expect(updates.some((u) => u.values.status === "failed")).toBe(false);
  });

  it("leaves a generation that already runs on the default tier to the normal failure path", async () => {
    const { db, updates } = fakeGenerations({ ...row, params: { service_tier: "default" } });
    const submit = vi.fn();
    expect(await fallBackToDefaultTier(db, "g1", "resp_1", submit)).toEqual({ outcome: "not_flex" });
    expect(submit).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("does not submit when another tick already claimed the generation", async () => {
    const { db } = fakeGenerations(row, false);
    const submit = vi.fn();
    expect(await fallBackToDefaultTier(db, "g1", "resp_1", submit)).toEqual({ outcome: "taken_by_other_tick" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("fails the generation as a transport failure when the new submit is refused", async () => {
    const { db, updates } = fakeGenerations(row);
    const result = await fallBackToDefaultTier(db, "g1", "resp_1", async () => { throw new Error("503"); });
    expect(result).toMatchObject({ outcome: "submit_failed", error: expect.stringContaining("503") });
    expect(updates.at(-1)).toMatchObject({ values: { status: "failed", failure_kind: "transport" }, filters: { status: "submitting" } });
  });
});

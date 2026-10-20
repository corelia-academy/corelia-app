import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }),
}));

const { createTimeoutFetch } = await import("./supabase");

const BASE = "https://example.supabase.co";

/** A fetch that never resolves on its own and rejects when its signal aborts. */
function stalledFetch() {
  return vi.fn<typeof fetch>((_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  });
}

describe("createTimeoutFetch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["/auth/v1/token?grant_type=pkce", "/rest/v1/courses?select=id"])(
    "aborts a stalled %s request after the timeout",
    async (path) => {
      const timedFetch = createTimeoutFetch(stalledFetch(), 1_000);
      const pending = timedFetch(`${BASE}${path}`);
      const assertion = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
    },
  );

  it("does not time out Storage or Edge Function requests", async () => {
    const base = stalledFetch();
    const timedFetch = createTimeoutFetch(base, 1_000);
    const init = { method: "POST" };

    void timedFetch(`${BASE}/storage/v1/object/avatars/a.png`, init);
    void timedFetch(new URL(`${BASE}/functions/v1/corelia-api`), init);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(base).toHaveBeenCalledTimes(2);
    expect(base.mock.calls.every(([, passed]) => passed === init)).toBe(true);
  });

  it("forwards caller aborts and clears the timer once the request settles", async () => {
    const base = stalledFetch();
    const timedFetch = createTimeoutFetch(base, 1_000);
    const caller = new AbortController();

    const pending = timedFetch(`${BASE}/rest/v1/courses`, { signal: caller.signal });
    const assertion = expect(pending).rejects.toBe("cancelled");
    caller.abort("cancelled");
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes successful responses through", async () => {
    const response = new Response("[]", { status: 200 });
    const timedFetch = createTimeoutFetch(vi.fn<typeof fetch>(async () => response), 1_000);

    await expect(timedFetch(`${BASE}/rest/v1/courses`)).resolves.toBe(response);
    expect(vi.getTimerCount()).toBe(0);
  });
});

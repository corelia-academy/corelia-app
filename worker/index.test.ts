import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type WorkerEnv } from "./index";

function createEnv(response = new Response("<!doctype html>", {
  headers: { "Content-Type": "text/html" },
})) {
  const fetch = vi.fn(async () => response);
  return {
    env: { ASSETS: { fetch } } satisfies WorkerEnv,
    fetch,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cloudflare asset fallback worker", () => {
  it("returns an uncached 404 for a missing hashed asset", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { env, fetch } = createEnv();

    const response = await handleRequest(
      new Request("https://app.corelia.academy/assets/index-old.js?ignored=secret"),
      env,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("Not Found");
    expect(fetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("[missing-static-asset]", {
      event: "missing_static_asset",
      path: "/assets/index-old.js",
    });
  });

  it("returns no body for a HEAD request to a missing asset", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { env } = createEnv();

    const response = await handleRequest(
      new Request("https://app.corelia.academy/assets/index-old.js", { method: "HEAD" }),
      env,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("delegates non-asset paths so SPA deep links keep working", async () => {
    const expected = new Response("<!doctype html>", {
      headers: { "Content-Type": "text/html" },
    });
    const { env, fetch } = createEnv(expected);
    const request = new Request("https://app.corelia.academy/courses/example");

    const response = await handleRequest(request, env);

    expect(response).toBe(expected);
    expect(fetch).toHaveBeenCalledWith(request);
  });
});

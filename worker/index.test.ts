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
  vi.unstubAllGlobals();
});

describe("Cloudflare asset fallback worker", () => {
  it("proxies a public avatar SVG instead of returning the SPA", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<svg></svg>", {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
    }));
    const { env, fetch } = createEnv();
    const response = await handleRequest(new Request("https://app.corelia.academy/avatar/alice.svg"), {
      ...env, CORELIA_API_URL: "https://example.supabase.co/functions/v1/corelia-api",
    });
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
    expect(await response.text()).toBe("<svg></svg>");
    expect(upstream.mock.calls[0]?.[0].toString()).toContain("op=avatar.svg&username=alice");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid avatar paths before SPA fallback", async () => {
    const { env, fetch } = createEnv();
    const response = await handleRequest(new Request("https://app.corelia.academy/avatar/bad-name.svg"), env);
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the cached SVG for repeated public requests", async () => {
    const cached = new Response("<svg cached />", { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" } });
    const match = vi.fn(async (request: Request) => { void request; return cached; });
    vi.stubGlobal("caches", { default: { match, put: vi.fn() } });
    const upstream = vi.spyOn(globalThis, "fetch");
    const { env } = createEnv();
    const response = await handleRequest(new Request("https://app.corelia.academy/avatar/alice.svg?size=42"), {
      ...env, CORELIA_API_URL: "https://example.supabase.co/functions/v1/corelia-api",
    });
    expect(await response.text()).toBe("<svg cached />");
    expect(match.mock.calls[0]?.[0].url).toBe("https://app.corelia.academy/avatar/alice.svg");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards the access token on avatar saves", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ seed: null, selections: {}, colors: {} }));
    const { env } = createEnv();
    const response = await handleRequest(new Request("https://app.corelia.academy/api/me/avatar", {
      method: "PATCH", headers: { Authorization: "Bearer test" }, body: JSON.stringify({ seed: null, selections: {}, colors: {} }),
    }), { ...env, CORELIA_API_URL: "https://example.supabase.co/functions/v1/corelia-api" });
    expect(response.status).toBe(200);
    expect((upstream.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe("Bearer test");
  });

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
    const request = new Request("https://app.corelia.academy/dashboard");

    const response = await handleRequest(request, env);

    expect(await response.text()).toBe("<!doctype html>");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(fetch).toHaveBeenCalledWith(request);
  });
});

describe("app served under the /learn base path", () => {
  const base = {
    CORELIA_APP_ORIGIN: "https://corelia.academy",
    CORELIA_APP_BASE_PATH: "/learn",
  };

  it("strips the base path before reading SPA assets", async () => {
    const { env, fetch } = createEnv();
    const response = await handleRequest(new Request("https://corelia.academy/learn/feed?tab=1"), { ...env, ...base });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe("https://corelia.academy/feed?tab=1");
  });

  it("serves the app root for the bare base path", async () => {
    const { env, fetch } = createEnv();
    await handleRequest(new Request("https://corelia.academy/learn"), { ...env, ...base });
    expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe("https://corelia.academy/");
  });

  it("serves hashed assets that exist under the base path", async () => {
    const script = new Response("console.log(1)", { headers: { "Content-Type": "text/javascript" } });
    const { env, fetch } = createEnv(script);
    const response = await handleRequest(new Request("https://corelia.academy/learn/assets/index-abc.js"), { ...env, ...base });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("console.log(1)");
    expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe("https://corelia.academy/assets/index-abc.js");
  });

  it("applies asset rules to the stripped path", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { env, fetch } = createEnv();
    // The SPA fallback answers a missing file with index.html; the Worker turns that into a 404.
    const response = await handleRequest(new Request("https://corelia.academy/learn/assets/index-old.js"), { ...env, ...base });
    expect(response.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not serve paths outside the base path", async () => {
    const { env, fetch } = createEnv();
    const response = await handleRequest(new Request("https://corelia.academy/learning"), { ...env, ...base });
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("injects OG metadata for page routes under the base path", async () => {
    const { env } = createEnv();
    const response = await handleRequest(new Request("https://corelia.academy/learn/projects/demo"), { ...env, ...base });
    // Unconfigured OG upstream: the page route was recognised after stripping the prefix.
    expect(response.status).toBe(503);
  });
});

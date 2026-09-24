import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOgWorkerRequest, type OgWorkerEnv } from "./og";

const base = "https://app.corelia.academy";
const meta = {
  canonicalUrl: `${base}/projects/example`, imageUrl: `${base}/api/og/project/example?v=abc`,
  updatedAt: "2026-09-24T00:00:00Z", revision: "abc", title: "Example | Corelia",
  description: "Example description", imageAlt: "Example image",
};

function env(success = true): OgWorkerEnv {
  return {
    ASSETS: { fetch: vi.fn(async () => new Response("<html><head></head></html>", { headers: { "Content-Type": "text/html" } })) },
    OG_RATE_LIMITER: { limit: vi.fn(async () => ({ success })) },
    CORELIA_OG_FUNCTION_URL: "https://supabase.example/functions/v1/corelia-api",
    CORELIA_APP_ORIGIN: base, OG_PROXY_SECRET: "secret",
  };
}

afterEach(() => vi.restoreAllMocks());

describe("OG Worker routing", () => {
  it("returns metadata without exposing the proxy secret", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(meta));
    const response = await handleOgWorkerRequest(new Request(`${base}/api/og/project/example/meta`), env());
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.json()).toEqual({ canonicalUrl: meta.canonicalUrl, imageUrl: meta.imageUrl, updatedAt: meta.updatedAt, revision: meta.revision });
    expect(upstream.mock.calls[0]?.[0].toString()).toContain("op=og.project.meta");
    expect(upstream.mock.calls[0]?.[1]?.headers).toEqual({ "x-corelia-og-proxy-secret": "secret" });
  });

  it("proxies HEAD and preserves upstream 404 for old or private images", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const response = await handleOgWorkerRequest(new Request(`${base}/api/og/project/example?v=old`, { method: "HEAD" }), env());
    expect(response?.status).toBe(404);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.text()).toBe("");
  });

  it("enforces methods and the rate limit", async () => {
    const wrongMethod = await handleOgWorkerRequest(new Request(`${base}/api/og/course/example/meta`, { method: "POST" }), env());
    expect(wrongMethod?.status).toBe(405);
    expect(wrongMethod?.headers.get("Allow")).toBe("GET");
    const limited = await handleOgWorkerRequest(new Request(`${base}/api/og/course/example/meta`), env(false));
    expect(limited?.status).toBe(429);
  });

  it("marks the admin preview noindex before hydration", async () => {
    const response = await handleOgWorkerRequest(new Request(`${base}/admin/og-preview`), env());
    expect(response?.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("keeps public pages indexable when metadata returns 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const response = await handleOgWorkerRequest(new Request(`${base}/projects/example`, {
      headers: { Accept: "text/html" },
    }), env());
    expect(response?.status).toBe(200);
    expect(response?.headers.get("X-Robots-Tag")).toBeNull();
  });

  it.each([
    ["projects/example", "project"],
    ["courses/typescript-tu-co-ban-den-thuc-hanh-mau", "course"],
    ["hackathons/unihackfest-2026", "hackathon"],
    ["@example", "profile"],
  ])("loads %s metadata for Telegram requests that accept any content type", async (path, entity) => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const response = await handleOgWorkerRequest(new Request(`${base}/${path}`, {
      headers: { Accept: "*/*", "User-Agent": "TelegramBot" },
    }), env());
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(upstream.mock.calls[0]?.[0].toString()).toContain(`op=og.${entity}.meta`);
  });

  it("retries a transient metadata error before serving a detail page", async () => {
    const upstream = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(Response.json(meta));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await handleOgWorkerRequest(new Request(`${base}/api/og/project/example/meta`), env());
    expect(response?.status).toBe(200);
    expect(response && (await response.json()).imageUrl).toBe(meta.imageUrl);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it.each(["network", "timeout"])('returns 503 instead of generic OG after %s errors', async (reason) => {
    const failure = reason === "timeout" ? new DOMException("timed out", "TimeoutError") : new TypeError("network failed");
    const upstream = vi.spyOn(globalThis, "fetch").mockRejectedValue(failure);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handleOgWorkerRequest(new Request(`${base}/projects/example`, {
      headers: { Accept: "text/html" },
    }), env());
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Retry-After")).toBe("5");
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(response?.headers.get("X-Robots-Tag")).toBeNull();
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("returns 503 after two upstream 5xx responses", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 502 }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handleOgWorkerRequest(new Request(`${base}/hackathons/unihackfest-2026`), env());
    expect(response?.status).toBe(503);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
});

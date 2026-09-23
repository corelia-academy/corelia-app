import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import type { OgCard } from "./types.ts";

const { loadCard, renderImage } = vi.hoisted(() => ({ loadCard: vi.fn(), renderImage: vi.fn() }));
vi.mock("./data.ts", () => ({ loadOgCard: loadCard, publicOgMeta: (card: OgCard) => ({
  canonicalUrl: card.canonicalUrl, imageUrl: `${card.canonicalUrl}?v=${card.revision}`,
  updatedAt: card.updatedAt, revision: card.revision,
}) }));
vi.mock("./media.ts", () => ({ loadCardImage: vi.fn(async () => null) }));
vi.mock("./render.tsx", () => ({ renderOgImage: renderImage }));

import { authorizedOgRequest, handleOgRequest } from "./handlers.ts";

const card: OgCard = {
  entity: "project", id: "project-id", canonicalId: "example", title: "Example",
  description: null, subtitle: null, tags: [], imagePath: null, dateLabel: null,
  updatedAt: "2026-09-24T00:00:00Z", canonicalUrl: "http://localhost:5173/projects/example",
  revision: "current",
};
const db = {} as SupabaseClient;
const url = "http://localhost:54321/functions/v1/corelia-api?op=og.project.image&id=example";

beforeEach(() => {
  loadCard.mockReset().mockResolvedValue(card);
  renderImage.mockReset().mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  vi.stubGlobal("Deno", { env: { get: (key: string) => key === "OG_PROXY_SECRET" ? "expected" : null } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OG Edge contract", () => {
  it("requires the proxy secret", () => {
    expect(authorizedOgRequest(new Request(url))).toBe(false);
    expect(authorizedOgRequest(new Request(url, { headers: { "x-corelia-og-proxy-secret": "wrong" } }))).toBe(false);
    expect(authorizedOgRequest(new Request(url, { headers: { "x-corelia-og-proxy-secret": "expected" } }))).toBe(true);
  });

  it("returns the same 404 for unavailable and obsolete revisions", async () => {
    loadCard.mockResolvedValueOnce(null);
    const missing = await handleOgRequest(new Request(`${url}&v=current`), db, "og.project.image");
    const obsolete = await handleOgRequest(new Request(`${url}&v=old`), db, "og.project.image");
    expect(missing.status).toBe(404);
    expect(obsolete.status).toBe(404);
    expect(await missing.text()).toBe(await obsolete.text());
    expect(renderImage).not.toHaveBeenCalled();
  });

  it("answers HEAD without rendering and GET with a PNG", async () => {
    const head = await handleOgRequest(new Request(`${url}&v=current`, { method: "HEAD" }), db, "og.project.image");
    expect(head.status).toBe(200);
    expect(head.headers.get("Content-Type")).toBe("image/png");
    expect(await head.text()).toBe("");
    expect(renderImage).not.toHaveBeenCalled();
    const get = await handleOgRequest(new Request(`${url}&v=current`), db, "og.project.image");
    expect(get.status).toBe(200);
    expect(get.headers.get("Cache-Control")).toBe("no-store");
    expect(renderImage).toHaveBeenCalledOnce();
  });

  it("returns 405 for the wrong method and 500 on render failure", async () => {
    const method = await handleOgRequest(new Request(url, { method: "POST" }), db, "og.project.image");
    expect(method.status).toBe(405);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderImage.mockRejectedValueOnce(new Error("render failed"));
    const failed = await handleOgRequest(new Request(`${url}&v=current`), db, "og.project.image");
    expect(failed.status).toBe(500);
    expect(failed.headers.get("Cache-Control")).toBe("no-store");
  });
});

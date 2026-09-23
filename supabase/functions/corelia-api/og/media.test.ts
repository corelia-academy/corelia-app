import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import { loadCardImage } from "./media.ts";
import type { OgCard } from "./types.ts";

const card: OgCard = {
  entity: "project", id: "one", canonicalId: "one", title: "One", description: null,
  subtitle: null, tags: [], imagePath: "project-media/owner/one/logo/test.png", dateLabel: null,
  updatedAt: "2026-09-24T00:00:00Z", canonicalUrl: "http://localhost:5173/projects/one", revision: "abc",
};

function db(signedUrl: string): SupabaseClient {
  return { storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn(async () => ({ data: { signedUrl }, error: null })) })) } } as unknown as SupabaseClient;
}

beforeEach(() => vi.stubGlobal("Deno", { env: { get: () => "http://127.0.0.1:54321" } }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OG media guard", () => {
  it("ignores external signed URLs without fetching", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    expect(await loadCardImage(db("https://outside.example/image.png"), card)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });

  it("rejects wrong MIME and oversized media", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/svg+xml" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "Content-Type": "image/png", "Content-Length": String(2 * 1024 * 1024 + 1) },
      }));
    const client = db("http://127.0.0.1:54321/storage/v1/object/sign/app/test.png");
    expect(await loadCardImage(client, card)).toBeNull();
    expect(await loadCardImage(client, card)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("accepts only bytes matching declared PNG MIME", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
      headers: { "Content-Type": "image/png" },
    }));
    const result = await loadCardImage(db("http://127.0.0.1:54321/storage/v1/object/sign/app/test.png"), card);
    expect(result).toMatch(/^data:image\/png;base64,/);
    fetcher.mockRestore();
  });
});

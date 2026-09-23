import { describe, expect, it, vi } from "vitest";
import { handleAvatarSave, handleAvatarSvg } from "./handlers";

vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: vi.fn(async (req: Request) => {
  if (req.headers.get("Authorization") !== "Bearer valid") throw new Error("Unauthenticated");
  return { id: "11111111-1111-4111-8111-111111111111" };
}) }));

function db(row: Record<string, unknown> | null) {
  const single = vi.fn(async () => ({ data: row, error: null }));
  const query = { update: vi.fn(() => query), eq: vi.fn(() => query), ilike: vi.fn(() => query), select: vi.fn(() => query), single, maybeSingle: single };
  return { client: { from: vi.fn(() => query) } as never, query };
}

describe("avatar API", () => {
  it("rejects unauthenticated and invalid writes", async () => {
    const mock = db({ avatar_seed: null });
    const payload = JSON.stringify({ seed: null, selections: {}, colors: {} });
    expect((await handleAvatarSave(new Request("https://example.com", { method: "PATCH", body: payload }), mock.client)).status).toBe(401);
    const bad = JSON.stringify({ seed: null, selections: { head: "unknown" }, colors: {} });
    expect((await handleAvatarSave(new Request("https://example.com", { method: "PATCH", headers: { Authorization: "Bearer valid" }, body: bad }), mock.client)).status).toBe(400);
    expect(mock.query.update).not.toHaveBeenCalled();
  });

  it("saves only the authenticated user's avatar", async () => {
    const mock = db({ avatar_seed: null });
    const response = await handleAvatarSave(new Request("https://example.com", { method: "PATCH", headers: { Authorization: "Bearer valid" }, body: JSON.stringify({ seed: null, selections: {}, colors: { hair: "123456" } }) }), mock.client);
    expect(response.status).toBe(200);
    expect(mock.query.eq).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");
    expect((await response.json()).colors.hair).toBe("#123456");
  });

  it("returns SVG for public profiles and 404 for private profiles", async () => {
    const publicDb = db({ id: "11111111-1111-4111-8111-111111111111", avatar_seed: null, avatar_config: { selections: {}, colors: {} }, profile_public: true });
    const request = new Request("https://example.com?username=alice");
    const response = await handleAvatarSvg(request, publicDb.client);
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(await response.text()).toContain("<svg");
    expect((await handleAvatarSvg(request, db({ profile_public: false }).client)).status).toBe(404);
    expect((await handleAvatarSvg(new Request("https://example.com?username=bad-name"), publicDb.client)).status).toBe(404);
  });
});

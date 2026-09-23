import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: mocks }));

import { getMilestonePage } from "@/lib/milestoneFeed";

describe("verified feed project card", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
  });

  it("links only to the hackathon and never reads user-authored project content", async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      id: 1, actor_id: "actor", kind: "project_submitted", source_key: "project",
      course_id: null, hackathon_id: "hackathon", project_id: "project", xp_total: null,
      created_at: "2026-09-22T00:00:00Z",
    }], error: null });
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({ in: async () => ({ data: table === "hackathons"
        ? [{ id: "hackathon", document: { title: "Hackathon Corelia", slug: "corelia" } }]
        : table === "public_profiles" ? [{ id: "actor", username: "actor" }] : [], error: null }) }),
    }));

    const page = await getMilestonePage("viewer", "explore");

    expect(page.sources[1]).toEqual([{ label: "Hackathon Corelia", href: "/hackathons/corelia" }]);
    expect(mocks.from).not.toHaveBeenCalledWith("projects");
  });
});


describe("feed RPC routing", () => {
  beforeEach(() => { mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({ data: [], error: null }); });
  it.each(["explore", "following"] as const)("uses v2 for %s", async (mode) => {
    await getMilestonePage("viewer", mode);
    expect(mocks.rpc).toHaveBeenCalledWith("get_feed_milestones_v2", {
      p_mode: mode, p_cursor_at: null, p_cursor_id: null, p_limit: 20,
    });
  });
  it("retains unfiltered v1 profile activity", async () => {
    await getMilestonePage("viewer", "profile", "actor");
    expect(mocks.rpc).toHaveBeenCalledWith("get_feed_milestones_v1", {
      p_actor_id: "actor", p_following: false, p_cursor_at: null, p_cursor_id: null, p_limit: 20,
    });
  });
  it("surfaces RPC failures", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(getMilestonePage("viewer", "explore")).rejects.toThrow("offline");
  });
});

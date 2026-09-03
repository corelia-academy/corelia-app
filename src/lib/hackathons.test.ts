import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  updated: null as Record<string, unknown> | null,
}));

vi.mock("@/i18n", () => ({ default: { language: "vi", resolvedLanguage: "vi" } }));
vi.mock("@/lib/coreliaEdgeApi", () => ({ invokeCoreliaApi: vi.fn(), callCoreliaApi: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteStorageObjectByPath: vi.fn() }));
vi.mock("@/lib/profile", () => ({
  getProfileForUser: vi.fn(async () => ({ id: "admin-1", role: "admin" })),
}));

vi.mock("@/lib/supabase", () => {
  const baseRow = () => ({
    id: "hackathon-1",
    status: "draft",
    participants_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    document: { slug: "demo", title: "Demo", short_description: "", tracks: [] },
  });

  const hackathonChain = () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      insert: vi.fn(async (payload: Record<string, unknown>) => {
        db.inserted = payload;
        return { error: null };
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        db.updated = payload;
        return chain;
      }),
      maybeSingle: vi.fn(async () => {
        const inserted = db.inserted;
        return {
          data: inserted
            ? { ...baseRow(), ...inserted }
            : baseRow(),
          error: null,
        };
      }),
      single: vi.fn(async () => {
        const updated = db.updated;
        return {
          data: updated
            ? { ...baseRow(), ...updated }
            : baseRow(),
          error: null,
        };
      }),
    };
    return chain;
  };

  const localeChain = () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    return chain;
  };

  return {
    supabase: {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } })) },
      from: vi.fn((table: string) => table === "hackathons" ? hackathonChain() : localeChain()),
    },
  };
});

import { createContest, updateContest } from "./hackathons";

const customTrack = {
  id: "open-track",
  name: "Hạng mục mở",
  description: "Mô tả",
  active: true,
  prize_amount: "80",
  sort_order: 2,
  rubric: { impact: 50 },
};

describe("hackathon track persistence", () => {
  beforeEach(() => {
    db.inserted = null;
    db.updated = null;
  });

  it("stores primary-locale tracks in a newly created hackathon document", async () => {
    await createContest({
      title: "Demo",
      tagline: "",
      slug: "demo",
      tracks: [customTrack],
    });

    expect((db.inserted?.document as { tracks?: unknown[] }).tracks).toEqual([customTrack]);
  });

  it("stores primary-locale tracks when updating a hackathon document", async () => {
    await updateContest("hackathon-1", { tracks: [customTrack] });

    expect((db.updated?.document as { tracks?: unknown[] }).tracks).toEqual([customTrack]);
  });
});

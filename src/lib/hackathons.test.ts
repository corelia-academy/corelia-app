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

import { canRegisterForContest, createContest, updateContest } from "./hackathons";

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

describe("canRegisterForContest registration policy", () => {
  const future = new Date(Date.now() + 86400000 * 7).toISOString();
  const past = new Date(Date.now() - 86400000 * 7).toISOString();

  it("returns true for published and running hackathons within deadline", () => {
    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: future,
        submission_deadline: null,
        ends_at: null,
      }),
    ).toBe(true);

    expect(
      canRegisterForContest({
        status: "running",
        registration_deadline: future,
        submission_deadline: null,
        ends_at: null,
      }),
    ).toBe(true);
  });

  it("returns false for hackathons after registration deadline", () => {
    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: past,
        submission_deadline: future,
        ends_at: future,
      }),
    ).toBe(false);

    expect(
      canRegisterForContest({
        status: "running",
        registration_deadline: past,
        submission_deadline: future,
        ends_at: future,
      }),
    ).toBe(false);
  });

  it("falls back to submission_deadline when registration_deadline is empty", () => {
    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: null,
        submission_deadline: future,
        ends_at: null,
      }),
    ).toBe(true);

    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: null,
        submission_deadline: past,
        ends_at: future,
      }),
    ).toBe(false);
  });

  it("falls back to ends_at when both registration and submission deadlines are empty", () => {
    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: null,
        submission_deadline: null,
        ends_at: future,
      }),
    ).toBe(true);

    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: null,
        submission_deadline: null,
        ends_at: past,
      }),
    ).toBe(false);
  });

  it("returns true when all deadlines are empty/omitted for published/running", () => {
    expect(
      canRegisterForContest({
        status: "published",
        registration_deadline: null,
        submission_deadline: null,
        ends_at: null,
      }),
    ).toBe(true);

    expect(
      canRegisterForContest({
        status: "running",
        registration_deadline: null,
        submission_deadline: null,
        ends_at: null,
      }),
    ).toBe(true);
  });

  it("returns false for draft or ended hackathons regardless of deadline", () => {
    expect(
      canRegisterForContest({
        status: "draft",
        registration_deadline: future,
        submission_deadline: future,
        ends_at: future,
      }),
    ).toBe(false);

    expect(
      canRegisterForContest({
        status: "ended",
        registration_deadline: future,
        submission_deadline: future,
        ends_at: future,
      }),
    ).toBe(false);
  });

  describe("hackathon taxonomy write contract enforcement", () => {
    const validSector = { id: "sec-1", name: "AI", active: true, sort_order: 0 };
    const validTech = { id: "tech-1", name: "Python", active: true, sort_order: 0 };

    it("allows creating a draft with empty taxonomy without injecting dummy values", async () => {
      const contest = await createContest({
        title: "Draft Event",
        tagline: "Draft Tagline",
        slug: "draft-event",
        status: "draft",
        sectors: [],
        tech_stacks: [],
      });

      expect(contest.status).toBe("draft");
      expect(db.inserted?.document).toMatchObject({
        sectors: [],
        tech_stacks: [],
      });
    });

    it("rejects creating a published hackathon when sectors or tech_stacks is empty", async () => {
      await expect(
        createContest({
          title: "Published Event",
          tagline: "",
          slug: "published-event",
          status: "published",
          sectors: [],
          tech_stacks: [validTech],
        }),
      ).rejects.toThrow("invalid_input:hackathon_taxonomy_required");

      await expect(
        createContest({
          title: "Published Event",
          tagline: "",
          slug: "published-event",
          status: "published",
          sectors: [validSector],
          tech_stacks: [],
        }),
      ).rejects.toThrow("invalid_input:hackathon_taxonomy_required");
    });

    it("rejects creating a published hackathon when items are invalid", async () => {
      await expect(
        createContest({
          title: "Published Event",
          tagline: "",
          slug: "published-event",
          status: "published",
          sectors: [{ id: "", name: "" } as unknown as typeof validSector],
          tech_stacks: [validTech],
        }),
      ).rejects.toThrow("invalid_input:hackathon_taxonomy_invalid");
    });

    it("rejects updating to published when hackathon lacks active taxonomy", async () => {
      await expect(
        updateContest("hackathon-1", {
          status: "published",
          sectors: [],
          tech_stacks: [],
        }),
      ).rejects.toThrow("invalid_input:hackathon_taxonomy_required");
    });

    it("allows updating to published when valid active taxonomy is provided", async () => {
      const updated = await updateContest("hackathon-1", {
        status: "published",
        sectors: [validSector],
        tech_stacks: [validTech],
      });
      expect(updated.status).toBe("published");
    });
  });
});

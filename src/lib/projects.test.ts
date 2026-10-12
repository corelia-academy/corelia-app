import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({
  winners: [] as Array<{ id: string; title: string; owner_id: string; logo_path: null; screenshot_paths: string[]; i18n: null }>,
  regular: [] as Array<{ id: string; title: string; owner_id: string; logo_path: null; screenshot_paths: string[]; i18n: null }>,
  ranges: [] as Array<[number, number]>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "projects") {
        let winnerLookup = false;
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: (column: string) => { if (column === "id") winnerLookup = true; return chain; },
          not: () => chain,
          order: () => chain,
          range: async (start: number, end: number) => {
            rows.ranges.push([start, end]);
            return { data: rows.regular.slice(start, end + 1), error: null };
          },
          then: (resolve: (value: { data: typeof rows.winners; error: null }) => unknown) =>
            resolve({ data: winnerLookup ? rows.winners : [], error: null }),
        };
        return chain;
      }
      const chain = {
        select: () => chain,
        in: () => chain,
        eq: async () => ({ data: [], error: null }),
      };
      return chain;
    },
  },
}));

import { listPublicProjects } from "./projects";

const project = (index: number) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  title: `Project ${index}`,
  owner_id: "",
  logo_path: null,
  screenshot_paths: [],
  i18n: null,
});

describe("listPublicProjects winner pagination", () => {
  beforeEach(() => {
    rows.winners = Array.from({ length: 12 }, (_, index) => project(index + 1));
    rows.regular = [];
    rows.ranges = [];
  });

  const options = () => ({
    hackathonId: "hackathon-1",
    source: "hackathon" as const,
    limit: 12,
    winnerProjectIds: rows.winners.map((winner) => winner.id),
  });

  it("continues after a full page of winners when regular projects exist", async () => {
    rows.regular = [project(13)];

    const first = await listPublicProjects(options());
    expect(first.items).toHaveLength(12);
    expect(first.nextCursor).toBe("12");
    expect(rows.ranges).toEqual([[0, 0]]);

    const second = await listPublicProjects({ ...options(), cursor: first.nextCursor });
    expect(second.items.map(({ project: item }) => item.id)).toEqual([rows.regular[0].id]);
    expect(second.nextCursor).toBeNull();
  });

  it("stops after a full page of winners when no regular projects exist", async () => {
    const first = await listPublicProjects(options());
    expect(first.items).toHaveLength(12);
    expect(first.hasMore).toBe(false);
    expect(first.nextCursor).toBeNull();
    expect(rows.ranges).toEqual([[0, 0]]);
  });
});

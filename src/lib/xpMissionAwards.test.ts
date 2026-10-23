import { expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ or: [] as string[], rows: [] as Array<{ source: string; source_key: string | null }> }));
vi.mock("@/lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    or: async (filter: string) => {
      calls.or.push(filter);
      return { data: calls.rows, error: null };
    },
  };
  return { supabase: { from: () => chain } };
});

import { getMyXpMissionAwards } from "./xp";

it("reads one-off awards and today's likes in one request", async () => {
  calls.rows = [
    { source: "ocid_connected", source_key: "ocid_connected" },
    ...Array.from({ length: 6 }, (_, index) => ({ source: "project_liked", source_key: `project_liked:${index}` })),
  ];
  const result = await getMyXpMissionAwards("user-1", ["ocid_connected", "github_connected"]);
  expect(calls.or).toHaveLength(1);
  expect(calls.or[0]).toMatch(/^source_key\.in\.\(ocid_connected,github_connected\),and\(source\.eq\.project_liked,occurred_at\.gte\."\d{4}-\d{2}-\d{2}T00:00:00\.000Z"\)$/);
  expect(result.awardedKeys.has("ocid_connected")).toBe(true);
  expect(result.awardedKeys.has("github_connected")).toBe(false);
  expect(result.projectLikesToday).toBe(5);
});

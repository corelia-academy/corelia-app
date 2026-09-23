import { expect, it, vi } from "vitest";
vi.mock("@/lib/xpLeaderboard", () => ({ getXpLeaderboard: vi.fn() }));
import { xpLeaderboardQuery } from "./xpQueries";
it("separates periods, identities and UTC weeks while remaining under XP invalidation", () => {
  const options = [xpLeaderboardQuery("a", "week", "2026-09-21"), xpLeaderboardQuery("a", "week", "2026-09-28"), xpLeaderboardQuery("b", "week", "2026-09-21"), xpLeaderboardQuery("a", "all_time")];
  expect(new Set(options.map(item => JSON.stringify(item.queryKey))).size).toBe(4);
  for (const option of options) expect(option.queryKey[0]).toBe("xp");
  expect(xpLeaderboardQuery("a", "all_time", "old").queryKey).toEqual(xpLeaderboardQuery("a", "all_time", "new").queryKey);
  expect(xpLeaderboardQuery("", "week").enabled).toBe(false);
});

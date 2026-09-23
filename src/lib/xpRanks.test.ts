import { describe, expect, it } from "vitest";
import { getXpRank, XP_RANKS, xpWeekStart } from "./xpRanks";

describe("XP rank thresholds", () => {
  it.each(XP_RANKS)("starts $code exactly at $minimum", ({ code, minimum }) => {
    expect(getXpRank(minimum).current.code).toBe(code);
    expect(getXpRank(minimum + 1).current.code).toBe(code);
    if (minimum) expect(getXpRank(minimum - 1).current.code).not.toBe(code);
  });
  it("measures progress within the current tier", () => {
    expect(getXpRank(625)).toMatchObject({ current: { code: "bronze" }, next: { code: "silver" }, progress: 50, remaining: 375 });
    expect(getXpRank(0)).toMatchObject({ progress: 0, remaining: 250 });
  });
  it("handles the top rank without a fictional next tier", () => {
    expect(getXpRank(100000)).toMatchObject({ current: { code: "diamond" }, next: null, remaining: 0, progress: 100 });
  });
  it("recomputes downward after correction and clamps progress safely", () => {
    expect(getXpRank(1000).current.code).toBe("silver");
    expect(getXpRank(900).current.code).toBe("bronze");
    expect(getXpRank(-10)).toMatchObject({ current: { code: "starter" }, progress: 0 });
  });
});
it("uses Monday UTC regardless of the caller timezone", () => {
  expect(xpWeekStart(new Date("2026-09-28T06:59:59+07:00"))).toBe("2026-09-21T00:00:00.000Z");
  expect(xpWeekStart(new Date("2026-09-28T07:00:00+07:00"))).toBe("2026-09-28T00:00:00.000Z");
  expect(xpWeekStart(new Date("2027-01-01T00:00:00Z"))).toBe("2026-12-28T00:00:00.000Z");
});

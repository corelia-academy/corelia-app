import { describe, expect, it } from "vitest";

import {
  areHackathonDeadlinesValid,
  generateCanonicalProjectSlug,
  isPrizeAllocationValid,
  matchesHackathonTaxonomy,
  orderWinnerFirst,
  sanitizeHackathonTaxonomy,
  sortHackathonTimeline,
} from "./hackathonContract";

describe("simplified hackathon contract", () => {
  it("sanitizes taxonomy and keeps stable ids", () => {
    expect(sanitizeHackathonTaxonomy([
      { id: " ai ", name: " AI ", active: true, sort_order: 2 },
      { id: "ai", name: "duplicate", active: true, sort_order: 3 },
      { id: "web3", name: " Web3 ", active: false, sort_order: 1 },
    ])).toEqual([
      { id: "web3", name: "Web3", active: false, sort_order: 1 },
      { id: "ai", name: "AI", active: true, sort_order: 2 },
    ]);
  });

  it("validates prize allocation and deadlines", () => {
    expect(isPrizeAllocationValid("1000.50", [{ id: "a", name: "A", prize_amount: "400.25" }, { id: "b", name: "B", prize_amount: "600.25" }])).toBe(true);
    expect(isPrizeAllocationValid("1000", [{ id: "a", name: "A", prize_amount: "1000.01" }])).toBe(false);
    expect(areHackathonDeadlinesValid("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true);
    expect(areHackathonDeadlinesValid("2026-01-03T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(false);
  });

  it("sorts timeline by authored order then time", () => {
    const items = [
      { id: "b", title: "B", starts_at: "2026-02-02T00:00:00Z", sort_order: 1 },
      { id: "a", title: "A", starts_at: "2026-02-01T00:00:00Z", sort_order: 1 },
      { id: "c", title: "C", starts_at: "2026-01-01T00:00:00Z", sort_order: 2 },
    ];
    expect(sortHackathonTimeline(items).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("uses OR within taxonomy groups and AND between groups", () => {
    const project = { trackIds: ["ai"], sectorIds: ["education"], techStackIds: ["react"] };
    expect(matchesHackathonTaxonomy(project, { trackIds: ["web3", "ai"], sectorIds: ["education"], techStackIds: ["react", "vue"] })).toBe(true);
    expect(matchesHackathonTaxonomy(project, { trackIds: ["ai"], sectorIds: ["finance"], techStackIds: [] })).toBe(false);
  });

  it("orders winners manually without scores", () => {
    const projects = [{ id: "normal" }, { id: "second" }, { id: "first" }];
    const awards = [
      { id: "award-2", project_id: "second", label: "Runner-up", sort_order: 2 },
      { id: "award-1", project_id: "first", label: "Winner", sort_order: 1 },
    ];
    expect(orderWinnerFirst(projects, awards).map((item) => item.id)).toEqual(["first", "second", "normal"]);
  });

  it("generates deterministic lowercase slugs", () => {
    expect(generateCanonicalProjectSlug("Ứng dụng Giáo dục", "A1B2C3D4-extra")).toBe("ung-dung-giao-duc-a1b2c3d4");
  });
});

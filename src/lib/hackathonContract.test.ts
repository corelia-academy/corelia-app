import { describe, expect, it } from "vitest";
import type { Contest } from "@/types/hackathons";

import {
  applyHackathonLocaleContent,
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
    expect(generateCanonicalProjectSlug("manual-slug-")).toBe("manual-slug");
  });

  it("falls back to original contest content when localized strings are empty or whitespace", () => {
    const baseContest = {
      id: "contest-1",
      title: "Cuộc thi AI",
      tagline: "Khám phá tiềm năng AI",
      short_description: "Mô tả ngắn cuộc thi",
      description: "Mô tả chi tiết",
      description_markdown: "# Nội dung cuộc thi",
      resources_markdown: "Tài liệu",
      rules: "Quy định",
      status: "published" as const,
      location: "online" as const,
      registration_deadline: null,
      submission_deadline: null,
      max_participants: null,
      judge_emails: [],
      tracks: [
        { id: "track-1", name: "AI Agent", description: "Lập trình agent" },
      ],
      sectors: [
        { id: "sec-1", name: "Giáo dục", active: true, sort_order: 0 },
      ],
    } as unknown as Contest;

    // Case 1: Empty string should fall back to base
    const localizedEmpty = {
      title: "",
      tagline: "   ",
      short_description: "",
      description_markdown: "  \n  ",
      tracks: [{ id: "track-1", name: "" }],
      sectors: [{ id: "sec-1", name: "   ", active: true, sort_order: 0 }],
    };
    const resultEmpty = applyHackathonLocaleContent(baseContest, localizedEmpty);
    expect(resultEmpty.title).toBe("Cuộc thi AI");
    expect(resultEmpty.tagline).toBe("Khám phá tiềm năng AI");
    expect(resultEmpty.short_description).toBe("Mô tả ngắn cuộc thi");
    expect(resultEmpty.description_markdown).toBe("# Nội dung cuộc thi");
    expect(resultEmpty.tracks?.[0]?.name).toBe("AI Agent");
    expect(resultEmpty.sectors?.[0]?.name).toBe("Giáo dục");

    // Case 2: Valid localized string should take precedence
    const localizedValid = {
      title: "Global AI Hackathon",
      tagline: "Explore AI potentials",
      short_description: "Short summary",
      tracks: [{ id: "track-1", name: "AI Agent Global" }],
    };
    const resultValid = applyHackathonLocaleContent(baseContest, localizedValid);
    expect(resultValid.title).toBe("Global AI Hackathon");
    expect(resultValid.tagline).toBe("Explore AI potentials");
    expect(resultValid.short_description).toBe("Short summary");
    expect(resultValid.tracks?.[0]?.name).toBe("AI Agent Global");
  });
});

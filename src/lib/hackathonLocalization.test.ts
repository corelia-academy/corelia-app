import { describe, expect, it } from "vitest";

import { applyHackathonLocaleContent } from "./hackathonContract";
import type { Contest } from "@/types/hackathons";

describe("hackathon locale projection", () => {
  it("localizes text while preserving shared ids, amounts, state, and timestamps", () => {
    const contest = {
      title: "Tiêu đề",
      tagline: "Ngắn",
      short_description: "Ngắn",
      prize_pool: { amount: "1000", currency: "USDC", description_markdown: "VI" },
      tracks: [{ id: "track", name: "AI", description: "VI", prize_amount: "500", active: true, sort_order: 1 }],
      sectors: [{ id: "sector", name: "Giáo dục", active: false, sort_order: 2 }],
      tech_stacks: [],
      timeline: [{ id: "phase", title: "Mở", starts_at: "2026-01-01T00:00:00Z", ends_at: null, description_markdown: "VI", sort_order: 3 }],
    } as unknown as Contest;

    const localized = applyHackathonLocaleContent(contest, {
      title: "Title",
      short_description: "Short",
      prize_description_markdown: "EN",
      tracks: [{ id: "track", name: "AI Track", description: "EN", active: false }],
      sectors: [{ id: "sector", name: "Education", active: true, sort_order: 0 }],
      timeline: [{ id: "phase", title: "Open", starts_at: "2099-01-01T00:00:00Z", description_markdown: "EN", sort_order: 0 }],
    });

    expect(localized.title).toBe("Title");
    expect(localized.prize_pool).toMatchObject({ amount: "1000", currency: "USDC", description_markdown: "EN" });
    expect(localized.tracks?.[0]).toMatchObject({ id: "track", name: "AI Track", prize_amount: "500", active: true, sort_order: 1 });
    expect(localized.sectors?.[0]).toMatchObject({ id: "sector", name: "Education", active: false, sort_order: 2 });
    expect(localized.timeline?.[0]).toMatchObject({ id: "phase", title: "Open", starts_at: "2026-01-01T00:00:00Z", sort_order: 3 });
  });
});

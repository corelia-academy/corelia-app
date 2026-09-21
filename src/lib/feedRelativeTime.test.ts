import { describe, expect, it } from "vitest";
import { feedRelativeTime } from "./feedRelativeTime";

describe("feed relative time", () => {
  const now = Date.parse("2026-09-22T12:00:00Z");

  it("shows elapsed hours in Vietnamese", () => {
    expect(feedRelativeTime("2026-09-22T09:00:00Z", now, "vi", "Vừa xong")).toBe("3 giờ trước");
  });

  it("uses minutes, days, and a short just-now label", () => {
    expect(feedRelativeTime("2026-09-22T11:59:30Z", now, "vi", "Vừa xong")).toBe("Vừa xong");
    expect(feedRelativeTime("2026-09-22T11:40:00Z", now, "en", "Just now")).toBe("20 minutes ago");
    expect(feedRelativeTime("2026-09-20T12:00:00Z", now, "en", "Just now")).toBe("2 days ago");
  });
});

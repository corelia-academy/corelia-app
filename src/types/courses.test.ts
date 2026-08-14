import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";

import { formatDuration, getYoutubeVideoId } from "./courses";

describe("formatDuration", () => {
  let previousLanguage: string;

  beforeAll(async () => {
    previousLanguage = i18n.language;
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(previousLanguage);
  });

  it("rounds only after raw lesson seconds have been accumulated", () => {
    // Ten 21-second lessons total 210 seconds; rounding each lesson first
    // would produce ten minutes instead of the correct rounded course total.
    expect(formatDuration(210)).toBe("4 mins");
  });

  it("carries rounded minutes into the hour component", () => {
    expect(formatDuration(3599)).toBe("1h 0m");
  });
});

describe("getYoutubeVideoId", () => {
  const videoId = "dQw4w9WgXcQ";

  it.each([
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/watch?feature=shared&v=${videoId}&si=abc`,
    `https://youtu.be/${videoId}?si=abc`,
    `https://www.youtube.com/shorts/${videoId}?feature=share`,
    `https://www.youtube.com/live/${videoId}?feature=share`,
    `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
  ])("extracts an ID from %s", (url) => {
    expect(getYoutubeVideoId(url)).toBe(videoId);
  });

  it("rejects non-YouTube URLs and malformed IDs", () => {
    expect(getYoutubeVideoId(`https://example.com/watch?v=${videoId}`)).toBeNull();
    expect(getYoutubeVideoId("https://www.youtube.com/shorts/not-an-id")).toBeNull();
  });
});

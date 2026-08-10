import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";

import { formatDuration } from "./courses";

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

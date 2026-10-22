import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTO_TIMEZONE, setTimeZonePreference } from "@/lib/timezone";
import { formatEventDateTime } from "./formatEventDateTime";

const deadline = "2026-09-30T05:00:00.000Z";

describe("formatEventDateTime", () => {
  beforeEach(() => setTimeZonePreference("Asia/Ho_Chi_Minh"));
  afterEach(() => setTimeZonePreference(AUTO_TIMEZONE));

  it("shows the deadline in the user's timezone with its offset", () => {
    expect(formatEventDateTime(deadline, "vi-VN")).toContain("30 thg 9, 2026 · 12:00");
    expect(formatEventDateTime(deadline, "en-US")).toContain("GMT+7");
  });

  it("follows a different chosen timezone", () => {
    setTimeZonePreference("Asia/Tokyo");
    expect(formatEventDateTime(deadline, "en-US")).toContain("14:00");
    expect(formatEventDateTime(deadline, "en-US")).toContain("GMT+9");
  });

  it("can omit the timezone when the deadline timezone is shown in a tooltip", () => {
    const formatted = formatEventDateTime(deadline, "en-US", { includeTimezone: false });
    expect(formatted).toContain("12:00");
    expect(formatted).not.toContain("GMT+7");
  });
});

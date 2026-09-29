import { describe, expect, it } from "vitest";
import { formatVietnamDateTime } from "./formatVietnamDateTime";

describe("formatVietnamDateTime", () => {
  it("shows the UniHackfest noon deadline with its Vietnam timezone", () => {
    const deadline = "2026-09-30T05:00:00.000Z";
    expect(formatVietnamDateTime(deadline, "vi-VN")).toContain("12:00");
    expect(formatVietnamDateTime(deadline, "vi-VN")).toContain("30 thg 9, 2026 · 12:00");
    expect(formatVietnamDateTime(deadline, "en-US")).toContain("ICT (UTC+7)");
  });
});

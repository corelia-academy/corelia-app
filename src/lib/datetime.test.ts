import { describe, expect, it } from "vitest";
import { datetimeLocalToIso, isoToDatetimeLocal } from "./datetime";

describe("datetime-local conversion", () => {
  it("renders an instant in the given zone", () => {
    expect(isoToDatetimeLocal("2026-09-30T05:00:00.000Z", "Asia/Ho_Chi_Minh")).toBe("2026-09-30T12:00");
    expect(isoToDatetimeLocal("2026-09-30T05:00:00.000Z", "America/New_York")).toBe("2026-09-30T01:00");
    expect(isoToDatetimeLocal("not a date", "UTC")).toBe("");
  });

  it("parses an input value in the given zone", () => {
    expect(datetimeLocalToIso("2026-09-30T12:00", "Asia/Ho_Chi_Minh")).toBe("2026-09-30T05:00:00.000Z");
    expect(datetimeLocalToIso("2026-01-15T09:30", "America/New_York")).toBe("2026-01-15T14:30:00.000Z");
    expect(datetimeLocalToIso("2026-07-15T09:30", "America/New_York")).toBe("2026-07-15T13:30:00.000Z");
    expect(datetimeLocalToIso("  ", "UTC")).toBeNull();
  });

  it("round-trips", () => {
    for (const zone of ["UTC", "Asia/Tokyo", "Europe/London", "Asia/Kolkata"]) {
      expect(datetimeLocalToIso(isoToDatetimeLocal("2026-03-29T00:30:00.000Z", zone), zone)).toBe("2026-03-29T00:30:00.000Z");
    }
  });
});

import { describe, expect, it } from "vitest";
import { normalizeProfileName, validateProfileName, profileNameFromMetadata } from "./profileName";

describe("profile names", () => {
  it("removes the incident payload without changing the visible name", () => {
    expect(normalizeProfileName("Terran " + "\ufff6 ".repeat(2094))).toBe("Terran");
    expect(normalizeProfileName("\ufff6 ".repeat(1000))).toBeNull();
  });
  it("preserves Vietnamese, CJK, Arabic and legitimate script joiners", () => {
    for (const name of ["Nguyễn Thị Ánh", "王小明", "محمد", "علی‌رضا", "👩‍💻 Linh"]) {
      expect(validateProfileName(name)).toBe(name);
    }
    expect(normalizeProfileName("Nguye\u0302\u0303n")).toBe("Nguyễn");
  });
  it("strips controls and bidi spoofing and handles invisible-only strings", () => {
    expect(normalizeProfileName("\u202eTerran\u202c\u200b\u0000")).toBe("Terran");
    expect(normalizeProfileName("\u200c\u200d ")).toBeNull();
    expect(normalizeProfileName("  Jane\u00a0  Doe  ")).toBe("Jane Doe");
  });
  it("enforces the code point limit and safely handles untrusted auth metadata", () => {
    expect(validateProfileName("é".repeat(160))).toHaveLength(160);
    expect(() => validateProfileName("é".repeat(161))).toThrow("profile_name_too_long");
    expect(profileNameFromMetadata({ name: "not a string" })).toBeNull();
    expect(profileNameFromMetadata("a".repeat(200))).toHaveLength(160);
  });
});

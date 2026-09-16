import { describe, expect, it } from "vitest";
import { consentFromCsv, normalizeEmail, parseCsv } from "./csv.ts";

describe("Email Center CSV", () => {
  it("parses BOM, quoted commas, escaped quotes and newlines", () => {
    expect(parseCsv('\uFEFFemail,name,note\r\na@example.com,"Nguyễn, An","a\n""b"""')).toEqual([
      ["email", "name", "note"],
      ["a@example.com", "Nguyễn, An", 'a\n"b"'],
    ]);
  });

  it("normalizes addresses and recognizes explicit consent", () => {
    expect(normalizeEmail(" USER@Example.com ")).toBe("user@example.com");
    expect(normalizeEmail("invalid")).toBeNull();
    expect(consentFromCsv("Đồng ý")).toBe(true);
    expect(consentFromCsv("no")).toBe(false);
  });
});

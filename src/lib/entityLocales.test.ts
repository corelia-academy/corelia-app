import { describe, expect, it } from "vitest";
import { normalizeContentLocale, pickContentLocale } from "./entityLocales";

describe("public content language negotiation", () => {
  it.each(["en", "en-US", "en_GB", " EN-us "])("normalizes %s", input => expect(normalizeContentLocale(input)).toBe("en"));
  it.each(["vi", "vi-VN", "vi_VN", null, undefined, "fr"])("keeps Vietnamese fallback for %s", input => expect(normalizeContentLocale(input)).toBe("vi"));
  it("respects a content item's supported languages", () => {
    expect(pickContentLocale({ primary_content_locale: "vi", supported_locales: ["vi"] }, "en-US")).toBe("vi");
  });
});

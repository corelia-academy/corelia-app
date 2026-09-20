import { describe, expect, it } from "vitest";
import { normalizeEmailLocale, parseEmailLocale, resolveRecipientEmailLocale } from "./locale.ts";

describe("email locale", () => {
  it.each([
    ["vi", "vi"], ["vn", "vi"], ["vi-VN", "vi"], ["VI_vn", "vi"],
    ["en", "en"], ["en-US", "en"], ["EN_gb", "en"],
  ])("normalizes %s", (input, expected) => expect(parseEmailLocale(input)).toBe(expected));

  it.each([null, undefined, "", "fr", " vietnamese "])("falls back to English for %s", (input) => {
    expect(normalizeEmailLocale(input)).toBe("en");
  });

  it("uses profile, metadata, contact, then fallback precedence", () => {
    expect(resolveRecipientEmailLocale({ profileLocale: "vi", authMetadataLocale: "en", contactLocale: "en" })).toEqual({ locale: "vi", source: "profile" });
    expect(resolveRecipientEmailLocale({ profileLocale: "fr", authMetadataLocale: "en-GB", contactLocale: "vi" })).toEqual({ locale: "en", source: "auth_metadata" });
    expect(resolveRecipientEmailLocale({ contactLocale: "vn" })).toEqual({ locale: "vi", source: "contact" });
    expect(resolveRecipientEmailLocale({ contactLocale: "fr" })).toEqual({ locale: "en", source: "fallback" });
  });
});

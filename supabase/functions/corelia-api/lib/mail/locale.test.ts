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
    expect(resolveRecipientEmailLocale({ recipientKind: "account", profileLocale: "vi", authMetadataLocale: "en", contactLocale: "en" })).toEqual({ locale: "vi", source: "profile" });
    expect(resolveRecipientEmailLocale({ recipientKind: "account", profileLocale: "fr", authMetadataLocale: "en-GB", contactLocale: "vi" })).toEqual({ locale: "en", source: "auth_metadata" });
    expect(resolveRecipientEmailLocale({ recipientKind: "account", contactLocale: "vn" })).toEqual({ locale: "en", source: "fallback" });
    expect(resolveRecipientEmailLocale({ recipientKind: "contact", contactLocale: "vn" })).toEqual({ locale: "vi", source: "contact" });
    expect(resolveRecipientEmailLocale({ recipientKind: "contact", contactLocale: "fr" })).toEqual({ locale: "en", source: "fallback" });
  });
});

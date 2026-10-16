import { describe, expect, it } from "vitest";
import { getSupportedContentLocales, normalizeContentLocale, pickContentLocale } from "./entityLocales";

describe("public content language negotiation", () => {
  it.each(["en", "en-US", "en_GB", " EN-us "])("normalizes %s", input => expect(normalizeContentLocale(input)).toBe("en"));
  it.each(["vi", "vi-VN", "vi_VN", null, undefined, "fr"])("keeps Vietnamese fallback for %s", input => expect(normalizeContentLocale(input)).toBe("vi"));
  it.each([["zh-TW", "zh-TW"], ["zh-HK", "zh-TW"], ["zh", "zh-CN"], ["zh_Hans", "zh-CN"], ["ko-KR", "ko"], ["ja", "ja"], ["es-MX", "es"]])("keeps %s as %s", (input, expected) => {
    expect(normalizeContentLocale(input)).toBe(expected);
  });
  it("serves a translated locale only when the item supports it", () => {
    expect(pickContentLocale({ primary_content_locale: "vi", supported_locales: ["vi", "ja", "zh-TW"] }, "zh-TW")).toBe("zh-TW");
    expect(pickContentLocale({ primary_content_locale: "ja", supported_locales: ["ja", "ko"] }, "zh-CN")).toBe("ja");
  });
  it("respects a content item's supported languages", () => {
    expect(pickContentLocale({ primary_content_locale: "vi", supported_locales: ["vi"] }, "en-US")).toBe("vi");
  });
  it("falls back to the primary locale alone when no supported list is stored", () => {
    expect(getSupportedContentLocales({ primary_content_locale: "ja" })).toEqual(["ja"]);
    expect(getSupportedContentLocales(null)).toEqual(["vi"]);
    expect(pickContentLocale({ primary_content_locale: "ko" }, "en")).toBe("ko");
  });
});

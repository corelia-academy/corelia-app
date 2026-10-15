import { describe, expect, it } from "vitest";
import {
  CONTENT_LOCALES,
  intlLocaleFor,
  normalizeLocale,
  parseContentLocale,
  pickBrowserLocale,
} from "./locales";

describe("locales", () => {
  it("lists the seven locales in display order", () => {
    expect([...CONTENT_LOCALES]).toEqual(["en", "zh-CN", "ko", "es", "zh-TW", "vi", "ja"]);
  });

  it.each([
    ["zh", "zh-CN"], ["zh-CN", "zh-CN"], ["zh_Hans", "zh-CN"], ["zh-SG", "zh-CN"],
    ["zh-TW", "zh-TW"], ["zh-HK", "zh-TW"], ["zh-MO", "zh-TW"], ["zh-Hant", "zh-TW"], ["zh_Hant_TW", "zh-TW"],
    ["ko-KR", "ko"], ["ja-JP", "ja"], ["es-MX", "es"], ["en-GB", "en"], ["vi-VN", "vi"], ["vn", "vi"], [" EN ", "en"],
  ])("parses %s", (input, expected) => expect(parseContentLocale(input)).toBe(expected));

  it.each([null, undefined, "", "fr", "de-DE"])("rejects %s and falls back", (input) => {
    expect(parseContentLocale(input)).toBeNull();
    expect(normalizeLocale(input)).toBe("vi");
    expect(normalizeLocale(input, "en")).toBe("en");
  });

  it("picks the first supported browser language", () => {
    expect(pickBrowserLocale(["fr-FR", "ko-KR", "en-US"])).toBe("ko");
    expect(pickBrowserLocale(["fr-FR"])).toBe("en");
    expect(pickBrowserLocale([])).toBe("en");
  });

  it("maps to BCP 47 tags for Intl", () => {
    expect(intlLocaleFor("zh-TW")).toBe("zh-TW");
    expect(intlLocaleFor("es")).toBe("es-ES");
    expect(intlLocaleFor("xx")).toBe("vi-VN");
  });
});

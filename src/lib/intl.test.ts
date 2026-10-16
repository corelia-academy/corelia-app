import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({ default: { resolvedLanguage: "zh-TW", language: "zh-TW" } }));

import { authMetadataLocaleFromUiLanguage, intlLocale, sortLocale } from "./intl";

describe("intl helpers", () => {
  it.each([["zh-TW", "zh-TW"], ["zh-HK", "zh-TW"], ["ko-KR", "ko"], ["vi-VN", "vi"], ["fr", "en"], [undefined, "en"]])(
    "stores %s as %s for auth email templates",
    (input, expected) => expect(authMetadataLocaleFromUiLanguage(input)).toBe(expected),
  );

  it("follows the active UI language", () => {
    expect(intlLocale()).toBe("zh-TW");
    expect(sortLocale()).toBe("zh-TW");
  });
});

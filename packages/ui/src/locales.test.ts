import { describe, expect, it } from "vitest";

import { localeFromPath, localizePath, stripLocalePrefix } from "./locales";

describe("site locales", () => {
  it.each([
    ["/", "en", "/"],
    ["/courses/x", "en", "/courses/x"],
    ["/vi", "vi", "/"],
    ["/vi/blog", "vi", "/blog"],
    ["/zh-cn/courses", "zh-CN", "/courses"],
    ["/ZH-TW/jobs", "zh-TW", "/jobs"],
    ["/visit", "en", "/visit"],
  ] as const)("parses %s", (path, locale, rest) => {
    expect(localeFromPath(path)).toBe(locale);
    expect(stripLocalePrefix(path)).toBe(rest);
  });

  it("builds localized paths", () => {
    expect(localizePath("/", "en")).toBe("/");
    expect(localizePath("/", "ja")).toBe("/ja");
    expect(localizePath("courses", "zh-TW")).toBe("/zh-tw/courses");
  });
});

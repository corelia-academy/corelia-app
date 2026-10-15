import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs tooling without type declarations
import { checkLocale, localeNamespaces } from "../../scripts/i18n/check-keys.mjs";
import { CONTENT_LOCALES } from "./locales";

describe("locale bundles", () => {
  it.each(CONTENT_LOCALES.filter((locale) => locale !== "en"))("%s matches the English keys, placeholders, tags and plural forms", (locale) => {
    expect(checkLocale(locale, localeNamespaces())).toEqual([]);
  }, 60_000);
});

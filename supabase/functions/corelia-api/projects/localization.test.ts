import { describe, expect, it } from "vitest";
import { contentLocale, projectContent, projectLocales } from "./localization.ts";
describe("project localization contract", () => {
  it("preserves Markdown and partial updates while stripping metadata", () => {
    expect(projectContent({ description: "## Story\n\n`code`", updated_at: "old" }, true)).toEqual({ description: "## Story\n\n`code`" });
    expect(projectLocales({ en: { title: "English" }, vi: { summary: null } })).toEqual({ en: { title: "English" }, vi: { summary: "" } });
  });
  it.each([null, [], {fr:{}}, {en:[]}, {vi:{title:7}}, {en:{description:"x".repeat(20001)}}, {vi:{progress:"x".repeat(10001)}}, {en:{unknown:"data"}}])("rejects invalid locales %j", value => {
    expect(() => projectLocales(value)).toThrow(/^invalid_input:/);
  });
  it.each(["fr", "en-US", "", null])("only accepts explicit supported languages", locale => expect(() => contentLocale(locale)).toThrow());
});

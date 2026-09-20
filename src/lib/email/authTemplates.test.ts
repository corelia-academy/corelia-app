import { describe, expect, it } from "vitest";
// @ts-expect-error JavaScript generator intentionally has no declaration file.
import { authNames, buildAuthTemplate, renderAuthFixture } from "../../../scripts/email/auth.mjs";

describe("Supabase Auth email templates", () => {
  it("keeps all 13 templates bilingual with English fallback", () => {
    expect(authNames).toHaveLength(13);
    for (const name of authNames as string[]) {
      const template = buildAuthTemplate(name);
      const fixture = { token: "123456", appUrl: "https://app.corelia.academy", confirmationUrl: "https://auth.example/verify", redirectTo: "https://app.corelia.academy" };
      const vi = renderAuthFixture(template, { ...fixture, locale: "vi-VN" });
      const en = renderAuthFixture(template, { ...fixture, locale: "en-US" });
      const fallback = renderAuthFixture(template, { ...fixture, locale: "" });
      expect(vi).toContain('lang="vi"');
      expect(en).toContain('lang="en"');
      expect(fallback).toBe(en);
      expect(vi).not.toContain("{{");
      expect(en).not.toContain("{{");
      expect(vi).toContain("Corelia Academy");
    }
  });
});

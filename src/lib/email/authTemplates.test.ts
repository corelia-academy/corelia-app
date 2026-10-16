import { describe, expect, it } from "vitest";
// @ts-expect-error JavaScript generator intentionally has no declaration file.
import { authNames, buildAuthTemplate, renderAuthFixture } from "../../../scripts/email/auth.mjs";

describe("Supabase Auth email templates", () => {
  const requiredActions: Record<string, string[]> = {
    confirmation: [".Token", ".TokenHash", ".RedirectTo"], recovery: [".ConfirmationURL", ".SentAt"],
    reauthentication: [".Token"], invite: [".ConfirmationURL"], magic_link: [".ConfirmationURL"],
    email_change: [".ConfirmationURL", ".Email", ".NewEmail"], password_changed: [".Email"],
    email_changed: [".Email", ".OldEmail"], phone_changed: [".Email", ".OldPhone", ".Phone"],
    mfa_factor_enrolled: [".Email", ".FactorType"], mfa_factor_unenrolled: [".Email", ".FactorType"],
    identity_linked: [".Email", ".Provider"], identity_unlinked: [".Email", ".Provider"],
  };

  it("keeps all 13 templates localized with English fallback", () => {
    expect(authNames).toHaveLength(13);
    for (const name of authNames as string[]) {
      const template = buildAuthTemplate(name);
      for (const action of requiredActions[name] ?? []) expect(template).toContain(`{{ ${action} }}`);
      const fixture = { token: "123456", appUrl: "https://app.corelia.academy", confirmationUrl: "https://auth.example/verify", redirectTo: "https://app.corelia.academy" };
      const vi = renderAuthFixture(template, { ...fixture, locale: "vi-VN" });
      const mixedCaseVi = renderAuthFixture(template, { ...fixture, locale: "vI_vN" });
      const en = renderAuthFixture(template, { ...fixture, locale: "en-US" });
      const fallback = renderAuthFixture(template, { ...fixture, locale: "" });
      expect(vi).toContain('lang="vi"');
      expect(mixedCaseVi).toBe(vi);
      expect(en).toContain('lang="en"');
      expect(fallback).toBe(en);
      expect(vi).not.toContain("{{");
      expect(en).not.toContain("{{");
      expect(vi).toContain("Corelia Academy");
      const expected: Array<[string, string]> = [
        ["zh-CN", "zh-CN"], ["zh_cn", "zh-CN"], ["zh-Hans", "zh-CN"], ["zh", "zh-CN"],
        ["zh-TW", "zh-TW"], ["zh-HK", "zh-TW"], ["zh_Hant", "zh-TW"],
        ["ko", "ko"], ["ko-KR", "ko"], ["ja", "ja"], ["ja_JP", "ja"], ["es", "es"], ["es-MX", "es"],
      ];
      for (const [input, lang] of expected) {
        const html = renderAuthFixture(template, { ...fixture, locale: input });
        expect(html).toContain(`lang="${lang}"`);
        expect(html).not.toContain("{{");
        expect(html).not.toBe(en);
      }
      expect(renderAuthFixture(template, { ...fixture, locale: "fr" })).toBe(en);
      expect(vi).toContain("padding:16px 24px");
      expect(vi).toContain("margin:0;line-height:18px");
    }
  });
});

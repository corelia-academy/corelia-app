import { describe, expect, it } from "vitest";

import {
  isValidHackathonSocialLink,
  normalizeHackathonSocialLink,
} from "./socialLinks";

describe("hackathon social links", () => {
  it("turns a Telegram @username into a public URL", () => {
    expect(normalizeHackathonSocialLink("telegram", " @corelia_builders "))
      .toBe("https://t.me/corelia_builders");
  });

  it("keeps full social URLs unchanged apart from surrounding whitespace", () => {
    expect(normalizeHackathonSocialLink("telegram", " https://t.me/corelia_builders "))
      .toBe("https://t.me/corelia_builders");
    expect(normalizeHackathonSocialLink("x", " https://x.com/unihackfest "))
      .toBe("https://x.com/unihackfest");
  });

  it("accepts only HTTP(S) links on the expected platform", () => {
    expect(isValidHackathonSocialLink("telegram", "@corelia_builders")).toBe(true);
    expect(isValidHackathonSocialLink("telegram", "https://t.me/+invite-code")).toBe(true);
    expect(isValidHackathonSocialLink("x", "https://twitter.com/unihackfest")).toBe(true);
    expect(isValidHackathonSocialLink("facebook", "https://www.facebook.com/unihackfest")).toBe(true);

    expect(isValidHackathonSocialLink("telegram", "corelia_builders")).toBe(false);
    expect(isValidHackathonSocialLink("x", "@unihackfest")).toBe(false);
    expect(isValidHackathonSocialLink("x", "https://facebook.com/unihackfest")).toBe(false);
    expect(isValidHackathonSocialLink("facebook", "javascript:alert(1)")).toBe(false);
  });

  it("allows optional social fields to remain empty", () => {
    expect(isValidHackathonSocialLink("telegram", "  ")).toBe(true);
    expect(isValidHackathonSocialLink("x", "")).toBe(true);
    expect(isValidHackathonSocialLink("facebook", "")).toBe(true);
  });
});

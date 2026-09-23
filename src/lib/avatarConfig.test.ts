import { describe, expect, it } from "vitest";
import { humation1 } from "@humation/assets-humation-1";
import { parseAvatarConfig } from "../../shared/avatarConfig";

describe("avatar config validation", () => {
  it("normalizes valid parts and colors", () => {
    expect(parseAvatarConfig({ selections: { head: "fluffy-bob" }, colors: { hair: "123456" } }, humation1))
      .toEqual({ selections: { head: "fluffy-bob" }, colors: { hair: "#123456" } });
  });
  it("rejects unknown parts, slots, and unsafe colors", () => {
    expect(() => parseAvatarConfig({ selections: { head: "missing" }, colors: {} }, humation1)).toThrow();
    expect(() => parseAvatarConfig({ selections: { nope: "fluffy-bob" }, colors: {} }, humation1)).toThrow();
    expect(() => parseAvatarConfig({ selections: {}, colors: { hair: "url(javascript:evil)" } }, humation1)).toThrow();
  });
});

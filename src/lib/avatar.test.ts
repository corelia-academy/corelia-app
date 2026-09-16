import { describe, expect, it } from "vitest";

import {
  getGeneratedAvatarDataUrl,
  getGeneratedAvatarSeed,
} from "@/lib/avatar";

describe("generated avatars", () => {
  it("uses a saved seed before the user id", () => {
    expect(getGeneratedAvatarSeed("user-id", "saved-seed")).toBe("saved-seed");
    expect(getGeneratedAvatarSeed("user-id", null)).toBe("user-id");
  });

  it("generates a stable inline SVG without a network URL", () => {
    const first = getGeneratedAvatarDataUrl("user-id", null);
    const second = getGeneratedAvatarDataUrl("user-id", null);

    expect(first).toBe(second);
    expect(first).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(first!.split(",", 2)[1])).toContain("<svg");
  });

  it("changes the generated avatar when the saved seed changes", () => {
    expect(getGeneratedAvatarDataUrl("user-id", "seed-one")).not.toBe(
      getGeneratedAvatarDataUrl("user-id", "seed-two"),
    );
  });

  it("returns null when no stable identity is available", () => {
    expect(getGeneratedAvatarDataUrl(null, null)).toBeNull();
  });
});

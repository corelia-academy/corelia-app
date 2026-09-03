import { describe, expect, it } from "vitest";

import { canonicalizeSlug, normalizeSlugDraft } from "./slug";

describe("slug input normalization", () => {
  it("preserves a trailing separator while typing", () => {
    expect(normalizeSlugDraft("manual-")).toBe("manual-");
    expect(normalizeSlugDraft("manual-s")).toBe("manual-s");
    expect(normalizeSlugDraft("manual-slug-check")).toBe("manual-slug-check");
  });

  it("normalizes Vietnamese text and invalid separators", () => {
    expect(normalizeSlugDraft("Ứng dụng  Đổi mới---")).toBe("ung-dung-doi-moi-");
  });

  it("removes incomplete separators before persistence", () => {
    expect(canonicalizeSlug("manual-slug-")).toBe("manual-slug");
    expect(canonicalizeSlug("---")).toBe("");
  });
});

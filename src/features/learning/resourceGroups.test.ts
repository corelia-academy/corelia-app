import { describe, expect, it } from "vitest";
import { resourceIconForUrl } from "./resourceGroups";

describe("resourceIconForUrl", () => {
  it("falls back to link for malformed URLs", () => {
    expect(resourceIconForUrl("not a url")).toBe("link");
    expect(resourceIconForUrl("https://www.github.com/x")).toBe("github");
    expect(resourceIconForUrl("https://github.com/corelia/repo")).toBe("github");
    expect(resourceIconForUrl("https://example.com/guide")).toBe("link");
  });
});

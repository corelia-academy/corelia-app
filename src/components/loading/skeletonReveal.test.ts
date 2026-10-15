import { describe, expect, it, vi } from "vitest";

describe("skeletonRevealClass", () => {
  it("shows placeholders at once until the first in-app navigation, then delays them", async () => {
    vi.resetModules();
    const { markClientNavigation, skeletonRevealClass } = await import("./skeletonReveal");
    expect(skeletonRevealClass()).toBeUndefined();
    markClientNavigation();
    expect(skeletonRevealClass()).toBe("animate-skeleton-reveal");
    expect(skeletonRevealClass(true)).toBeUndefined();
  });
});

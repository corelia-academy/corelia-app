import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn typography tokens", () => {
  it("keeps typography token and semantic color together", () => {
    const result = cn(
      "text-body-medium font-body text-foreground",
    );

    expect(result).toContain("text-body-medium");
    expect(result).toContain("font-body");
    expect(result).toContain("text-foreground");
  });

  it("keeps heading token and semantic color together", () => {
    const result = cn(
      "text-heading-large font-display text-foreground",
    );

    expect(result).toContain("text-heading-large");
    expect(result).toContain("font-display");
    expect(result).toContain("text-foreground");
  });

  it("allows a later typography token to override an earlier one", () => {
    expect(
      cn("text-body-medium text-body-small"),
    ).toBe("text-body-small");
  });
});

describe("cn spacing tokens", () => {
  it("allows a dialog consumer to remove token padding and gap", () => {
    expect(cn("p-xl gap-xl", "p-0 gap-0")).toBe("p-0 gap-0");
  });

  it("preserves directional overrides and independent typography", () => {
    expect(cn("p-xl text-body-medium text-foreground", "px-md")).toBe(
      "p-xl text-body-medium text-foreground px-md",
    );
    expect(cn("px-md", "p-xl")).toBe("p-xl");
    expect(cn("sm:gap-xl", "sm:gap-md")).toBe("sm:gap-md");
  });
});

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

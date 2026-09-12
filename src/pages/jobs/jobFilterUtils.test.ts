import { describe, expect, it } from "vitest";
import { parseSalaryFilter } from "./jobFilterUtils";

describe("parseSalaryFilter", () => {
  it("preserves 0 as a valid salary number", () => {
    expect(parseSalaryFilter("0")).toBe(0);
    expect(parseSalaryFilter(0)).toBe(0);
  });

  it("parses valid positive numbers", () => {
    expect(parseSalaryFilter("1000")).toBe(1000);
    expect(parseSalaryFilter("50000000")).toBe(50000000);
    expect(parseSalaryFilter(2500)).toBe(2500);
  });

  it("returns undefined for empty, whitespace, or nullish inputs", () => {
    expect(parseSalaryFilter("")).toBeUndefined();
    expect(parseSalaryFilter("   ")).toBeUndefined();
    expect(parseSalaryFilter(null)).toBeUndefined();
    expect(parseSalaryFilter(undefined)).toBeUndefined();
  });

  it("returns undefined for invalid, non-numeric, or negative inputs", () => {
    expect(parseSalaryFilter("-100")).toBeUndefined();
    expect(parseSalaryFilter("abc")).toBeUndefined();
    expect(parseSalaryFilter("100abc")).toBeUndefined();
    expect(parseSalaryFilter(Number.NaN)).toBeUndefined();
    expect(parseSalaryFilter(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

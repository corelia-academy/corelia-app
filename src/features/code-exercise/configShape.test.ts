import { expect, it } from "vitest";
import { defaultCodeConfig, validateCodeConfig } from "./config";
import { isCodeConfigShape } from "./configShape";

it.each([
  {},
  { ...defaultCodeConfig(), file: null },
  { ...defaultCodeConfig(), blanks: {} },
  { ...defaultCodeConfig(), blanks: [null] },
  { ...defaultCodeConfig(), blanks: [{ id: "mutable", accepted_answers: "mut" }] },
  { ...defaultCodeConfig(), hints: false },
  { ...defaultCodeConfig("edit"), tests: {} },
  { ...defaultCodeConfig("edit"), tests: [null] },
  { ...defaultCodeConfig("edit"), tests: [{ id: "test", description: "Test", required: true, type: "source_equals", accepted_sources: {} }] },
  { ...defaultCodeConfig("edit"), tests: [{ id: "test", description: "Test", required: true, type: "contains", value: "fn", failure_message: {} }] },
  { ...defaultCodeConfig("two_stage"), parts: null },
  { ...defaultCodeConfig("two_stage"), parts: [] },
  { ...defaultCodeConfig("two_stage"), parts: [{ mode: "fill" }] },
])("reports malformed code config safely: %j", value => {
  expect(isCodeConfigShape(value)).toBe(false);
  expect(validateCodeConfig(value)).toContain("invalid_config");
  expect(validateCodeConfig(value, true)).toContain("invalid_config");
});

it("keeps incomplete source and rules editable, while normal validation still blocks saving", () => {
  const config = { ...defaultCodeConfig("edit"), reference_solution: "", tests: [] };
  expect(isCodeConfigShape(config)).toBe(true);
  expect(validateCodeConfig(config)).toContain("source_required");
});

it("keeps a failing reference solution editable and draft-saveable", () => {
  const config = { ...defaultCodeConfig("edit"), reference_solution: "not ready" };
  expect(isCodeConfigShape(config)).toBe(true);
  expect(validateCodeConfig(config)).toEqual([]);
  expect(validateCodeConfig(config, true)).toContain("solution_failed");
});

it("validates two_stage config and enforces publish rules", () => {
  const config = defaultCodeConfig("two_stage");
  expect(isCodeConfigShape(config)).toBe(true);
  expect(validateCodeConfig(config)).toEqual([]);
  expect(validateCodeConfig(config, true)).toEqual([]);

  if (config.mode === "two_stage") {
    // Failing solution in part 1
    const badP1 = {
      ...config,
      parts: [
        { ...config.parts[0], reference_solution: "let x = 5;" },
        config.parts[1],
      ] as typeof config.parts,
    };
    expect(validateCodeConfig(badP1, true)).toContain("solution_failed");

    // Failing solution in part 2
    const badP2 = {
      ...config,
      parts: [
        config.parts[0],
        { ...config.parts[1], reference_solution: "pub fn add(a: i32, b: i32) -> i32 { 0 }" },
      ] as typeof config.parts,
    };
    expect(validateCodeConfig(badP2, true)).toContain("solution_failed");

    // Starter auto-passing in part 2
    const starterPassing = {
      ...config,
      parts: [
        config.parts[0],
        { ...config.parts[1], file: { ...config.parts[1].file, starter_source: "pub fn add(a: i32, b: i32) -> i32 { a + b }" } },
      ] as typeof config.parts,
    };
    expect(validateCodeConfig(starterPassing, true)).toContain("starter_passes");
  }
});

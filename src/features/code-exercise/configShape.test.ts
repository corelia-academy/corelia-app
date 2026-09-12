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

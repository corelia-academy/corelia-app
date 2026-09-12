import type { CodeExerciseConfig } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");
const optionalText = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(key => value[key] === undefined || typeof value[key] === "string");

/** Protect authoring from malformed persisted JSON without rejecting unfinished copy/rules. */
export function isCodeConfigShape(value: unknown): value is CodeExerciseConfig {
  if (!record(value) || value.schema_version !== 1 || value.language !== "rust" ||
    !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 ||
    !record(value.file) || typeof value.file.path !== "string" || typeof value.file.starter_source !== "string" ||
    typeof value.reference_solution !== "string" || (value.hints !== undefined && !strings(value.hints))) return false;
  if (value.mode === "fill") {
    if (!Array.isArray(value.blanks) || !value.blanks.every(blank => record(blank) &&
      typeof blank.id === "string" && strings(blank.accepted_answers) && optionalText(blank, ["feedback"]) &&
      ["case_sensitive", "trim_whitespace"].every(key => blank[key] === undefined || typeof blank[key] === "boolean"))) return false;
  } else if (value.mode !== "edit" || value.blanks !== undefined || !Array.isArray(value.tests)) return false;
  return value.tests === undefined || (Array.isArray(value.tests) && value.tests.every(test => record(test) &&
    typeof test.id === "string" && typeof test.description === "string" && typeof test.required === "boolean" &&
    optionalText(test, ["failure_message", "hint"]) &&
    (test.type === "source_equals" ? strings(test.accepted_sources) :
      (test.type === "contains" || test.type === "not_contains") && typeof test.value === "string")));
}

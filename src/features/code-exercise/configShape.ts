import { isCodeLanguage } from "./languages";
import type { CodeExerciseConfig } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");
const optionalText = (value: Record<string, unknown>, keys: string[]) =>
  keys.every(key => value[key] === undefined || typeof value[key] === "string");

function isTestsShape(tests: unknown): boolean {
  return tests === undefined || (Array.isArray(tests) && tests.every(test => record(test) &&
    typeof test.id === "string" && typeof test.description === "string" && typeof test.required === "boolean" &&
    optionalText(test, ["failure_message", "hint"]) &&
    (test.type === "source_equals" ? strings(test.accepted_sources) :
      (test.type === "contains" || test.type === "not_contains") && typeof test.value === "string")));
}

function isBlanksShape(blanks: unknown): boolean {
  return Array.isArray(blanks) && blanks.every(blank => record(blank) &&
    typeof blank.id === "string" && strings(blank.accepted_answers) && optionalText(blank, ["feedback"]) &&
    ["case_sensitive", "trim_whitespace"].every(key => blank[key] === undefined || typeof blank[key] === "boolean"));
}

/** Protect authoring from malformed persisted JSON without rejecting unfinished copy/rules. */
export function isCodeConfigShape(value: unknown): value is CodeExerciseConfig {
  if (!record(value) || value.schema_version !== 1 || !isCodeLanguage(value.language) ||
    !Number.isSafeInteger(value.revision) || Number(value.revision) < 1) return false;

  if (value.mode === "two_stage") {
    if (!Array.isArray(value.parts) || value.parts.length !== 2) return false;
    const [p1, p2] = value.parts;
    if (!record(p1) || p1.mode !== "fill" || !record(p1.file) || typeof p1.file.path !== "string" || typeof p1.file.starter_source !== "string" || typeof p1.reference_solution !== "string" || (p1.hints !== undefined && !strings(p1.hints)) || (p1.instructions !== undefined && typeof p1.instructions !== "string") || !isBlanksShape(p1.blanks) || (p1 as { tests?: unknown }).tests !== undefined) return false;
    if (!record(p2) || p2.mode !== "edit" || !record(p2.file) || typeof p2.file.path !== "string" || typeof p2.file.starter_source !== "string" || typeof p2.reference_solution !== "string" || (p2.hints !== undefined && !strings(p2.hints)) || (p2.instructions !== undefined && typeof p2.instructions !== "string") || p2.blanks !== undefined || !isTestsShape(p2.tests) || !Array.isArray(p2.tests)) return false;
    return true;
  }

  if (!record(value.file) || typeof value.file.path !== "string" || typeof value.file.starter_source !== "string" ||
    typeof value.reference_solution !== "string" || (value.hints !== undefined && !strings(value.hints))) return false;
  if (value.mode === "fill") {
    if (!isBlanksShape(value.blanks)) return false;
  } else if (value.mode !== "edit" || value.blanks !== undefined || !Array.isArray(value.tests)) return false;
  return isTestsShape(value.tests);
}

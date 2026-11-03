import type { CodeExerciseBlank, CodeExerciseConfig, CodeExerciseResult } from "./types";
import { reconstructSource } from "./markers";

export const MAX_SOURCE_BYTES = 64 * 1024;
export const sourceBytes = (source: string) => new TextEncoder().encode(source).length;
export function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, "\n").split("\n").map(line => line.replace(/[\t ]+$/g, "")).join("\n").replace(/^\n+|\n+$/g, "");
}
export function matchBlank(blank: CodeExerciseBlank, answer: string): boolean {
  if (/[\r\n]/.test(answer)) return false;
  const normalize = (s: string) => {
    const value = blank.trim_whitespace === false ? s : s.trim();
    return blank.case_sensitive === false ? value.toLowerCase() : value;
  };
  return blank.accepted_answers.some(value => normalize(value) === normalize(answer));
}
export function evaluateCodeExercise(config: CodeExerciseConfig, input: { answers?: Record<string, string>; source?: string }): CodeExerciseResult {
  const source = config.mode === "fill" ? reconstructSource(config.file.starter_source, input.answers ?? {}) : input.source ?? "";
  if (sourceBytes(source) > MAX_SOURCE_BYTES) throw new Error("source_too_large");
  const results: CodeExerciseResult["results"] = config.mode === "fill" ? config.blanks.map(blank => ({
    test_id: blank.id, required: true, description: blank.id,
    passed: matchBlank(blank, input.answers?.[blank.id] ?? ""), message: blank.feedback,
  })) : [];
  for (const test of config.tests ?? []) {
    const normalized = source.replace(/\r\n?/g, "\n");
    const passed = test.type === "source_equals"
      ? test.accepted_sources.some(value => normalizeSource(value) === normalizeSource(source))
      : test.type === "contains" ? normalized.includes(test.value.replace(/\r\n?/g, "\n"))
      : !normalized.includes(test.value.replace(/\r\n?/g, "\n"));
    results.push({ test_id: test.id, required: test.required, description: test.description, passed, message: passed ? undefined : test.failure_message, hint: passed ? undefined : test.hint });
  }
  return { passed: results.some(r => r.required) && results.every(r => !r.required || r.passed), results };
}

import { codeLanguages, isCodeLanguage, validCodeFile, type CodeLanguage } from "./languages";
import type { CodeExerciseConfig } from "./types";
import { evaluateCodeExercise, matchBlank, MAX_SOURCE_BYTES, sourceBytes } from "./evaluate";
import { parseMarkers } from "./markers";
import { isCodeConfigShape } from "./configShape";

export function validateCodeConfig(value: unknown, publish = false): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["config_required"];
  if (!isCodeConfigShape(value)) return ["invalid_config"];
  const c = value as CodeExerciseConfig;
  if (c.schema_version !== 1 || !isCodeLanguage(c.language) || !["fill", "edit"].includes(c.mode)) errors.push("unsupported_config");
  if (!Number.isInteger(c.revision) || c.revision < 1) errors.push("invalid_revision");
  if (!c.file || typeof c.file.path !== "string" || !validCodeFile(c.file.path, c.language)) errors.push("invalid_file");
  for (const source of [c.file?.starter_source, c.reference_solution]) {
    if (typeof source !== "string" || !source.trim()) errors.push("source_required");
    else if (sourceBytes(source) > MAX_SOURCE_BYTES) errors.push("source_too_large");
  }
  if (c.hints && (!Array.isArray(c.hints) || c.hints.some(h => typeof h !== "string"))) errors.push("invalid_hints");
  if (errors.length) return errors;
  const testIds = new Set<string>();
  if (c.tests !== undefined && !Array.isArray(c.tests)) return ["invalid_tests"];
  for (const t of c.tests ?? []) {
    if (!t || typeof t.id !== "string" || !t.id || testIds.has(t.id) || typeof t.description !== "string" || typeof t.required !== "boolean") { errors.push("invalid_test"); continue; }
    testIds.add(t.id);
    if (t.type === "source_equals") {
      if (!Array.isArray(t.accepted_sources) || !t.accepted_sources.length || t.accepted_sources.some(s => typeof s !== "string" || !s.trim() || sourceBytes(s) > MAX_SOURCE_BYTES)) errors.push("invalid_test_source");
    } else if (!["contains", "not_contains"].includes(t.type) || typeof t.value !== "string" || !t.value) errors.push("invalid_test_rule");
  }
  if (c.mode === "edit" && (!(c.tests ?? []).some(t => t?.required) || c.blanks !== undefined)) errors.push("required_test_missing");
  if (c.mode === "fill") {
    try {
      const ids = parseMarkers(c.file.starter_source).flatMap(s => s.type === "blank" ? [s.id] : []);
      if (!Array.isArray(c.blanks) || ids.length < 1 || ids.length > 5 || c.blanks.length !== ids.length) errors.push("invalid_blanks");
      else for (const b of c.blanks) {
        if (!b || !ids.includes(b.id) || c.blanks.filter(x => x.id === b.id).length !== 1 || !Array.isArray(b.accepted_answers) || !b.accepted_answers.length || b.accepted_answers.some(a => typeof a !== "string" || !a.trim() || /[\r\n]/.test(a))) errors.push("invalid_blank");
      }
    } catch { errors.push("invalid_markers"); }
  }
  if (publish && !errors.length) {
    if (c.reference_solution.includes("{{blank:")) errors.push("unresolved_solution");
    else if (c.mode === "edit") {
      if (!evaluateCodeExercise(c, { source: c.reference_solution }).passed) errors.push("solution_failed");
    } else {
      // Capture blanks using the literal surrounding source; no arbitrary regex rules.
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const segments = parseMarkers(c.file.starter_source);
      const pattern = segments.map(s => s.type === "source" ? escape(s.value) : "([^\\r\\n]*?)").join("");
      const match = new RegExp(`^${pattern}$`).exec(c.reference_solution);
      const ids = segments.flatMap(s => s.type === "blank" ? [s.id] : []);
      const answers = Object.fromEntries(ids.map((id, i) => [id, match?.[i + 1] ?? ""]));
      if (!match || c.blanks.some(b => !matchBlank(b, answers[b.id])) || !evaluateCodeExercise(c, { answers }).passed) errors.push("solution_failed");
    }
  }
  return [...new Set(errors)];
}
export function defaultCodeConfig(mode: "fill" | "edit" = "fill", language: CodeLanguage = "rust"): CodeExerciseConfig {
  const template = codeLanguages[language];
  const base = { schema_version: 1 as const, revision: 1, language, file: { path: template.path, starter_source: mode === "fill" ? template.fill : template.edit }, reference_solution: mode === "fill" ? template.fill.replace("{{blank:mutable}}", template.answer) : template.solution };
  return mode === "fill" ? { ...base, mode, blanks: [{ id: "mutable", accepted_answers: [template.answer] }] } : { ...base, mode, tests: [{ id: "sum", type: "contains", value: "a + b", required: true, description: "a + b" }] };
}
export function withCodeRevision(previous: CodeExerciseConfig | undefined, next: CodeExerciseConfig): CodeExerciseConfig {
  const machine = (c: CodeExerciseConfig) => JSON.stringify({ language: c.language, mode: c.mode, file: c.file, reference_solution: c.reference_solution, blanks: c.blanks?.map(({ id, accepted_answers, case_sensitive, trim_whitespace }) => ({ id, accepted_answers, case_sensitive, trim_whitespace })), tests: c.tests?.map(t => t.type === "source_equals" ? { id: t.id, type: t.type, required: t.required, accepted_sources: t.accepted_sources } : { id: t.id, type: t.type, required: t.required, value: t.value }) });
  return { ...next, revision: previous ? previous.revision + Number(machine(previous) !== machine(next)) : 1 };
}

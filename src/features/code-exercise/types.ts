export interface CodeExerciseBlank {
  id: string;
  accepted_answers: string[];
  case_sensitive?: boolean;
  trim_whitespace?: boolean;
  feedback?: string;
}
export type CodeExerciseTest = {
  id: string;
  description: string;
  required: boolean;
  failure_message?: string;
  hint?: string;
} & ({ type: "source_equals"; accepted_sources: string[] } | { type: "contains" | "not_contains"; value: string });
interface BaseConfig {
  schema_version: 1;
  revision: number;
  language: "rust";
  file: { path: string; starter_source: string };
  reference_solution: string;
  hints?: string[];
}
export type CodeExerciseConfig = BaseConfig & (
  | { mode: "fill"; blanks: CodeExerciseBlank[]; tests?: CodeExerciseTest[] }
  | { mode: "edit"; blanks?: never; tests: CodeExerciseTest[] }
);
export interface CodeExerciseLocaleContent {
  instructions?: string;
  hints?: string[];
  blank_feedback?: Record<string, string>;
  test_copy?: Record<string, { description?: string; failure_message?: string; hint?: string }>;
}
export type CodeExerciseDraft = { mode: "fill"; answers: Record<string, string>; updated_at: string }
  | { mode: "edit"; source: string; updated_at: string };
export interface CodeExerciseResult {
  passed: boolean;
  results: Array<{ test_id: string; passed: boolean; required: boolean; description: string; message?: string; hint?: string }>;
}

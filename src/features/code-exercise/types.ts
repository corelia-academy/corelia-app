import type { CodeLanguage } from "./languages";

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

export interface CodeExercisePartFill {
  mode: "fill";
  file: { path: string; starter_source: string };
  reference_solution: string;
  blanks: CodeExerciseBlank[];
  hints?: string[];
  instructions?: string;
}

export interface CodeExercisePartEdit {
  mode: "edit";
  file: { path: string; starter_source: string };
  reference_solution: string;
  tests: CodeExerciseTest[];
  hints?: string[];
  instructions?: string;
}

export interface CodeExerciseFillConfig {
  schema_version: 1;
  revision: number;
  language: CodeLanguage;
  mode: "fill";
  file: { path: string; starter_source: string };
  reference_solution: string;
  hints?: string[];
  blanks: CodeExerciseBlank[];
  tests?: CodeExerciseTest[];
}

export interface CodeExerciseEditConfig {
  schema_version: 1;
  revision: number;
  language: CodeLanguage;
  mode: "edit";
  file: { path: string; starter_source: string };
  reference_solution: string;
  hints?: string[];
  blanks?: never;
  tests: CodeExerciseTest[];
}

export type CodeExerciseSingleConfig = CodeExerciseFillConfig | CodeExerciseEditConfig;

export interface CodeExerciseTwoStageConfig {
  schema_version: 1;
  revision: number;
  language: CodeLanguage;
  mode: "two_stage";
  parts: [CodeExercisePartFill, CodeExercisePartEdit];
}

export type CodeExerciseConfig = CodeExerciseFillConfig | CodeExerciseEditConfig | CodeExerciseTwoStageConfig;

export interface CodeExercisePartLocale {
  instructions?: string;
  hints?: string[];
  blank_feedback?: Record<string, string>;
  test_copy?: Record<string, { description?: string; failure_message?: string; hint?: string }>;
}

export interface CodeExerciseLocaleContent {
  instructions?: string;
  hints?: string[];
  blank_feedback?: Record<string, string>;
  test_copy?: Record<string, { description?: string; failure_message?: string; hint?: string }>;
  parts?: [CodeExercisePartLocale, CodeExercisePartLocale];
}

export type CodeExerciseDraft =
  | { mode: "fill"; answers: Record<string, string>; updated_at: string }
  | { mode: "edit"; source: string; updated_at: string }
  | {
      mode: "two_stage";
      stage1_answers: Record<string, string>;
      stage2_source: string;
      active_stage: 1 | 2;
      stage1_passed?: boolean;
      updated_at: string;
    };

export interface CodeExerciseResult {
  passed: boolean;
  results: Array<{ test_id: string; passed: boolean; required: boolean; description: string; message?: string; hint?: string }>;
}

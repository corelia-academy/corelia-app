// Lesson rules of the Corelia app, copied here because an Edge Function cannot import src/.
// Each block names its original; lesson_ports.drift.test.ts runs both on the same fixtures so a
// change in the app that this copy misses fails a test.
// Where the database publish gate (private.learning_lesson_errors) is stricter than the app's
// TypeScript, the stricter rule is used and marked "publish gate".

import type { CourseLesson, QuestionData } from "./lesson_types.ts";

// ---- src/types/courses.ts: getYoutubeVideoId ------------------------------------------------

function isYoutubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export function getYoutubeVideoId(url: string): string | null {
  const raw = url.trim();
  if (!raw || /[\s\\]/.test(raw)) return null;

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const candidate = host === "youtu.be"
    ? pathSegments[0]
    : host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com"
    ? parsed.pathname === "/watch"
      ? parsed.searchParams.get("v")
      : ["embed", "shorts", "live", "v"].includes(pathSegments[0] ?? "") ? pathSegments[1] : null
    : null;

  return isYoutubeVideoId(candidate) ? candidate : null;
}

// ---- src/features/code-exercise/languages.ts ------------------------------------------------

// Publish gate: private.learning_code_errors accepts only "rust" and a *.rs file, although the
// app's CODE_LANGUAGES lists more.
export const PUBLISHABLE_CODE_LANGUAGE = "rust";
const CODE_LANGUAGES = ["rust", "typescript", "javascript", "python", "java", "c", "cpp", "go"] as const;
const LANGUAGE_EXTENSIONS: Record<string, readonly string[]> = {
  rust: ["rs"],
  typescript: ["ts"],
  javascript: ["js"],
  python: ["py"],
  java: ["java"],
  c: ["c"],
  cpp: ["cpp", "cc", "cxx"],
  go: ["go"],
};

function isCodeLanguage(value: unknown): boolean {
  return typeof value === "string" && CODE_LANGUAGES.some((language) => language === value);
}

function validCodeFile(path: string, language: string): boolean {
  return /^[\w.-]+\.[a-z]+$/.test(path) && (LANGUAGE_EXTENSIONS[language] ?? []).includes(path.split(".").at(-1) ?? "");
}

// ---- src/features/code-exercise/types.ts ----------------------------------------------------

export interface CodeExerciseBlank {
  id: string;
  accepted_answers: string[];
  case_sensitive?: boolean;
  trim_whitespace?: boolean;
  feedback?: string;
}
export type CodeExerciseTest =
  & { id: string; description: string; required: boolean; failure_message?: string; hint?: string }
  & ({ type: "source_equals"; accepted_sources: string[] } | { type: "contains" | "not_contains"; value: string });
interface BaseConfig {
  schema_version: 1;
  revision: number;
  language: string;
  file: { path: string; starter_source: string };
  reference_solution: string;
  hints?: string[];
}
export type CodeExerciseConfig = BaseConfig & (
  | { mode: "fill"; blanks: CodeExerciseBlank[]; tests?: CodeExerciseTest[] }
  | { mode: "edit"; blanks?: never; tests: CodeExerciseTest[] }
);
export interface CodeExerciseResult {
  passed: boolean;
  results: { test_id: string; passed: boolean; required: boolean }[];
}

// ---- src/features/code-exercise/markers.ts --------------------------------------------------

type FillSegment = { type: "source"; value: string } | { type: "blank"; id: string };
function parseMarkers(source: string): FillSegment[] {
  const segments: FillSegment[] = [];
  const ids = new Set<string>();
  let end = 0;
  for (const match of source.matchAll(/\{\{blank:([a-z][a-z0-9_]{0,31})\}\}/g)) {
    const value = source.slice(end, match.index);
    if (value.includes("{{") || value.includes("}}")) throw new Error("malformed_marker");
    if (ids.has(match[1])) throw new Error("duplicate_marker");
    ids.add(match[1]);
    segments.push({ type: "source", value }, { type: "blank", id: match[1] });
    end = match.index! + match[0].length;
  }
  const tail = source.slice(end);
  if (tail.includes("{{") || tail.includes("}}")) throw new Error("malformed_marker");
  segments.push({ type: "source", value: tail });
  return segments;
}
function reconstructSource(source: string, answers: Record<string, string>): string {
  return parseMarkers(source).map((s) => s.type === "source" ? s.value : answers[s.id] ?? "").join("");
}

// ---- src/features/code-exercise/evaluate.ts -------------------------------------------------

const MAX_SOURCE_BYTES = 64 * 1024;
const sourceBytes = (source: string) => new TextEncoder().encode(source).length;
function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[\t ]+$/g, "")).join("\n").replace(/^\n+|\n+$/g, "");
}
function matchBlank(blank: CodeExerciseBlank, answer: string): boolean {
  if (/[\r\n]/.test(answer)) return false;
  const normalize = (s: string) => {
    const value = blank.trim_whitespace === false ? s : s.trim();
    return blank.case_sensitive === false ? value.toLowerCase() : value;
  };
  return blank.accepted_answers.some((value) => normalize(value) === normalize(answer));
}
export function evaluateCodeExercise(config: CodeExerciseConfig, input: { answers?: Record<string, string>; source?: string }): CodeExerciseResult {
  const source = config.mode === "fill" ? reconstructSource(config.file.starter_source, input.answers ?? {}) : input.source ?? "";
  if (sourceBytes(source) > MAX_SOURCE_BYTES) throw new Error("source_too_large");
  const results: CodeExerciseResult["results"] = config.mode === "fill"
    ? config.blanks.map((blank) => ({ test_id: blank.id, required: true, passed: matchBlank(blank, input.answers?.[blank.id] ?? "") }))
    : [];
  for (const test of config.tests ?? []) {
    const normalized = source.replace(/\r\n?/g, "\n");
    const passed = test.type === "source_equals"
      ? test.accepted_sources.some((value) => normalizeSource(value) === normalizeSource(source))
      : test.type === "contains"
      ? normalized.includes(test.value.replace(/\r\n?/g, "\n"))
      : !normalized.includes(test.value.replace(/\r\n?/g, "\n"));
    results.push({ test_id: test.id, required: test.required, passed });
  }
  return { passed: results.some((r) => r.required) && results.every((r) => !r.required || r.passed), results };
}

// ---- src/features/code-exercise/configShape.ts ----------------------------------------------

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const optionalText = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => value[key] === undefined || typeof value[key] === "string");

function isCodeConfigShape(value: unknown): value is CodeExerciseConfig {
  if (
    !record(value) || value.schema_version !== 1 || !isCodeLanguage(value.language) ||
    !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 ||
    !record(value.file) || typeof value.file.path !== "string" || typeof value.file.starter_source !== "string" ||
    typeof value.reference_solution !== "string" || (value.hints !== undefined && !strings(value.hints))
  ) return false;
  if (value.mode === "fill") {
    if (
      !Array.isArray(value.blanks) || !value.blanks.every((blank) =>
        record(blank) && typeof blank.id === "string" && strings(blank.accepted_answers) && optionalText(blank, ["feedback"]) &&
        ["case_sensitive", "trim_whitespace"].every((key) => blank[key] === undefined || typeof blank[key] === "boolean")
      )
    ) return false;
  } else if (value.mode !== "edit" || value.blanks !== undefined || !Array.isArray(value.tests)) return false;
  return value.tests === undefined || (Array.isArray(value.tests) && value.tests.every((test) =>
    record(test) && typeof test.id === "string" && typeof test.description === "string" && typeof test.required === "boolean" &&
    optionalText(test, ["failure_message", "hint"]) &&
    (test.type === "source_equals"
      ? strings(test.accepted_sources)
      : (test.type === "contains" || test.type === "not_contains") && typeof test.value === "string")
  ));
}

// ---- src/features/code-exercise/config.ts: validateCodeConfig -------------------------------

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
  if (c.hints && (!Array.isArray(c.hints) || c.hints.some((h) => typeof h !== "string"))) errors.push("invalid_hints");
  if (errors.length) return errors;
  const testIds = new Set<string>();
  if (c.tests !== undefined && !Array.isArray(c.tests)) return ["invalid_tests"];
  for (const t of c.tests ?? []) {
    if (!t || typeof t.id !== "string" || !t.id || testIds.has(t.id) || typeof t.description !== "string" || typeof t.required !== "boolean") {
      errors.push("invalid_test");
      continue;
    }
    testIds.add(t.id);
    if (t.type === "source_equals") {
      if (
        !Array.isArray(t.accepted_sources) || !t.accepted_sources.length ||
        t.accepted_sources.some((s) => typeof s !== "string" || !s.trim() || sourceBytes(s) > MAX_SOURCE_BYTES)
      ) errors.push("invalid_test_source");
    } else if (!["contains", "not_contains"].includes(t.type) || typeof t.value !== "string" || !t.value) errors.push("invalid_test_rule");
  }
  if (c.mode === "edit" && (!(c.tests ?? []).some((t) => t?.required) || c.blanks !== undefined)) errors.push("required_test_missing");
  if (c.mode === "fill") {
    try {
      const ids = parseMarkers(c.file.starter_source).flatMap((s) => s.type === "blank" ? [s.id] : []);
      if (!Array.isArray(c.blanks) || ids.length < 1 || ids.length > 5 || c.blanks.length !== ids.length) errors.push("invalid_blanks");
      else {
        for (const b of c.blanks) {
          if (
            !b || !ids.includes(b.id) || c.blanks.filter((x) => x.id === b.id).length !== 1 || !Array.isArray(b.accepted_answers) ||
            !b.accepted_answers.length || b.accepted_answers.some((a) => typeof a !== "string" || !a.trim() || /[\r\n]/.test(a))
          ) errors.push("invalid_blank");
        }
      }
    } catch {
      errors.push("invalid_markers");
    }
  }
  if (publish && !errors.length) {
    if (c.reference_solution.includes("{{blank:")) errors.push("unresolved_solution");
    else if (c.mode === "edit") {
      if (!evaluateCodeExercise(c, { source: c.reference_solution }).passed) errors.push("solution_failed");
    } else {
      // Capture blanks using the literal surrounding source; no arbitrary regex rules.
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const segments = parseMarkers(c.file.starter_source);
      const pattern = segments.map((s) => s.type === "source" ? escape(s.value) : "([^\\r\\n]*?)").join("");
      const match = new RegExp(`^${pattern}$`).exec(c.reference_solution);
      const ids = segments.flatMap((s) => s.type === "blank" ? [s.id] : []);
      const answers = Object.fromEntries(ids.map((id, i) => [id, match?.[i + 1] ?? ""]));
      if (!match || c.blanks.some((b) => !matchBlank(b, answers[b.id])) || !evaluateCodeExercise(c, { answers }).passed) errors.push("solution_failed");
    }
  }
  return [...new Set(errors)];
}

// ---- src/features/learning/practiceConfig.ts, types.ts ---------------------------------------

const ARTIFACT_FIELDS = ["github_url", "deployment_url", "contract_address", "transaction_url", "demo_url", "notes"];
const artifactFields = (value: unknown) => Array.isArray(value) && value.every((field) => typeof field === "string" && ARTIFACT_FIELDS.includes(field));

export function isPracticeConfig(value: unknown): boolean {
  if (!record(value) || typeof value.mode !== "string" || !["instruction", "checklist", "submission", "guided_project"].includes(value.mode)) return false;
  if (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || Number(value.revision) < 1)) return false;
  if (value.requires_review !== undefined && typeof value.requires_review !== "boolean") return false;
  for (const key of ["related_hackathon_id", "related_project_id", "related_project_template_id"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") return false;
  }
  if (value.submission_fields !== undefined && !artifactFields(value.submission_fields)) return false;
  if (
    value.checklist_items !== undefined && (!Array.isArray(value.checklist_items) ||
      !value.checklist_items.every((item) => record(item) && typeof item.id === "string" && typeof item.label === "string"))
  ) return false;
  if (
    value.project_steps !== undefined && (!Array.isArray(value.project_steps) || !value.project_steps.every((step) =>
      record(step) && typeof step.id === "string" && typeof step.title === "string" &&
      typeof step.order === "number" && Number.isFinite(step.order) &&
      typeof step.verification === "string" && ["self_check", "artifact_required"].includes(step.verification) &&
      (step.instructions_markdown === undefined || typeof step.instructions_markdown === "string") &&
      (step.artifact_fields === undefined || artifactFields(step.artifact_fields))
    ))
  ) return false;
  return true;
}

// ---- src/features/learning/quizShape.ts -------------------------------------------------------

function isQuizConfigShape(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return (config.passing_ratio === undefined || (typeof config.passing_ratio === "number" && Number.isFinite(config.passing_ratio))) &&
    (config.allow_retry === undefined || typeof config.allow_retry === "boolean");
}

/**
 * Publish gate private.learning_question_valid(data, true): question text, at least two options
 * with non-empty text and unique ids, and correct_index inside the options.
 */
export function validateQuestion(q: QuestionData): string[] {
  const codes: string[] = [];
  if (q.type !== "mcq" || typeof q.question !== "string" || !q.question.trim()) codes.push("question_required");
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length < 2) codes.push("options_required");
  if (options.some((o) => !o || typeof o.id !== "string" || !o.id || typeof o.text !== "string" || !o.text.trim())) codes.push("invalid_options");
  if (new Set(options.map((o) => o?.id)).size !== options.length) codes.push("duplicate_option_id");
  if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= options.length) codes.push("invalid_correct_index");
  return codes;
}

// ---- src/features/learning/validation.ts: validateLesson, per format ---------------------------

/** Same (field, code) pairs as the app's validateLesson for the fields of one lesson. */
export function validateLesson(lesson: CourseLesson): { field: string; code: string }[] {
  const codes: Array<[string, string]> = [];
  if (typeof lesson.title !== "string" || !lesson.title.trim()) codes.push(["title", "title_required"]);
  if (lesson.lesson_format != null && !["article", "video", "quiz", "practice", "code_exercise"].includes(lesson.lesson_format)) {
    codes.push(["lesson_format", "invalid_format"]);
  }
  const format = lesson.lesson_format;
  if (format === "video") {
    const youtubeUrl = typeof lesson.youtube_url === "string" ? lesson.youtube_url.trim() : "";
    // Publish gate: a draft lesson must carry the URL (the app tolerates an empty one).
    if (!youtubeUrl || !getYoutubeVideoId(youtubeUrl)) codes.push(["youtube_url", "youtube_required"]);
    const start = lesson.youtube_start_seconds ?? 0;
    const end = lesson.youtube_end_seconds;
    if (
      typeof start !== "number" || !Number.isFinite(start) || start < 0 ||
      (end != null && (typeof end !== "number" || !Number.isFinite(end) || end <= start))
    ) codes.push(["youtube_end_seconds", "invalid_segment"]);
  } else if (format === "code_exercise") {
    for (const code of validateCodeConfig(lesson.code_exercise_config, true)) codes.push(["code_exercise_config", code]);
  } else if (format === "quiz") {
    if (!isQuizConfigShape(lesson.quiz_config)) codes.push(["quiz_config", "invalid_config"]);
    else {
      const ratio = lesson.quiz_config?.passing_ratio ?? 0.7;
      if (!(ratio >= 0.01 && ratio <= 1)) codes.push(["quiz_config", "invalid_threshold"]);
    }
  } else if (typeof lesson.description_markdown !== "string" || !lesson.description_markdown.trim()) codes.push(["description_markdown", "content_required"]);
  if (format === "practice") {
    const c = lesson.practice_config;
    if (c != null && !isPracticeConfig(c)) {
      codes.push(["practice_config", "invalid_config"]);
      return codes.map(([field, code]) => ({ field, code }));
    }
    if (c?.requires_review) codes.push(["practice_config", "course_review_only"]);
    if (
      c?.mode === "checklist" &&
      (!c.checklist_items?.length || c.checklist_items.some((i) => !i.id || !i.label.trim()) ||
        new Set(c.checklist_items.map((i) => i.id)).size !== c.checklist_items.length)
    ) codes.push(["practice_config", "invalid_checklist"]);
  }
  return codes.map(([field, code]) => ({ field, code }));
}

// ---- src/features/learning/resourceValidation.ts ----------------------------------------------

export function validateResources(resources: { title: string; url: string }[]): string[] {
  const codes: string[] = [];
  resources.forEach((resource) => {
    if (!resource.title.trim()) codes.push("resource_title_required");
    let validUrl = false;
    try {
      const url = new URL(resource.url);
      validUrl = /^https?:\/\/\S+$/.test(resource.url) && ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
    } catch { /* reported below */ }
    if (!validUrl) codes.push("resource_url_invalid");
  });
  return codes;
}

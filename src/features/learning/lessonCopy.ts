import type { CourseLessonLocaleContent } from "@/types/courses";

type Copy = Partial<Pick<CourseLessonLocaleContent, "title" | "short_description" | "description_markdown" | "youtube_url" | "youtube_start_seconds" | "youtube_end_seconds" | "practice_copy" | "question_copy">>;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export const lessonText = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;

/** Display/recovery projection only. Callers retain the original JSON until explicit Save. */
export function normalizeLessonCopy(input: unknown): { value: Copy; invalid: boolean } {
  const value: Copy = {};
  let invalid = !record(input);
  if (!record(input)) return { value, invalid };
  for (const field of ["title", "short_description", "description_markdown", "youtube_url"] as const) {
    if (input[field] === undefined) continue;
    value[field] = lessonText(input[field]);
    invalid ||= typeof input[field] !== "string";
  }
  for (const field of ["youtube_start_seconds", "youtube_end_seconds"] as const) {
    const item = input[field];
    if (item === undefined) continue;
    if (field === "youtube_end_seconds" && item === null) value[field] = null;
    else if (typeof item === "number" && Number.isFinite(item)) value[field] = item;
    else { invalid = true; if (field === "youtube_end_seconds") value[field] = null; else value[field] = 0; }
  }
  for (const field of ["practice_copy", "question_copy"] as const) {
    if (input[field] === undefined) continue;
    const map = input[field];
    const copy: Record<string, Record<string, string | Record<string, string>>> = {};
    if (!record(map)) invalid = true;
    else for (const [id, item] of Object.entries(map)) {
      if (!record(item)) { invalid = true; continue; }
      const output: Record<string, string | Record<string, string>> = {};
      for (const name of field === "practice_copy" ? ["title", "label", "instructions_markdown"] : ["question", "explanation"]) {
        if (item[name] === undefined) continue;
        if (typeof item[name] === "string") output[name] = item[name];
        else invalid = true;
      }
      if (field === "question_copy" && item.options !== undefined) {
        if (!record(item.options)) invalid = true;
        else {
          const options: Record<string, string> = {};
          for (const [optionId, text] of Object.entries(item.options)) {
            if (typeof text === "string") options[optionId] = text;
            else invalid = true;
          }
          output.options = options;
        }
      }
      copy[id] = output;
    }
    // The branch-specific fields above keep machine IDs and omit malformed display values.
    value[field] = copy as NonNullable<Copy[typeof field]>;
  }
  return { value, invalid };
}

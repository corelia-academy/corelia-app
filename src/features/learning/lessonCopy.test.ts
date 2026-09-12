import { describe, expect, it } from "vitest";
import { normalizeLessonCopy } from "./lessonCopy";
import { validateLesson } from "./validation";
import type { CourseLesson } from "@/types/courses";

describe("legacy lesson display boundary", () => {
  it.each([42, true, {}, [], null])("reports malformed text %j without changing the raw object", bad => {
    const raw = { title: bad, description_markdown: bad, youtube_url: bad, question_copy: { q: { question: bad, options: { a: "Keep", b: bad } } } };
    const original = JSON.stringify(raw);
    const result = normalizeLessonCopy(raw);
    expect(result.invalid).toBe(true);
    expect(result.value).toMatchObject({ title: "", description_markdown: "", youtube_url: "", question_copy: { q: { options: { a: "Keep" } } } });
    expect(JSON.stringify(raw)).toBe(original);
    expect(() => validateLesson({ ...raw, id: "lesson", lesson_format: "article" } as unknown as CourseLesson)).not.toThrow();
    expect(validateLesson({ ...raw, id: "lesson", lesson_format: "article" } as unknown as CourseLesson)).toContainEqual(expect.objectContaining({ field: "locale_copy", code: "invalid_locale_copy" }));
  });
  it("retains empty localized copy, stable IDs and valid segment metadata", () => {
    const raw = { title: "", youtube_start_seconds: 2, youtube_end_seconds: null, practice_copy: { step: { title: "EN", instructions_markdown: "Read" } }, question_copy: { q: { question: "Q", options: { option: "A" } } } };
    expect(normalizeLessonCopy(raw)).toEqual({ value: raw, invalid: false });
  });
  it("rejects duplicate guided step IDs and the same threshold range as SQL", () => {
    const base = { id: "lesson", title: "Title", description_markdown: "Read" };
    const step = { id: "same", title: "Step", order: 1, verification: "self_check" };
    expect(validateLesson({ ...base, lesson_format: "practice", practice_config: { mode: "guided_project", project_steps: [step, step] } } as CourseLesson)).toContainEqual(expect.objectContaining({ code: "invalid_steps" }));
    expect(validateLesson({ ...base, lesson_format: "quiz", quiz_config: { passing_ratio: 0.005, allow_retry: true } } as CourseLesson)).toContainEqual(expect.objectContaining({ code: "invalid_threshold" }));
  });
});

it("never throws while inspecting JSON-shaped legacy lesson fields", () => {
  const fields = ["title", "description_markdown", "short_description", "youtube_url", "youtube_start_seconds", "youtube_end_seconds", "quiz_config", "practice_config", "code_exercise_config", "code_exercise_locale"];
  for (const lesson_format of ["article", "video", "quiz", "practice", "code_exercise"] as const) {
    for (const field of fields) for (const value of [null, false, 42, [], {}, { toString: 42 }, "legacy"]) {
      const raw = { id: "legacy", title: "Title", description_markdown: "Read", lesson_format, [field]: value } as unknown as CourseLesson;
      expect(() => validateLesson(raw), `${lesson_format}/${field}/${JSON.stringify(value)}`).not.toThrow();
    }
  }
});

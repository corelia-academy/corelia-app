// Runs the app's own validation and its copy in lesson_ports.ts on the same fixtures. A change in
// the app's rules that the copy misses shows up as a difference here.
import { describe, expect, it } from "vitest";

import { validateCodeConfig as appValidateCodeConfig } from "@/features/code-exercise/config";
import { validateLesson as appValidateLesson } from "@/features/learning/validation";
import { validateLessonResources } from "@/features/learning/resourceValidation";
import { getYoutubeVideoId as appYoutubeId } from "@/types/courses";

import { getYoutubeVideoId, validateCodeConfig, validateLesson, validateResources } from "./lesson_ports.ts";

const fill = {
  schema_version: 1,
  revision: 1,
  language: "rust",
  mode: "fill",
  file: { path: "lib.rs", starter_source: "let {{blank:kw}} x = 5;" },
  reference_solution: "let mut x = 5;",
  blanks: [{ id: "kw", accepted_answers: ["mut"] }],
};
const edit = {
  schema_version: 1,
  revision: 1,
  language: "rust",
  mode: "edit",
  file: { path: "lib.rs", starter_source: "pub fn add(a: i32, b: i32) -> i32 { 0 }" },
  reference_solution: "pub fn add(a: i32, b: i32) -> i32 { a + b }",
  tests: [{ id: "sum", type: "contains", value: "a + b", required: true, description: "d" }],
};
const configs: [string, unknown][] = [
  ["valid fill", fill],
  ["valid edit", edit],
  ["null", null],
  ["not an object shape", { ...fill, schema_version: 2 }],
  ["bad language", { ...fill, language: "cobol" }],
  ["wrong extension", { ...fill, file: { path: "lib.py", starter_source: fill.file.starter_source } }],
  ["empty starter", { ...edit, file: { path: "lib.rs", starter_source: " " } }],
  ["fill without markers", { ...fill, file: { path: "lib.rs", starter_source: "let x = 5;" } }],
  ["fill extra blank", { ...fill, blanks: [...fill.blanks, { id: "zz", accepted_answers: ["a"] }] }],
  ["fill multiline answer", { ...fill, blanks: [{ id: "kw", accepted_answers: ["a\nb"] }] }],
  ["fill solution mismatch", { ...fill, reference_solution: "let x = 5;" }],
  ["fill unresolved", { ...fill, reference_solution: "let {{blank:kw}} x = 5;" }],
  ["edit no required test", { ...edit, tests: [{ ...edit.tests[0], required: false }] }],
  ["edit solution fails", { ...edit, reference_solution: "pub fn add(a: i32, b: i32) -> i32 { 0 }" }],
  ["edit empty rule", { ...edit, tests: [{ ...edit.tests[0], value: "" }] }],
  ["edit duplicate test", { ...edit, tests: [edit.tests[0], edit.tests[0]] }],
  ["edit source_equals", { ...edit, tests: [{ id: "eq", type: "source_equals", accepted_sources: [edit.reference_solution], required: true, description: "d" }] }],
  ["edit with blanks", { ...edit, blanks: [] }],
  ["bad revision", { ...edit, revision: 0 }],
];

const lessonBase = { id: "l", section_id: "s", title: "T", duration_seconds: 60, order: 0 };
const lessons: [string, Record<string, unknown>][] = [
  ["article", { ...lessonBase, lesson_format: "article", description_markdown: "x" }],
  ["article empty", { ...lessonBase, lesson_format: "article", description_markdown: " " }],
  ["no title", { ...lessonBase, title: " ", lesson_format: "article", description_markdown: "x" }],
  ["bad format", { ...lessonBase, lesson_format: "podcast", description_markdown: "x" }],
  ["video", { ...lessonBase, lesson_format: "video", youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: 5, youtube_end_seconds: 50 }],
  ["video bad url", { ...lessonBase, lesson_format: "video", youtube_url: "https://example.com/v" }],
  ["video end before start", { ...lessonBase, lesson_format: "video", youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: 50, youtube_end_seconds: 10 }],
  ["video negative start", { ...lessonBase, lesson_format: "video", youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: -1 }],
  ["quiz", { ...lessonBase, lesson_format: "quiz", quiz_config: { passing_ratio: 0.7, allow_retry: true } }],
  ["quiz low", { ...lessonBase, lesson_format: "quiz", quiz_config: { passing_ratio: 0.01, allow_retry: true } }],
  ["quiz zero", { ...lessonBase, lesson_format: "quiz", quiz_config: { passing_ratio: 0, allow_retry: true } }],
  ["quiz over", { ...lessonBase, lesson_format: "quiz", quiz_config: { passing_ratio: 1.5, allow_retry: true } }],
  ["quiz bad shape", { ...lessonBase, lesson_format: "quiz", quiz_config: { passing_ratio: "x" } }],
  ["code", { ...lessonBase, lesson_format: "code_exercise", code_exercise_config: edit }],
  ["code bad", { ...lessonBase, lesson_format: "code_exercise", code_exercise_config: { ...edit, reference_solution: "x" } }],
  ["practice instruction", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "instruction", requires_review: false } }],
  ["practice review", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "instruction", requires_review: true } }],
  ["practice checklist", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "checklist", checklist_items: [{ id: "a", label: "A" }] } }],
  ["practice checklist empty", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "checklist", checklist_items: [] } }],
  ["practice checklist duplicate", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "checklist", checklist_items: [{ id: "a", label: "A" }, { id: "a", label: "B" }] } }],
  ["practice checklist blank label", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "checklist", checklist_items: [{ id: "a", label: " " }] } }],
  ["practice bad shape", { ...lessonBase, lesson_format: "practice", description_markdown: "x", practice_config: { mode: "oops" } }],
];

const pairs = (issues: { field: string; code: string }[]) => issues.map((i) => `${i.field}:${i.code}`).sort();

describe("lesson_ports drift", () => {
  it.each(configs)("validateCodeConfig: %s", (_name, config) => {
    expect(validateCodeConfig(config, true).sort()).toEqual(appValidateCodeConfig(config, true).sort());
    expect(validateCodeConfig(config, false).sort()).toEqual(appValidateCodeConfig(config, false).sort());
  });

  it.each(lessons)("validateLesson: %s", (_name, lesson) => {
    expect(pairs(validateLesson(lesson as never))).toEqual(pairs(appValidateLesson(lesson as never)));
  });

  it("validateLesson: an empty video URL is the one deliberate difference (a draft must carry the video)", () => {
    const empty = { ...lessonBase, lesson_format: "video" as const, youtube_url: "" };
    expect(appValidateLesson(empty as never)).toEqual([]);
    expect(pairs(validateLesson(empty as never))).toEqual(["youtube_url:youtube_required"]);
  });

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ",
    "not a url",
    "",
  ])("getYoutubeVideoId: %s", (url) => {
    expect(getYoutubeVideoId(url)).toEqual(appYoutubeId(url));
  });

  it("validateResources matches the app for published resources", () => {
    const cases = [
      [{ title: "ok", url: "https://a.dev/x" }],
      [{ title: " ", url: "https://a.dev/x" }],
      [{ title: "x", url: "ftp://a.dev" }],
      [{ title: "x", url: "https://u:p@a.dev" }],
      [{ title: "x", url: "https://a.dev/ x" }],
      [{ title: "x", url: "" }],
    ];
    for (const resources of cases) {
      const app = validateLessonResources(resources, "l", "vi" as never, true).map((i) => i.code).sort();
      expect(validateResources(resources).sort()).toEqual(app);
    }
  });
});

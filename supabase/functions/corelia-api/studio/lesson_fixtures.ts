// Shared fixtures of the lesson tests: a two-module curriculum with one lesson per format, its research, and valid outputs.
import type { RunContext } from "./steps.ts";

export const now = Date.parse("2026-10-20T12:00:00Z");

export function lesson(id: string, type: string, extra: object = {}) {
  return {
    id,
    title: id,
    description: "d",
    type,
    purpose: "explanation",
    prerequisite_lesson_ids: [],
    outcome_ids: ["o1"],
    prerequisites: [],
    completion_rule: "c",
    pass_threshold: null,
    review_lesson_ids: [],
    source_ids: ["s1"],
    ...extra,
  };
}

export const curriculum = {
  outcomes: [{ id: "o1", text: "Làm được X" }, { id: "o2", text: "Làm được Y" }],
  modules: [
    { id: "m1", title: "Module 1", description: "md", lessons: [lesson("l-art", "article"), lesson("l-quiz", "quiz", { pass_threshold: 70, review_lesson_ids: ["l-art"] })] },
    { id: "m2", title: "Module 2", description: "md", lessons: [lesson("l-code", "code_exercise", { source_ids: ["s1", "s2"] }), lesson("l-prac", "practice"), lesson("l-vid", "video", { source_ids: ["s2"] })] },
  ],
};

export const research = {
  sources: [
    { source_id: "s1", title: "Book", url: "https://doc.rust-lang.org/book/", access: "read" },
    { source_id: "s2", title: "Ref", url: "https://doc.rust-lang.org/reference/", access: "read" },
    { source_id: "s3", title: "Gone", url: "https://example.com/gone", access: "unreachable" },
  ],
  topics: [
    { topic: "t1", why: "w", source_ids: ["s1"], key_points: [{ point: "p1", source_ids: ["s1"] }, { point: "p2", source_ids: ["s2"] }] },
    { topic: "t2", why: "w", source_ids: ["s2"], key_points: [{ point: "p3", source_ids: ["s2"] }] },
  ],
  videos: [
    {
      topic: "t1",
      url: "https://youtu.be/aaaaaaaaaaa",
      title: "Worked example for t1",
      channel: "Rust Education",
      channel_basis: "A read channel page establishes the educational focus.",
      evidence_source_ids: ["s1"],
    },
    {
      topic: "t2",
      url: "https://youtu.be/bbbbbbbbbbb",
      title: "Worked example for t2",
      channel: "Rust Education",
      channel_basis: "A read channel page establishes the educational focus.",
      evidence_source_ids: ["s2"],
    },
  ],
  misconceptions: [
    { topic: "t1", misconception: "m1", correction: "c1", source_ids: ["s1"] },
    { topic: "t2", misconception: "m2", correction: "c2", source_ids: ["s2"] },
  ],
};

export const ctx: RunContext = {
  course: { title: "Rust", level: "beginner" },
  paths: [],
  scopes: [],
  outputs: { brief: { locale: "vi" }, research, curriculum },
  today: "2026-10-20",
  revision: null,
};

export const base = {
  title: "Tiêu đề",
  short_description: "Mô tả ngắn.",
  duration_seconds: 300,
  resources: [],
  suggested_videos: [],
  source_ids: ["s1"],
  summary: "Lesson làm X.",
  article: null,
  quiz: null,
  code: null,
  practice: null,
  video: null,
};

export const diagram = {
  id: "d1",
  alt: "Cargo build",
  title: "",
  nodes: [
    { id: "a", label: "main.rs", col: 0, row: 0, shape: "box" },
    { id: "b", label: "Cargo", col: 1, row: 0, shape: "box" },
  ],
  edges: [{ from: "a", to: "b", style: "solid", route: "straight", label: "", crossed: false }],
};
export const article = { description_markdown: "## Biên dịch\n\nXem ![sơ đồ](diagram:d1) bên dưới.", diagrams: [diagram] };
export const question = (over: object = {}) => ({
  question: "Điều gì xảy ra?",
  options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
  correct_index: 1,
  explanation: "B đúng vì ...; A sai vì ...; C sai vì ...",
  ...over,
});
export const test = (over: object = {}) => ({
  id: "sum",
  type: "contains",
  description: "có a + b",
  required: true,
  value: "a + b",
  accepted_sources: [],
  failure_message: "",
  hint: "",
  ...over,
});
export const editCode = {
  instructions: "Hoàn thành hàm add.",
  language: "rust",
  file_path: "lib.rs",
  starter_source: "pub fn add(a: i32, b: i32) -> i32 { 0 }",
  reference_solution: "pub fn add(a: i32, b: i32) -> i32 { a + b }",
  hints: [],
  mode: "edit",
  blanks: [],
  tests: [test()],
};
export const fillCode = {
  ...editCode,
  starter_source: "let {{blank:kw}} x = 5;",
  reference_solution: "let mut x = 5;",
  mode: "fill",
  blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: "" }],
  tests: [],
};


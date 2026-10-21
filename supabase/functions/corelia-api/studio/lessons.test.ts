import { describe, expect, it } from "vitest";

import { acceptLesson, buildLessonInput, LESSON_SCHEMA, lessonIds, lessonRefs, quizPassingRatio, toLessonDraft, TransientError } from "./lessons.ts";
import { article, base, ctx, curriculum, diagram, editCode, fillCode, question, test } from "./lesson_fixtures.ts";

const ok = (youtube = true): typeof fetch => (() => Promise.resolve(new Response("{}", { status: youtube ? 200 : 404 }))) as typeof fetch;
const accept = (id: string, out: object, fetchFn = ok()) => acceptLesson({ ...base, ...out }, ctx, id, fetchFn);
const reason = async (id: string, out: object, fetchFn = ok()) => {
  const r = await accept(id, out, fetchFn);
  return r.ok ? "" : r.reason;
};

describe("studio lessons: accept by format", () => {
  it("accepts a valid lesson of each format", async () => {
    expect((await accept("l-art", { article })).ok).toBe(true);
    expect((await accept("l-quiz", { quiz: { questions: [question(), question()] } })).ok).toBe(true);
    expect((await accept("l-code", { code: editCode, source_ids: ["s1", "s2"] })).ok).toBe(true);
    expect((await accept("l-code", { code: fillCode })).ok).toBe(true);
    expect((await accept("l-prac", { practice: { description_markdown: "Làm theo.", mode: "instruction", checklist_items: [] } })).ok).toBe(true);
    expect((await accept("l-prac", { practice: { description_markdown: "Tự kiểm tra.", mode: "checklist", checklist_items: [{ id: "c1", label: "Đã chạy" }] } })).ok).toBe(true);
    expect((await accept("l-vid", { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 10, end_seconds: 0 } })).ok).toBe(true);
  });

  it("requires exactly the block of the lesson's format", async () => {
    expect(await reason("l-art", { article: null })).toContain("thiếu khối article");
    expect(await reason("l-art", { article, quiz: { questions: [question()] } })).toContain("khối quiz phải null");
  });

  it("checks sources, resources, duration and summary", async () => {
    expect(await reason("l-art", { article, source_ids: ["s9"] })).toContain("source_ids ngoài curriculum");
    expect(await reason("l-art", { article, source_ids: [] })).toContain("thiếu source_ids");
    expect(await reason("l-art", { article, resources: [{ title: "x", url: "https://elsewhere.dev/" }] })).toContain("không thuộc nguồn đã đọc");
    expect(await reason("l-art", { article, resources: [{ title: "x", url: "https://example.com/gone" }] })).toContain("không thuộc nguồn đã đọc");
    expect((await accept("l-art", { article, resources: [{ title: "Book", url: "https://doc.rust-lang.org/book/" }] })).ok).toBe(true);
    expect(await reason("l-art", { article, duration_seconds: 0 })).toContain("duration_seconds");
    expect(await reason("l-art", { article, summary: " " })).toContain("summary");
  });

  it("article: markdown and diagrams must match, and the layout must be drawable", async () => {
    expect(await reason("l-art", { article: { ...article, description_markdown: "" } })).toContain("content_required");
    expect(await reason("l-art", { article: { ...article, description_markdown: "Không có ảnh." } })).toContain("không được tham chiếu");
    expect(await reason("l-art", { article: { ...article, diagrams: [] } })).toContain("không có trong diagrams");
    expect(await reason("l-art", { article: { ...article, diagrams: [{ ...diagram, alt: " " }] } })).toContain("thiếu alt");
    // a→c passes through b on the same row
    const crossing = {
      ...diagram,
      nodes: [...diagram.nodes, { id: "c", label: "binary", col: 2, row: 0, shape: "box" }],
      edges: [{ from: "a", to: "c", style: "solid", route: "straight", label: "", crossed: false }],
    };
    expect(await reason("l-art", { article: { ...article, diagrams: [crossing] } })).toContain("đi xuyên node b");
    const dup = { ...diagram, nodes: [diagram.nodes[0], { ...diagram.nodes[1], col: 0 }] };
    expect(await reason("l-art", { article: { ...article, diagrams: [dup] } })).toContain("cùng ô");
  });

  it("quiz: keys, options and explanations follow the publish gate", async () => {
    const quiz = (q: object) => ({ quiz: { questions: [q] } });
    expect(await reason("l-quiz", { quiz: { questions: [] } })).toContain("không có câu hỏi");
    expect(await reason("l-quiz", quiz(question({ correct_index: 3 })))).toContain("invalid_correct_index");
    expect(await reason("l-quiz", quiz(question({ options: [{ id: "a", text: "A" }] })))).toContain("options_required");
    expect(await reason("l-quiz", quiz(question({ options: [{ id: "a", text: "A" }, { id: "a", text: "B" }] })))).toContain("duplicate_option_id");
    expect(await reason("l-quiz", quiz(question({ options: [{ id: "a", text: "A" }, { id: "b", text: " " }] })))).toContain("invalid_options");
    expect(await reason("l-quiz", quiz(question({ question: " " })))).toContain("question_required");
    expect(await reason("l-quiz", quiz(question({ explanation: "" })))).toContain("thiếu giải thích");
  });

  it("code: the reference passes, the starter does not, and the file is Rust", async () => {
    const code = (over: object) => ({ code: { ...editCode, ...over } });
    expect(await reason("l-code", { ...code({ starter_source: "pub fn add(a: i32, b: i32) -> i32 { a + b }" }), source_ids: ["s1"] })).toContain("starter_source đã vượt");
    expect(await reason("l-code", code({ reference_solution: "pub fn add(a: i32, b: i32) -> i32 { 0 }" }))).toContain("solution_failed");
    expect(await reason("l-code", code({ tests: [test({ required: false })] }))).toContain("required_test_missing");
    expect(await reason("l-code", code({ tests: [test({ value: "" })] }))).toContain("thiếu value");
    expect(await reason("l-code", code({ blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: "" }] }))).toContain("mode edit không có blanks");
    expect(await reason("l-code", code({ file_path: "main.py" }))).toContain(".rs");
    expect(await reason("l-code", code({ language: "python" }))).toContain("rust");
    expect(await reason("l-code", code({ instructions: " " }))).toContain("instructions");
    expect(await reason("l-code", { code: { ...fillCode, reference_solution: "let x = 5;" } })).toContain("solution_failed");
    expect(await reason("l-code", { code: { ...fillCode, blanks: [] } })).toContain("invalid_blanks");
    const sourceEquals = test({ id: "eq", type: "source_equals", value: "", accepted_sources: [editCode.reference_solution] });
    expect((await accept("l-code", { code: { ...editCode, tests: [sourceEquals] } })).ok).toBe(true);
  });

  it("practice: no submissions, valid checklist", async () => {
    const practice = (over: object) => ({ practice: { description_markdown: "Làm.", mode: "checklist", checklist_items: [{ id: "c1", label: "A" }], ...over } });
    expect(await reason("l-prac", practice({ description_markdown: "" }))).toContain("content_required");
    expect(await reason("l-prac", practice({ checklist_items: [] }))).toContain("invalid_checklist");
    expect(await reason("l-prac", practice({ checklist_items: [{ id: "c1", label: "A" }, { id: "c1", label: "B" }] }))).toContain("invalid_checklist");
    expect(await reason("l-prac", practice({ mode: "instruction" }))).toContain("không có checklist_items");
  });

  it("diagnostic practice: a checklist self-check whose resources are the review material", async () => {
    const diagnosticCtx = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        curriculum: {
          ...curriculum,
          modules: curriculum.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === "l-prac" ? { ...l, purpose: "diagnostic" } : l)) })),
        },
      },
    };
    const practice = { description_markdown: "Tự kiểm tra...", mode: "checklist", checklist_items: [{ id: "c1", label: "Đã dùng terminal" }] };
    const resources = [{ title: "Book", url: "https://doc.rust-lang.org/book/" }];
    const run = async (out: object) => {
      const r = await acceptLesson({ ...base, ...out }, diagnosticCtx, "l-prac", ok());
      return r.ok ? "" : r.reason;
    };
    expect(await run({ practice, resources })).toBe("");
    expect(await run({ practice, resources: [] })).toContain("cần resources");
    expect(await run({ practice: { ...practice, mode: "instruction", checklist_items: [] }, resources })).toContain("phải là practice checklist");
  });

  it("video: the URL must parse and the video must exist for oEmbed", async () => {
    const video = (url: string) => ({ source_ids: ["s2"], video: { youtube_url: url, start_seconds: 0, end_seconds: 0 } });
    expect(await reason("l-vid", video("https://example.com/watch"))).toContain("youtube_required");
    expect(await reason("l-vid", { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 30, end_seconds: 20 } })).toContain("invalid_segment");
    expect(await reason("l-vid", video("https://youtu.be/dQw4w9WgXcQ"), ok(false))).toContain("oEmbed");
    const seen: string[] = [];
    const spy = ((url: string) => {
      seen.push(url);
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    expect((await accept("l-vid", video("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5"), spy)).ok).toBe(true);
    expect(seen[0]).toContain("youtube.com/oembed");
    expect(seen[0]).toContain(encodeURIComponent("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  });

  it("video: a check that cannot be made throws instead of failing the lesson", async () => {
    const out = { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 0, end_seconds: 0 } };
    const server = (() => Promise.resolve(new Response("", { status: 503 }))) as typeof fetch;
    const offline = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    await expect(accept("l-vid", out, server)).rejects.toBeInstanceOf(TransientError);
    await expect(accept("l-vid", out, offline)).rejects.toBeInstanceOf(TransientError);
    // other defects are reported without calling YouTube
    let called = false;
    const spy = (() => {
      called = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch;
    await accept("l-vid", { ...out, duration_seconds: 0 }, spy);
    expect(called).toBe(false);
  });
});

describe("studio lessons: app record", () => {
  const ref = (id: string) => lessonRefs(curriculum).find((r) => r.lesson.id === id)!;

  it("maps the curriculum pass threshold to quiz_config.passing_ratio", () => {
    expect(quizPassingRatio(70)).toBe(0.7);
    expect(quizPassingRatio(100)).toBe(1);
    const draft = toLessonDraft(ref("l-quiz"), { ...base, quiz: { questions: [question()] } } as never, "vi");
    expect(draft.lesson).toMatchObject({ id: "l-quiz", section_id: "m1", order: 1, lesson_format: "quiz", quiz_config: { passing_ratio: 0.7, allow_retry: true } });
    expect(draft.questions).toEqual([{ type: "mcq", question: "Điều gì xảy ra?", options: question().options, correct_index: 1, explanation: question().explanation, locale: "vi" }]);
  });

  it("builds records the app validates: code config without blanks in edit mode, canonical video URL", () => {
    const edit = toLessonDraft(ref("l-code"), { ...base, code: editCode } as never, "vi").lesson;
    expect(edit.code_exercise_config).not.toHaveProperty("blanks");
    expect(edit.code_exercise_config).toMatchObject({ schema_version: 1, revision: 1, mode: "edit", file: { path: "lib.rs" } });
    expect(edit.code_exercise_locale).toEqual({ instructions: "Hoàn thành hàm add." });
    const fill = toLessonDraft(ref("l-code"), { ...base, code: fillCode } as never, "vi").lesson;
    expect(fill.code_exercise_config).toMatchObject({ mode: "fill", blanks: [{ id: "kw", accepted_answers: ["mut"] }] });
    expect(fill.code_exercise_config).not.toHaveProperty("tests");
    const video = toLessonDraft(ref("l-vid"), { ...base, video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 5, end_seconds: 0 } } as never, "vi").lesson;
    expect(video).toMatchObject({ youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", youtube_start_seconds: 5, youtube_end_seconds: null });
    const practice = toLessonDraft(ref("l-prac"), { ...base, practice: { description_markdown: "x", mode: "instruction", checklist_items: [] } } as never, "vi").lesson;
    expect(practice.practice_config).toEqual({ mode: "instruction", requires_review: false });
  });
});

describe("studio lessons: input", () => {
  it("gives the lesson, its neighbours and only the research that rests on its sources", () => {
    const input = buildLessonInput(ctx, "l-quiz") as Record<string, any>;
    expect(input.lesson.id).toBe("l-quiz");
    expect(input.module).toEqual({ id: "m1", title: "Module 1", description: "md" });
    expect(input.outcomes).toEqual([{ id: "o1", text: "Làm được X" }]);
    expect(input.previous_lesson).toMatchObject({ id: "l-art" });
    expect(input.next_lesson).toMatchObject({ id: "l-code" });
    expect(input.review_lessons).toEqual([{ id: "l-art", title: "l-art" }]);
    expect(input.research.sources.map((s: { source_id: string }) => s.source_id)).toEqual(["s1"]);
    expect(input.research.topics.map((t: { topic: string }) => t.topic)).toEqual(["t1"]);
    expect(input.research.topics[0].key_points).toHaveLength(1);
    expect(input.research.misconceptions.map((m: { topic: string }) => m.topic)).toEqual(["t1"]);
    expect(buildLessonInput(ctx, "l-art").previous_lesson).toBeNull();
    expect(buildLessonInput(ctx, "l-vid").next_lesson).toBeNull();
  });
});

describe("studio lessons: schema", () => {
  it("is strict-mode shaped: closed objects with every key required, within the property budget", () => {
    let properties = 0;
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node === null || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "object") {
        const props = Object.keys(n.properties as object);
        properties += props.length;
        expect(n.additionalProperties).toBe(false);
        expect([...(n.required as string[])].sort()).toEqual([...props].sort());
      }
      Object.values(n).forEach(walk);
    };
    walk(LESSON_SCHEMA);
    expect(properties).toBeLessThan(100);
  });
});

describe("studio lessons: curriculum", () => {
  it("lists the lessons of a curriculum in teaching order", () => {
    expect(lessonIds(curriculum)).toEqual(["l-art", "l-quiz", "l-code", "l-prac", "l-vid"]);
  });
});

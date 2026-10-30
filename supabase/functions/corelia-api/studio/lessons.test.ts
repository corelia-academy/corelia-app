import { describe, expect, it } from "vitest";

import { acceptLesson, buildLessonInput, LESSON_SCHEMA, lessonIds, lessonRefs, quizPassingRatio, toLessonDraft, TransientError } from "./lessons.ts";
import { ENABLED_CODE_LANGUAGES, getCodeLanguageAdapter, PREPARED_CODE_LANGUAGES } from "./lesson_ports.ts";
import { article, base, ctx, curriculum, diagram, editCode, fillCode, question, test } from "./lesson_fixtures.ts";

const ok = (youtube = true): typeof fetch => (() => Promise.resolve(new Response(
  youtube ? JSON.stringify({ author_name: "Rust Education" }) : "",
  { status: youtube ? 200 : 404 },
))) as typeof fetch;
const accept = (id: string, out: object, fetchFn = ok(), lessonCtx: typeof ctx = ctx) => acceptLesson({ ...base, ...out }, lessonCtx, id, fetchFn);
const reason = async (id: string, out: object, fetchFn = ok(), lessonCtx: typeof ctx = ctx) => {
  const r = await accept(id, out, fetchFn, lessonCtx);
  return r.ok ? "" : r.reason;
};
const withCodeLanguage = (language: unknown): typeof ctx => ({
  ...ctx,
  outputs: { ...ctx.outputs, brief: { locale: "vi", code_language: language } },
}) as typeof ctx;

describe("studio lessons: accept by format", () => {
  it("accepts a valid lesson of each format", async () => {
    expect((await accept("l-art", { article })).ok).toBe(true);
    expect((await accept("l-quiz", { quiz: { questions: [question(), question()] } })).ok).toBe(true);
    expect((await accept("l-code", { code: editCode, source_ids: ["s1", "s2"] })).ok).toBe(true);
    expect((await accept("l-code", { code: fillCode })).ok).toBe(true);
    expect((await accept("l-prac", { practice: { description_markdown: "Làm theo.", mode: "instruction", checklist_items: [] } })).ok).toBe(true);
    expect((await accept("l-prac", { practice: { description_markdown: "Tự kiểm tra.", mode: "checklist", checklist_items: [{ id: "c1", label: "Đã chạy" }] } })).ok).toBe(true);
    expect((await accept("l-vid", { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/bbbbbbbbbbb", start_seconds: 10, end_seconds: 0 } })).ok).toBe(true);
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

  it("code: the reference passes, the starter does not, and the file matches the course language", async () => {
    const code = (over: object) => ({ code: { ...editCode, ...over } });
    expect(await reason("l-code", { ...code({ starter_source: "pub fn add(a: i32, b: i32) -> i32 { a + b }" }), source_ids: ["s1"] })).toContain("starter_source đã vượt");
    expect(await reason("l-code", code({ reference_solution: "pub fn add(a: i32, b: i32) -> i32 { 0 }" }))).toContain("solution_failed");
    expect(await reason("l-code", code({ tests: [test({ required: false })] }))).toContain("required_test_missing");
    expect(await reason("l-code", code({ tests: [test({ value: "" })] }))).toContain("thiếu value");
    expect(await reason("l-code", code({ blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: "" }] }))).toContain("mode edit không có blanks");
    expect(await reason("l-code", code({ file_path: "main.py" }))).toContain("file_path");
    expect(await reason("l-code", code({ file_path: "src/lib.rs" }))).toContain("tên tệp trần");
    expect(await reason("l-code", code({ language: "python", file_path: "main.py" }))).toContain("language phải khớp code_language của khóa (rust)");
    expect(await reason("l-code", code({ language: "solidity", file_path: "lib.sol" }), ok(), withCodeLanguage("solidity"))).toContain("solidity chưa hỗ trợ publish");
    expect(await reason("l-code", code({}), ok(), withCodeLanguage(null))).toContain("brief.code_language = null");
    expect(await reason("l-code", code({ instructions: " " }))).toContain("instructions");
    expect(await reason("l-code", { code: { ...fillCode, reference_solution: "let x = 5;" } })).toContain("solution_failed");
    expect(await reason("l-code", { code: { ...fillCode, blanks: [] } })).toContain("invalid_blanks");
    const sourceEquals = test({ id: "eq", type: "source_equals", value: "", accepted_sources: [editCode.reference_solution] });
    expect((await accept("l-code", { code: { ...editCode, tests: [sourceEquals] } })).ok).toBe(true);
  });

  it.each(ENABLED_CODE_LANGUAGES)("accepts a valid code lesson in enabled language %s", async (language) => {
    const extension = getCodeLanguageAdapter(language)!.extensions[0];
    const result = await accept(
      "l-code",
      { code: { ...editCode, language, file_path: `Main.${extension}` } },
      ok(),
      withCodeLanguage(language),
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects prepared languages at the lesson gate with a publish-specific reason", async () => {
    for (const language of PREPARED_CODE_LANGUAGES) {
      const extension = getCodeLanguageAdapter(language)!.extensions[0];
      expect(await reason(
        "l-code",
        { code: { ...editCode, language, file_path: `Main.${extension}` } },
        ok(),
        withCodeLanguage(language),
      )).toContain(`${language} chưa hỗ trợ publish`);
    }
  });

  it("rejects identifier answers leaked into each hint surface", async () => {
    expect(await reason("l-code", { code: { ...fillCode, hints: ["Hãy thử từ mut ở đây."] } }))
      .toContain('code.hints[0] lộ đáp án định danh "mut"');
    expect(await reason("l-code", { code: { ...fillCode, blanks: [{ ...fillCode.blanks[0], feedback: "Đáp án là mut." }] } }))
      .toContain('code.blanks[0].feedback lộ đáp án định danh "mut"');
    expect(await reason("l-code", { code: { ...editCode, tests: [test({ value: "add", failure_message: "Hãy thêm add." })] } }))
      .toContain('code.tests[0].failure_message lộ đáp án định danh "add"');
    expect(await reason("l-code", { code: { ...editCode, tests: [test({ value: "add", hint: "Dùng add." })] } }))
      .toContain('code.tests[0].hint lộ đáp án định danh "add"');
  });

  it("uses whole-identifier, case-sensitive, conservative answer matching", async () => {
    const nonLeaking = await accept("l-code", { code: { ...fillCode, hints: ["Tư duy về tính mutable; đừng trả lời MUT."] } });
    expect(nonLeaking).toMatchObject({ ok: true });

    const shortAndNonIdentifierAnswers = {
      ...fillCode,
      blanks: [{ id: "kw", accepted_answers: ["if", "::", "a + b"], feedback: "Từ khóa if, toán tử :: và biểu thức a + b." }],
      hints: ["Xem lại if, :: và a + b."],
    };
    const conservativeReason = await reason("l-code", { code: shortAndNonIdentifierAnswers });
    expect(conservativeReason).not.toContain("lộ đáp án định danh");

    const sourceEquals = test({ id: "eq", type: "source_equals", value: "", accepted_sources: [editCode.reference_solution], failure_message: "Đáp án add chưa đúng." });
    const ignoredTestReason = await reason("l-code", { code: { ...editCode, tests: [sourceEquals] } });
    expect(ignoredTestReason).not.toContain("lộ đáp án định danh");
    const notContains = test({ type: "not_contains", value: "add", failure_message: "Đừng dùng add." });
    expect(await reason("l-code", { code: { ...editCode, tests: [notContains] } })).not.toContain("lộ đáp án định danh");
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

  it("requires optional_hands_on lessons to use instruction mode without checklist completion", async () => {
    const optionalContext = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        curriculum: {
          ...curriculum,
          modules: curriculum.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === "l-prac" ? { ...l, purpose: "optional_hands_on" } : l)) })),
        },
      },
    } as typeof ctx;
    const instruction = { practice: { description_markdown: "Tự thực hành (không bắt buộc).", mode: "instruction", checklist_items: [] } };
    expect((await accept("l-prac", instruction, ok(), optionalContext)).ok).toBe(true);
    expect(await reason("l-prac", {
      practice: { description_markdown: "Tự thực hành (không bắt buộc).", mode: "checklist", checklist_items: [{ id: "c1", label: "Đã cài công cụ" }] },
    }, ok(), optionalContext)).toContain("optional_hands_on phải là practice mode instruction");
  });

  it("video: use only a matching research candidate and verify its oEmbed channel", async () => {
    const video = (url: string) => ({ source_ids: ["s2"], video: { youtube_url: url, start_seconds: 0, end_seconds: 0 } });
    expect(await reason("l-vid", video("https://example.com/watch"))).toContain("youtube_required");
    expect(await reason("l-vid", { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/bbbbbbbbbbb", start_seconds: 30, end_seconds: 20 } })).toContain("invalid_segment");
    expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb"), ok(false))).toContain("oEmbed");
    const seen: string[] = [];
    const spy = ((url: string) => {
      seen.push(url);
      return Promise.resolve(new Response(JSON.stringify({ author_name: "  RUST   education " }), { status: 200 }));
    }) as unknown as typeof fetch;
    expect((await accept("l-vid", video("https://www.youtube.com/watch?v=bbbbbbbbbbb&t=5"), spy)).ok).toBe(true);
    expect(seen[0]).toContain("youtube.com/oembed");
    expect(seen[0]).toContain(encodeURIComponent("https://www.youtube.com/watch?v=bbbbbbbbbbb"));

    expect(await reason("l-vid", video("https://youtu.be/ccccccccccc"))).toContain("không có trong research.videos");
    expect(await reason("l-vid", video("https://youtu.be/aaaaaaaaaaa"))).toContain("không có trong research.videos");
    const wrongChannel = ((() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel" }), { status: 200 }))) as unknown) as typeof fetch;
    expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb"), wrongChannel)).toContain("author_name không khớp channel research");
    const missingAuthor = (() => Promise.resolve(new Response("{}", { status: 200 }))) as typeof fetch;
    expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb"), missingAuthor)).toContain("thiếu author_name");
  });

  it("article: every YouTube link must be a matching lesson candidate with the same channel", async () => {
    const withRecommendation = {
      ...article,
      description_markdown: `${article.description_markdown}\n\nĐề xuất xem: [bài giảng](https://youtu.be/aaaaaaaaaaa)`,
    };
    expect((await accept("l-art", { article: withRecommendation })).ok).toBe(true);
    expect(await reason("l-art", {
      article: { ...withRecommendation, description_markdown: `${article.description_markdown}\n\n[video](https://youtu.be/ccccccccccc)` },
    })).toContain("ngoài research.videos");
    const wrongChannel = (() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel" }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-art", { article: withRecommendation }, wrongChannel)).toContain("author_name không khớp channel research");
  });

  it.each(((): { field: string; lessonId: string; output: object; lessonCtx?: typeof ctx }[] => {
    const unresearched = "https://youtu.be/ccccccccccc";
    const practice = {
      practice: {
        description_markdown: "Tự kiểm tra kiến thức.",
        mode: "checklist",
        checklist_items: [{ id: "c1", label: "Đã hiểu" }],
      },
    };
    const codeWith = (over: object) => ({ code: { ...editCode, ...over } });
    const resourceContext = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        research: {
          ...(ctx.outputs.research as object),
          sources: (ctx.outputs.research as { sources: { source_id: string; url: string }[] }).sources
            .map((source) => source.source_id === "s1" ? { ...source, url: unresearched } : source),
        },
      },
    } as typeof ctx;
    return [
      { field: "lesson.title", lessonId: "l-prac", output: { ...practice, title: unresearched } },
      { field: "lesson.short_description", lessonId: "l-prac", output: { ...practice, short_description: unresearched } },
      {
        field: "lesson.description_markdown (article)",
        lessonId: "l-art",
        output: { article: { ...article, description_markdown: `${article.description_markdown}\n\n${unresearched}` } },
      },
      { field: "lesson.description_markdown (practice)", lessonId: "l-prac", output: { ...practice, practice: { ...practice.practice, description_markdown: unresearched } } },
      { field: "lesson.resources[0].title", lessonId: "l-prac", output: { ...practice, resources: [{ title: unresearched, url: "https://doc.rust-lang.org/book/" }] } },
      {
        field: "lesson.resources[0].url",
        lessonId: "l-prac",
        output: { ...practice, resources: [{ title: "Tài liệu", url: unresearched }] },
        lessonCtx: resourceContext,
      },
      { field: "questions[0].question", lessonId: "l-quiz", output: { quiz: { questions: [question({ question: unresearched })] } } },
      { field: "questions[0].options[0].text", lessonId: "l-quiz", output: { quiz: { questions: [question({ options: [{ id: "a", text: unresearched }, ...question().options.slice(1)] })] } } },
      { field: "questions[0].explanation", lessonId: "l-quiz", output: { quiz: { questions: [question({ explanation: unresearched })] } } },
      { field: "lesson.code_exercise_locale.instructions", lessonId: "l-code", output: codeWith({ instructions: `[Xem video](${unresearched})` }) },
      { field: "lesson.code_exercise_config.hints[0]", lessonId: "l-code", output: codeWith({ hints: [unresearched] }) },
      { field: "lesson.code_exercise_config.blanks[0].feedback", lessonId: "l-code", output: { code: { ...fillCode, blanks: [{ ...fillCode.blanks[0], feedback: unresearched }] } } },
      { field: "lesson.code_exercise_config.tests[0].description", lessonId: "l-code", output: codeWith({ tests: [{ ...editCode.tests[0], description: unresearched }] }) },
      { field: "lesson.code_exercise_config.tests[0].failure_message", lessonId: "l-code", output: codeWith({ tests: [{ ...editCode.tests[0], failure_message: unresearched }] }) },
      { field: "lesson.code_exercise_config.tests[0].hint", lessonId: "l-code", output: codeWith({ tests: [{ ...editCode.tests[0], hint: unresearched }] }) },
      { field: "lesson.practice_config.checklist_items[0].label", lessonId: "l-prac", output: { ...practice, practice: { ...practice.practice, checklist_items: [{ id: "c1", label: unresearched }] } } },
    ];
  })())("rejects an unresearched YouTube link in $field", async ({ field, lessonId, output, lessonCtx }) => {
    const why = await reason(lessonId, output, ok(), lessonCtx);
    if (field === "lesson.resources[0].url") expect(why).toContain("video xem thêm phải được chọn qua suggested_videos");
    else expect(why).toContain("ngoài research.videos");
    if (field !== "quiz fixture" && field !== "code fixture" && field !== "lesson.resources[0].url") {
      expect(why).toContain(field.replace(/ \(.+\)$/, ""));
    }
  });

  it("practice: accepts a researched link, rejects malformed IDs and channel mismatches, and checks repeated IDs once", async () => {
    const practice = (description_markdown: string) => ({
      practice: { description_markdown, mode: "instruction", checklist_items: [] },
    });
    const validUrl = "https://youtu.be/aaaaaaaaaaa";
    const valid = practice(`Bài viết minh họa. [Đề xuất xem](${validUrl})`);
    expect((await accept("l-prac", valid)).ok).toBe(true);
    expect(await reason("l-prac", practice("[Video](https://youtu.be:not-a-port/not-a-video-id)")))
      .toContain("lesson.description_markdown: link YouTube không hợp lệ");
    expect(await reason("l-prac", practice("[Video](//youtu.be/not-a-video-id)")))
      .toContain("lesson.description_markdown: link YouTube không hợp lệ");

    const wrongChannel = (() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel" }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-prac", practice(`[Đề xuất xem](${validUrl})`), wrongChannel))
      .toContain("lesson.description_markdown: author_name không khớp channel research");

    let calls = 0;
    const spy = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify({ author_name: "Rust Education" }), { status: 200 }));
    }) as typeof fetch;
    expect((await accept("l-prac", { ...practice(`[Đề xuất xem](${validUrl})`), title: validUrl }, spy)).ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("practice: oEmbed network and server errors remain transient", async () => {
    const output = { practice: { description_markdown: "https://youtu.be/aaaaaaaaaaa", mode: "instruction", checklist_items: [] } };
    const server = (() => Promise.resolve(new Response("", { status: 503 }))) as typeof fetch;
    const offline = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    await expect(accept("l-prac", output, server)).rejects.toBeInstanceOf(TransientError);
    await expect(accept("l-prac", output, offline)).rejects.toBeInstanceOf(TransientError);
  });

  it.each([
    ["l-art", { article }],
    ["l-quiz", { quiz: { questions: [question()] } }],
    ["l-code", { code: editCode, source_ids: ["s1", "s2"] }],
    ["l-prac", { practice: { description_markdown: "Đọc ví dụ.", mode: "instruction", checklist_items: [] } }],
  ])("builds a code-owned optional video resource for %s and allows an empty selection", async (lessonId, block) => {
    const selected = { ...base, ...block, suggested_videos: ["aaaaaaaaaaa"] };
    expect((await accept(lessonId, selected)).ok).toBe(true);
    const ref = lessonRefs(curriculum).find((item) => item.lesson.id === lessonId)!;
    const withSuggestion = toLessonDraft(ref, selected as never, "vi", ctx.outputs.research as never);
    expect(withSuggestion.lesson.resources).toContainEqual({
      title: "Video: Worked example for t1 — Rust Education",
      url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    });

    const empty = { ...selected, suggested_videos: [] };
    expect((await accept(lessonId, empty)).ok).toBe(true);
    expect(toLessonDraft(ref, empty as never, "vi", ctx.outputs.research as never).lesson.resources).toBeUndefined();
  });

  it("rejects suggested video IDs that are unknown, duplicated, or over the limit", async () => {
    expect(await reason("l-art", { article, suggested_videos: ["ccccccccccc"] })).toContain("không thuộc ứng viên của lesson");
    expect(await reason("l-art", { article, suggested_videos: ["aaaaaaaaaaa", "aaaaaaaaaaa"] })).toContain("bị trùng video ID");
    expect(await reason("l-code", { code: editCode, suggested_videos: ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"], source_ids: ["s1", "s2"] })).toContain("tối đa 2 video");
    expect(await reason("l-art", { article, resources: [{ title: "Video xem thêm", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }] }))
      .toContain("video xem thêm phải được chọn qua suggested_videos");
  });

  it("oEmbeds each suggested ID once, rejects missing embeds or channel mismatch, and keeps transient errors", async () => {
    const articleWithLink = {
      ...article,
      description_markdown: `${article.description_markdown}\n\n[Xem thêm](https://youtu.be/aaaaaaaaaaa)`,
    };
    let calls = 0;
    const spy = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify({ author_name: "Rust Education" }), { status: 200 }));
    }) as typeof fetch;
    expect((await accept("l-art", { article: articleWithLink, suggested_videos: ["aaaaaaaaaaa"] }, spy)).ok).toBe(true);
    expect(calls).toBe(1);

    const wrongChannel = (() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel" }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, wrongChannel))
      .toContain("author_name không khớp channel research");
    const missing = (() => Promise.resolve(new Response("", { status: 404 }))) as typeof fetch;
    expect(await reason("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, missing)).toContain("không nhúng được");
    const server = (() => Promise.resolve(new Response("", { status: 503 }))) as typeof fetch;
    const offline = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    await expect(accept("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, server)).rejects.toBeInstanceOf(TransientError);
    await expect(accept("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, offline)).rejects.toBeInstanceOf(TransientError);
  });

  it("video: a check that cannot be made throws instead of failing the lesson", async () => {
    const out = { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/bbbbbbbbbbb", start_seconds: 0, end_seconds: 0 } };
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
    expect((LESSON_SCHEMA as any).required).toContain("suggested_videos");
    const codeSchema = (LESSON_SCHEMA.properties.code as any).anyOf[0];
    expect(codeSchema.properties.language.enum).toEqual(ENABLED_CODE_LANGUAGES);
    expect(codeSchema.properties.file_path.type).toBe("string");
    for (const language of PREPARED_CODE_LANGUAGES) {
      expect(codeSchema.properties.language.enum).not.toContain(language);
    }
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

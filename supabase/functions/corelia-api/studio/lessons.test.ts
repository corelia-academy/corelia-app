import { describe, expect, it } from "vitest";

import {
  acceptLesson,
  ARTICLE_MAX_PROSE_CHARS,
  articleProseLength,
  buildLessonInput,
  buildLessonReviewInput,
  checksAlreadyRun,
  hasUnseenBlocking,
  LESSON_SCHEMA,
  lessonIdLeaks,
  lessonIds,
  lessonRefs,
  quizPassingRatio,
  STALE_KNOWLEDGE_MESSAGE,
  toLessonDraft,
  TransientError,
} from "./lessons.ts";
import { ENABLED_CODE_LANGUAGES, getCodeLanguageAdapter, PREPARED_CODE_LANGUAGES } from "./lesson_ports.ts";
import { PLATFORM_FORMAT_GUIDE } from "./formats.ts";
import { article, base, ctx, curriculum, diagram, editCode, fillCode, fiveQuestions, lesson, question, test, withKnowledge } from "./lesson_fixtures.ts";

const ok = (youtube = true, over?: object): typeof fetch => (() => Promise.resolve(new Response(
  youtube ? JSON.stringify({ author_name: "Let's Get Rusty", author_url: "https://www.youtube.com/@letsgetrusty", ...over }) : "",
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
/** The curriculum of ctx with the code_mode of l-code replaced. */
const withCodeMode = (codeMode: "fill" | "edit"): typeof ctx => ({
  ...ctx,
  outputs: {
    ...ctx.outputs,
    curriculum: {
      ...curriculum,
      modules: curriculum.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === "l-code" ? { ...l, code_mode: codeMode } : l)),
      })),
    },
  },
}) as typeof ctx;
const fillBlock = { ...fillCode, blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: "Từ khóa cho phép gán lại." }] };

describe("studio lessons: accept by format", () => {
  it("accepts a valid lesson of each format", async () => {
    expect((await accept("l-art", { article })).ok).toBe(true);
    expect((await accept("l-quiz", { quiz: { questions: fiveQuestions } })).ok).toBe(true);
    expect((await accept("l-code", { code: editCode, source_ids: ["s1", "s2"] })).ok).toBe(true);
    expect((await accept("l-code", { code: fillBlock }, ok(), withCodeMode("fill"))).ok).toBe(true);
    expect((await accept("l-prac", { practice: { description_markdown: "Làm theo.", mode: "instruction", checklist_items: [] } })).ok).toBe(true);
    expect((await accept("l-prac", { practice: { description_markdown: "Tự kiểm tra.", mode: "checklist", checklist_items: [{ id: "c1", label: "Đã chạy" }] } })).ok).toBe(false);
    expect((await accept("l-vid", {
      source_ids: ["s2"],
      video: {
        youtube_url: "https://youtu.be/bbbbbbbbbbb",
        start_seconds: 0,
        end_seconds: 0,
        description_markdown: "## Mục tiêu\n\nHiểu Y.\n\n## Ý chính\n\n- Ý 1\n- Ý 2\n- Ý 3\n\nVideo từ kênh Let's Get Rusty.",
      },
    })).ok).toBe(true);
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
    expect(await reason("l-art", { article: { description_markdown: "Bài giải thích không có sơ đồ nào.", diagrams: [] } })).toContain("phải có ít nhất 1 sơ đồ");
  });

  it("quiz: keys, options and explanations follow the publish gate", async () => {
    const fourQuestions = Array.from({ length: 4 }, (_, i) => question({ question: `Q ${i + 1}` }));
    expect(await reason("l-quiz", { quiz: { questions: fourQuestions } })).toContain("quiz phải có ít nhất 5 câu hỏi");
    expect((await accept("l-quiz", { quiz: { questions: fiveQuestions } })).ok).toBe(true);

    const quiz = (q: object) => ({ quiz: { questions: [q, ...fiveQuestions.slice(1)] } });
    expect(await reason("l-quiz", quiz(question({ correct_index: 3 })))).toContain("invalid_correct_index");
    expect(await reason("l-quiz", quiz(question({ options: [{ id: "a", text: "A" }] })))).toContain("options_required");
    expect(await reason("l-quiz", quiz(question({ options: [{ id: "a", text: "A" }, { id: "a", text: "B" }] })))).toContain("duplicate_option_id");
    expect(await reason("l-quiz", quiz(question({ options: [{ id: "a", text: "A" }, { id: "b", text: " " }] })))).toContain("invalid_options");
    expect(await reason("l-quiz", quiz(question({ question: " " })))).toContain("question_required");
    expect(await reason("l-quiz", quiz(question({ explanation: "" })))).toContain("thiếu giải thích");
  });

  it("code edit: validates tests, reference solution, file, and course language", async () => {
    const edit = (over: object) => ({ code: { ...editCode, ...over } });
    expect(await reason("l-code", edit({ reference_solution: "pub fn add(a: i32, b: i32) -> i32 { 0 }" }))).toContain("solution_failed");
    expect(await reason("l-code", edit({ tests: [test({ required: false })] }))).toContain("required_test_missing");
    expect(await reason("l-code", edit({ tests: [test({ value: "" })] }))).toContain("thiếu value");
    expect(await reason("l-code", edit({ tests: [] }))).toContain("mode edit phải có ít nhất 1 test");
    expect(await reason("l-code", edit({ blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: "Từ khóa." }] }))).toContain("mode edit không có blanks");
    expect(await reason("l-code", edit({ file_path: "main.py" }))).toContain("file_path");
    expect(await reason("l-code", edit({ file_path: "src/lib.rs" }))).toContain("file_path");
    expect(await reason("l-code", edit({ language: "python", file_path: "main.py" }))).toContain("language phải khớp code_language của khóa (rust)");
    expect(await reason("l-code", edit({ language: "solidity", file_path: "lib.sol" }), ok(), withCodeLanguage("solidity"))).toContain("solidity chưa hỗ trợ publish");
    expect(await reason("l-code", edit({}), ok(), withCodeLanguage(null))).toContain("brief.code_language = null");
    expect(await reason("l-code", edit({ instructions: " " }))).toContain("instructions");
    const sourceEquals = test({ id: "eq", type: "source_equals", value: "", accepted_sources: [editCode.reference_solution] });
    expect((await accept("l-code", edit({ tests: [sourceEquals] }))).ok).toBe(true);
  });

  it("code fill: validates blanks, markers and solutions, and rejects tests", async () => {
    const fill = (over: object) => ({ code: { ...fillBlock, ...over } });
    const fillMode = withCodeMode("fill");
    expect(await reason("l-code", fill({ reference_solution: "let x = 5;" }), ok(), fillMode)).toContain("solution_failed");
    expect(await reason("l-code", fill({ blanks: [] }), ok(), fillMode)).toContain("mode fill phải có ít nhất 1 blank");
    expect(await reason("l-code", fill({ tests: [test()] }), ok(), fillMode)).toContain("mode fill không có tests");
    expect(await reason("l-code", fill({ file_path: "main.py" }), ok(), fillMode)).toContain("file_path");
    expect(await reason("l-code", fill({ blanks: [{ id: "kw", accepted_answers: [" "], feedback: "x" }] }), ok(), fillMode)).toContain("invalid_blank");
    expect(await reason("l-code", fill({ blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: " " }] }), ok(), fillMode)).toContain("blank kw thiếu feedback");
    expect((await accept("l-code", fill({}), ok(), fillMode)).ok).toBe(true);
  });

  it("code: the block's mode must equal the curriculum code_mode of the lesson", async () => {
    expect(await reason("l-code", { code: fillBlock }, ok(), withCodeMode("edit"))).toContain('code.mode "fill" phải khớp code_mode của lesson ("edit")');
    expect(await reason("l-code", { code: editCode }, ok(), withCodeMode("fill"))).toContain('code.mode "edit" phải khớp code_mode của lesson ("fill")');
    expect(await reason("l-code", { code: null })).toContain("thiếu khối code");
  });

  it("a draft saved in the removed two-part format fails with a clear message, not a TypeError", () => {
    const legacy = { ...base, code: { instructions: "Đề bài", language: "rust", part_1: {}, part_2: {} } };
    const codeRef = lessonRefs(curriculum).find((item) => item.lesson.id === "l-code")!;
    expect(() => toLessonDraft(codeRef, legacy as never, "vi")).toThrow("cần tạo lại khóa");

    const resumed = { ...ctx, lesson: { drafts: 1, reviews: 0, draft: legacy, review: null } };
    expect(() => buildLessonReviewInput(resumed as never, "l-code")).toThrow("cần tạo lại khóa");
  });

  it("a curriculum accepted before code_mode fails before any model call, asking for a regenerated course", () => {
    const legacyCtx = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        curriculum: {
          ...curriculum,
          modules: curriculum.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === "l-code" ? { ...l, code_mode: undefined } : l)) })),
        },
      },
    } as typeof ctx;
    expect(() => buildLessonInput(legacyCtx, "l-code")).toThrow("cần tạo lại khóa");
    expect(() => buildLessonInput(ctx, "l-code")).not.toThrow();
  });

  it.each(ENABLED_CODE_LANGUAGES)("accepts a valid code lesson in enabled language %s", async (language) => {
    const extension = getCodeLanguageAdapter(language)!.extensions[0];
    const result = await accept(
      "l-code",
      {
        code: {
          ...editCode,
          language,
          file_path: `Main.${extension}`,
        },
      },
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
        {
          code: {
            ...editCode,
            language,
            file_path: `Main.${extension}`,
          },
        },
        ok(),
        withCodeLanguage(language),
      )).toContain(`${language} chưa hỗ trợ publish`);
    }
  });

  it("rejects identifier answers leaked into each hint surface", async () => {
    const fillMode = withCodeMode("fill");
    expect(await reason("l-code", { code: { ...fillBlock, hints: ["Hãy thử từ mut ở đây."] } }, ok(), fillMode))
      .toContain('code.hints[0] lộ đáp án định danh "mut"');
    expect(await reason("l-code", { code: { ...fillBlock, blanks: [{ ...fillBlock.blanks[0], feedback: "Đáp án là mut." }] } }, ok(), fillMode))
      .toContain('code.blanks[0].feedback lộ đáp án định danh "mut"');
    expect(await reason("l-code", { code: { ...editCode, tests: [test({ value: "add", failure_message: "Hãy thêm add." })] } }))
      .toContain('code.tests[0].failure_message lộ đáp án định danh "add"');
    expect(await reason("l-code", { code: { ...editCode, tests: [test({ value: "add", hint: "Dùng add." })] } }))
      .toContain('code.tests[0].hint lộ đáp án định danh "add"');
  });

  it("uses whole-identifier, case-sensitive, conservative answer matching", async () => {
    const fillMode = withCodeMode("fill");
    const nonLeaking = await accept("l-code", { code: { ...fillBlock, hints: ["Tư duy về tính mutable; đừng trả lời MUT."] } }, ok(), fillMode);
    expect(nonLeaking).toMatchObject({ ok: true });

    const shortAndNonIdentifierAnswers = {
      ...fillBlock,
      blanks: [{ id: "kw", accepted_answers: ["if", "::", "a + b"], feedback: "Từ khóa if, toán tử :: và biểu thức a + b." }],
      hints: ["Xem lại if, :: và a + b."],
    };
    const conservativeReason = await reason("l-code", { code: shortAndNonIdentifierAnswers }, ok(), fillMode);
    expect(conservativeReason).not.toContain("lộ đáp án định danh");

    const sourceEquals = test({ id: "eq", type: "source_equals", value: "", accepted_sources: [editCode.reference_solution], failure_message: "Đáp án add chưa đúng." });
    const ignoredTestReason = await reason("l-code", { code: { ...editCode, tests: [sourceEquals] } });
    expect(ignoredTestReason).not.toContain("lộ đáp án định danh");
    const notContains = test({ type: "not_contains", value: "add", failure_message: "Đừng dùng add." });
    expect(await reason("l-code", { code: { ...editCode, tests: [notContains] } })).not.toContain("lộ đáp án định danh");
  });

  it("practice: only instruction mode allowed for AI courses, checklist and non-optional_hands_on are rejected", async () => {
    expect(await reason("l-prac", {
      practice: { description_markdown: "Làm.", mode: "checklist", checklist_items: [{ id: "c1", label: "A" }] },
    })).toContain("practice của khóa AI chỉ hỗ trợ mode instruction");

    expect(await reason("l-prac", {
      practice: { description_markdown: "Làm.", mode: "instruction", checklist_items: [{ id: "c1", label: "A" }] },
    })).toContain("mode instruction không có checklist_items");

    expect((await accept("l-prac", {
      practice: { description_markdown: "Làm theo hướng dẫn.", mode: "instruction", checklist_items: [] },
    })).ok).toBe(true);

    const explanationPracContext = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        curriculum: {
          ...curriculum,
          modules: curriculum.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) => (l.id === "l-prac" ? { ...l, purpose: "explanation" } : l)),
          })),
        },
      },
    } as typeof ctx;
    expect(await reason("l-prac", {
      practice: { description_markdown: "Làm.", mode: "instruction", checklist_items: [] },
    }, ok(), explanationPracContext)).toContain("lesson practice phải có purpose optional_hands_on");
  });

  it("video: use only a matching research candidate and verify its oEmbed channel", async () => {
    const video = (url: string) => ({ source_ids: ["s2"], video: { youtube_url: url, start_seconds: 0, end_seconds: 0, description_markdown: "## Mục tiêu\n\nHiểu Y.\n\n## Ý chính\n\n- Ý 1\n- Ý 2\n- Ý 3\n\nVideo từ kênh Let's Get Rusty." } });
    expect(await reason("l-vid", video("https://example.com/watch"))).toContain("youtube_required");
    expect(await reason("l-vid", { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/bbbbbbbbbbb", start_seconds: 30, end_seconds: 0, description_markdown: "Mô tả." } })).toContain("start_seconds và end_seconds phải bằng 0");
    expect(await reason("l-vid", { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/bbbbbbbbbbb", start_seconds: 0, end_seconds: 20, description_markdown: "Mô tả." } })).toContain("start_seconds và end_seconds phải bằng 0");
    expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb"), ok(false))).toContain("oEmbed");
    const seen: string[] = [];
    const spy = ((url: string) => {
      seen.push(url);
      return Promise.resolve(new Response(JSON.stringify({ author_name: "  Let's   Get Rusty ", author_url: "https://www.youtube.com/@letsgetrusty" }), { status: 200 }));
    }) as unknown as typeof fetch;
    expect((await accept("l-vid", video("https://www.youtube.com/watch?v=bbbbbbbbbbb&t=5"), spy)).ok).toBe(true);
    expect(seen[0]).toContain("youtube.com/oembed");
    expect(seen[0]).toContain(encodeURIComponent("https://www.youtube.com/watch?v=bbbbbbbbbbb"));

    expect(await reason("l-vid", video("https://youtu.be/ccccccccccc"))).toContain("không có trong research.videos");
    expect(await reason("l-vid", video("https://youtu.be/aaaaaaaaaaa"))).toContain("không có trong research.videos");
    const wrongChannel = ((() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel", author_url: "https://www.youtube.com/@otherchannel" }), { status: 200 }))) as unknown) as typeof fetch;
    expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb"), wrongChannel)).toContain("không khớp channel research");
    const missingAuthor = (() => Promise.resolve(new Response("{}", { status: 200 }))) as typeof fetch;
    expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb"), missingAuthor)).toContain("thiếu author_name");
  });


  it("video: validates CNCF, imposter handle, missing author_url, curly quote, source_ids, banned self-assessment terms, and article fallback", async () => {
    const video = (url = "https://youtu.be/bbbbbbbbbbb", over = {}) => ({
      source_ids: ["s2"],
      video: {
        youtube_url: url,
        start_seconds: 0,
        end_seconds: 0,
        description_markdown: "## Mục tiêu\n\nHiểu Y.\n\n## Ý chính\n\n- Ý 1\n- Ý 2\n- Ý 3\n\nVideo từ kênh Let's Get Rusty.",
        ...over,
      },
    });

    // CNCF accepted with real oEmbed payload
    const cncfVideo = video("https://youtu.be/bbbbbbbbbbb", { description_markdown: "## Mục tiêu\n\nHiểu K8s.\n\n## Ý chính\n\n- 1\n- 2\n- 3\n\nVideo từ kênh CNCF." });
    const cncfContext = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        research: {
          ...ctx.outputs.research,
          videos: [{
            topic: "t2",
            url: "https://youtu.be/bbbbbbbbbbb",
            title: "CNCF Overview",
            channel: "CNCF",
            channel_basis: "Official",
            evidence_source_ids: ["s2"],
          }],
        },
      },
    } as typeof ctx;
    const cncfSpy = (() => Promise.resolve(new Response(JSON.stringify({
      author_name: "CNCF [Cloud Native Computing Foundation]",
      author_url: "https://www.youtube.com/@cncf",
    }), { status: 200 }))) as typeof fetch;
    expect((await accept("l-vid", cncfVideo, cncfSpy, cncfContext)).ok).toBe(true);

    // Imposter handle with matching author_name is rejected
    const imposterSpy = (() => Promise.resolve(new Response(JSON.stringify({
      author_name: "Let's Get Rusty",
      author_url: "https://www.youtube.com/@imposter_channel",
    }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-vid", video(), imposterSpy)).toContain("không khớp channel research");

    // Missing author_url is rejected
    const noAuthorUrl = (() => Promise.resolve(new Response(JSON.stringify({
      author_name: "Let's Get Rusty",
    }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-vid", video(), noAuthorUrl)).toContain("thiếu author_name/author_url");

    // Curly quote in candidate channel name matches cleanly
    const curlyContext = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        research: {
          ...ctx.outputs.research,
          videos: [{
            topic: "t2",
            url: "https://youtu.be/bbbbbbbbbbb",
            title: "Curly Vid",
            channel: "Let’s Get Rusty",
            channel_basis: "Official",
            evidence_source_ids: ["s2"],
          }],
        },
      },
    } as typeof ctx;
    expect((await accept("l-vid", video(), ok(), curlyContext)).ok).toBe(true);

    // source_ids empty is rejected for video
    expect(await reason("l-vid", { ...video(), source_ids: [] })).toContain("thiếu source_ids");

    // Banned self-check / self-assessment terms in description_markdown
    for (const banned of ["tự đánh giá", "tự thử", "self-assessment", "tự kiểm tra", "checklist"]) {
      expect(await reason("l-vid", video("https://youtu.be/bbbbbbbbbbb", {
        description_markdown: `## Mục tiêu\n\nHiểu.\n\n## Ý chính\n\n- 1\n- 2\n- 3\n\nCó ${banned} ở cuối bài.`,
      }))).toContain("không dùng checklist hoặc tự đánh giá dưới video");
    }

    // Fallback: when all video candidates fail oEmbed, guides to article, and accepts valid article
    const failOembed = (() => Promise.resolve(new Response("", { status: 404 }))) as typeof fetch;
    const r1 = await accept("l-vid", video(), failOembed);
    expect(r1.ok).toBe(false);
    expect((r1 as any).reason).toContain("không có video ứng viên nào có thể nhúng được qua oEmbed; hãy chuyển sang viết bài dạng article");

    const r2 = await accept("l-vid", { article, source_ids: ["s2"] }, failOembed);
    expect(r2.ok).toBe(true);
    expect((r2 as any).summary).toContain("article (chuyển từ video)");
  });

  it("video fallback: covers all V-19 conditions cleanly", async () => {
    const videoDraft = (url = "https://youtu.be/bbbbbbbbbbb") => ({
      source_ids: ["s2"],
      video: {
        youtube_url: url,
        start_seconds: 0,
        end_seconds: 0,
        description_markdown: "## Mục tiêu\n\nHiểu Y.\n\n## Ý chính\n\n- Ý 1\n- Ý 2\n- Ý 3\n\nVideo từ kênh Let's Get Rusty.",
      },
    });

    // 1. Ứng viên duy nhất sai handle: lý do từ chối có chỉ dẫn article; article sau đó được nhận.
    const wrongHandleSpy = (() => Promise.resolve(new Response(JSON.stringify({
      author_name: "Let's Get Rusty",
      author_url: "https://www.youtube.com/@wrong_handle",
    }), { status: 200 }))) as typeof fetch;
    const rWrongHandle = await accept("l-vid", videoDraft(), wrongHandleSpy);
    expect(rWrongHandle.ok).toBe(false);
    expect((rWrongHandle as any).reason).toContain("không khớp channel research");
    expect((rWrongHandle as any).reason).toContain("không có video ứng viên nào có thể nhúng được qua oEmbed; hãy chuyển sang viết bài dạng article");

    const rArticleAfterWrongHandle = await accept("l-vid", { article, source_ids: ["s2"] }, wrongHandleSpy);
    expect(rArticleAfterWrongHandle.ok).toBe(true);
    expect((rArticleAfterWrongHandle as any).summary).toContain("article (chuyển từ video)");

    // 2. Ứng viên 200 thiếu author_url: lý do từ chối có chỉ dẫn article; article sau đó được nhận.
    const missingAuthorUrlSpy = (() => Promise.resolve(new Response(JSON.stringify({
      author_name: "Let's Get Rusty",
    }), { status: 200 }))) as typeof fetch;
    const rMissingAuthor = await accept("l-vid", videoDraft(), missingAuthorUrlSpy);
    expect(rMissingAuthor.ok).toBe(false);
    expect((rMissingAuthor as any).reason).toContain("thiếu author_name/author_url");
    expect((rMissingAuthor as any).reason).toContain("không có video ứng viên nào có thể nhúng được qua oEmbed; hãy chuyển sang viết bài dạng article");

    const rArticleAfterMissingAuthor = await accept("l-vid", { article, source_ids: ["s2"] }, missingAuthorUrlSpy);
    expect(rArticleAfterMissingAuthor.ok).toBe(true);

    // 3. Article khi còn ứng viên dùng được: bị từ chối, nêu video còn dùng được.
    const validOembedSpy = (() => Promise.resolve(new Response(JSON.stringify({
      author_name: "Let's Get Rusty",
      author_url: "https://www.youtube.com/@letsgetrusty",
    }), { status: 200 }))) as typeof fetch;
    const rPrematureArticle = await accept("l-vid", { article, source_ids: ["s2"] }, validOembedSpy);
    expect(rPrematureArticle.ok).toBe(false);
    expect((rPrematureArticle as any).reason).toContain("vẫn còn video ứng viên dùng được");
    expect((rPrematureArticle as any).reason).toContain("https://youtu.be/bbbbbbbbbbb");

    // 4. Video 404 và ứng viên khác lỗi mạng: ném TransientError, không chỉ dẫn article.
    const twoCandidateCtx = {
      ...ctx,
      outputs: {
        ...ctx.outputs,
        research: {
          ...ctx.outputs.research,
          videos: [
            { topic: "t2", url: "https://youtu.be/bbbbbbbbbbb", title: "Vid 1", channel: "Let's Get Rusty", evidence_source_ids: ["s2"] },
            { topic: "t2", url: "https://youtu.be/ddddddddddd", title: "Vid 2", channel: "Let's Get Rusty", evidence_source_ids: ["s2"] },
          ],
        },
      },
    } as typeof ctx;
    const transientSpy = ((url: string) => {
      if (String(url).includes("bbbbbbbbbbb")) {
        return Promise.resolve(new Response("", { status: 404 }));
      }
      return Promise.resolve(new Response("", { status: 503 }));
    }) as typeof fetch;
    await expect(accept("l-vid", videoDraft("https://youtu.be/bbbbbbbbbbb"), transientSpy, twoCandidateCtx))
      .rejects.toBeInstanceOf(TransientError);

    // 5. Nhiều ứng viên, một còn dùng được: chỉ dẫn chọn video khác, không chỉ dẫn article.
    const fallbackOtherVidSpy = ((url: string) => {
      if (String(url).includes("bbbbbbbbbbb")) {
        return Promise.resolve(new Response("", { status: 404 }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        author_name: "Let's Get Rusty",
        author_url: "https://www.youtube.com/@letsgetrusty",
      }), { status: 200 }));
    }) as typeof fetch;
    const rHasOther = await accept("l-vid", videoDraft("https://youtu.be/bbbbbbbbbbb"), fallbackOtherVidSpy, twoCandidateCtx);
    expect(rHasOther.ok).toBe(false);
    expect((rHasOther as any).reason).toContain("Hãy chọn video ứng viên khác trong research có thể nhúng được");
    expect((rHasOther as any).reason).toContain("https://youtu.be/ddddddddddd");
    expect((rHasOther as any).reason).not.toContain("hãy chuyển sang viết bài dạng article");
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
    const wrongChannel = (() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel", author_url: "https://www.youtube.com/@otherchannel" }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-art", { article: withRecommendation }, wrongChannel)).toContain("không khớp channel research");
  });

  it.each(((): { field: string; lessonId: string; output: object; lessonCtx?: typeof ctx }[] => {
    const unresearched = "https://youtu.be/ccccccccccc";
    const practice = {
      practice: {
        description_markdown: "Tự thực hành.",
        mode: "instruction",
        checklist_items: [],
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
      { field: "questions[0].question", lessonId: "l-quiz", output: { quiz: { questions: [question({ question: unresearched }), ...fiveQuestions.slice(1)] } } },
      { field: "questions[0].options[0].text", lessonId: "l-quiz", output: { quiz: { questions: [question({ options: [{ id: "a", text: unresearched }, ...question().options.slice(1)] }), ...fiveQuestions.slice(1)] } } },
      { field: "questions[0].explanation", lessonId: "l-quiz", output: { quiz: { questions: [question({ explanation: unresearched }), ...fiveQuestions.slice(1)] } } },
      { field: "lesson.code_exercise_locale.instructions", lessonId: "l-code", output: codeWith({ instructions: `[Xem video](${unresearched})` }) },
      { field: "lesson.code_exercise_config.hints[0]", lessonId: "l-code", output: codeWith({ hints: [unresearched] }) },
      {
        field: "lesson.code_exercise_config.blanks[0].feedback",
        lessonId: "l-code",
        output: { code: { ...fillBlock, blanks: [{ ...fillBlock.blanks[0], feedback: unresearched }] } },
        lessonCtx: withCodeMode("fill"),
      },
      { field: "lesson.code_exercise_config.tests[0].description", lessonId: "l-code", output: codeWith({ tests: [{ ...editCode.tests[0], description: unresearched }] }) },
      { field: "lesson.code_exercise_config.tests[0].failure_message", lessonId: "l-code", output: codeWith({ tests: [{ ...editCode.tests[0], failure_message: unresearched }] }) },
      { field: "lesson.code_exercise_config.tests[0].hint", lessonId: "l-code", output: codeWith({ tests: [{ ...editCode.tests[0], hint: unresearched }] }) },
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

    const wrongChannel = (() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel", author_url: "https://www.youtube.com/@otherchannel" }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-prac", practice(`[Đề xuất xem](${validUrl})`), wrongChannel))
      .toContain("lesson.description_markdown: handle kênh không khớp channel research");

    let calls = 0;
    const spy = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify({ author_name: "Let's Get Rusty", author_url: "https://www.youtube.com/@letsgetrusty" }), { status: 200 }));
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
    ["l-quiz", { quiz: { questions: fiveQuestions } }],
    ["l-code", { code: editCode, source_ids: ["s1", "s2"] }],
    ["l-prac", { practice: { description_markdown: "Đọc ví dụ.", mode: "instruction", checklist_items: [] } }],
  ])("builds a code-owned optional video resource for %s and allows an empty selection", async (lessonId, block) => {
    const selected = { ...base, ...block, suggested_videos: ["aaaaaaaaaaa"] };
    expect((await accept(lessonId, selected)).ok).toBe(true);
    const ref = lessonRefs(curriculum).find((item) => item.lesson.id === lessonId)!;
    const withSuggestion = toLessonDraft(ref, selected as never, "vi", ctx.outputs.research as never);
    expect(withSuggestion.lesson.resources).toContainEqual({
      title: "Video: Worked example for t1 — Let's Get Rusty",
      url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    });

    const empty = { ...selected, suggested_videos: [] };
    expect((await accept(lessonId, empty)).ok).toBe(true);
    expect(toLessonDraft(ref, empty as never, "vi", ctx.outputs.research as never).lesson.resources).toBeUndefined();
  });

  it("drops suggested video IDs that are unknown, duplicated or over the limit instead of rejecting the lesson", async () => {
    const dropped = async (id: string, out: object) => {
      const r = await accept(id, out);
      return r.ok ? { summary: r.summary, kept: (r.normalizedOutput as { suggested_videos: string[] }).suggested_videos } : { summary: r.reason, kept: null };
    };
    expect(await dropped("l-art", { article, suggested_videos: ["ccccccccccc"] }))
      .toMatchObject({ summary: expect.stringContaining("không thuộc ứng viên của lesson"), kept: [] });
    expect(await dropped("l-art", { article, suggested_videos: ["aaaaaaaaaaa", "aaaaaaaaaaa"] }))
      .toMatchObject({ summary: expect.stringContaining("bị trùng video ID"), kept: ["aaaaaaaaaaa"] });
    expect(await dropped("l-code", { code: editCode, suggested_videos: ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"], source_ids: ["s1", "s2"] }))
      .toMatchObject({ summary: expect.stringContaining("không thuộc ứng viên của lesson"), kept: ["aaaaaaaaaaa", "bbbbbbbbbbb"] });
    expect(await dropped("l-art", { article, suggested_videos: "aaaaaaaaaaa" }))
      .toMatchObject({ summary: expect.stringContaining("phải là mảng video ID"), kept: [] });
    // A link the model wrote in the lesson text is not optional.
    expect(await reason("l-art", { article, resources: [{ title: "Video xem thêm", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }] }))
      .toContain("video xem thêm phải được chọn qua suggested_videos");
  });

  it("oEmbeds each suggested ID once, drops a missing embed or channel mismatch, and keeps transient errors", async () => {
    const articleWithLink = {
      ...article,
      description_markdown: `${article.description_markdown}

[Xem thêm](https://youtu.be/aaaaaaaaaaa)`,
    };
    let calls = 0;
    const spy = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify({ author_name: "Let's Get Rusty", author_url: "https://www.youtube.com/@letsgetrusty" }), { status: 200 }));
    }) as typeof fetch;
    const good = await accept("l-art", { article: articleWithLink, suggested_videos: ["aaaaaaaaaaa"] }, spy);
    expect(good).toMatchObject({ ok: true });
    expect(good).not.toHaveProperty("normalizedOutput");
    expect(calls).toBe(1);

    const dropsSuggestion = async (fetchFn: typeof fetch, note: string) => {
      const r = await accept("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, fetchFn);
      expect(r).toMatchObject({ ok: true, summary: expect.stringContaining(note), normalizedOutput: { suggested_videos: [] } });
    };
    await dropsSuggestion((() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel", author_url: "https://www.youtube.com/@otherchannel" }), { status: 200 }))) as typeof fetch, "không khớp channel research");
    await dropsSuggestion((() => Promise.resolve(new Response("", { status: 404 }))) as typeof fetch, "không nhúng được");

    // The same video linked in the lesson text must pass: that link is not optional.
    const wrongChannel = (() => Promise.resolve(new Response(JSON.stringify({ author_name: "Other Channel", author_url: "https://www.youtube.com/@otherchannel" }), { status: 200 }))) as typeof fetch;
    expect(await reason("l-art", { article: articleWithLink, suggested_videos: ["aaaaaaaaaaa"] }, wrongChannel))
      .toContain("handle kênh không khớp channel research");

    const server = (() => Promise.resolve(new Response("", { status: 503 }))) as typeof fetch;
    const offline = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    await expect(accept("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, server)).rejects.toBeInstanceOf(TransientError);
    await expect(accept("l-art", { article, suggested_videos: ["aaaaaaaaaaa"] }, offline)).rejects.toBeInstanceOf(TransientError);
  });

  it("video: a check that cannot be made throws instead of failing the lesson", async () => {
    const out = { source_ids: ["s2"], video: { youtube_url: "https://youtu.be/bbbbbbbbbbb", start_seconds: 0, end_seconds: 0, description_markdown: "Mô tả video." } };
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

describe("studio lessons: blocking issues new in a review", () => {
  const issue = (problem: string, location = "lesson.description_markdown") => ({ severity: "blocking", category: "flow_violation", location, problem });
  const previous = { issues: [issue("The opening uses lamports without explaining it.")] };

  it("counts an issue A6 marks as new at a location the previous review flagged", () => {
    expect(hasUnseenBlocking({ issues: [issue("Mới ở vòng này: Bài dùng wallet mà không giải thích.")] }, previous)).toBe(true);
  });

  it("counts an issue at a new location", () => {
    expect(hasUnseenBlocking({ issues: [issue("Sai đáp án.", "questions[0]")] }, previous)).toBe(true);
  });

  it("does not count an issue kept at the same location", () => {
    expect(hasUnseenBlocking({ issues: [issue("Vẫn chưa giải thích lamports.")] }, previous)).toBe(false);
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

  it("builds records the app validates: one-mode code config for fill and edit, canonical video URL", () => {
    const editLesson = toLessonDraft(ref("l-code"), { ...base, code: editCode } as never, "vi").lesson;
    expect(editLesson.code_exercise_config).toMatchObject({
      schema_version: 1,
      revision: 1,
      mode: "edit",
      language: "rust",
      file: { path: "lib.rs", starter_source: editCode.starter_source },
      tests: [{ id: "sum", type: "contains", value: "a + b", required: true }],
    });
    expect(editLesson.code_exercise_config).not.toHaveProperty("blanks");
    expect(editLesson.code_exercise_locale).toEqual({ instructions: "Hoàn thành hàm add." });

    const fillLesson = toLessonDraft(ref("l-code"), { ...base, code: fillBlock } as never, "vi").lesson;
    expect(fillLesson.code_exercise_config).toMatchObject({
      schema_version: 1,
      revision: 1,
      mode: "fill",
      language: "rust",
      file: { path: "lib.rs", starter_source: fillBlock.starter_source },
      blanks: [{ id: "kw", accepted_answers: ["mut"], feedback: "Từ khóa cho phép gán lại." }],
    });
    expect(fillLesson.code_exercise_config).not.toHaveProperty("tests");
    const video = toLessonDraft(ref("l-vid"), { ...base, video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 5, end_seconds: 0, description_markdown: "Mô tả video." } } as never, "vi").lesson;
    expect(video).toMatchObject({ youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", youtube_start_seconds: 5, youtube_end_seconds: null, description_markdown: "Mô tả video." });
    const practice = toLessonDraft(ref("l-prac"), { ...base, practice: { description_markdown: "x", mode: "instruction", checklist_items: [] } } as never, "vi").lesson;
    expect(practice.practice_config).toEqual({ mode: "instruction", requires_review: false });
  });
});

describe("studio lessons: input", () => {
  it("gives the lesson, its neighbours and only the research that rests on its sources", () => {
    const input = buildLessonInput(ctx, "l-quiz") as Record<string, any>;
    expect(input.lesson.id).toBe("l-quiz");
    expect(input.module).toEqual({ id: "m1", title: "Module 1", description: "md", first_teaching_lesson_id: "l-art" });
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

  it("identifies the first teaching lesson separately from a legacy warm_up lesson", () => {
    const legacyCurriculum = {
      ...curriculum,
      modules: [
        {
          ...curriculum.modules[0],
          lessons: [lesson("l-warm-up", "quiz", { purpose: "warm_up", pass_threshold: 70 }), ...curriculum.modules[0].lessons],
        },
        curriculum.modules[1],
      ],
    };
    const legacyCtx = { ...ctx, outputs: { ...ctx.outputs, curriculum: withKnowledge(legacyCurriculum) } } as typeof ctx;
    const input = buildLessonInput(legacyCtx, "l-art") as Record<string, any>;
    expect(input.module).toMatchObject({ first_teaching_lesson_id: "l-art" });
  });

  it("uses effective article format in inputs and review checks when video fallback occurred", () => {
    const articleDraft = {
      title: "Bài đọc thay video",
      short_description: "Tóm tắt",
      duration_seconds: 600,
      source_ids: ["s2"],
      resources: [],
      summary: "Tóm tắt bài đọc",
      article: {
        description_markdown: "## Nội dung\n\nNội dung bài viết.",
        diagrams: [],
      },
    };

    const fallbackCtx = {
      ...ctx,
      lesson: {
        lessonId: "l-vid",
        drafts: 1,
        reviews: 1,
        draft: articleDraft,
        review: { round: 1, issues: [{ location: "lesson.description_markdown", category: "factual_inaccuracy", severity: "blocking", problem: "fix" }] },
      },
    } as unknown as typeof ctx;

    const writerInput = buildLessonInput(fallbackCtx, "l-vid") as Record<string, any>;
    expect(writerInput.lesson.type).toBe("article");
    expect(writerInput.platform_format).toBe(PLATFORM_FORMAT_GUIDE.article);
    expect((fallbackCtx.outputs.curriculum as any).modules[1].lessons[2].type).toBe("video"); // curriculum intact

    const reviewerInput = buildLessonReviewInput(fallbackCtx, "l-vid") as Record<string, any>;
    expect(reviewerInput.lesson.type).toBe("article");
    expect(reviewerInput.module.first_teaching_lesson_id).toBe("l-code");
    expect(reviewerInput.platform_format).toBe(PLATFORM_FORMAT_GUIDE.article);
    expect(reviewerInput.checks_already_run).toEqual(expect.arrayContaining([
      expect.stringContaining("Markdown và diagrams khớp hai chiều"),
    ]));
    expect(reviewerInput.checks_already_run).not.toEqual(expect.arrayContaining([
      expect.stringContaining("Video ID thuộc ứng viên research"),
    ]));
  });
});

describe("studio lessons: schema", () => {
  it("is strict-mode shaped: closed objects with every key required, within the property budget", () => {
    expect((LESSON_SCHEMA as any).required).toContain("suggested_videos");
    const codeSchema = (LESSON_SCHEMA.properties.code as any).anyOf[0];
    expect(codeSchema.properties.language.enum).toEqual(ENABLED_CODE_LANGUAGES);
    expect(codeSchema.properties.mode.enum).toEqual(["fill", "edit"]);
    expect(codeSchema.required).toEqual(expect.arrayContaining(["mode", "blanks", "tests"]));
    expect(codeSchema).not.toHaveProperty("properties.part_1");
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

describe("studio lessons: knowledge chain, length, ID and code_mode checks (A5 v30)", () => {
  it("counts article length without fenced code blocks", () => {
    expect(articleProseLength("abc\n```ts\nxxxxx\n```\ndef")).toBe("abc\n\ndef".length);
    // An unclosed fence runs to the end of the text, so the code after it is not counted.
    expect(articleProseLength("abc\n```\ncode that goes on")).toBe("abc\n".length);
    expect(ARTICLE_MAX_PROSE_CHARS).toBe(9000);
  });

  it("refuses an article whose prose is longer than the limit, and counts only prose", async () => {
    const long = await reason("l-art", { article: { ...article, description_markdown: "x".repeat(ARTICLE_MAX_PROSE_CHARS + 1) } });
    expect(long).toContain(`vượt giới hạn ${ARTICLE_MAX_PROSE_CHARS}`);
    const withCode = `## Biên dịch\n\nXem ![sơ đồ](diagram:d1) bên dưới.\n\n${"x".repeat(8900)}\n\`\`\`\n${"y".repeat(5000)}\n\`\`\``;
    expect(await reason("l-art", { article: { ...article, description_markdown: withCode } })).not.toContain("vượt giới hạn");
  });

  it("finds curriculum lesson IDs in learner text as whole tokens, ignoring case", () => {
    const texts = [{ location: "lesson.description_markdown", text: "See L04-02 and l04-02, not L04-020 or xL04-02." }];
    expect(lessonIdLeaks(texts, ["L04-02"])).toEqual([
      { location: "lesson.description_markdown", id: "L04-02" },
      { location: "lesson.description_markdown", id: "l04-02" },
    ]);
    // A short ID is still a token: "intro" matches "Intro", not "introduction".
    expect(lessonIdLeaks([{ location: "t", text: "Intro, then introduction." }], ["intro"])).toEqual([{ location: "t", id: "Intro" }]);
    expect(lessonIdLeaks([{ location: "t", text: "no ids here" }], [])).toEqual([]);
  });

  it("refuses a lesson that shows another lesson's ID to the learner", async () => {
    const leaked = await reason("l-art", { article: { ...article, description_markdown: "## Biên dịch\n\nXem l-quiz trước.\n" } });
    expect(leaked).toContain('lộ mã bài "l-quiz"');
    expect(leaked).toContain("hãy viết tiêu đề bài thay cho mã");
  });

  it("names the checks by code_mode separately (V-55): a fill exercise has no test claim", () => {
    const fill = checksAlreadyRun("code_exercise", "rust", "fill");
    expect(fill.some((c) => c.startsWith("code_mode fill") && c.includes("tests rỗng"))).toBe(true);
    expect(fill.some((c) => c.includes("reference_solution đạt mọi test bắt buộc"))).toBe(false);
    const edit = checksAlreadyRun("code_exercise", "rust", "edit");
    expect(edit.some((c) => c.startsWith("code_mode edit") && c.includes("reference_solution đạt mọi test bắt buộc"))).toBe(true);
    // Starter behaviour is not checked by code; the list must say so instead of claiming it.
    expect(edit.join(" ")).toContain("CHƯA được code kiểm");
  });

  it("gives A5 the recap it writes here, by placement, and prerequisite lessons by title", () => {
    // Module m1 ends with a quiz: its recap opens l-code, the first teaching lesson of m2.
    expect(buildLessonInput(ctx, "l-code").recap_to_write).toEqual([{ module_id: "m1", placement: "opening", text: "After this module you can use m1." }]);
    // Module m2 is the last module: it has no recap, so the video carries none.
    expect(buildLessonInput(ctx, "l-vid").recap_to_write).toEqual([]);
    expect(buildLessonInput(ctx, "l-art").recap_to_write).toEqual([]);
    expect(buildLessonInput(ctx, "l-vid").prerequisite_lessons).toEqual([]);
  });

  it("refuses to write a lesson from a curriculum without the knowledge fields", () => {
    const staleCtx = { ...ctx, outputs: { ...ctx.outputs, curriculum } } as typeof ctx;
    expect(() => buildLessonInput(staleCtx, "l-art")).toThrow(STALE_KNOWLEDGE_MESSAGE);
  });
});

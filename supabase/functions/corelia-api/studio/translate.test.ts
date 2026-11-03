import { describe, expect, it } from "vitest";
import {
  extractCodeBlocks,
  findEnglishLeaks,
  extractDiagramReferences,
  validateCourseTranslation,
  validateSectionTranslation,
  validateLessonTranslation,
  buildLessonLocaleData,
  buildLessonTranslateInput,
  buildCourseTranslateInput,
  canonicalCourseDescription,
  canonicalCourseShortDescription,
  TranslationIntegrityError,
  TRANSLATION_LOCALES,
  type TranslatedLesson,
} from "./translate.ts";
import type { LessonRecord } from "./checks.ts";

describe("translate: extract helpers", () => {
  it("extracts code blocks exactly", () => {
    const md = "# Heading\n\n```rust\nfn main() {}\n```\n\nText\n\n```python\nprint(1)\n```";
    expect(extractCodeBlocks(md)).toEqual(["```rust\nfn main() {}\n```", "```python\nprint(1)\n```"]);
  });

  it("extracts diagram references", () => {
    const md = "Xem ![cargo](diagram:d1) và ![build](diagram:d2).";
    expect(extractDiagramReferences(md)).toEqual(["d1", "d2"]);
  });
});

describe("translate: validateCourseTranslation & validateSectionTranslation", () => {
  it("validates course translation fields", () => {
    const source = {
      title: "Rust Course",
      short_description: "Learn Rust",
      description: "Full course description",
      learning_outcomes: ["Outcome 1", "Outcome 2"],
    };
    const valid = {
      title: "Khóa học Rust",
      short_description: "Học Rust",
      description: "Mô tả khóa học đầy đủ",
      learning_outcomes: ["Mục tiêu 1", "Mục tiêu 2"],
    };
    expect(() => validateCourseTranslation(source, valid, "vi")).not.toThrow();

    expect(() => validateCourseTranslation(source, { ...valid, title: " " }, "vi")).toThrow(TranslationIntegrityError);
    expect(() => validateCourseTranslation(source, { ...valid, learning_outcomes: ["Mục tiêu 1"] }, "vi")).toThrow(TranslationIntegrityError);
    expect(() => validateCourseTranslation(source, { ...valid, learning_outcomes: ["Mục tiêu 1", " "] }, "vi")).toThrow(TranslationIntegrityError);
  });

  it("validates section translation fields", () => {
    const source = { id: "m1", title: "Module 1", description: "Desc 1" };
    expect(() => validateSectionTranslation(source, { id: "m1", title: "Phần 1", description: "Mô tả 1" }, "vi")).not.toThrow();
    expect(() => validateSectionTranslation(source, { id: "m1", title: "", description: "Mô tả 1" }, "vi")).toThrow(TranslationIntegrityError);
    expect(() => validateSectionTranslation(source, { id: "m1", title: "Phần 1", description: "Mô tả with lỗi" }, "vi")).toThrow("còn chữ tiếng Anh");
  });
});

describe("translate: validateLessonTranslation", () => {
  it("article: rejects when code block in markdown is altered", () => {
    const sourceRecord: LessonRecord = {
      lessonId: "l-art",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-art",
          lesson_format: "article",
          title: "Title",
          short_description: "Short",
          description_markdown: "Intro\n\n```rust\nlet x = 1;\n```",
        },
        questions: [],
        diagrams: [],
      },
    };

    const validTranslated: TranslatedLesson = {
      title: "Tiêu đề",
      short_description: "Mô tả ngắn",
      summary: "Tóm tắt",
      article: {
        description_markdown: "Mở đầu\n\n```rust\nlet x = 1;\n```",
        diagrams: [],
      },
    };

    expect(() => validateLessonTranslation(sourceRecord, validTranslated, "vi")).not.toThrow();

    // Sửa code block
    const alteredCode: TranslatedLesson = {
      ...validTranslated,
      article: {
        description_markdown: "Mở đầu\n\n```rust\nlet x = 2;\n```",
        diagrams: [],
      },
    };
    expect(() => validateLessonTranslation(sourceRecord, alteredCode, "vi")).toThrow("bị sửa đổi");
  });

  describe("quiz option IDs", () => {
    const sourceRecord: LessonRecord = {
      draft: {
        lesson: { id: "l-quiz", lesson_format: "quiz", title: "Quiz 1", short_description: "Short" },
        questions: [
          {
            question: "Q1?",
            explanation: "E1",
            options: [
              { id: "a", text: "Source A" },
              { id: "b", text: "Source B" },
              { id: "c", text: "Source C" },
              { id: "d", text: "Correct source answer" },
            ],
            correct_index: 3,
          },
        ],
        diagrams: [],
      },
    };

    const translation = (options: { id: string; text: string }[]): TranslatedLesson => ({
      title: "Bài kiểm tra 1",
      short_description: "Mô tả",
      summary: "Tóm tắt",
      quiz: {
        questions: [{ question: "Câu hỏi 1?", explanation: "Giải thích 1", options }],
      },
    });

    it("accepts reordered IDs and keeps the correct answer text under the correct_index ID", () => {
      const reorderedOptions = [
        { id: "d", text: "Đáp án đúng đã dịch" },
        { id: "a", text: "Lựa chọn A đã dịch" },
        { id: "b", text: "Lựa chọn B đã dịch" },
        { id: "c", text: "Lựa chọn C đã dịch" },
      ];
      const translated = translation(reorderedOptions);

      expect(() => validateLessonTranslation(sourceRecord, translated, "ko")).not.toThrow();

      const localeData = buildLessonLocaleData(sourceRecord, translated, "course-123", "ko", (md) => md);
      const questionCopy = Object.values(localeData.question_copy as Record<string, { options: Record<string, string> }>)[0];
      const correctSourceOption = sourceRecord.draft.questions[0].options[sourceRecord.draft.questions[0].correct_index];

      expect(questionCopy.options).toEqual({
        d: "Đáp án đúng đã dịch",
        a: "Lựa chọn A đã dịch",
        b: "Lựa chọn B đã dịch",
        c: "Lựa chọn C đã dịch",
      });
      expect(questionCopy.options[correctSourceOption.id]).toBe("Đáp án đúng đã dịch");
    });

    it("rejects an option ID outside the source set", () => {
      expect(() => validateLessonTranslation(sourceRecord, translation([
        { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "e", text: "E" },
      ]), "ko")).toThrow("option IDs phải khớp tập nguồn");
    });

    it("rejects duplicate option IDs", () => {
      expect(() => validateLessonTranslation(sourceRecord, translation([
        { id: "a", text: "A1" }, { id: "a", text: "A2" }, { id: "b", text: "B" }, { id: "c", text: "C" },
      ]), "ko")).toThrow("option IDs phải khớp tập nguồn");
    });

    it("rejects a missing option", () => {
      expect(() => validateLessonTranslation(sourceRecord, translation([
        { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" },
      ]), "ko")).toThrow("số lựa chọn");
    });

    it("rejects English text left in quiz questions, explanations, and options", () => {
      const valid = translation([
        { id: "a", text: "Lựa chọn A" }, { id: "b", text: "Lựa chọn B" },
        { id: "c", text: "Lựa chọn C" }, { id: "d", text: "Đáp án đúng" },
      ]);
      const baseQuestion = valid.quiz!.questions[0];
      const leakedQuestion: TranslatedLesson = { ...valid, quiz: { questions: [{ ...baseQuestion, question: "Câu hỏi with phần còn lại" }] } };
      const leakedExplanation: TranslatedLesson = { ...valid, quiz: { questions: [{ ...baseQuestion, explanation: "Giải thích but còn sót" }] } };
      const leakedOption = translation([
        { id: "a", text: "Lựa chọn A" }, { id: "b", text: "Lựa chọn B" },
        { id: "c", text: "Lựa chọn C" }, { id: "d", text: "Đáp án and phần còn lại" },
      ]);
      expect(() => validateLessonTranslation(sourceRecord, leakedQuestion, "ko")).toThrow("còn chữ tiếng Anh");
      expect(() => validateLessonTranslation(sourceRecord, leakedExplanation, "ko")).toThrow("còn chữ tiếng Anh");
      expect(() => validateLessonTranslation(sourceRecord, leakedOption, "ko")).toThrow("còn chữ tiếng Anh");
    });
  });

  it("code_exercise: rejects when blanks (fill) or tests (edit) mismatch", () => {
    const fillRecord: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code 1",
          short_description: "Short",
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "fill",
            hints: ["Hint 1"],
            file: { path: "main.rs", starter_source: "let x = {{blank:b1}};" },
            reference_solution: "let x = 42;",
            blanks: [{ id: "b1", accepted_answers: ["42"], feedback: "Forty two" }],
          },
        },
        questions: [],
        diagrams: [],
      },
    };

    const validFill: TranslatedLesson = {
      title: "Bài code 1",
      short_description: "Mô tả",
      summary: "Tóm tắt",
      code: {
        instructions: "Đề bài đã dịch",
        hints: ["Gợi ý 1"],
        blanks: [{ id: "b1", feedback: "Số 42" }],
        tests: [],
      },
    };

    expect(() => validateLessonTranslation(fillRecord, validFill, "vi")).not.toThrow();
    expect(() => validateLessonTranslation(fillRecord, { ...validFill, code: { ...validFill.code!, blanks: [{ id: "wrong_id", feedback: "Feedback" }] } }, "vi"))
      .toThrow("thiếu blank b1");
    expect(() => validateLessonTranslation(fillRecord, { ...validFill, code: { ...validFill.code!, tests: [{ id: "t1", description: "D", failure_message: "F", hint: "H" }] } }, "vi"))
      .toThrow("số tests (1) không khớp nguồn (0)");

    const editRecord: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code 1",
          short_description: "Short",
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "edit",
            hints: ["Hint 2"],
            file: { path: "main.rs", starter_source: "" },
            reference_solution: "fn solve() {}",
            tests: [{ id: "t1", description: "Has solve", required: true, type: "contains", value: "solve" }],
          },
        },
        questions: [],
        diagrams: [],
      },
    };

    const validEdit: TranslatedLesson = {
      title: "Bài code 1",
      short_description: "Mô tả",
      summary: "Tóm tắt",
      code: {
        instructions: "Đề bài đã dịch",
        hints: ["Gợi ý 2"],
        blanks: [],
        tests: [{ id: "t1", description: "Có hàm solve", failure_message: "Thiếu", hint: "Xem lại" }],
      },
    };

    expect(() => validateLessonTranslation(editRecord, validEdit, "vi")).not.toThrow();
    expect(() => validateLessonTranslation(editRecord, { ...validEdit, code: { ...validEdit.code!, tests: [] } }, "vi"))
      .toThrow("số tests (0) không khớp nguồn (1)");
    expect(() => validateLessonTranslation(editRecord, { ...validEdit, code: { ...validEdit.code!, tests: [{ id: "wrong", description: "D", failure_message: "F", hint: "H" }] } }, "vi"))
      .toThrow("thiếu test t1");
  });

  it("practice & video: rejects when code block in markdown is altered (V-28)", () => {
    const pracSource: LessonRecord = {
      lessonId: "l-prac",
      source_ids: ["s1"],
      draft: {
        lesson: { id: "l-prac", lesson_format: "practice", title: "Practice", short_description: "Short", description_markdown: "Run: ```bash\ncargo build\n```" },
        questions: [],
        diagrams: [],
      },
    };
    const validPrac: TranslatedLesson = {
      title: "Thực hành",
      short_description: "Ngắn",
      summary: "Tóm tắt",
      practice: { description_markdown: "Chạy lệnh: ```bash\ncargo build\n```" },
    };
    expect(() => validateLessonTranslation(pracSource, validPrac, "vi")).not.toThrow();
    expect(() => validateLessonTranslation(pracSource, { ...validPrac, practice: { description_markdown: "Chạy lệnh but còn sót ```bash\ncargo build\n```" } }, "vi")).toThrow("còn chữ tiếng Anh");

    const badPrac: TranslatedLesson = {
      ...validPrac,
      practice: { description_markdown: "Chạy lệnh: ```bash\ncargo run\n```" },
    };
    expect(() => validateLessonTranslation(pracSource, badPrac, "vi")).toThrow("bị sửa đổi");

    const vidSource: LessonRecord = {
      lessonId: "l-vid",
      source_ids: ["s1"],
      draft: {
        lesson: { id: "l-vid", lesson_format: "video", title: "Video", short_description: "Short", description_markdown: "Code: ```rust\nfn foo() {}\n```" },
        questions: [],
        diagrams: [],
      },
    };
    const validVid: TranslatedLesson = {
      title: "Video",
      short_description: "Ngắn",
      summary: "Tóm tắt",
      video: { description_markdown: "Mã: ```rust\nfn foo() {}\n```" },
    };
    expect(() => validateLessonTranslation(vidSource, validVid, "vi")).not.toThrow();
    expect(() => validateLessonTranslation(vidSource, { ...validVid, video: { description_markdown: "Mục tiêu with phần chưa dịch ```rust\nfn foo() {}\n```" } }, "vi")).toThrow("còn chữ tiếng Anh");

    const badVid: TranslatedLesson = {
      ...validVid,
      video: { description_markdown: "Mã: ```rust\nfn bar() {}\n```" },
    };
    expect(() => validateLessonTranslation(vidSource, badVid, "vi")).toThrow("bị sửa đổi");
  });

  it("code_exercise: checks code blocks in instructions and hints, and English leaks (V-28)", () => {
    const codeSource: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code",
          short_description: "Short",
          code_exercise_locale: { instructions: "Overarching ```rust\nlet a = 1;\n```" },
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "fill",
            hints: ["Hint ```code```"],
            file: { path: "main.rs", starter_source: "let {{blank:b1}} = 1;" },
            reference_solution: "let a = 1;",
            blanks: [{ id: "b1", accepted_answers: ["a"], feedback: "Feedback" }],
          },
        },
        questions: [],
        diagrams: [],
      },
    };

    const validCode: TranslatedLesson = {
      title: "Code",
      short_description: "Ngắn",
      summary: "Tóm tắt",
      code: {
        instructions: "Đề bài chung ```rust\nlet a = 1;\n```",
        hints: ["Gợi ý ```code```"],
        blanks: [{ id: "b1", feedback: "Phản hồi" }],
        tests: [],
      },
    };
    expect(() => validateLessonTranslation(codeSource, validCode, "vi")).not.toThrow();

    const leakedCodeFields: TranslatedLesson[] = [
      { ...validCode, code: { ...validCode.code!, instructions: "Đề bài but còn sót" } },
      { ...validCode, code: { ...validCode.code!, hints: ["Gợi ý with phần chưa dịch"] } },
      { ...validCode, code: { ...validCode.code!, blanks: [{ id: "b1", feedback: "Phản hồi but còn sót" }] } },
    ];
    for (const leaked of leakedCodeFields) expect(() => validateLessonTranslation(codeSource, leaked, "vi")).toThrow("còn chữ tiếng Anh");

    // Code block trong instructions bị đổi nội dung
    const alteredBlock: TranslatedLesson = { ...validCode, code: { ...validCode.code!, instructions: "Đề bài chung ```rust\nlet a = 2;\n```" } };
    expect(() => validateLessonTranslation(codeSource, alteredBlock, "vi")).toThrow("code instructions");
  });

  it("article: checks diagram edges integrity (V-28)", () => {
    const artSource: LessonRecord = {
      lessonId: "l-art",
      source_ids: ["s1"],
      draft: {
        lesson: { id: "l-art", lesson_format: "article", title: "Article", short_description: "Short", description_markdown: "![d](diagram:d1)" },
        questions: [],
        diagrams: [{
          id: "d1",
          title: "Title",
          alt: "Alt",
          nodes: [{ id: "n1", label: "A" }, { id: "n2", label: "B" }],
          edges: [{ from: "n1", to: "n2", label: "edge 1" }],
        }],
      },
    };

    const validArt: TranslatedLesson = {
      title: "Bài đọc",
      short_description: "Ngắn",
      summary: "Tóm tắt",
      article: {
        description_markdown: "![d](diagram:d1)",
        diagrams: [{
          id: "d1",
          title: "Tiêu đề",
          alt: "Mô tả",
          nodes: [{ id: "n1", label: "A dịch" }, { id: "n2", label: "B dịch" }],
          edges: [{ from: "n1", to: "n2", label: "cạnh 1" }],
        }],
      },
    };
    expect(() => validateLessonTranslation(artSource, validArt, "vi")).not.toThrow();

    const leakedDiagram: TranslatedLesson = {
      ...validArt,
      article: {
        ...validArt.article!,
        diagrams: [{ ...validArt.article!.diagrams[0], title: "Tiêu đề but thiếu dịch" }],
      },
    };
    expect(() => validateLessonTranslation(artSource, leakedDiagram, "vi")).toThrow("còn chữ tiếng Anh");

    const leakedNode: TranslatedLesson = {
      ...validArt,
      article: {
        ...validArt.article!,
        diagrams: [{ ...validArt.article!.diagrams[0], nodes: [{ id: "n1", label: "Nút and còn sót" }, validArt.article!.diagrams[0].nodes[1]] }],
      },
    };
    expect(() => validateLessonTranslation(artSource, leakedNode, "vi")).toThrow("còn chữ tiếng Anh");

    // Edge from/to bị đổi
    const badEdge: TranslatedLesson = {
      ...validArt,
      article: {
        ...validArt.article!,
        diagrams: [{
          ...validArt.article!.diagrams[0],
          edges: [{ from: "n2", to: "n1", label: "cạnh 1" }],
        }],
      },
    };
    expect(() => validateLessonTranslation(artSource, badEdge, "vi")).toThrow("from/to không khớp");
  });

});

describe("translate: buildLessonLocaleData shape guard compliance", () => {
  it("produces data conforming to learning_content_shape_guard without forbidden machine configs", () => {
    const sourceRecord: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code 1",
          short_description: "Short",
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "fill",
            file: { path: "main.rs", starter_source: "let {{blank:b1}} = 1;" },
            reference_solution: "let x = 1;",
            hints: ["H1"],
            blanks: [{ id: "b1", accepted_answers: ["1"], feedback: "F1" }],
          },
        },
        questions: [],
        diagrams: [],
      },
    };

    const translated: TranslatedLesson = {
      title: "Bài code",
      short_description: "Mô tả",
      summary: "Tóm tắt",
      code: {
        instructions: "Đề bài chung",
        hints: ["H1 dịch"],
        blanks: [{ id: "b1", feedback: "F1" }],
        tests: [],
      },
    };

    const mockPublishMd = (md: string, _c: string, _l: string, _loc: string) => md;
    const data = buildLessonLocaleData(sourceRecord, translated, "course-123", "vi", mockPublishMd);

    expect(data.title).toBe("Bài code");
    expect(data.short_description).toBe("Mô tả");
    expect(data.code_exercise_locale).toEqual({
      instructions: "Đề bài chung",
      hints: ["H1 dịch"],
      blank_feedback: { b1: "F1" },
      test_copy: {},
    });

    // BẮT BUỘC KHÔNG ĐƯỢC CHỨA CÁC TRƯỜNG BỊ CẤM BỞI TRIGGER
    expect(data).not.toHaveProperty("lesson_format");
    expect(data).not.toHaveProperty("quiz_config");
    expect(data).not.toHaveProperty("practice_config");
    expect(data).not.toHaveProperty("code_exercise_config");
    expect(data).not.toHaveProperty("published");
    expect(data).not.toHaveProperty("archived_at");
  });

  it("maps an edit exercise's tests to test_copy and leaves blank_feedback empty", () => {
    const sourceRecord: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code 2",
          short_description: "Short",
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "edit",
            file: { path: "main.rs", starter_source: "" },
            reference_solution: "fn solve() {}",
            tests: [{ id: "t1", description: "desc", required: true, type: "contains", value: "solve" }],
          },
        },
        questions: [],
        diagrams: [],
      },
    };
    const translated: TranslatedLesson = {
      title: "Bài code 2",
      short_description: "Mô tả",
      summary: "Tóm tắt",
      code: {
        instructions: "Đề bài",
        hints: [],
        blanks: [],
        tests: [{ id: "t1", description: "D1", failure_message: "M1", hint: "H1" }],
      },
    };
    const data = buildLessonLocaleData(sourceRecord, translated, "course-123", "vi", (md: string) => md);
    expect(data.code_exercise_locale).toEqual({
      instructions: "Đề bài",
      blank_feedback: {},
      test_copy: { t1: { description: "D1", failure_message: "M1", hint: "H1" } },
    });
  });
});

describe("V-25: code_exercise_locale instructions & course description parity", () => {
  it("buildLessonTranslateInput extracts shared instructions from code_exercise_locale", () => {
    const record: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code Lesson",
          short_description: "Short desc",
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "fill",
            file: { path: "main.rs", starter_source: "let {{blank:b1}} = 10;" },
            reference_solution: "let x = 10;",
            blanks: [{ id: "b1", accepted_answers: ["x"] }],
          },
          code_exercise_locale: {
            instructions: "Thực hành Rust với đề bài chung: ```rust\nlet x = 10;\n```",
          },
        },
        questions: [],
        diagrams: [],
      },
    };

    const input = buildLessonTranslateInput(record, "course-123", "vi");
    expect((input as any).code?.instructions).toBe("Thực hành Rust với đề bài chung: ```rust\nlet x = 10;\n```");
  });

  it("validateLessonTranslation rejects translation when shared instructions is missing or alters code block", () => {
    const record: LessonRecord = {
      lessonId: "l-code",
      source_ids: ["s1"],
      draft: {
        lesson: {
          id: "l-code",
          lesson_format: "code_exercise",
          title: "Code Lesson",
          short_description: "Short desc",
          code_exercise_config: {
            schema_version: 1,
            revision: 1,
            language: "rust",
            mode: "fill",
            file: { path: "main.rs", starter_source: "let {{blank:b1}} = 1;" },
            reference_solution: "let x = 1;",
            blanks: [{ id: "b1", accepted_answers: ["x"], feedback: "Fb" }],
          },
          code_exercise_locale: {
            instructions: "Đề bài chung: ```rust\nfn foo() {}\n```",
          },
        },
        questions: [],
        diagrams: [],
      },
    };

    const validTranslation: TranslatedLesson = {
      title: "Bài học code",
      short_description: "Mô tả ngắn",
      summary: "Tóm tắt",
      code: {
        instructions: "Đề bài dịch: ```rust\nfn foo() {}\n```",
        hints: [],
        blanks: [{ id: "b1", feedback: "Phản hồi" }],
        tests: [],
      },
    };

    expect(() => validateLessonTranslation(record, validTranslation, "vi")).not.toThrow();

    // 1. Thiếu instructions chung
    const missingInstructions: TranslatedLesson = {
      ...validTranslation,
      code: {
        ...validTranslation.code!,
        instructions: "   ",
      },
    };
    expect(() => validateLessonTranslation(record, missingInstructions, "vi")).toThrow("thiếu instructions của bài code");

    // 2. Sửa code block trong instructions chung
    const alteredCodeBlock: TranslatedLesson = {
      ...validTranslation,
      code: {
        ...validTranslation.code!,
        instructions: "Đề bài dịch: ```rust\nfn bar() {}\n```",
      },
    };
    expect(() => validateLessonTranslation(record, alteredCodeBlock, "vi")).toThrow("bị sửa đổi");
  });

  it("canonicalCourseDescription and canonicalCourseShortDescription parity across translate input and publish", () => {
    const brief = { topic: "Sui Move Advanced", audience: "Web3 Developers" };
    expect(canonicalCourseShortDescription(brief)).toBe("Sui Move Advanced");
    expect(canonicalCourseDescription(brief)).toBe("Sui Move Advanced. Web3 Developers");

    const input = buildCourseTranslateInput("Sui Move Course", brief, { outcomes: [], modules: [] }, "vi");
    expect(input.course.short_description).toBe(canonicalCourseShortDescription(brief));
    expect(input.course.description).toBe(canonicalCourseDescription(brief));
  });
});

describe("translate: English leak check (V-38, V-42)", () => {
  it("flags an English function word left inside a Vietnamese sentence", () => {
    expect(findEnglishLeaks("Trình biên dịch phát hiện—not chỉ là lỗi cú pháp.")).toEqual(["not"]);
    expect(findEnglishLeaks("Lỗi này là lỗi kiểu, with thông báo ngắn.")).toEqual(["with"]);
  });

  it("lists every match in order, not only the first", () => {
    expect(findEnglishLeaks("Trình biên dịch—not chỉ là lỗi, and the cách sửa.")).toEqual(["not", "and", "the"]);
  });

  it("keeps proper names written in capitals, including connectors inside the name", () => {
    expect(findEnglishLeaks("Đọc The Rust Book để hiểu ownership.")).toEqual([]);
    expect(findEnglishLeaks("Xem The Graph và Rust and Cargo trong bài.")).toEqual([]);
    expect(findEnglishLeaks("Học Ownership and Borrowing trước.")).toEqual([]);
  });

  it("still flags a lowercase connector that is not between two capitalised words", () => {
    expect(findEnglishLeaks("Học Rust with cargo trước.")).toEqual(["with"]);
    expect(findEnglishLeaks("Lỗi sign-and-send khác và tùy chọn read-only.")).toEqual([]);
  });

  it("ignores code blocks, inline code, URLs, link targets and blank markers", () => {
    const md = [
      "Dùng `not` và `the` trong code.",
      "```rust\nlet not = true; // with the\n```",
      "Xem https://doc.rust-lang.org/the/and/index.html để đọc thêm.",
      "![sơ đồ](diagram:the-and-flow)",
      "Điền {{blank:not_the_one}} vào chỗ trống.",
    ].join("\n");
    expect(findEnglishLeaks(md)).toEqual([]);
  });

  it("ignores identifiers written in plain text outside inline code", () => {
    expect(findEnglishLeaks("Gọi from() hoặc is_empty() rồi x.from để đổi kiểu.")).toEqual([]);
    expect(findEnglishLeaks("Hàm and_then và isEmpty xử lý Option.")).toEqual([]);
  });

  it("keeps fixed technical terms such as Not Found", () => {
    expect(findEnglishLeaks("Máy chủ trả về 404 Not Found khi đường dẫn sai.")).toEqual([]);
  });

  it("does not flag valid Vietnamese or Spanish prose", () => {
    expect(findEnglishLeaks("Bài học này giải thích kiểu dữ liệu và ownership trong Rust.")).toEqual([]);
    expect(findEnglishLeaks("Esta lección explica cómo funciona el préstamo de valores en Rust.")).toEqual([]);
    expect(findEnglishLeaks("Este módulo no trata de errores; sólo muestra cómo leer el mensaje.")).toEqual([]);
  });

  it("rejects a lesson translation that still contains an English word in its article", () => {
    const record = {
      draft: {
        lesson: { id: "l1", lesson_format: "article", description_markdown: "Nội dung" },
        diagrams: [],
        questions: [],
      },
    } as unknown as LessonRecord;
    const translated = {
      title: "Bài 1",
      short_description: "Mô tả",
      article: { description_markdown: "Trình biên dịch phát hiện—not chỉ là lỗi cú pháp.", diagrams: [] },
    } as unknown as TranslatedLesson;
    expect(() => validateLessonTranslation(record, translated, "vi")).toThrow(TranslationIntegrityError);
  });
});

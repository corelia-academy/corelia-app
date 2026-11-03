
export function canonicalCourseDescription(brief: { topic: string; audience: string }): string {
  return `${brief.topic}. ${brief.audience}`;
}

export function canonicalCourseShortDescription(brief: { topic: string }): string {
  return brief.topic;
}

// Step `translate`: Translates course canonical content from English (en) into all 6 supported
// target locales (zh-CN, ko, es, zh-TW, vi, ja) using Agent A7 (a7-translate@v1).
// Every translation is strictly code-verified for structural integrity before being accepted.

import type { LessonRecord } from "./checks.ts";
import type { Diagram, DiagramNode, DiagramEdge } from "./diagram.ts";

export const TRANSLATION_LOCALES = ["zh-CN", "ko", "es", "zh-TW", "vi", "ja"] as const;
export type TranslationLocale = typeof TRANSLATION_LOCALES[number];

export class TranslationIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationIntegrityError";
  }
}

/**
 * Sinh ID câu hỏi ổn định và duy nhất toàn cầu dựa trên courseId, lessonId và chỉ số câu hỏi.
 * Ngăn ngừa xung đột khóa chính trên bảng course_section_questions khi hai khóa có cùng lessonId.
 */
export function stableQuestionId(courseId: string, lessonId: string, index: number): string {
  return `${courseId}-${lessonId}-q${index + 1}`;
}

/** Tách các khối code ```...``` để đối chiếu bất biến. */
export function extractCodeBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const re = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    blocks.push(match[0].trim());
  }
  return blocks;
}

/** Kiểm tra các khối code được bảo toàn 100%. */
export function assertCodeBlocksPreserved(
  srcText: string,
  transText: string,
  context: string,
  locale: TranslationLocale,
): void {
  const srcBlocks = extractCodeBlocks(srcText);
  const transBlocks = extractCodeBlocks(transText);
  if (srcBlocks.length !== transBlocks.length) {
    throw new TranslationIntegrityError(`[${locale}] ${context}: số lượng code block (${transBlocks.length}) không khớp nguồn (${srcBlocks.length})`);
  }
  for (let i = 0; i < srcBlocks.length; i++) {
    if (srcBlocks[i] !== transBlocks[i]) {
      throw new TranslationIntegrityError(`[${locale}] ${context}: khối code thứ ${i + 1} bị sửa đổi trong bản dịch`);
    }
  }
}

/** Tách các ID sơ đồ được tham chiếu dạng ![...](diagram:<id>). */
export function extractDiagramReferences(markdown: string): string[] {
  const ids: string[] = [];
  const re = /!\[[^\]]*\]\(diagram:([^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

export interface TranslatedCourse {
  title: string;
  short_description: string;
  description: string;
  learning_outcomes: string[];
}

export interface TranslatedSection {
  id: string;
  title: string;
  description: string;
}

export interface TranslatedDiagram {
  id: string;
  title: string;
  alt: string;
  nodes: { id: string; label: string }[];
  edges?: { from: string; to: string; label?: string }[];
}

export interface TranslatedLesson {
  title: string;
  short_description: string;
  summary: string;
  article?: {
    description_markdown: string;
    diagrams: TranslatedDiagram[];
  } | null;
  quiz?: {
    questions: {
      id?: string;
      question: string;
      explanation: string;
      options: { id: string; text: string }[];
    }[];
  } | null;
  practice?: {
    description_markdown: string;
  } | null;
  video?: {
    description_markdown: string;
  } | null;
  /** blanks are translated for a fill exercise, tests for an edit exercise; the other list is empty. */
  code?: {
    instructions: string;
    hints: string[];
    blanks: { id: string; feedback: string }[];
    tests: { id: string; description: string; failure_message: string; hint: string }[];
  } | null;
}

export type CourseTranslationMap = Record<TranslationLocale, {
  course: TranslatedCourse;
  sections: Record<string, TranslatedSection>;
  lessons: Record<string, TranslatedLesson>;
}>;

/**
 * Từ chức năng tiếng Anh hay lọt vào câu dịch (ví dụ "phát hiện—not chỉ là"). Danh sách hẹp: chỉ các
 * từ không phải từ thông dụng của tiếng Việt, tiếng Tây Ban Nha hay tiếng Trung/Nhật/Hàn ở dạng Latin.
 * Từ nối bằng gạch nối là một phần của thuật ngữ ("sign-and-send"), không tính.
 */
const ENGLISH_LEAK_WORDS = ["and", "are", "but", "from", "is", "just", "not", "only", "that", "the", "this", "with"];
const LEAK_WORD = new RegExp(`(?<![\\w.:]|\\w-)(?:${ENGLISH_LEAK_WORDS.join("|")})(?!\\w|-\\w|\\s*\\(|::|\\.\\w)`, "g");
/** Từ chức năng viết thường nằm giữa hai từ viết hoa là một phần tên riêng ("Rust and Cargo"), không tính là lọt chữ. */
const NAME_CONNECTOR = new RegExp(`(\\b[A-Z][\\w+#.-]*)\\s+(?:${ENGLISH_LEAK_WORDS.join("|")})\\s+(?=[A-Z])`, "g");

/** Văn bản thuần để kiểm tra: bỏ code block, inline code, URL, link target, marker sơ đồ/chỗ trống và tên riêng nối bằng từ chức năng. */
function proseOnly(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\]\([^)]*\)/g, "] ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\{\{blank:[^}]*\}\}/g, " ")
    .replace(NAME_CONNECTOR, "$1 ");
}

/** Mọi từ tiếng Anh lọt vào văn bản dịch, theo thứ tự xuất hiện. Mảng rỗng khi văn bản không còn chữ Anh. */
export function findEnglishLeaks(text: string): string[] {
  return proseOnly(text).match(LEAK_WORD) ?? [];
}

function assertNoEnglishLeak(text: string, context: string, locale: TranslationLocale): void {
  const words = [...new Set(findEnglishLeaks(text))];
  if (words.length > 0) {
    throw new TranslationIntegrityError(`[${locale}] ${context}: còn chữ tiếng Anh "${words.join('", "')}" trong bản dịch`);
  }
}

/** Kiểm tra toàn vẹn bản dịch khóa. */
export function validateCourseTranslation(source: TranslatedCourse, translated: TranslatedCourse, locale: TranslationLocale): void {
  if (!translated.title?.trim()) throw new TranslationIntegrityError(`[${locale}] Tiêu đề khóa học không được rỗng`);
  assertNoEnglishLeak(`${translated.title} ${translated.short_description ?? ""} ${translated.description ?? ""}`, "Khóa học", locale);
  for (const outcome of translated.learning_outcomes ?? []) assertNoEnglishLeak(outcome, "Learning outcome", locale);
  if (!translated.short_description?.trim()) throw new TranslationIntegrityError(`[${locale}] Mô tả ngắn khóa học không được rỗng`);
  if (!translated.description?.trim()) throw new TranslationIntegrityError(`[${locale}] Mô tả khóa học không được rỗng`);
  if (!Array.isArray(translated.learning_outcomes) || translated.learning_outcomes.length !== source.learning_outcomes.length) {
    throw new TranslationIntegrityError(`[${locale}] Số lượng learning outcomes (${translated.learning_outcomes?.length ?? 0}) không khớp nguồn (${source.learning_outcomes.length})`);
  }
  for (let i = 0; i < translated.learning_outcomes.length; i++) {
    if (!translated.learning_outcomes[i]?.trim()) {
      throw new TranslationIntegrityError(`[${locale}] Learning outcome ${i + 1} không được rỗng`);
    }
  }
}

/** Kiểm tra toàn vẹn bản dịch section. */
export function validateSectionTranslation(source: TranslatedSection, translated: TranslatedSection, locale: TranslationLocale): void {
  if (!translated.title?.trim()) throw new TranslationIntegrityError(`[${locale}] Section ${source.id}: tiêu đề không được rỗng`);
  if (!translated.description?.trim()) throw new TranslationIntegrityError(`[${locale}] Section ${source.id}: mô tả không được rỗng`);
  assertNoEnglishLeak(`${translated.title} ${translated.description}`, `Section ${source.id}`, locale);
}

/** Kiểm tra toàn vẹn bản dịch lesson theo đúng yêu cầu handoff Mục E. */
export function validateLessonTranslation(
  sourceRecord: LessonRecord,
  translated: TranslatedLesson,
  locale: TranslationLocale,
): void {
  const format = sourceRecord.draft.lesson.lesson_format;
  if (!translated.title?.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: tiêu đề không được rỗng`);
  if (!translated.short_description?.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: mô tả ngắn không được rỗng`);
  if ((sourceRecord.draft.lesson as any).summary && !translated.summary?.trim()) {
    throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: tóm tắt (summary) không được rỗng`);
  }
  const lessonLabel = `Lesson ${sourceRecord.draft.lesson.id}`;
  assertNoEnglishLeak(`${translated.title} ${translated.short_description} ${translated.summary ?? ""}`, lessonLabel, locale);
  if (format === "article") assertNoEnglishLeak(translated.article?.description_markdown ?? "", `${lessonLabel} article`, locale);
  if (format === "quiz") {
    for (const [qIndex, question] of (translated.quiz?.questions ?? []).entries()) {
      assertNoEnglishLeak(`${question.question ?? ""} ${question.explanation ?? ""}`, `${lessonLabel} question ${qIndex + 1}`, locale);
      for (const option of question.options ?? []) assertNoEnglishLeak(option.text ?? "", `${lessonLabel} question ${qIndex + 1} option ${option.id}`, locale);
    }
  }
  if (format === "practice") assertNoEnglishLeak(translated.practice?.description_markdown ?? "", `${lessonLabel} practice`, locale);
  if (format === "video") assertNoEnglishLeak(translated.video?.description_markdown ?? "", `${lessonLabel} video`, locale);
  if (format === "code_exercise") {
    const code = translated.code;
    assertNoEnglishLeak(code?.instructions ?? "", `${lessonLabel} code instructions`, locale);
    for (const [hintIndex, hint] of (code?.hints ?? []).entries()) assertNoEnglishLeak(hint, `${lessonLabel} hint ${hintIndex + 1}`, locale);
    for (const blank of code?.blanks ?? []) assertNoEnglishLeak(blank.feedback ?? "", `${lessonLabel} blank ${blank.id} feedback`, locale);
    for (const test of code?.tests ?? []) {
      assertNoEnglishLeak(test.description ?? "", `${lessonLabel} test ${test.id} description`, locale);
      assertNoEnglishLeak(test.failure_message ?? "", `${lessonLabel} test ${test.id} failure message`, locale);
      assertNoEnglishLeak(test.hint ?? "", `${lessonLabel} test ${test.id} hint`, locale);
    }
  }

  // 1. Article
  if (format === "article") {
    const srcArticle = sourceRecord.draft.lesson.description_markdown ?? "";
    const transArticle = translated.article?.description_markdown ?? "";
    if (!transArticle.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: bài article thiếu description_markdown`);

    // Invariant: code blocks phải giữ nguyên 100%
    assertCodeBlocksPreserved(srcArticle, transArticle, `Lesson ${sourceRecord.draft.lesson.id} article`, locale);

    // Invariant: diagram references giữ nguyên diagram id
    const srcDiagramRefs = extractDiagramReferences(srcArticle);
    const transDiagramRefs = extractDiagramReferences(transArticle);
    if (srcDiagramRefs.sort().join(",") !== transDiagramRefs.sort().join(",")) {
      throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: tham chiếu sơ đồ trong markdown không khớp nguồn`);
    }

    // Diagrams integrity
    const srcDiagrams = sourceRecord.draft.diagrams;
    const transDiagrams = translated.article?.diagrams ?? [];
    if (srcDiagrams.length !== transDiagrams.length) {
      throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: số lượng diagrams (${transDiagrams.length}) không khớp nguồn (${srcDiagrams.length})`);
    }
    for (let i = 0; i < srcDiagrams.length; i++) {
      const sd = srcDiagrams[i];
      const td = transDiagrams.find((d) => d.id === sd.id);
      if (!td) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: thiếu sơ đồ ${sd.id}`);
      if (!td.alt?.trim()) throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}: alt text không được rỗng`);
      assertNoEnglishLeak(`${td.title ?? ""} ${td.alt}`, `${lessonLabel} diagram ${sd.id}`, locale);
      if (sd.nodes.length !== td.nodes.length) {
        throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}: số node (${td.nodes.length}) không khớp nguồn (${sd.nodes.length})`);
      }
      for (const sn of sd.nodes) {
        const tn = td.nodes.find((n) => n.id === sn.id);
        if (!tn) throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}: thiếu node ${sn.id}`);
        if (!tn.label?.trim()) throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}, node ${sn.id}: label không được rỗng`);
        assertNoEnglishLeak(tn.label, `${lessonLabel} diagram ${sd.id} node ${sn.id}`, locale);
      }
      const srcEdges = sd.edges ?? [];
      const tdEdges = td.edges ?? [];
      if (srcEdges.length !== tdEdges.length) {
        throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}: số edge (${tdEdges.length}) không khớp nguồn (${srcEdges.length})`);
      }
      for (let eIdx = 0; eIdx < srcEdges.length; eIdx++) {
        const se = srcEdges[eIdx];
        const te = tdEdges[eIdx];
        if (se.from !== te.from || se.to !== te.to) {
          throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}, edge ${eIdx + 1}: from/to không khớp nguồn (${se.from}->${se.to} vs ${te.from}->${te.to})`);
        }
        if (se.label && !te.label?.trim()) {
          throw new TranslationIntegrityError(`[${locale}] Sơ đồ ${sd.id}, edge ${eIdx + 1}: label không được rỗng`);
        }
        if (te.label) assertNoEnglishLeak(te.label, `${lessonLabel} diagram ${sd.id} edge ${eIdx + 1}`, locale);
      }
    }
  }

  // 2. Quiz
  if (format === "quiz") {
    const srcQuestions = sourceRecord.draft.questions;
    const transQuestions = translated.quiz?.questions ?? [];
    if (srcQuestions.length !== transQuestions.length) {
      throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: số lượng câu hỏi (${transQuestions.length}) không khớp nguồn (${srcQuestions.length})`);
    }
    for (let i = 0; i < srcQuestions.length; i++) {
      const sq = srcQuestions[i];
      const tq = transQuestions[i];
      if (!tq.question?.trim()) throw new TranslationIntegrityError(`[${locale}] Câu hỏi ${i + 1}: nội dung câu hỏi không được rỗng`);
      if (!tq.explanation?.trim()) throw new TranslationIntegrityError(`[${locale}] Câu hỏi ${i + 1}: giải thích không được rỗng`);
      if (!Array.isArray(tq.options) || tq.options.length !== sq.options.length) {
        throw new TranslationIntegrityError(`[${locale}] Câu hỏi ${i + 1}: số lựa chọn (${tq.options?.length ?? 0}) không khớp nguồn (${sq.options.length})`);
      }
      const srcOptionIds = sq.options.map((o) => o.id);
      const transOptionIds = tq.options.map((o) => o.id);
      const srcOptionIdSet = new Set(srcOptionIds);
      const transOptionIdSet = new Set(transOptionIds);
      if (
        srcOptionIdSet.size !== srcOptionIds.length ||
        transOptionIdSet.size !== transOptionIds.length ||
        srcOptionIdSet.size !== transOptionIdSet.size ||
        [...srcOptionIdSet].some((id) => !transOptionIdSet.has(id))
      ) {
        throw new TranslationIntegrityError(`[${locale}] Câu hỏi ${i + 1}: option IDs phải khớp tập nguồn, không được thiếu, thừa hoặc trùng`);
      }
      for (const opt of tq.options) {
        if (!opt.text?.trim()) throw new TranslationIntegrityError(`[${locale}] Câu hỏi ${i + 1}, lựa chọn ${opt.id}: nội dung không được rỗng`);
      }
    }
  }

  // 3. Practice
  if (format === "practice") {
    const srcPractice = sourceRecord.draft.lesson.description_markdown ?? "";
    const transPractice = translated.practice?.description_markdown ?? "";
    if (!transPractice.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: practice thiếu description_markdown`);
    assertCodeBlocksPreserved(srcPractice, transPractice, `Lesson ${sourceRecord.draft.lesson.id} practice`, locale);
  }

  // 4. Video
  if (format === "video") {
    const srcVideo = sourceRecord.draft.lesson.description_markdown ?? "";
    const transVideo = translated.video?.description_markdown ?? "";
    if (!transVideo.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: video thiếu description_markdown`);
    assertCodeBlocksPreserved(srcVideo, transVideo, `Lesson ${sourceRecord.draft.lesson.id} video`, locale);
  }

  // 5. Code Exercise (một kiểu: fill hoặc edit)
  if (format === "code_exercise") {
    const codeCfg = sourceRecord.draft.lesson.code_exercise_config;
    if (codeCfg) {
      const transCode = translated.code;
      if (!transCode) throw new TranslationIntegrityError(`[${locale}] Lesson ${sourceRecord.draft.lesson.id}: thiếu khối code trong bản dịch`);
      const lessonId = sourceRecord.draft.lesson.id;

      const sourceInstructions = sourceRecord.draft.lesson.code_exercise_locale?.instructions;
      if (sourceInstructions) {
        if (!transCode.instructions?.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: thiếu instructions của bài code`);
        assertCodeBlocksPreserved(sourceInstructions, transCode.instructions, `Lesson ${lessonId} code instructions`, locale);
      }

      const srcHints = codeCfg.hints ?? [];
      const transHints = transCode.hints ?? [];
      if (srcHints.length !== transHints.length) {
        throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: số hints (${transHints.length}) không khớp nguồn (${srcHints.length})`);
      }
      srcHints.forEach((srcHint, i) => {
        if (!transHints[i]?.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: hint ${i + 1} không được rỗng`);
        assertCodeBlocksPreserved(srcHint, transHints[i], `Lesson ${lessonId} hint ${i + 1}`, locale);
      });

      const srcBlanks = codeCfg.mode === "fill" ? codeCfg.blanks : [];
      const transBlanks = transCode.blanks ?? [];
      if (transBlanks.length !== srcBlanks.length) {
        throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: số blanks (${transBlanks.length}) không khớp nguồn (${srcBlanks.length})`);
      }
      for (const sb of srcBlanks) {
        const tb = transBlanks.find((b) => b.id === sb.id);
        if (!tb) throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: thiếu blank ${sb.id}`);
        if (!tb.feedback?.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: blank ${sb.id} thiếu feedback`);
      }

      const srcTests = codeCfg.mode === "edit" ? codeCfg.tests : [];
      const transTests = transCode.tests ?? [];
      if (transTests.length !== srcTests.length) {
        throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: số tests (${transTests.length}) không khớp nguồn (${srcTests.length})`);
      }
      for (const st of srcTests) {
        const tt = transTests.find((t) => t.id === st.id);
        if (!tt) throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: thiếu test ${st.id}`);
        if (!tt.description?.trim()) throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: test ${st.id} thiếu description`);
        if (st.failure_message && !tt.failure_message?.trim()) {
          throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: test ${st.id} thiếu failure_message`);
        }
        if (st.hint && !tt.hint?.trim()) {
          throw new TranslationIntegrityError(`[${locale}] Lesson ${lessonId}: test ${st.id} thiếu hint`);
        }
      }
    }
  }
}

/** Đóng gói dữ liệu course_lesson_locales.data tuân thủ trigger learning_content_shape_guard. */
export function buildLessonLocaleData(
  sourceRecord: LessonRecord,
  translated: TranslatedLesson,
  courseId: string,
  locale: TranslationLocale,
  publishMarkdownFn: (md: string, cId: string, lId: string, loc: string) => string,
): Record<string, unknown> {
  const format = sourceRecord.draft.lesson.lesson_format;
  const result: Record<string, unknown> = {
    title: translated.title,
    short_description: translated.short_description,
    updated_at: new Date().toISOString(),
  };

  if (format === "article" && translated.article) {
    result.description_markdown = publishMarkdownFn(
      translated.article.description_markdown,
      courseId,
      sourceRecord.draft.lesson.id,
      locale,
    );
  } else if (format === "practice" && translated.practice) {
    result.description_markdown = translated.practice.description_markdown;
  } else if (format === "video" && translated.video) {
    result.description_markdown = translated.video.description_markdown;
    if (sourceRecord.draft.lesson.youtube_url) {
      result.youtube_url = sourceRecord.draft.lesson.youtube_url;
      result.youtube_start_seconds = sourceRecord.draft.lesson.youtube_start_seconds ?? 0;
      result.youtube_end_seconds = sourceRecord.draft.lesson.youtube_end_seconds ?? null;
    }
  } else if (format === "quiz" && translated.quiz) {
    const questionCopy: Record<string, unknown> = {};
    translated.quiz.questions.forEach((q, idx) => {
      const qId = stableQuestionId(courseId, sourceRecord.draft.lesson.id, idx);
      questionCopy[qId] = {
        question: q.question,
        explanation: q.explanation,
        options: Object.fromEntries(q.options.map((o) => [o.id, o.text])),
      };
    });
    result.question_copy = questionCopy;
  } else if (format === "code_exercise" && translated.code) {
    result.code_exercise_locale = {
      instructions: translated.code.instructions,
      ...(translated.code.hints.length ? { hints: translated.code.hints } : {}),
      blank_feedback: Object.fromEntries(translated.code.blanks.map((b) => [b.id, b.feedback])),
      test_copy: Object.fromEntries(
        translated.code.tests.map((t) => [t.id, { description: t.description, failure_message: t.failure_message, hint: t.hint }]),
      ),
    };
  }

  // Đảm bảo TUYỆT ĐỐI không vi phạm learning_content_shape_guard
  delete result.lesson_format;
  delete result.quiz_config;
  delete result.practice_config;
  delete result.code_exercise_config;
  delete result.published;
  delete result.archived_at;

  return result;
}


const schemaStr = { type: "string" };
const schemaStrList = { type: "array", items: schemaStr };
function schemaObj(properties: Record<string, unknown>, required = Object.keys(properties)): Record<string, unknown> {
  return { type: "object", additionalProperties: false, required, properties };
}

export const TRANSLATE_COURSE_SCHEMA = schemaObj({
  course: schemaObj({
    title: schemaStr,
    short_description: schemaStr,
    description: schemaStr,
    learning_outcomes: schemaStrList,
  }),
  sections: {
    type: "array",
    items: schemaObj({
      id: schemaStr,
      title: schemaStr,
      description: schemaStr,
    }),
  },
});

export const TRANSLATE_ARTICLE_SCHEMA = schemaObj({
  title: schemaStr,
  short_description: schemaStr,
  summary: schemaStr,
  article: schemaObj({
    description_markdown: schemaStr,
    diagrams: {
      type: "array",
      items: schemaObj({
        id: schemaStr,
        title: schemaStr,
        alt: schemaStr,
        nodes: {
          type: "array",
          items: schemaObj({ id: schemaStr, label: schemaStr }),
        },
        edges: {
          type: "array",
          items: schemaObj({ from: schemaStr, to: schemaStr, label: schemaStr }),
        },
      }),
    },
  }),
});

export const TRANSLATE_QUIZ_SCHEMA = schemaObj({
  title: schemaStr,
  short_description: schemaStr,
  summary: schemaStr,
  quiz: schemaObj({
    questions: {
      type: "array",
      items: schemaObj({
        id: schemaStr,
        question: schemaStr,
        explanation: schemaStr,
        options: {
          type: "array",
          items: schemaObj({ id: schemaStr, text: schemaStr }),
        },
      }),
    },
  }),
});

export const TRANSLATE_CODE_SCHEMA = schemaObj({
  title: schemaStr,
  short_description: schemaStr,
  summary: schemaStr,
  code: schemaObj({
    instructions: schemaStr,
    hints: schemaStrList,
    blanks: {
      type: "array",
      items: schemaObj({ id: schemaStr, feedback: schemaStr }),
    },
    tests: {
      type: "array",
      items: schemaObj({
        id: schemaStr,
        description: schemaStr,
        failure_message: schemaStr,
        hint: schemaStr,
      }),
    },
  }),
});

export const TRANSLATE_PRACTICE_SCHEMA = schemaObj({
  title: schemaStr,
  short_description: schemaStr,
  summary: schemaStr,
  practice: schemaObj({
    description_markdown: schemaStr,
  }),
});

export const TRANSLATE_VIDEO_SCHEMA = schemaObj({
  title: schemaStr,
  short_description: schemaStr,
  summary: schemaStr,
  video: schemaObj({
    description_markdown: schemaStr,
  }),
});

export function getTranslateSchemaForFormat(format?: string): Record<string, unknown> {
  switch (format) {
    case "article": return TRANSLATE_ARTICLE_SCHEMA;
    case "quiz": return TRANSLATE_QUIZ_SCHEMA;
    case "code_exercise": return TRANSLATE_CODE_SCHEMA;
    case "practice": return TRANSLATE_PRACTICE_SCHEMA;
    case "video": return TRANSLATE_VIDEO_SCHEMA;
    default: return TRANSLATE_COURSE_SCHEMA;
  }
}


export function buildCourseTranslateInput(courseTitle: string, brief: any, curriculum: any, locale: TranslationLocale) {
  return {
    target_locale: locale,
    course: {
      title: courseTitle,
      short_description: canonicalCourseShortDescription(brief),
      description: canonicalCourseDescription(brief),
      learning_outcomes: (curriculum.outcomes || []).map((o: any) => o.text),
    },
    sections: (curriculum.modules || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.description,
    })),
  };
}

export function buildLessonTranslateInput(record: LessonRecord, courseId: string, locale: TranslationLocale) {
  const d = record.draft;
  const l = d.lesson;
  const format = l.lesson_format;

  const base: Record<string, unknown> = {
    target_locale: locale,
    id: l.id,
    format,
    title: l.title,
    short_description: l.short_description || "",
    summary: (l as any).summary || (d as any).summary || "",
  };

  if (format === "article") {
    base.article = {
      description_markdown: l.description_markdown || "",
      diagrams: (d.diagrams || []).map((diag) => ({
        id: diag.id,
        title: diag.title,
        alt: diag.alt,
        nodes: (diag.nodes || []).map((n) => ({ id: n.id, label: n.label })),
        edges: (diag.edges || []).map((e) => ({ from: e.from, to: e.to, label: e.label || "" })),
      })),
    };
  } else if (format === "quiz") {
    base.quiz = {
      questions: (d.questions || []).map((q, idx) => ({
        id: stableQuestionId(courseId, l.id, idx),
        question: q.question,
        explanation: q.explanation,
        options: (q.options || []).map((o) => ({ id: o.id, text: o.text })),
      })),
    };
  } else if (format === "code_exercise") {
    const cfg = l.code_exercise_config as any;
    base.code = {
      instructions: l.code_exercise_locale?.instructions || "",
      hints: cfg?.hints || [],
      blanks: (cfg?.blanks || []).map((b: any) => ({ id: b.id, feedback: b.feedback || "" })),
      tests: (cfg?.tests || []).map((t: any) => ({
        id: t.id,
        description: t.description,
        failure_message: t.failure_message || "",
        hint: t.hint || "",
      })),
    };
  } else if (format === "practice") {
    base.practice = {
      description_markdown: l.description_markdown || "",
    };
  } else if (format === "video") {
    base.video = {
      description_markdown: l.description_markdown || "",
    };
  }

  return base;
}

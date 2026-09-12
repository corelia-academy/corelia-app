import { beforeEach, expect, it, vi } from "vitest";
import { supabase } from "./supabase";
import { setSectionQuestions } from "./sectionQuestions";
vi.mock("./supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
it("replaces a section set through one RPC and preserves supplied IDs", async () => {
  const question = { id: "stable-id", type: "mcq" as const, question: "Which?", options: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }], correct_index: 0 };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ id: question.id, course_id: "course", section_id: "section", sort_order: 0, data: question }], error: null } as never);
  const result = await setSectionQuestions("course", "section", [question], "vi");
  expect(supabase.rpc).toHaveBeenCalledWith("learning_save_section_questions", { p_course: "course", p_section: "section", p_questions: [question], p_locale: "vi" });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(result[0]).toMatchObject({ id: "stable-id", order: 0, question: "Which?", options: question.options });
});
it("propagates transaction errors without a fallback delete or insert", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "QUESTION_SCOPE_MISMATCH" } } as never);
  await expect(setSectionQuestions("course", "section", [], "en")).rejects.toThrow("QUESTION_SCOPE_MISMATCH");
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.from).not.toHaveBeenCalled();
});

const canonical = { id: "question-1", course_id: "course", section_id: null, lesson_id: "lesson", sort_order: 0,
  data: { type: "mcq" as const, question: "Câu gốc", options: [{ id: "first", text: "Một" }, { id: "second", text: "Hai" }], correct_index: 1 } };
function mockLessonData() {
  const tables: string[] = [];
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    tables.push(table);
    const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), single: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [canonical], error: null });
    query.single.mockResolvedValue({ data: table === "courses" ? { data: { i18n: { primary_content_locale: "vi" } } }
      : { id: "lesson", course_id: "course", section_id: "section", published: false, sort_order: 0, data: { lesson_format: "quiz", title: "Quiz" } }, error: null });
    query.maybeSingle.mockResolvedValue({ data: { data: { question_copy: { "question-1": { question: "English question", options: { first: "First" } } } } }, error: null });
    return query as unknown as ReturnType<typeof supabase.from>;
  });
  return tables;
}

it("overlays localized text by stable IDs and falls back without changing scoring", async () => {
  mockLessonData();
  const { getLessonQuestions } = await import("./sectionQuestions");
  const questions = await getLessonQuestions("course", "lesson", "en");
  expect(questions[0]).toMatchObject({ id: "question-1", question: "English question", correct_index: 1,
    options: [{ id: "first", text: "First" }, { id: "second", text: "Hai" }] });
});
it("saves a translation without replacing canonical question rows", async () => {
  mockLessonData();
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  const { setLessonQuestions } = await import("./sectionQuestions");
  await setLessonQuestions("course", "lesson", [{ ...canonical.data, id: canonical.id, question: "Translated" }], "en");
  expect(supabase.rpc).toHaveBeenCalledWith("learning_save_lesson", expect.objectContaining({
    p_questions: null, p_locales: { en: { question_copy: { "question-1": { question: "Translated", explanation: undefined, options: { first: "Một", second: "Hai" } } } } },
  }));
});
it("rejects a translated payload that changes canonical scoring before mutation", async () => {
  mockLessonData();
  const { setLessonQuestions } = await import("./sectionQuestions");
  await expect(setLessonQuestions("course", "lesson", [{ ...canonical.data, id: canonical.id, correct_index: 0 }], "en")).rejects.toThrow("preserve");
  expect(supabase.rpc).not.toHaveBeenCalled();
});

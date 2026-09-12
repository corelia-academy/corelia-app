// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { QuestionGeneratorDialog } from "./QuestionGeneratorDialog";
import { setSectionQuestions } from "@/lib/sectionQuestions";
import type { CourseSection, SupportedCourseLocale } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/questionGenerator", () => ({ invokeGenerateQuestions: vi.fn() }));
vi.mock("@/lib/sectionQuestions", () => ({ setSectionQuestions: vi.fn(), setLessonQuestions: vi.fn() }));
vi.mock("@/features/courses/instructorCourseEditorQueries", () => ({ instructorCourseQuestionsQueryOptions: ({ locale }: { locale: string }) => ({ queryKey: ["questions", locale], queryFn: async () => [], staleTime: Infinity }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

it("keeps a late question Save in its original locale cache and does not close the new context", async () => {
  const question = (id: string) => ({ id, type: "mcq", question: id, correct_index: 0, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] });
  const client = new QueryClient();
  client.setQueryData(["questions", "vi"], [question("Vietnamese")]);
  client.setQueryData(["questions", "en"], [question("English")]);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const onOpenChange = vi.fn();
  cleanup = () => { act(() => root.unmount()); host.remove(); client.clear(); };
  const render = async (locale: SupportedCourseLocale) => {
    await act(async () => root.render(<QueryClientProvider client={client}><QuestionGeneratorDialog
      open courseId="course" userId="owner" locale={locale} section={{ id: "section", title: "Section" } as CourseSection} onOpenChange={onOpenChange}
    /></QueryClientProvider>));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  };
  let resolve!: (value: Awaited<ReturnType<typeof setSectionQuestions>>) => void;
  vi.mocked(setSectionQuestions).mockReturnValue(new Promise(done => { resolve = done; }));
  await render("vi");
  const save = [...document.querySelectorAll("button")].find(button => button.textContent === "courseEdit.questions.saveCount")!;
  expect(save.disabled).toBe(false);
  await act(async () => save.click());
  expect(setSectionQuestions).toHaveBeenCalledWith("course", "section", expect.any(Array), "vi");
  await render("en");
  await act(async () => { resolve([question("Saved Vietnamese")] as never); });
  await act(async () => { await new Promise(done => setTimeout(done, 10)); });
  expect(client.getQueryData(["questions", "en"])).toEqual([question("English")]);
  expect(client.getQueryData(["questions", "vi"])).toEqual([question("Saved Vietnamese")]);
  expect(onOpenChange).not.toHaveBeenCalled();
});

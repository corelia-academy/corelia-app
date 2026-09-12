// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizLesson } from "./QuizLesson";
import { getLearningQuiz, submitLearningQuiz } from "@/lib/learning";
import type { LessonActionState } from "./types";
import type { SectionQuestion } from "@/types/questions";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/lib/learning", () => ({ getLearningQuiz: vi.fn(), submitLearningQuiz: vi.fn() }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "instructor" } }) }));
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key, i18n: { language: "vi" } }) }));

const question = (text: string): SectionQuestion & { explanation: string } => ({
  id: "question", course_id: "course", section_id: "section", type: "mcq", explanation: "Explanation",
  question: text, options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], correct_index: 0, order: 0,
});
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllMocks(); });

describe("quiz preview", () => {
  it("loads the selected content locale without learner attempts and switches languages", async () => {
    vi.mocked(getLearningQuiz).mockImplementation(async (_course, _lesson, _user, locale) => ({ questions: [question(locale === "en" ? "English question" : "Câu hỏi tiếng Việt")], result: null }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const container = document.createElement("div");
    const root = createRoot(container);
    cleanups.push(() => { act(() => root.unmount()); client.clear(); });
    const onAction = vi.fn();
    const render = async (locale: string) => {
      await act(async () => {
        root.render(<QueryClientProvider client={client}><QuizLesson courseId="course" lesson={{ id: "lesson", section_id: "section", title: "Quiz", duration_seconds: 0, order: 0 }} mode="preview" contentLocale={locale} completed={false} onComplete={vi.fn()} onAction={onAction} /></QueryClientProvider>);
      });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    };
    await render("en");
    expect(getLearningQuiz).toHaveBeenLastCalledWith("course", "lesson", undefined, "en", expect.any(AbortSignal));
    expect(container.textContent).toContain("English question");
    await render("vi");
    expect(getLearningQuiz).toHaveBeenLastCalledWith("course", "lesson", undefined, "vi", expect.any(AbortSignal));
    expect(container.textContent).toContain("Câu hỏi tiếng Việt");
    expect(submitLearningQuiz).not.toHaveBeenCalled();
  });

  it("checks unsaved questions locally without loading or submitting server state", async () => {
    const client = new QueryClient();
    const container = document.createElement("div");
    const root = createRoot(container);
    cleanups.push(() => { act(() => root.unmount()); client.clear(); });
    let action: LessonActionState | null = null;
    const onAction = (next: LessonActionState | null) => { action = next; };
    const onComplete = vi.fn();
    await act(async () => root.render(<QueryClientProvider client={client}><QuizLesson courseId="course" lesson={{ id: "lesson", section_id: "section", title: "Quiz", duration_seconds: 0, order: 0 }} mode="preview" contentLocale="en" questions={[question("Unsaved question")]} completed={false} onComplete={onComplete} onAction={onAction} /></QueryClientProvider>));
    act(() => (container.querySelector("input") as HTMLInputElement).click());
    await act(async () => { await action?.run(); });
    expect(container.textContent).toContain("learning.passed");
    expect(getLearningQuiz).not.toHaveBeenCalled();
    expect(submitLearningQuiz).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("quiz mutation recovery", () => {
  async function mount(onComplete = vi.fn<() => Promise<void>>().mockResolvedValue(undefined), allowRetry = false) {
    const client = new QueryClient();
    const container = document.createElement("div");
    const root = createRoot(container);
    cleanups.push(() => { act(() => root.unmount()); client.clear(); });
    let action: LessonActionState | null = null;
    const onAction = (next: LessonActionState | null) => { action = next; };
    await act(async () => root.render(<QueryClientProvider client={client}><QuizLesson courseId="course" lesson={{ id: "lesson", section_id: "section", title: "Quiz", duration_seconds: 0, order: 0, quiz_config: { allow_retry: allowRetry, passing_ratio: 0.7 } }} mode="learner" questions={[question("Question")]} completed={false} onComplete={onComplete} onAction={onAction} /></QueryClientProvider>));
    act(() => (container.querySelector("input") as HTMLInputElement).click());
    return { container, action: () => action, runTwice: async () => { await act(async () => { const run = action?.run; await Promise.all([run?.(), run?.()]); }); }, run: async () => { await act(async () => { await action?.run(); }); } };
  }

  it("retries only completion synchronization after a committed pass", async () => {
    vi.mocked(submitLearningQuiz).mockResolvedValue({ attempt_group_id: "committed", total: 1, correct: 1, passing_ratio: 0.7, passed: true, completed: true, attempts: [] });
    const onComplete = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("Progress synchronization failed")).mockResolvedValue(undefined);
    const ui = await mount(onComplete);
    await ui.run();
    expect(ui.container.textContent).toContain("Progress synchronization failed");
    expect((ui.container.querySelector("input") as HTMLInputElement).checked).toBe(true);
    await ui.run();
    expect(submitLearningQuiz).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(ui.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps the same request ID and answers when the submit response is lost", async () => {
    vi.mocked(submitLearningQuiz).mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValue({ attempt_group_id: "committed", total: 1, correct: 1, passing_ratio: 0.7, passed: true, completed: true, attempts: [] });
    const ui = await mount();
    await ui.run();
    expect(ui.container.textContent).toContain("Network unavailable");
    expect(ui.container.querySelector("fieldset")?.disabled).toBe(true);
    expect(ui.action()?.label).toBe("learning.retry");
    act(() => (ui.container.querySelectorAll("input")[1] as HTMLInputElement).click());
    expect((ui.container.querySelector("input") as HTMLInputElement).checked).toBe(true);
    await ui.run();
    const calls = vi.mocked(submitLearningQuiz).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[1][3]).toEqual({ question: 0 });
  });

  it("coalesces repeated action invocations before React updates pending state", async () => {
    vi.mocked(submitLearningQuiz).mockResolvedValue({ attempt_group_id: "committed", total: 1, correct: 1, passing_ratio: 0.7, passed: true, completed: true, attempts: [] });
    const onComplete = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const ui = await mount(onComplete);
    await ui.runTwice();
    expect(submitLearningQuiz).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("unlocks answers and creates a new request only when retrying a graded failure", async () => {
    vi.mocked(submitLearningQuiz).mockResolvedValue({ attempt_group_id: "failed", total: 1, correct: 0, passing_ratio: 0.7, passed: false, completed: false, attempts: [] });
    const ui = await mount(undefined, true);
    await ui.run();
    const firstRequest = vi.mocked(submitLearningQuiz).mock.calls[0][2];
    expect(ui.container.querySelector("fieldset")?.disabled).toBe(true);
    await ui.run();
    expect(ui.container.querySelector("fieldset")?.disabled).toBe(false);
    act(() => (ui.container.querySelectorAll("input")[1] as HTMLInputElement).click());
    await ui.run();
    expect(submitLearningQuiz).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitLearningQuiz).mock.calls[1][2]).not.toBe(firstRequest);
    expect(vi.mocked(submitLearningQuiz).mock.calls[1][3]).toEqual({ question: 1 });
  });
});

it("isolates answers between courses with the same legacy lesson ID", async () => {
  const client = new QueryClient();
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanups.push(() => { act(() => root.unmount()); client.clear(); });
  const render = (courseId: string) => act(() => root.render(<QueryClientProvider client={client}><QuizLesson courseId={courseId} lesson={{ id: "shared", section_id: "section", title: "Quiz", order: 0, duration_seconds: 0 }} mode="learner" questions={[question("Shared ID question")]} completed={false} onAction={vi.fn()} onComplete={vi.fn()} /></QueryClientProvider>));
  render("first");
  act(() => (container.querySelector("input") as HTMLInputElement).click());
  render("second");
  expect(Array.from(container.querySelectorAll("input")).every(input => !input.checked)).toBe(true);
  expect(submitLearningQuiz).not.toHaveBeenCalled();
});

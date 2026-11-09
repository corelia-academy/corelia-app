// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { QuizLesson } from "./QuizLesson";
import { getLearningQuiz } from "@/lib/learning";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/lib/learning", () => ({ getLearningQuiz: vi.fn(), submitLearningQuiz: vi.fn() }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "instructor" } }) }));
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key, i18n: { language: "vi" } }) }));

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllMocks(); });

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const host = document.createElement("div");
  const root = createRoot(host);
  cleanups.push(() => { act(() => root.unmount()); client.clear(); });
  await act(async () => {
    root.render(<QueryClientProvider client={client}><QuizLesson courseId="course" lesson={{ id: "lesson", section_id: "section", title: "Quiz", duration_seconds: 0, order: 0 }} mode="preview" contentLocale="vi" completed={false} onComplete={vi.fn()} onAction={vi.fn()} /></QueryClientProvider>);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  return host;
}

it("shows the lesson data error when the quiz has no questions", async () => {
  vi.mocked(getLearningQuiz).mockResolvedValue({ questions: [], result: null });
  const host = await mount();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("learning.lessonDataErrorTitle");
  expect(host.querySelector('[role="alert"] button')).toBeNull();
});

it("shows the lesson data error without any action when the quiz fails to load", async () => {
  vi.mocked(getLearningQuiz).mockRejectedValue(new Error("Network unavailable"));
  const host = await mount();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("learning.lessonDataErrorTitle");
  expect(host.querySelector('[role="alert"] button')).toBeNull();
});

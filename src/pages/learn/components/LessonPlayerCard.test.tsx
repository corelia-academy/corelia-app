// @vitest-environment happy-dom
import { act, useEffect, type ComponentProps } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LessonPlayerCard } from "./LessonPlayerCard";
import type { LessonRendererProps } from "@/features/learning/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const translate = (key: string) => key;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "learner" } }) }));
vi.mock("@/lib/xp", () => ({ getLessonXpState: vi.fn().mockResolvedValue({ lesson: false, quiz: false, course: false }) }));
const routeNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router", () => ({ useNavigate: () => routeNavigate }));
vi.mock("@/features/learning/LessonRenderer", () => ({ LessonRenderer: ({ lesson, onAction, onComplete }: LessonRendererProps) => {
  const title = lesson.title;
  useEffect(() => {
    const summary = title === "Scored" ? { correct: 2, total: 5 } : title === "Failed" ? { correct: 2, total: 5, passed: false } : title === "Passed" ? { correct: 5, total: 5, passed: true } : undefined;
    onAction({ label: "Complete", run: onComplete, ...(summary ? { summary } : {}), ...(title === "HintCode" ? { hint: { items: ["Try mut"] } } : {}), ...(title === "CheckedCode" ? { checked: true } : {}) });
    return () => onAction(null);
  }, [onAction, onComplete, title]);
  return <div>Lesson content</div>;
} }));
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function TestCard(props: ComponentProps<typeof LessonPlayerCard>) { return <QueryClientProvider client={client}><LessonPlayerCard {...props} /></QueryClientProvider>; }
const lesson = { id: "shared-lesson", section_id: "section", title: "Article", lesson_format: "article" as const, order: 0, duration_seconds: 0 };
const props = { lesson, lessonIndex: 0, isDraftLesson: false, completed: false, hasFullCourseAccess: true, previousLesson: null, nextLesson: { ...lesson, id: "next" }, translate };
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

it("submits once and does not navigate when the old completion resolves after a course change", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let resolve!: () => void;
  const complete = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const navigate = vi.fn();
  act(() => root.render(<TestCard {...props} courseId="first" onMarkComplete={complete} onNavigateToLesson={navigate} />));
  const button = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Complete")!;
  act(() => { button.click(); button.click(); });
  expect(complete).toHaveBeenCalledOnce();
  act(() => root.render(<TestCard {...props} courseId="second" onMarkComplete={complete} onNavigateToLesson={navigate} />));
  await act(async () => resolve());
  expect(navigate).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Complete");
  expect(host.textContent).not.toContain("learning.saving");
});

it.each(["article", "quiz"] as const)("puts the %s footer in the lesson column", format => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(
    <TestCard {...props} lesson={{ ...lesson, lesson_format: format }} courseId="c" onMarkComplete={vi.fn()} onNavigateToLesson={vi.fn()} actionSlot={document.createElement("div")} />,
  ));
  expect(host.querySelectorAll("[data-lesson-column]")).toHaveLength(1);
});

it("keeps a failed completion on the same lesson and clears its error for another course", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const complete = vi.fn().mockRejectedValue(new Error("Progress unavailable"));
  const navigate = vi.fn();
  act(() => root.render(<TestCard {...props} courseId="first" onMarkComplete={complete} onNavigateToLesson={navigate} />));
  await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Complete")!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Progress unavailable");
  expect(navigate).not.toHaveBeenCalled();
  act(() => root.render(<TestCard {...props} courseId="second" onMarkComplete={complete} onNavigateToLesson={navigate} />));
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("waits for completion and its cache refresh before navigating on the active lesson", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let resolve!: () => void;
  const complete = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const navigate = vi.fn();
  act(() => root.render(<TestCard {...props} courseId="first" onMarkComplete={complete} onNavigateToLesson={navigate} />));
  act(() => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Complete")!.click());
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(navigate).toHaveBeenCalledExactlyOnceWith("next");
});

it("marks a completed lesson incomplete without navigating and blocks duplicate requests", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let resolve!: () => void;
  const reset = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const navigate = vi.fn();
  act(() => root.render(<TestCard {...props} completed courseId="course" onMarkComplete={vi.fn()} onReset={reset} onNavigateToLesson={navigate} />));
  const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent === "learning.markIncomplete")!;
  act(() => { button.click(); button.click(); });
  expect(reset).toHaveBeenCalledExactlyOnceWith(false);
  expect(button.disabled).toBe(true);
  await act(async () => resolve());
  expect(navigate).not.toHaveBeenCalled();
});

it("does not offer progress reset for an unavailable lesson", () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const reset = vi.fn();
  act(() => root.render(<TestCard {...props} completed isDraftLesson courseId="course" onMarkComplete={vi.fn()} onReset={reset} onNavigateToLesson={vi.fn()} />));
  expect(host.textContent).not.toContain("learning.markIncomplete");
  act(() => root.render(<TestCard {...props} completed hasFullCourseAccess={false} courseId="course" onMarkComplete={vi.fn()} onReset={reset} onNavigateToLesson={vi.fn()} />));
  expect(host.textContent).not.toContain("learning.markIncomplete");
});


it("opens the final assignment route after the last completed lesson", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const markComplete = vi.fn();
  act(() => root.render(<TestCard {...props} completed hasFinalAssignment nextLesson={null} courseId="course" onMarkComplete={markComplete} onNavigateToLesson={vi.fn()} />));
  await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "learning.finalAssignmentLink")!.click());
  expect(routeNavigate).toHaveBeenCalledWith("/study/course/final-assignment");
  expect(markComplete).not.toHaveBeenCalled();
});

it("uses the floating bar as a complete/incomplete toggle without a next-lesson button", async () => {
  const host = document.createElement("div"), slot = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const complete = vi.fn().mockResolvedValue(undefined);
  const reset = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn();
  act(() => root.render(<TestCard {...props} courseId="course" actionSlot={slot} onMarkComplete={complete} onReset={reset} onNavigateToLesson={navigate} />));
  const toggle = slot.querySelector("button")!;
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await act(async () => toggle.click());
  expect(complete).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  act(() => root.render(<TestCard {...props} completed courseId="course" actionSlot={slot} onMarkComplete={complete} onReset={reset} onNavigateToLesson={navigate} />));
  expect(slot.querySelectorAll("button")).toHaveLength(1);
  const incompleteToggle = slot.querySelector("button")!;
  // The full label stays the accessible name; a short one is shown below the sm breakpoint.
  expect(incompleteToggle.getAttribute("aria-label")).toBe("learning.markIncomplete");
  expect(incompleteToggle.querySelector('[class~="max-sm:hidden"]')?.textContent).toBe("learning.markIncomplete");
  expect(incompleteToggle.querySelector('[class~="sm:hidden"]')?.textContent).toBe("learning.markIncompleteShort");
  expect(slot.textContent).not.toContain("learning.next");
  await act(async () => slot.querySelector("button")!.click());
  expect(reset).toHaveBeenCalledExactlyOnceWith(false);
  expect(navigate).not.toHaveBeenCalled();
});

it("puts the quiz score in its own slot when the footer offers one", () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const askAi = document.createElement("div"), summary = document.createElement("div");
  act(() => root.render(
    <TestCard {...props} lesson={{ ...lesson, title: "Scored", lesson_format: "quiz" }} courseId="c" onMarkComplete={vi.fn()} onNavigateToLesson={vi.fn()}
      actionSlot={document.createElement("div")} askAiSlot={askAi} summarySlot={summary} />,
  ));
  expect(summary.textContent).toContain("learning.quizAchieveLead");
  expect(askAi.textContent).not.toContain("learning.quizAchieveLead");
});

it("keeps the quiz score next to Ask AI when the footer has no score slot", () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const askAi = document.createElement("div");
  act(() => root.render(
    <TestCard {...props} lesson={{ ...lesson, title: "Scored", lesson_format: "quiz" }} courseId="c" onMarkComplete={vi.fn()} onNavigateToLesson={vi.fn()}
      actionSlot={document.createElement("div")} askAiSlot={askAi} />,
  ));
  expect(askAi.textContent).toContain("learning.quizAchieveLead");
});

it.each([
  ["a quiz that has no result yet", "quiz", "Scored", false],
  ["a quiz that was not passed", "quiz", "Failed", true],
  ["a quiz that was passed", "quiz", "Passed", true],
  ["an article", "article", "Article", true],
] as const)("puts Ask AI in the footer for %s: %s", (_label, format, title, expected) => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const askAi = document.createElement("div");
  act(() => root.render(
    <TestCard {...props} lesson={{ ...lesson, title, lesson_format: format }} courseId="c" onMarkComplete={vi.fn()} onNavigateToLesson={vi.fn()}
      actionSlot={document.createElement("div")} askAiSlot={askAi} />,
  ));
  expect(askAi.querySelector('button[aria-label="learning.askAi.trigger"]') !== null).toBe(expected);
});

function renderCode(title: string) {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const askAi = document.createElement("div");
  act(() => root.render(
    <TestCard {...props} lesson={{ ...lesson, title, lesson_format: "code_exercise" }} courseId="c" onMarkComplete={vi.fn()} onNavigateToLesson={vi.fn()}
      actionSlot={document.createElement("div")} askAiSlot={askAi} />,
  ));
  const hint = () => askAi.querySelector<HTMLElement>('[data-slot="tooltip-trigger"]');
  const askAiButton = () => askAi.querySelector('button[aria-label="learning.askAi.trigger"]');
  return { hint, askAiButton };
}

it("puts Hint in the footer of a code exercise with no result, instead of Ask AI, as a hover tooltip", () => {
  const { hint, askAiButton } = renderCode("HintCode");
  expect(hint()).toBeDefined();
  expect(hint()!.textContent).toBe("learning.hints");
  expect(hint()!.getAttribute("aria-label")).toBe("learning.hints");
  // The project's tooltip trigger: it shows hints and has no button hover background.
  expect(hint()!.className).not.toContain("hover:bg");
  expect(askAiButton()).toBeNull();
});

it("swaps Hint for Ask AI once a code exercise has a result", () => {
  const { hint, askAiButton } = renderCode("CheckedCode");
  expect(hint()).toBeNull();
  expect(askAiButton()).not.toBeNull();
});

it("shows neither Hint nor Ask AI when a fresh code exercise offers no hint action", () => {
  const { hint, askAiButton } = renderCode("PlainCode");
  expect(hint()).toBeNull();
  expect(askAiButton()).toBeNull();
});

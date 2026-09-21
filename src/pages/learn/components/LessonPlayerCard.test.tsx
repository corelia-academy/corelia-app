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
vi.mock("@/features/learning/LessonRenderer", () => ({ LessonRenderer: ({ onAction, onComplete }: LessonRendererProps) => {
  useEffect(() => { onAction({ label: "Complete", run: onComplete }); return () => onAction(null); }, [onAction, onComplete]);
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
  expect(routeNavigate).toHaveBeenCalledWith("/learn/course/final-assignment");
  expect(markComplete).not.toHaveBeenCalled();
});

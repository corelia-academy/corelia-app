// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CodeExerciseLesson } from "./CodeExerciseLesson";
import { defaultCodeConfig } from "./config";
import { codeDraftKey } from "./drafts";
import { recordLearningEvent } from "@/lib/learning";
import type { LessonActionState, LessonRendererProps } from "@/features/learning/types";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const translate = (key: string) => key;
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: translate }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "learner" } }) }));
vi.mock("@/lib/learning", () => ({ recordLearningEvent: vi.fn() }));
const props: LessonRendererProps = { courseId: "course", mode: "learner", completed: false, onComplete: vi.fn(), onAction: vi.fn(), lesson: { id: "lesson", section_id: "section", title: "Fill", order: 0, duration_seconds: 0, code_exercise_config: defaultCodeConfig() } };
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); localStorage.clear(); vi.clearAllMocks(); });

it("warns instead of grading when a blank is empty", async () => {
  Element.prototype.scrollIntoView = vi.fn();
  const host = document.createElement("div"), root = createRoot(host);
  document.body.append(host);
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  act(() => root.render(<CodeExerciseLesson {...props} />));
  await act(async () => host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
  expect(recordLearningEvent).not.toHaveBeenCalled();
  expect(props.onComplete).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("learning.codeFillAll");
  expect(document.activeElement).toBe(host.querySelector("input"));
});

it("checks a wrong fill only once, locks the answers, and keeps them on retry", async () => {
  localStorage.setItem(codeDraftKey("learner", "course", "lesson", 1), JSON.stringify({ mode: "fill", answers: { mutable: "wrong" }, updated_at: "2026-09-11T00:00:00Z" }));
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let action: LessonActionState | null = null;
  act(() => root.render(<CodeExerciseLesson {...props} onAction={next => { action = next; }} />));
  expect(action!.summary).toBeUndefined();
  await act(async () => host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
  expect(recordLearningEvent).toHaveBeenCalledExactlyOnceWith("course", "lesson", "code_exercise_checked", false);
  expect(props.onComplete).not.toHaveBeenCalled();
  expect(host.querySelector("input")!.readOnly).toBe(true);
  expect(action!.label).toBe("learning.retry");
  expect(host.querySelector('[data-slot="explanation-box"]')?.getAttribute("data-status")).toBe("incorrect");
  await act(async () => { await action!.run(); });
  expect(host.querySelector("input")!.readOnly).toBe(false);
  expect(host.querySelector("input")!.value).toBe("wrong");
  expect(host.querySelector('[data-slot="explanation-box"]')).toBeNull();
  expect(action!.label).toBe("learning.checkCode");
  expect(recordLearningEvent).toHaveBeenCalledOnce();
});

it("unlocks the answers and keeps them when the lesson is marked undone", async () => {
  localStorage.setItem(codeDraftKey("learner", "course", "lesson", 1), JSON.stringify({ mode: "fill", answers: { mutable: "mut" }, updated_at: "2026-09-11T00:00:00Z" }));
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let action: LessonActionState | null = null;
  const render = (resetEpoch: number) => act(() => root.render(<CodeExerciseLesson {...props} resetEpoch={resetEpoch} onAction={next => { action = next; }} />));
  render(0);
  await act(async () => { await action!.run(); });
  expect(host.querySelector("input")!.readOnly).toBe(true);
  expect(host.querySelector('[data-slot="explanation-box"]')?.getAttribute("data-status")).toBe("correct");
  render(1);
  expect(host.querySelector("input")!.readOnly).toBe(false);
  expect(host.querySelector("input")!.value).toBe("mut");
  expect(host.querySelector('[data-slot="explanation-box"]')).toBeNull();
});

it("locks duplicate checks while completion saves without losing the answer", async () => {
  localStorage.setItem(codeDraftKey("learner", "course", "lesson", 1), JSON.stringify({ mode: "fill", answers: { mutable: "mut" }, updated_at: "2026-09-11T00:00:00Z" }));
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let resolve!: () => void;
  const complete = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  let action: LessonActionState | null = null;
  act(() => root.render(<CodeExerciseLesson {...props} onComplete={complete} onAction={next => { action = next; }} />));
  const run = action!.run;
  act(() => { void run(); void run(); });
  expect(complete).toHaveBeenCalledOnce();
  expect(recordLearningEvent).toHaveBeenCalledOnce();
  expect(host.querySelector("input")!.disabled).toBe(true);
  expect(host.querySelector("input")!.value).toBe("mut");
  await act(async () => resolve());
  expect(host.querySelector("input")!.disabled).toBe(false);
});

it("retries only completion after a passed check, then locks the answers", async () => {
  localStorage.setItem(codeDraftKey("learner", "course", "lesson", 1), JSON.stringify({ mode: "fill", answers: { mutable: "mut" }, updated_at: "2026-09-11T00:00:00Z" }));
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const complete = vi.fn().mockRejectedValue(new Error("Offline"));
  let action: LessonActionState | null = null;
  act(() => root.render(<CodeExerciseLesson {...props} onComplete={complete} onAction={next => { action = next; }} />));
  await act(async () => { await action!.run(); });
  expect(action!.label).toBe("learning.retryProgress");
  expect(host.querySelector("input")!.value).toBe("mut");
  await act(async () => { await action!.run(); });
  expect(complete).toHaveBeenCalledTimes(2);
  expect(recordLearningEvent).toHaveBeenCalledTimes(1);
  expect(host.querySelector("input")!.readOnly).toBe(true);
  expect(host.querySelector('canvas[data-testid="lesson-confetti"]')).not.toBeNull();
});

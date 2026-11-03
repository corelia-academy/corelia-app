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

it("checks a failed fill only once when Ctrl+Enter bubbles from the input", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<CodeExerciseLesson {...props} />));
  await act(async () => host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
  expect(recordLearningEvent).toHaveBeenCalledExactlyOnceWith("course", "lesson", "code_exercise_checked", false);
  expect(props.onComplete).not.toHaveBeenCalled();
});

it("locks duplicate checks and reset while completion saves without losing the answer", async () => {
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
  const reset = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "learning.reset")!;
  expect(reset.disabled).toBe(true);
  expect(host.querySelector("input")!.value).toBe("mut");
  await act(async () => resolve());
  expect(host.querySelector("input")!.disabled).toBe(false);
  expect(reset.disabled).toBe(false);
});

it("retries only completion after a passed check, and requires rechecking edited answers", async () => {
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
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "wrong");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(action!.label).toBe("learning.checkCode");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => { await action!.run(); });
  expect(complete).toHaveBeenCalledTimes(2);
  expect(recordLearningEvent).toHaveBeenLastCalledWith("course", "lesson", "code_exercise_checked", false);
});

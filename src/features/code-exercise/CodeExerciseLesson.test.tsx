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

it("two_stage exercise requires both stages to pass before completion", async () => {
  const twoStageProps: LessonRendererProps = {
    ...props,
    lesson: {
      ...props.lesson,
      code_exercise_config: defaultCodeConfig("two_stage"),
    },
  };
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let action: LessonActionState | null = null;
  act(() => root.render(<CodeExerciseLesson {...twoStageProps} onAction={next => { action = next; }} />));

  // Stage 1 initial: fill answer is empty, check fails
  await act(async () => { await action!.run(); });
  expect(twoStageProps.onComplete).not.toHaveBeenCalled();

  // Fill correct answer for Stage 1: "mut"
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => { await action!.run(); });
  expect(twoStageProps.onComplete).not.toHaveBeenCalled();

  // Continue to Stage 2 button is present
  const continueBtn = Array.from(host.querySelectorAll("button")).find(b => b.textContent?.includes("learning.codeContinueToPart2"));
  expect(continueBtn).toBeDefined();
  act(() => continueBtn!.click());

  // In Stage 2, starter source does not pass test yet
  await act(async () => { await action!.run(); });
  expect(twoStageProps.onComplete).not.toHaveBeenCalled();

  // Change source in CodeEditor
  const textarea = host.querySelector("textarea")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "pub fn add(a: i32, b: i32) -> i32 { a + b }");
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => { await action!.run(); });

  // Now both stages passed, onComplete is called!
  expect(twoStageProps.onComplete).toHaveBeenCalledOnce();
});

it("V-09: renders feedback in Part 1 when check fails, and clears on answer edit", async () => {
  const twoStageConfig = defaultCodeConfig("two_stage");
  twoStageConfig.parts[0].blanks[0].feedback = "Remember: variables in Rust are immutable by default.";
  const twoStageProps: LessonRendererProps = {
    ...props,
    lesson: {
      ...props.lesson,
      code_exercise_config: twoStageConfig,
    },
  };
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let action: LessonActionState | null = null;
  act(() => root.render(<CodeExerciseLesson {...twoStageProps} onAction={next => { action = next; }} />));

  // Check with empty input -> check fails
  await act(async () => { await action!.run(); });

  // Feedback appears in aria-live container
  const ariaLive = host.querySelector('[aria-live="polite"]');
  expect(ariaLive).not.toBeNull();
  expect(ariaLive!.textContent).toContain("learning.failed");
  expect(ariaLive!.textContent).toContain("Remember: variables in Rust are immutable by default.");

  // Learner types in blank -> feedback clears
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "m");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(ariaLive!.textContent).toBe("");
});

it("V-11: invalidating Part 1 answer prevents completion even if Part 2 is passed", async () => {
  const complete = vi.fn();
  const twoStageProps: LessonRendererProps = {
    ...props,
    onComplete: complete,
    lesson: {
      ...props.lesson,
      code_exercise_config: defaultCodeConfig("two_stage"),
    },
  };
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  let action: LessonActionState | null = null;
  act(() => root.render(<CodeExerciseLesson {...twoStageProps} onAction={next => { action = next; }} />));

  // Pass Part 1
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => { await action!.run(); });

  // Switch to Part 2
  const part2Btn = Array.from(host.querySelectorAll("button")).find(b => b.textContent?.includes("learning.codePart2"));
  expect(part2Btn).toBeDefined();
  act(() => part2Btn!.click());

  // In Part 2, pass Part 2 solution
  const textarea = host.querySelector("textarea")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "pub fn add(a: i32, b: i32) -> i32 { a + b }");
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Switch back to Part 1 and corrupt answer
  const part1Btn = Array.from(host.querySelectorAll("button")).find(b => b.textContent?.includes("learning.codePart1"));
  act(() => part1Btn!.click());
  const input2 = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input2, "invalid");
    input2.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Switch to Part 2 and run check -> Must NOT complete because Part 1 is no longer passed!
  act(() => part2Btn!.click());
  await act(async () => { await action!.run(); });
  expect(complete).not.toHaveBeenCalled();
});

it("V-11: restoring draft with stage1_passed = true but incorrect answer locks Part 2", () => {
  // Fraudulent or stale draft: claims stage1_passed = true, but answers are wrong
  localStorage.setItem(codeDraftKey("learner", "course", "lesson", 1), JSON.stringify({
    mode: "two_stage",
    stage1_answers: { mutable: "wrong_answer" },
    stage2_source: "starter",
    active_stage: 2,
    stage1_passed: true,
    updated_at: "2026-09-11T00:00:00Z",
  }));

  const twoStageProps: LessonRendererProps = {
    ...props,
    lesson: {
      ...props.lesson,
      code_exercise_config: defaultCodeConfig("two_stage"),
    },
  };
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<CodeExerciseLesson {...twoStageProps} />));

  // Stage 2 button must be disabled / locked because actual answer evaluation fails
  const part2Btn = Array.from(host.querySelectorAll("button")).find(b => b.textContent?.includes("learning.codePart2"));
  expect(part2Btn).toBeDefined();
  expect(part2Btn!.disabled).toBe(true);
});

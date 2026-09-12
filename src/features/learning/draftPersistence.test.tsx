// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PracticeLesson } from "./PracticeLesson";
import { CodeExerciseLesson } from "@/features/code-exercise/CodeExerciseLesson";
import { defaultCodeConfig } from "@/features/code-exercise/config";
import type { LessonRendererProps } from "./types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const translate = (key: string) => key;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: translate }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/lib/learning", () => ({ recordLearningEvent: vi.fn() }));
vi.mock("@/components/markdown/Markdown", () => ({ Markdown: () => null }));
vi.mock("./PracticeHackathon", () => ({ PracticeHackathonLink: () => null }));
vi.mock("./PracticeProject", () => ({ PracticeProjectLink: () => null }));
const props: LessonRendererProps = {
  courseId: "course", mode: "learner", completed: false, onComplete: vi.fn(), onAction: vi.fn(),
  lesson: { id: "lesson", section_id: "section", title: "Practice", duration_seconds: 0, order: 0, practice_config: { mode: "checklist", revision: 1, checklist_items: [{ id: "step", label: "Run tests" }] } },
};
let cleanup: (() => void) | undefined;
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

it.each(["null", "[]", "false", "{broken", '{"checked":null,"artifacts":[]}'])("keeps practice usable with corrupt draft %s", draft => {
    localStorage.setItem("corelia:practice:user:course:lesson:1", draft);
    const container = document.createElement("div");
    const root = createRoot(container);
    cleanup = () => act(() => root.unmount());
    act(() => root.render(<PracticeLesson {...props} />));
    const checkbox = container.querySelector("input") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    act(() => checkbox.click());
    expect(checkbox.checked).toBe(true);
  });

it("ignores invalid artifact values while restoring valid checklist entries", () => {
  localStorage.setItem("corelia:practice:user:course:lesson:1", JSON.stringify({
    checked: { step: true }, artifacts: { notes: { bad: true }, github_url: 12 },
  }));
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onAction = vi.fn();
  act(() => root.render(<PracticeLesson {...props} onAction={onAction} lesson={{ ...props.lesson,
    practice_config: { ...props.lesson.practice_config!, submission_fields: ["notes", "github_url"] },
  }} />));
  expect((container.querySelector("input[type=checkbox]") as HTMLInputElement).checked).toBe(true);
  expect(onAction.mock.lastCall?.[0].disabled).toBe(true);
  expect(Array.from(container.querySelectorAll("input:not([type=checkbox])"), input => (input as HTMLInputElement).value)).toEqual(["", ""]);
});

it("keeps checklist interaction available when storage is denied and reports autosave failure", () => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => { throw new DOMException("denied", "SecurityError"); }),
    setItem: vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }),
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<PracticeLesson {...props} />));
  act(() => (container.querySelector("input") as HTMLInputElement).click());
  act(() => vi.advanceTimersByTime(350));
  expect((container.querySelector("input") as HTMLInputElement).checked).toBe(true);
  expect(container.querySelector('[role="status"]')?.textContent).toBe("learning.draftUnavailable");
});

it("flushes a checklist on pagehide before autosave has fired", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<PracticeLesson {...props} />));
  act(() => (container.querySelector("input") as HTMLInputElement).click());
  act(() => window.dispatchEvent(new Event("pagehide")));
  expect(JSON.parse(localStorage.getItem("corelia:practice:user:course:lesson:1")!)).toMatchObject({ checked: { step: true } });
});

it("isolates checklist state when courses share a legacy lesson ID", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<PracticeLesson {...props} />));
  act(() => (container.querySelector("input") as HTMLInputElement).click());
  act(() => root.render(<PracticeLesson {...props} courseId="another-course" />));
  expect((container.querySelector("input") as HTMLInputElement).checked).toBe(false);
  act(() => root.render(<PracticeLesson {...props} />));
  expect((container.querySelector("input") as HTMLInputElement).checked).toBe(true);
});

it("flushes a checklist when navigating immediately and restores it on remount", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<PracticeLesson {...props} />));
  act(() => (container.querySelector("input") as HTMLInputElement).click());
  act(() => root.render(null));
  act(() => root.render(<PracticeLesson {...props} />));
  expect((container.querySelector("input") as HTMLInputElement).checked).toBe(true);
});

it("does not persist preview drafts on pagehide or unmount", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<PracticeLesson {...props} mode="preview" />));
  act(() => (container.querySelector("input") as HTMLInputElement).click());
  act(() => window.dispatchEvent(new Event("pagehide")));
  act(() => root.unmount());
  expect(localStorage.length).toBe(0);
});

it("flushes the latest code answer on immediate navigation", () => {
  const config = defaultCodeConfig();
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<CodeExerciseLesson {...props} lesson={{ ...props.lesson, code_exercise_config: config }} />));
  const input = container.querySelector("input") as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => root.unmount());
  const draft = JSON.parse(localStorage.getItem(`corelia:code-exercise:user:course:lesson:${config.revision}`)!);
  expect(draft.mode).toBe(config.mode);
  expect(draft.answers).toEqual({ mutable: "mut" });
  expect(draft.updated_at).toEqual(expect.any(String));
});

it("isolates code answers across courses sharing a legacy lesson ID", () => {
  const config = defaultCodeConfig();
  const lesson = { ...props.lesson, code_exercise_config: config };
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<CodeExerciseLesson {...props} lesson={lesson} />));
  const input = container.querySelector("input") as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => root.render(<CodeExerciseLesson {...props} lesson={lesson} courseId="another-course" />));
  expect((container.querySelector("input") as HTMLInputElement).value).toBe("");
  act(() => root.render(<CodeExerciseLesson {...props} lesson={lesson} />));
  expect((container.querySelector("input") as HTMLInputElement).value).toBe("mut");
});

it("merges artifacts across practice lessons without replaying stale fields into the final form", async () => {
  localStorage.setItem("corelia:final-artifacts:user:course", JSON.stringify({ github_url: "https://github.com/example/cli", notes: "Old notes" }));
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onAction = vi.fn();
  const listener = vi.fn();
  window.addEventListener("learning:final-artifacts", listener);
  try {
    act(() => root.render(<PracticeLesson {...props} onAction={onAction} lesson={{ ...props.lesson,
      practice_config: { mode: "submission", revision: 1, submission_fields: ["notes"] },
    }} />));
    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "New project notes");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await onAction.mock.lastCall?.[0].run(); });
    expect(JSON.parse(localStorage.getItem("corelia:final-artifacts:user:course")!)).toEqual({ github_url: "https://github.com/example/cli", notes: "New project notes" });
    expect((listener.mock.lastCall?.[0] as CustomEvent).detail.artifacts).toEqual({ notes: "New project notes" });
  } finally { window.removeEventListener("learning:final-artifacts", listener); }
});

it.each(["learner", "preview"] as const)("handles storage denial during artifact handoff in %s mode", async mode => {
  const getItem = vi.fn(() => { throw new DOMException("denied"); });
  const setItem = vi.fn(() => { throw new DOMException("denied"); });
  vi.stubGlobal("localStorage", { getItem, setItem });
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onAction = vi.fn();
  const onComplete = vi.fn();
  const listener = vi.fn();
  window.addEventListener("learning:final-artifacts", listener);
  try {
    act(() => root.render(<PracticeLesson {...props} mode={mode} onAction={onAction} onComplete={onComplete} lesson={{ ...props.lesson,
      practice_config: { mode: "submission", revision: 1, submission_fields: ["notes"] },
    }} />));
    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Notes still in memory");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await onAction.mock.lastCall?.[0].run(); });
    if (mode === "learner") {
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect((listener.mock.lastCall?.[0] as CustomEvent).detail.artifacts).toEqual({ notes: "Notes still in memory" });
      expect(container.querySelector('[role="status"]')?.textContent).toBe("learning.draftUnavailable");
    } else {
      expect(onComplete).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
      expect(getItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
    }
  } finally { window.removeEventListener("learning:final-artifacts", listener); }
});

it("checks preview code without reading learner drafts, recording events, or completing lessons", async () => {
  const { recordLearningEvent } = await import("@/lib/learning");
  vi.mocked(recordLearningEvent).mockClear();
  const getItem = vi.fn();
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { getItem, setItem });
  const container = document.createElement("div");
  const root = createRoot(container);
  const onAction = vi.fn();
  const onComplete = vi.fn();
  act(() => root.render(<CodeExerciseLesson {...props} mode="preview" onAction={onAction} onComplete={onComplete} lesson={{ ...props.lesson, code_exercise_config: defaultCodeConfig() }} />));
  try {
    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await onAction.mock.lastCall?.[0].run(); });
    expect(container.textContent).toContain("learning.passed");
    act(() => window.dispatchEvent(new Event("pagehide")));
  } finally { act(() => root.unmount()); }
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
  expect(recordLearningEvent).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

it("keeps code usable and reports failed persistence when storage is blocked", async () => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => { throw new DOMException("denied", "SecurityError"); }),
    setItem: vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }),
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const complete = vi.fn();
  act(() => root.render(<CodeExerciseLesson {...props} onComplete={complete} lesson={{ ...props.lesson, code_exercise_config: defaultCodeConfig() }} />));
  const input = container.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(400);
  });
  act(() => vi.advanceTimersByTime(400));
  expect(container.querySelector('[role="status"]')?.textContent).toBe("learning.draftUnavailable");
  expect(input.value).toBe("mut");
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true })));
  expect(complete).toHaveBeenCalledOnce();
  expect(input.value).toBe("mut");
});

it("isolates code answers when the machine revision changes and restores the old revision", () => {
  const config = defaultCodeConfig();
  const lesson = { ...props.lesson, code_exercise_config: config };
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<CodeExerciseLesson {...props} lesson={lesson} />));
  const input = container.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "mut");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => root.render(<CodeExerciseLesson {...props} lesson={{ ...lesson, code_exercise_config: { ...config, revision: config.revision + 1 } }} />));
  expect(container.querySelector("input")!.value).toBe("");
  act(() => root.render(<CodeExerciseLesson {...props} lesson={lesson} />));
  expect(container.querySelector("input")!.value).toBe("mut");
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { LearnFooterMenu } from "./LearnFooterMenu";
import { AskAiMenu } from "./AskAiMenu";
import type { CourseLesson } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); document.body.innerHTML = ""; });

function open(props: Partial<React.ComponentProps<typeof LearnFooterMenu>> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const onNavigate = vi.fn(), onModeChange = vi.fn();
  act(() => root.render(<LearnFooterMenu mode="bar" previousLessonId="prev" nextLessonId="next" onNavigate={onNavigate} onModeChange={onModeChange} {...props} />));
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="learning.moreActions"]')!;
  act(() => {
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    trigger.click();
  });
  const items = () => Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]'));
  return { trigger, items, onNavigate, onModeChange };
}

it("labels the icon-only trigger", () => {
  const { trigger } = open();
  expect(trigger.getAttribute("aria-label")).toBe("learning.moreActions");
});

it("lists previous, next and the footer mode switch", () => {
  const { items } = open();
  expect(items().map(item => item.textContent)).toEqual(["learning.previous", "learning.next", "learning.footerToDock"]);
});

it("offers the way back to the pinned bar while docked", () => {
  const { items } = open({ mode: "dock" });
  expect(items().at(-1)?.textContent).toBe("learning.footerToBar");
});

it("disables a lesson move that has no target", () => {
  const { items } = open({ previousLessonId: null, nextLessonId: null });
  expect(items().slice(0, 2).every(item => item.hasAttribute("data-disabled"))).toBe(true);
});

it("reports the chosen lesson and mode", () => {
  const { items, onNavigate, onModeChange } = open();
  act(() => items()[1].click());
  expect(onNavigate).toHaveBeenCalledWith("next");
  expect(onModeChange).not.toHaveBeenCalled();
});

it("uses the project's list menu look and never scrolls sideways", () => {
  open();
  const content = document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')!;
  expect(content.getAttribute("data-layout")).toBe("multiple-list");
  expect(content.className).toContain("overflow-x-hidden");
  expect(content.className).not.toContain("overflow-x-auto");
  expect(content.className).toContain("w-52");
  expect(content.className).not.toContain("w-[296px]");
  expect(content.querySelector('[data-slot="dropdown-menu-list"]')).not.toBeNull();
});

it("gives the AI Summary menu the same list look, no sideways scroll, and a trailing icon per row", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  const lesson = { id: "l", section_id: "s", title: "Lesson", lesson_format: "article", description_markdown: "Body", order: 0, duration_seconds: 0 } as CourseLesson;
  act(() => root.render(<AskAiMenu lesson={lesson} courseTitle="Course" />));
  const trigger = host.querySelector<HTMLButtonElement>("button")!;
  act(() => {
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    trigger.click();
  });
  const content = document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')!;
  expect(content.getAttribute("data-layout")).toBe("multiple-list");
  expect(content.className).toContain("overflow-x-hidden");
  expect(content.className).not.toContain("overflow-x-auto");
  const rows = Array.from(content.querySelectorAll('[data-slot="dropdown-menu-item"]'));
  expect(rows).toHaveLength(4);
  expect(rows.every(row => row.querySelector('[data-slot="dropdown-menu-item-trailing-icon"]'))).toBe(true);
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
// import { LessonColumn, LESSON_MEDIA_MAX_HEIGHT } from "./lessonLayout";
import { LessonColumn, LESSON_COLUMN_MAX_WIDTH } from "./lessonLayout";
import { LearnShellSkeleton, LessonPlayerSkeletonBody } from "@/components/loading/RouteSkeleton";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/components/layouts/AppHeaderBar", () => ({ AppHeaderBar: () => null }));

// it("centers the lesson column, caps at 100% on narrow screens, and follows the video width above 64rem", () => {
it("centers the lesson column, caps at 100% on narrow screens, and stops at the 55rem Figma frame", () => {
  const host = document.createElement("div"), root = createRoot(host);
  act(() => root.render(<LessonColumn className="extra">x</LessonColumn>));
  const column = host.querySelector<HTMLElement>("[data-lesson-column]")!;
  expect(column.className).toContain("mx-auto");
  expect(column.className).toContain("md:px-8xl");
  expect(column.className).toContain("extra");
  expect(column.style.maxWidth).toContain("100%");
  // expect(column.style.maxWidth).toContain("64rem");
  // expect(column.style.maxWidth).toContain(LESSON_MEDIA_MAX_HEIGHT);
  expect(column.style.maxWidth).toContain(LESSON_COLUMN_MAX_WIDTH);
  // happy-dom drops marginLeft values that use max()/cqw, so the sliding margin can only be checked in a real browser.
  // expect(column.style.marginLeft).toContain("cqw");
  act(() => root.unmount());
});

it("draws the Learn shell skeleton with the pinned 64px footer bar, not the floating one", () => {
  const host = document.createElement("div"), root = createRoot(host);
  act(() => root.render(<LearnShellSkeleton immediate />));
  expect(host.querySelector(".h-16.border-t")).not.toBeNull();
  expect(host.querySelector(".border-border-strong")).toBeNull();
  act(() => root.unmount());
});

it("draws the lesson skeleton inside the same column", () => {
  const host = document.createElement("div"), root = createRoot(host);
  act(() => root.render(<LessonPlayerSkeletonBody />));
  expect(host.querySelector("[data-lesson-column]")).not.toBeNull();
  act(() => root.unmount());
});

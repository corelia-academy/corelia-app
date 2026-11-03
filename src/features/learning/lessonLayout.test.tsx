// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LessonColumn, LESSON_MEDIA_MAX_HEIGHT } from "./lessonLayout";
import { LessonPlayerSkeletonBody } from "@/components/loading/RouteSkeleton";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/components/layouts/AppHeaderBar", () => ({ AppHeaderBar: () => null }));

it("centers the lesson column, keeps the side gutter and follows the video width above 64rem", () => {
  const host = document.createElement("div"), root = createRoot(host);
  act(() => root.render(<LessonColumn className="extra">x</LessonColumn>));
  const column = host.querySelector<HTMLElement>("[data-lesson-column]")!;
  expect(column.className).toContain("mx-auto");
  expect(column.className).toContain("md:px-8xl");
  expect(column.className).toContain("extra");
  expect(column.style.maxWidth).toContain("64rem");
  expect(column.style.maxWidth).toContain(LESSON_MEDIA_MAX_HEIGHT);
  act(() => root.unmount());
});

it("draws the lesson skeleton inside the same column", () => {
  const host = document.createElement("div"), root = createRoot(host);
  act(() => root.render(<LessonPlayerSkeletonBody />));
  expect(host.querySelector("[data-lesson-column]")).not.toBeNull();
  act(() => root.unmount());
});

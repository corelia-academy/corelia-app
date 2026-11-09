// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LessonDataError } from "./LessonDataError";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));

function mount(node: React.ReactNode) {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, unmount: () => act(() => root.unmount()) };
}

it("shows the data connection failure illustration with the lesson error copy", () => {
  const { host, unmount } = mount(<LessonDataError />);
  const alert = host.querySelector('[role="alert"]');
  expect(alert).not.toBeNull();
  expect(alert?.querySelector('svg [id="Group 7"]')).not.toBeNull();
  expect(alert?.textContent).toContain("learning.lessonDataErrorTitle");
  expect(alert?.textContent).toContain("learning.lessonDataErrorDescription");
  unmount();
});

it("keeps the title on one line from the sm breakpoint up", () => {
  const { host, unmount } = mount(<LessonDataError />);
  const text = host.querySelector('[data-slot="empty-state-illustration"] > div:last-child');
  expect(text?.className).toContain("sm:[&>p:first-child]:whitespace-nowrap");
  expect(text?.className).not.toContain("w-[320px]");
  unmount();
});

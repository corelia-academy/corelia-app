// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";
import type { TFunction } from "i18next";

import { HomeHeader } from "./HomeHeader";
import type { FocusCard } from "../utils/homeTypes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = ((key: string) =>
  ({
    "home.dashboard": "Dashboard",
    "home.sections.featuredOnline": "Online",
    "home.sections.progress": "Progress",
    "home.sections.greeting": "Hello, {{name}}",
    "home.sections.greetingSubtitle": "Subtitle",
    "home.continueLearning": "Continue learning",
    "home.viewCourse": "View",
    "home.allCourses": "All courses",
  })[key] ?? key) as TFunction<"common">;

function makeFocusCard(completed: boolean): FocusCard {
  return {
    id: "course-revert-test",
    title: "Revert Test Course",
    format: "online",
    progress: completed ? 100 : 50,
    completed,
    nextStep: completed ? "All lessons completed" : "Next lesson: Lesson 1",
    meta: "2 minutes · self-paced",
    action: "/learn/course-revert-test",
  };
}

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function renderHeader(featuredFocus: FocusCard) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };

  await act(async () => {
    root.render(
      <MemoryRouter>
        <HomeHeader
          t={t}
          loading={false}
          firstName="Revert"
          featuredFocus={featuredFocus}
        />
      </MemoryRouter>,
    );
  });

  return container;
}

it("labels a completed featured course as View", async () => {
  const container = await renderHeader(makeFocusCard(true));
  const action = container.querySelector<HTMLAnchorElement>(
    'a[href="/learn/course-revert-test"]',
  );

  expect(action?.textContent).toContain("View");
  expect(action?.textContent).not.toContain("Continue learning");
});

it("keeps Continue learning for an incomplete featured course", async () => {
  const container = await renderHeader(makeFocusCard(false));
  const action = container.querySelector<HTMLAnchorElement>(
    'a[href="/learn/course-revert-test"]',
  );

  expect(action?.textContent).toContain("Continue learning");
  expect(action?.textContent).not.toContain("View");
});

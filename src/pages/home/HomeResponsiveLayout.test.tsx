// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";

import Home from "./Home";
import { ContinueLearningSection } from "./components/ContinueLearningSection";
import { ExploreCoursesSection } from "./components/ExploreCoursesSection";
import type { FocusCard } from "./utils/homeTypes";
import type { Course } from "@/types/courses";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({
    profile: { full_name: "Layout Test" },
    user: { id: "layout-test-user", user_metadata: {} },
    isAuthenticated: true,
  }),
}));

vi.mock("./hooks/useHomeCatalogAndContests", () => ({
  useHomeCatalogAndContests: () => ({
    courseCatalog: [],
    courseLessonCounts: {},
  }),
}));

vi.mock("./hooks/useHomeUserDashboard", () => ({
  useHomeUserDashboard: () => ({
    loading: false,
    focusCards: [],
    enrolledCourseCount: 0,
  }),
}));

vi.mock("./components/GuestHome", () => ({
  GuestHome: () => <div data-testid="guest-home" />,
}));

vi.mock("./components/HomeHeader", () => ({
  HomeHeader: () => <header data-testid="home-header" />,
}));

vi.mock("./components/HomeXpPanel", () => ({
  HomeXpPanel: () => <div data-testid="home-xp-panel" />,
}));

vi.mock("./components/HomeXpMissionsPanel", () => ({
  HomeXpMissionsPanel: () => <div data-testid="home-xp-missions-panel" />,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = ((key: string) => key) as TFunction<"common">;
const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

async function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });

  await act(async () => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });

  return container;
}

it("keeps the home sidebar and content in the responsive container layout", async () => {
  const container = await render(<Home />);
  const page = container.firstElementChild as HTMLDivElement;
  const grid = page.firstElementChild as HTMLDivElement;
  const sidebar = grid.querySelector("aside");

  expect(page.className).toContain("@container");
  expect(grid.className).toContain("@max-[807px]:grid-cols-1!");
  expect(grid.children[0].querySelector('[data-testid="home-header"]')).not.toBeNull();
  expect(grid.children[0].className).toContain("@max-[807px]:col-auto!");
  expect(grid.children[1].tagName).toBe("ASIDE");
  expect(grid.children[2].tagName).toBe("MAIN");
  expect(grid.children[2].className).toContain("@max-[807px]:col-auto!");
  expect(sidebar?.className).toContain("@min-[504px]:@max-[807px]:grid-cols-2!");
  expect(sidebar?.className).toContain("@max-[807px]:row-span-1!");
});

it("keeps continue-learning cards at the intended tablet container width", async () => {
  const focusCard: FocusCard = {
    id: "responsive-focus-card",
    title: "Responsive Focus Card",
    format: "online",
    progress: 50,
    completed: false,
    nextStep: "Next lesson",
    meta: "2 minutes · self-paced",
    action: "/learn/responsive-focus-card",
  };
  const container = await render(
    <ContinueLearningSection t={t} focusCards={[focusCard]} enrolledCourseCount={1} />,
  );
  const card = container.querySelector<HTMLAnchorElement>(
    'a[href="/learn/responsive-focus-card"]',
  );

  expect(card?.className).toContain("@min-[504px]:@max-[807px]:flex-[1_1_240px]!");
  const chip = container.querySelector<HTMLElement>('[data-slot="chip"]');
  expect(chip?.textContent).toBe("1");
  expect(chip?.className).toContain("text-xs");
});

it("keeps recommended-course cards at the intended tablet container width", async () => {
  const course = {
    id: "responsive-course-card",
    title: "Responsive Course Card",
    slug: "responsive-course-card",
    thumbnail_url: "",
    level: "beginner",
    total_duration_seconds: 0,
  } as Course;
  const container = await render(
    <ExploreCoursesSection t={t} courseCatalog={[course]} courseLessonCounts={{}} />,
  );
  const card = container.querySelector<HTMLAnchorElement>(
    'a[href="/courses/responsive-course-card"]',
  );

  expect(card?.className).toContain("@min-[504px]:@max-[807px]:flex-[1_1_240px]!");
});

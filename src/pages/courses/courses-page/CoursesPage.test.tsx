import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Course } from "@/types/courses";
import type { useCoursesCatalog } from "./hooks/useCoursesCatalog";
import CoursesPage from "./CoursesPage";

const mocks = vi.hoisted(() => ({
  useCoursesCatalog: vi.fn(),
  useUserCoursesProgress: vi.fn(),
}));

vi.mock("./hooks/useCoursesCatalog", () => ({
  useCoursesCatalog: mocks.useCoursesCatalog,
}));

vi.mock("./hooks/useUserCoursesProgress", () => ({
  useUserCoursesProgress: mocks.useUserCoursesProgress,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

type CatalogState = ReturnType<typeof useCoursesCatalog>;

const existingCourse = {
  id: "course-1",
  slug: "course-1",
  title: "Existing course",
  level: "beginner",
  updated_at: "2026-01-01T00:00:00.000Z",
} as Course;

function createCatalogState(overrides: Partial<CatalogState> = {}): CatalogState {
  return {
    loading: false,
    error: null,
    errorTitle: "catalog.loadErrorTitle",
    catalogCourses: [],
    filteredOnlineCourses: [],
    lessonCounts: new Map(),
    query: "",
    setQuery: () => undefined,
    levelFilter: [],
    setLevelFilter: () => undefined,
    selectedSkills: [],
    setSelectedSkills: () => undefined,
    selectedInstructorIds: [],
    setSelectedInstructorIds: () => undefined,
    skillOptions: [],
    instructorOptions: [],
    hasActiveFilters: false,
    activeFilterCount: 0,
    resetFilters: () => undefined,
    retry: async () => [],
    ...overrides,
  };
}

function renderPage(state: CatalogState) {
  mocks.useCoursesCatalog.mockReturnValue(state);
  mocks.useUserCoursesProgress.mockReturnValue({ progressByCourse: new Map() });
  return renderToStaticMarkup(<CoursesPage />);
}

describe("CoursesPage catalog states", () => {
  beforeEach(() => {
    mocks.useCoursesCatalog.mockReset();
    mocks.useUserCoursesProgress.mockReset();
  });

  it("shows the catalog empty state only when there are no courses", () => {
    const markup = renderPage(createCatalogState());

    expect(markup).toContain("catalog.noCoursesTitle");
    expect(markup).not.toContain("catalog.emptyTitle");
    expect(markup).not.toContain("catalog.loadErrorTitle");
  });

  it.each([
    ["search", { query: "missing", hasActiveFilters: true }],
    ["filter", { hasActiveFilters: true }],
  ] as const)("shows the no-results state for a %s miss", (_kind, overrides) => {
    const markup = renderPage(createCatalogState({
      catalogCourses: [existingCourse],
      ...overrides,
    }));

    expect(markup).toContain("catalog.emptyTitle");
    expect(markup).not.toContain("catalog.noCoursesTitle");
    expect(markup).not.toContain("catalog.loadErrorTitle");
  });

  it("shows the load-error state separately from both empty states", () => {
    const markup = renderPage(createCatalogState({
      error: "Request failed",
    }));

    expect(markup).toContain("catalog.loadErrorTitle");
    expect(markup).not.toContain("catalog.noCoursesTitle");
    expect(markup).not.toContain("catalog.emptyTitle");
  });
});

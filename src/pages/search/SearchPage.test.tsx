// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

import type { SearchResultRow } from "@/lib/search";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const searchResults = vi.hoisted(() => ({
  rows: [] as SearchResultRow[],
  contests: [] as Array<{ id: string; title: string }>,
  projects: [] as Array<{ project: { id: string; title: string; source_id: null }; owner: null }>,
}));

vi.mock("@/features/search/searchQueries", () => ({
  searchResultsQueryOptions: (query: string) => ({
    queryKey: ["search-page-test", query],
    queryFn: async () => searchResults.rows,
    enabled: query.length > 0,
  }),
  searchProfilesQueryOptions: (ids: string[]) => ({
    queryKey: ["search-page-profiles", ...ids],
    queryFn: async () => [],
    enabled: ids.length > 0,
  }),
}));

vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonCatalogQueryOptions: (locale: string, enabled = true) => ({
    queryKey: ["search-page-catalog", locale],
    queryFn: async () => searchResults.contests,
    enabled,
  }),
  publicHackathonApplicantPreviewsQueryOptions: (ids: string[]) => ({
    queryKey: ["search-page-applicants", ...ids],
    queryFn: async () => ({}),
    enabled: false,
  }),
}));

vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectEntriesByIdsQueryOptions: (ids: string[]) => ({
    queryKey: ["search-page-projects", ...ids],
    queryFn: async () => searchResults.projects,
    enabled: ids.length > 0,
  }),
  publicProjectTeamsQueryOptions: (ids: string[]) => ({
    queryKey: ["search-page-teams", ...ids],
    queryFn: async () => ({}),
    enabled: false,
  }),
}));

vi.mock("@/features/projects/projectSocialQueries", () => ({
  projectHeartsQueryOptions: () => ({ queryKey: ["search-page-hearts"], queryFn: async () => new Set(), enabled: false }),
}));

vi.mock("@/features/projects/projectSaveQueries", () => ({
  projectSavesQueryOptions: () => ({ queryKey: ["search-page-saves"], queryFn: async () => new Set(), enabled: false }),
}));

vi.mock("@/lib/projectTaxonomy", () => ({ listProjectTaxonomyOptions: async () => [] }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: null }) }));

vi.mock("@/features/hackathons/list/ContestCatalogCard", () => ({
  ContestCatalogCard: ({ contest }: { contest: { title: string } }) => <article data-testid="contest-card">{contest.title}</article>,
}));

vi.mock("@/components/projects/ProjectCard", () => ({
  ProjectCard: ({ project }: { project: { title: string } }) => <article data-testid="project-card">{project.title}</article>,
}));

vi.mock("@/components/participants/ParticipantSummary", () => ({ ParticipantSummary: () => null }));

import SearchPage from "./SearchPage";

const course: SearchResultRow = {
  entity_type: "course",
  entity_id: "course-1",
  title: "TypeScript basics",
  subtitle: "Learn TypeScript",
  href: "/courses/course-1",
  rank: 2,
  course: { thumbnail_url: "https://cdn.example/thumb.png", level: "beginner", total_duration_seconds: 600 },
  lessonCount: 3,
};

const project: SearchResultRow = {
  entity_type: "project",
  entity_id: "project-1",
  title: "Type helper",
  subtitle: null,
  href: "/projects/type-helper",
  rank: 1,
};

const hackathon: SearchResultRow = {
  entity_type: "hackathon",
  entity_id: "hackathon-1",
  title: "Type Hackathon",
  subtitle: null,
  href: "/hackathons/hackathon-1/overview",
  rank: 3,
};

const profile: SearchResultRow = {
  entity_type: "profile",
  entity_id: "profile-1",
  title: "Typed Person",
  subtitle: "typed",
  href: "/u/typed",
  rank: 4,
};

async function flush() {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

let root: Root | null = null;
let queryClient: QueryClient | null = null;

async function renderSearch(path: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient!}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/search" element={<><SearchPage /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await flush();
  return container;
}

async function typeInto(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SearchPage", () => {
  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    queryClient?.clear();
    root = null;
    queryClient = null;
    document.body.innerHTML = "";
    searchResults.contests = [];
    searchResults.projects = [];
  });

  it("renders each entity type with its own card in sections when results mix types", async () => {
    searchResults.rows = [project, course, hackathon, profile];
    searchResults.contests = [{ id: "hackathon-1", title: "Type Hackathon" }];
    searchResults.projects = [{ project: { id: "project-1", title: "Type helper", source_id: null }, owner: null }];
    const container = await renderSearch("/search?q=type");

    expect(container.querySelector('img[src="https://cdn.example/thumb.png"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="contest-card"]')?.textContent).toBe("Type Hackathon");
    expect(container.querySelector('[data-testid="project-card"]')?.textContent).toBe("Type helper");
    expect(container.querySelector('a[href="/u/typed"]')?.textContent).toContain("@typed");
    expect(Array.from(container.querySelectorAll(".course-catalog-section-title"), (heading) => heading.textContent))
      .toEqual(["Course", "Hackathon", "Project", "Profile"]);
  });

  it("falls back to a plain row when a result has no card data", async () => {
    searchResults.rows = [project];
    const container = await renderSearch("/search?q=type");

    expect(container.querySelector('[data-testid="project-card"]')).toBeNull();
    expect(container.querySelector('a[href="/projects/type-helper"]')?.textContent).toContain("Type helper");
  });

  it("waits for submit before searching and keeps the selected tab for the new query", async () => {
    searchResults.rows = [course, hackathon];
    searchResults.contests = [{ id: "hackathon-1", title: "Type Hackathon" }];
    const container = await renderSearch("/search?q=type");
    const hackathonTab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((tab) => tab.textContent === "Hackathon")!;

    await act(async () => hackathonTab.click());
    expect(hackathonTab.getAttribute("aria-selected")).toBe("true");

    const form = container.querySelector<HTMLFormElement>('form[role="search"]')!;
    const input = form.querySelector<HTMLInputElement>("input")!;
    await typeInto(input, "types");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe("/search?q=type");

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe("/search?q=types");
    expect(hackathonTab.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector('[data-testid="contest-card"]')).not.toBeNull();
    expect(container.querySelector('img[src="https://cdn.example/thumb.png"]')).toBeNull();
  });

  it("keeps the course card grid when every result is a course", async () => {
    searchResults.rows = [course];
    const container = await renderSearch("/search?q=type");

    expect(container.querySelector('img[src="https://cdn.example/thumb.png"]')).not.toBeNull();
  });

  it("submits the on-page search form to the search route", async () => {
    searchResults.rows = [];
    const container = await renderSearch("/search");
    const form = container.querySelector<HTMLFormElement>('form[role="search"]')!;
    const input = form.querySelector<HTMLInputElement>("input")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

    await act(async () => {
      setValue.call(input, "  khóa học  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[data-testid="location"]')?.textContent)
      .toBe(`/search?q=${encodeURIComponent("khóa học")}`);
    expect(input.value).toBe("khóa học");
  });
});

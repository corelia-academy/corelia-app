// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

import type { SearchResultRow } from "@/lib/search";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const searchResults = vi.hoisted(() => ({ rows: [] as SearchResultRow[] }));

vi.mock("@/features/search/searchQueries", () => ({
  searchResultsQueryOptions: (query: string) => ({
    queryKey: ["search-page-test", query],
    queryFn: async () => searchResults.rows,
    enabled: query.length > 0,
  }),
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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

describe("SearchPage", () => {
  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    queryClient?.clear();
    root = null;
    queryClient = null;
    document.body.innerHTML = "";
  });

  it("renders courses as compact rows when results mix entity types", async () => {
    searchResults.rows = [course, project];
    const container = await renderSearch("/search?q=type");

    expect(container.textContent).toContain("TypeScript basics");
    expect(container.querySelector('img[src="https://cdn.example/thumb.png"]')).toBeNull();
    expect(container.querySelector('a[href="/projects/type-helper"]')).not.toBeNull();
    expect(container.querySelector('a[href="/courses/course-1"]')?.textContent).toContain("Learn TypeScript");
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

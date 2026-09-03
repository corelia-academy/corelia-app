// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { projectQueryFn } = vi.hoisted(() => ({
  projectQueryFn: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { resolvedLanguage: "vi", language: "vi" },
  }),
}));

vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectDirectoryQueryOptions: () => ({
    queryKey: ["projects", "hackathon-filter-test"],
    queryFn: projectQueryFn,
    initialPageParam: null,
    getNextPageParam: () => undefined,
  }),
}));

vi.mock("@/components/projects/ProjectCard", () => ({ ProjectCard: () => null }));
vi.mock("@/components/projects/ProjectCardSkeleton", () => ({ ProjectCardSkeleton: () => null }));

import { HackathonProjectsTab } from "./ContestPublicTabs";

const contest = {
  id: "hackathon-1",
  slug: "demo-hackathon",
  tracks: [{ id: "general", name: "General", active: true, sort_order: 0 }],
  sectors: [{ id: "sector-ai-engineering", name: "Kỹ thuật AI & Machine Learning", active: true, sort_order: 0 }],
  tech_stacks: [{ id: "tech-solana", name: "Solana", active: true, sort_order: 0 }],
  winner_awards: [],
} as unknown as Contest;

function ParentRoute() {
  return <Outlet context={{ contest, registration: null }} />;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderProjectsTab(initialEntry: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<ParentRoute />}>
              <Route path="/hackathons/:slug/projects" element={<><HackathonProjectsTab /><LocationProbe /></>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      queryClient.clear();
      container.remove();
    },
  };
}

describe("HackathonProjectsTab filters", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a compact selected count and clears taxonomy filters without dropping other params", async () => {
    const view = renderProjectsTab("/hackathons/demo-hackathon/projects?tracks=general&sectors=sector-ai-engineering&tech=tech-solana&sort=oldest&preview=1");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(view.container.textContent).toContain("public.projects.selectedCount:3");
    expect(view.container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(3);

    const clearButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("public.projects.clearFilters"));
    expect(clearButton).toBeDefined();

    await act(async () => clearButton?.click());

    expect(view.container.querySelector('[data-testid="location"]')?.textContent).toBe("?sort=oldest&preview=1");
    expect(view.container.textContent).not.toContain("public.projects.selectedCount");

    await view.cleanup();
  });
});

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
const locale = vi.hoisted(() => ({ value: "vi" }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { resolvedLanguage: locale.value, language: locale.value },
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

import { HackathonPrizesTab, HackathonProjectsTab } from "./ContestPublicTabs";

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

describe("HackathonPrizesTab", () => {
  afterEach(() => {
    locale.value = "vi";
  });

  async function renderPrizes(prizeContest: Partial<Contest>) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Routes>
            <Route element={<Outlet context={{ contest: prizeContest, registration: null }} />}>
              <Route index element={<HackathonPrizesTab />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });
    return {
      container,
      async cleanup() {
        await act(async () => root.unmount());
        container.remove();
      },
    };
  }

  it.each([
    ["vi", "100.000.000", "50.000.000,125"],
    ["en", "100,000,000", "50,000,000.125"],
  ])("formats prize amounts in %s without dropping fractional awards", async (language, total, allocation) => {
    locale.value = language;
    const view = await renderPrizes({
      prize_pool: { amount: "100000000", currency: "VND" },
      tracks: [{ id: "product", name: "Best Product & Business", prize_amount: "50000000.125" }],
    });
    try {
      expect(view.container.querySelector("section")?.textContent).toContain(`${total} VND`);
      expect(view.container.querySelector("article")?.textContent).toContain(`${allocation} VND`);
    } finally {
      await view.cleanup();
    }
  });

  it("renders track paragraphs, rubric lists and links as Markdown", async () => {
    const view = await renderPrizes({
      tracks: [{
        id: "technical",
        name: "Best Technical Build",
        description: "Build a working demo.\n\n**Judging rubric**\n\n- Technical depth: 30%.\n- Architecture: 25%.\n\n[Rules](https://unihackfest.vn/)",
      }],
    });
    try {
      const track = view.container.querySelector("article");
      expect(track?.querySelectorAll("p")).toHaveLength(3);
      expect(track?.querySelectorAll("ul > li")).toHaveLength(2);
      expect(track?.querySelector("strong")?.textContent).toBe("Judging rubric");
      expect(track?.querySelector("a")?.getAttribute("href")).toBe("https://unihackfest.vn/");
    } finally {
      await view.cleanup();
    }
  });

  it("preserves legacy non-numeric prize labels and excludes archived tracks", async () => {
    const view = await renderPrizes({
      prize_pool: { amount: "TBA", currency: "VND" },
      tracks: [
        { id: "active", name: "Active", prize_amount: "TBA" },
        { id: "archived", name: "Archived", prize_amount: "1000", active: false },
      ],
    });
    try {
      expect(view.container.textContent).toContain("TBA VND");
      expect(view.container.textContent).not.toContain("NaN");
      expect(view.container.querySelectorAll("article")).toHaveLength(1);
      expect(view.container.querySelector("article")?.textContent).toContain("TBA VND");
    } finally {
      await view.cleanup();
    }
  });
});

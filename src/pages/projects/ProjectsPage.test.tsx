// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";
import ProjectsPage from "./ProjectsPage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  hackathons: [
    {
      id: "h-qa-356",
      slug: "qa-356",
      title: "QA 356",
      tracks: [],
      sectors: [],
      tech_stacks: [],
      winner_awards: [],
    } as unknown as Contest,
  ],
  projectsByHackathonId: {
    "h-qa-356": [
      {
        project: { id: "p-1", title: "Project Alpha", slug: "project-alpha", source_id: "h-qa-356" },
        owner: { username: "alice", full_name: "Alice" },
      },
    ],
  } as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  },
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonCatalogQueryOptions: () => ({
    queryKey: ["hackathons", "projects-test"],
    queryFn: async () => state.hackathons,
  }),
}));

vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectDirectoryQueryOptions: (
    _locale: string,
    _tab: string,
    _sort: string,
    filters: { hackathonId?: string | null },
  ) => ({
    queryKey: ["projects", "directory-test", filters.hackathonId],
    queryFn: async () => {
      const items = filters.hackathonId ? state.projectsByHackathonId[filters.hackathonId] ?? [] : [];
      return {
        items,
        nextCursor: null,
        hasMore: false,
      };
    },
    initialPageParam: null,
    getNextPageParam: () => undefined,
  }),
}));

vi.mock("@/features/projects/projectSocialQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/projects/projectSocialQueries")>();
  return {
    ...actual,
    projectHeartsQueryOptions: () => ({
      queryKey: ["projects", "hearts-test"],
      queryFn: async () => new Set<string>(),
    }),
    projectHeartQueryOptions: () => ({
      queryKey: ["projects", "heart-test"],
      queryFn: async () => false,
    }),
  };
});

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        if (key === "projects.errors.hackathonMissing") {
          return "This hackathon is unavailable. Clear the filter to browse other projects.";
        }
        return key;
      },
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});

describe("ProjectsPage hackathon slug filter case-insensitivity", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  async function settle() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }

  async function renderPage(initialEntry: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/projects" element={<ProjectsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await settle();

    return {
      container,
      cleanup: async () => {
        await act(async () => {
          root.unmount();
        });
        queryClient.clear();
      },
    };
  }

  it("resolves lowercase hackathon slug and renders project list", async () => {
    const view = await renderPage("/projects?hackathon=qa-356");

    const select = view.container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select?.value).toBe("qa-356");

    expect(view.container.textContent).toContain("Project Alpha");
    expect(view.container.textContent).not.toContain("This hackathon is unavailable");

    await view.cleanup();
  });

  it("resolves uppercase hackathon slug QA-356 and renders the same project list", async () => {
    const view = await renderPage("/projects?hackathon=QA-356");

    const select = view.container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select?.value).toBe("qa-356");

    expect(view.container.textContent).toContain("Project Alpha");
    expect(view.container.textContent).not.toContain("This hackathon is unavailable");

    await view.cleanup();
  });

  it("displays hackathon missing error when slug does not exist", async () => {
    const view = await renderPage("/projects?hackathon=unknown-hackathon");

    const select = view.container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select?.value).toBe("");

    expect(view.container.textContent).toContain("This hackathon is unavailable");
    expect(view.container.textContent).not.toContain("Project Alpha");

    await view.cleanup();
  });
});

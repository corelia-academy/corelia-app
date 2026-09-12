// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";
import Contests from "./Contests";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  items: [] as Contest[],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  },
}));

vi.mock("@/lib/permissions", () => ({
  canManageContests: () => false,
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ profile: null }),
}));

vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonCatalogQueryOptions: () => ({
    queryKey: ["hackathons", "catalog-test"],
    queryFn: async () => state.items,
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { total?: number; accepting?: number; running?: number; ended?: number }) => {
        if (key === "catalog.statsSummary" && options) {
          return `${options.total} total · ${options.accepting} accepting · ${options.running} running · ${options.ended} ended`;
        }
        return key;
      },
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});

describe("Contests catalog statistics", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    state.items = [];
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

  async function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Contests />
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

  it("displays 0 accepting when hackathons have expired registration deadlines", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    state.items = [
      {
        id: "qa-356",
        slug: "qa-356",
        title: "QA 356",
        status: "published",
        registration_deadline: past,
        submission_deadline: past,
        location: "online",
        mode: "online",
        participants_count: 5,
        prize_pool: { amount: "1000", currency: "USD" },
      } as unknown as Contest,
      {
        id: "bug2",
        slug: "bug2",
        title: "Bug2",
        status: "published",
        registration_deadline: past,
        submission_deadline: past,
        location: "online",
        mode: "online",
        participants_count: 2,
        prize_pool: { amount: "2000", currency: "USD" },
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("2 total · 0 accepting · 0 running · 0 ended");

    await view.cleanup();
  });

  it("counts published and running hackathons within deadline as accepting", async () => {
    const future = new Date(Date.now() + 86400000 * 7).toISOString();
    state.items = [
      {
        id: "h-open-pub",
        slug: "h-open-pub",
        title: "Open Published",
        status: "published",
        registration_deadline: future,
        location: "online",
        mode: "online",
        participants_count: 1,
      } as unknown as Contest,
      {
        id: "h-open-run",
        slug: "h-open-run",
        title: "Open Running",
        status: "running",
        registration_deadline: future,
        location: "online",
        mode: "online",
        participants_count: 3,
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("2 total · 2 accepting · 1 running · 0 ended");

    await view.cleanup();
  });

  it("uses submission_deadline fallback when registration_deadline is null", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000 * 7).toISOString();
    state.items = [
      {
        id: "h-sub-past",
        slug: "h-sub-past",
        title: "Submission Past",
        status: "published",
        registration_deadline: null,
        submission_deadline: past,
      } as unknown as Contest,
      {
        id: "h-sub-future",
        slug: "h-sub-future",
        title: "Submission Future",
        status: "published",
        registration_deadline: null,
        submission_deadline: future,
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("2 total · 1 accepting · 0 running · 0 ended");

    await view.cleanup();
  });

  it("excludes draft and ended hackathons from accepting count even if deadlines are in future", async () => {
    const future = new Date(Date.now() + 86400000 * 7).toISOString();
    state.items = [
      {
        id: "h-draft",
        slug: "h-draft",
        title: "Draft Hackathon",
        status: "draft",
        registration_deadline: future,
      } as unknown as Contest,
      {
        id: "h-ended",
        slug: "h-ended",
        title: "Ended Hackathon",
        status: "ended",
        registration_deadline: future,
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("2 total · 0 accepting · 0 running · 1 ended");

    await view.cleanup();
  });
});

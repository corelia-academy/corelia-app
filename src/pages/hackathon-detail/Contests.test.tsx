// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";
import Contests from "./Contests";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ items: [] as Contest[] }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  },
}));
vi.mock("@/lib/permissions", () => ({ canManageContests: () => true }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ profile: null }) }));
vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonCatalogQueryOptions: () => ({
    queryKey: ["hackathons", "catalog-test"],
    queryFn: async () => state.items,
  }),
  publicHackathonApplicantPreviewsQueryOptions: (ids: string[]) => ({
    queryKey: ["hackathons", "applicant-test", ...ids],
    queryFn: async () => Object.fromEntries(ids.map((id) => [id, [{
        user_id: "applicant-1",
        username: "applicant",
        full_name: "Applicant One",
        avatar_seed: null,
        avatar_config: null,
      }]])),
    enabled: ids.length > 0,
  }),
}));
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: "en", resolvedLanguage: "en" },
    }),
  };
});

describe("Hackathon catalog card", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    state.items = [];
  });

  afterEach(() => {
    container.remove();
  });

  async function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter><Contests /></MemoryRouter>
        </QueryClientProvider>,
      );
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
    return {
      cleanup: async () => {
        await act(async () => root.unmount());
        queryClient.clear();
      },
    };
  }

  it("uses the detail banner across the card without redundant controls or a divider", async () => {
    state.items = [{
      id: "unihackfest",
      slug: "unihackfest",
      title: "UniHackfest",
      status: "published",
      cover_image_url: "https://cdn.example.com/banner.png",
      thumbnail_url: "https://cdn.example.com/thumbnail.png",
      registration_deadline: new Date(Date.now() + 86400000).toISOString(),
      participants_count: 119,
    } as Contest];

    const view = await renderPage();
    const banner = container.querySelector<HTMLImageElement>("img[src='https://cdn.example.com/banner.png']");
    expect(banner?.parentElement?.className).toContain("aspect-[21/9]");
    expect(banner?.className).toContain("object-cover");
    expect(container.querySelector("img[src='https://cdn.example.com/thumbnail.png']")).toBeNull();
    expect(container.querySelector("[data-slot='avatar-group']")).not.toBeNull();
    expect(container.querySelector("[data-slot='avatar-group-count']")?.textContent).toBe("+118");
    expect(container.querySelector("[data-slot='avatar-group']")?.closest(".basis-full")).toBeNull();
    expect(container.textContent).not.toContain("catalog.statsSummary");
    expect(container.textContent).not.toContain("catalog.openWorkspace");
    expect(container.querySelector("a[href='/admin/hackathons']")).toBeNull();
    expect(container.querySelector(".border-t")).toBeNull();
    await view.cleanup();
  });

  it("does not show a workspace button in the empty state", async () => {
    const view = await renderPage();
    expect(container.textContent).toContain("catalog.emptyTitle");
    expect(container.querySelector("a[href='/admin/hackathons']")).toBeNull();
    await view.cleanup();
  });

  it("omits the banner frame when a hackathon has no image", async () => {
    state.items = [{ id: "no-banner", slug: "no-banner", title: "No Banner", status: "published", participants_count: 1 } as Contest];
    const view = await renderPage();

    expect(container.textContent).toContain("No Banner");
    expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
    expect(container.querySelector("article > div > img")).toBeNull();
    expect(Array.from(container.querySelectorAll("article div")).some((element) => element.className.includes("aspect-[21/9]"))).toBe(false);

    await view.cleanup();
  });
});

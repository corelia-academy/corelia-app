// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";
import Contests from "./Contests";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ items: [] as Contest[], catalogFails: false }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  },
}));
vi.mock("@/lib/permissions", () => ({ canManageContests: () => true }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ profile: null }) }));
vi.mock("@/components/ui/dropdown-menu", async () => {
  const React = await import("react");
  const passThrough = ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children);

  return {
    DropdownMenu: passThrough,
    DropdownMenuContent: passThrough,
    DropdownMenuTrigger: (props: React.ComponentProps<"button">) =>
      React.createElement("button", { ...props, "data-slot": "dropdown-menu-trigger" }),
    DropdownMenuRadioGroup: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
    }) =>
      React.createElement(
        "div",
        null,
        React.Children.map(children, (child) => {
          const radioItem = child as React.ReactElement<{
            value: string;
            onClick?: () => void;
          }>;

          return React.cloneElement(radioItem, {
            onClick: () => onValueChange?.(radioItem.props.value),
          });
        }),
      ),
    DropdownMenuRadioItem: ({
      children,
      value,
      onClick,
    }: {
      children: React.ReactNode;
      value: string;
      onClick?: () => void;
    }) =>
      React.createElement(
        "button",
        { type: "button", "data-slot": "dropdown-menu-radio-item", "data-value": value, onClick },
        children,
      ),
  };
});
vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonCatalogQueryOptions: () => ({
    queryKey: ["hackathons", "catalog-test"],
    queryFn: async () => {
      if (state.catalogFails) throw new Error("catalog request failed");
      return state.items;
    },
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
    state.catalogFails = false;
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

  it("uses the detail banner and divider without redundant controls", async () => {
    state.items = [{
      id: "unihackfest",
      slug: "unihackfest",
      title: "UniHackfest",
      status: "published",
      cover_image_url: "https://cdn.example.com/banner.png",
      thumbnail_url: "https://cdn.example.com/thumbnail.png",

      participants_count: 119,
    } as Contest];

    const view = await renderPage();
    const banner = container.querySelector<HTMLImageElement>("img[src='https://cdn.example.com/banner.png']");
    expect(banner?.parentElement?.className).toContain("aspect-[44/25]");
    expect(banner?.className).toContain("object-cover");
    expect(container.querySelector("img[src='https://cdn.example.com/thumbnail.png']")).toBeNull();
    expect(container.querySelector("[data-slot='avatar-group']")).not.toBeNull();
    expect(container.querySelector("[data-slot='avatar-group-count']")).toBeNull();
    expect(container.querySelector("[data-slot='avatar-group']")?.closest(".basis-full")).toBeNull();
    expect(container.querySelector('[data-slot="timestamp"][data-type="full"]')).not.toBeNull();
    expect(container.textContent).not.toContain("catalog.statsSummary");
    expect(container.textContent).not.toContain("catalog.openWorkspace");
    expect(container.querySelector("a[href='/admin/hackathons']")).toBeNull();
    expect(container.querySelector(".border-t")).not.toBeNull();
    const card = container.querySelector("article");
    expect(card?.className).toContain("border-border");
    expect(card?.className).not.toContain("group-hover:border-primary/30");
    await view.cleanup();
  });

  it("does not show a workspace button in the empty state", async () => {
    const view = await renderPage();
    expect(container.textContent).toContain("catalog.emptyTitle");
    expect(container.querySelector("a[href='/admin/hackathons']")).toBeNull();
    await view.cleanup();
  });

  it("keeps a catalog load error separate from the search-empty state", async () => {
    state.catalogFails = true;
    const view = await renderPage();
    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="catalog.searchPlaceholder"]',
    )!;

    await act(async () => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(searchInput), "value")!.set!.call(searchInput, "no-match");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(searchInput.value).toBe("no-match");
    expect(container.querySelector("[role='alert']")).not.toBeNull();
    expect(container.textContent).toContain("catalog.errorTitle");
    expect(container.textContent).not.toContain("catalog.searchEmptyTitle");
    await view.cleanup();
  });

  it("sorts open hackathons by nearest deadline and preserves update-date sorting", async () => {
    const inDays = (days: number) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const contest = (
      id: string,
      submission_deadline: string | null,
      ends_at: string | null,
      updated_at: string,
    ) =>
      ({ id, slug: id, title: id, status: "published", submission_deadline, ends_at, updated_at }) as Contest;
    state.items = [
      contest("far", inDays(10), null, "2026-12-01T12:00:00.000Z"),
      contest("near", inDays(1), null, "2026-10-01T12:00:00.000Z"),
      contest("fallback", null, inDays(3), "2026-10-15T12:00:00.000Z"),
      contest("undated", null, null, "2026-11-01T12:00:00.000Z"),
    ];

    const view = await renderPage();
    const getTitles = () =>
      Array.from(container.querySelectorAll("article h3"), (heading) => heading.textContent);
    const chooseSort = async (value: string) => {
      const option = container.querySelector<HTMLButtonElement>(
        `[data-slot="dropdown-menu-radio-item"][data-value="${value}"]`,
      )!;

      await act(async () => {
        option.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    expect(getTitles()).toEqual(["far", "undated", "fallback", "near"]);

    await chooseSort("oldest");
    expect(getTitles()).toEqual(["near", "fallback", "undated", "far"]);

    await chooseSort("deadlineSoonest");
    expect(getTitles()).toEqual(["near", "fallback", "far", "undated"]);

    await view.cleanup();
  });

  it("omits the banner frame when a hackathon has no image", async () => {
    state.items = [{ id: "no-banner", slug: "no-banner", title: "No Banner", status: "published", participants_count: 1 } as Contest];
    const view = await renderPage();

    expect(container.textContent).toContain("No Banner");
    expect(container.querySelector("[data-slot='avatar']")).not.toBeNull();
    expect(container.querySelector("article > div > img")).toBeNull();
    expect(Array.from(container.querySelectorAll("article div")).some((element) => element.className.includes("aspect-[44/25]"))).toBe(false);

    await view.cleanup();
  });
});

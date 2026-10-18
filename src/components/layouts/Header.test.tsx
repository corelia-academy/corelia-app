// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    authInitialized: true,
    profile: {
      id: "user-1",
      username: "learner",
      full_name: "Corelia Learner",
      ocid: null,
      role: "student",
      avatar_url: null,
      avatar_seed: null,
      avatar_config: null,
    },
    user: {
      id: "user-1",
      user_metadata: { full_name: "Corelia Learner" },
    },
    signOut: vi.fn(async () => undefined),
  }),
}));

vi.mock("@opencampus/ocid-connect-js", () => ({
  useOCAuth: () => ({ isInitialized: true, authState: null, ocAuth: {} }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("@/features/search/searchQueries", () => ({
  trendingSearchesQueryOptions: () => ({
    queryKey: ["header-test", "trending"],
    queryFn: async () => [],
  }),
  searchResultsQueryOptions: () => ({
    queryKey: ["header-test", "search"],
    queryFn: async () => [],
  }),
}));

vi.mock("@/lib/xp", () => ({ getXpTotals: async () => ({}) }));
vi.mock("@/lib/search", () => ({ logSearchQuery: vi.fn() }));
vi.mock("@/lib/routePrefetch", () => ({ prefetchRouteChunk: vi.fn() }));
vi.mock("@/components/layouts/OpenCampusConnectDialog", () => ({ default: () => null }));
vi.mock("@/components/layouts/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => null }));
vi.mock("@/components/ui/user", () => ({ User: () => <button type="button" aria-label="Account menu" /> }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => <span /> }));
vi.mock("@/features/xp/XpBadge", () => ({ XpBadge: () => null }));
vi.mock("@/features/xp/XpRankBadge", () => ({ XpRankBadge: () => null }));
vi.mock("@/components/ui/action", () => ({ Action: () => null }));

import Header from "./Header";

describe("Header search and OpenCampus placement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses the shared leading-icon Input and does not render the OpenCampus connect control", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Header publicUI />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(container.querySelector('input[data-slot="input"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="input-field-leading-icon"] svg')).not.toBeNull();
    expect(container.querySelector('[data-slot="input-field-status-icon"]')).toBeNull();
    expect(container.textContent).not.toContain("Link OCID");

    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it("opens search suggestions while typing even without recent or trending searches", async () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Header publicUI />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[data-slot="input"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const type = async (value: string) => {
      await act(async () => {
        setValue.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await act(async () => input.focus());
    expect(container.textContent).not.toContain("Search for");

    await type("type");
    expect(container.textContent).toContain("Search for “type”");

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.textContent).not.toContain("Search for");

    await type("types");
    expect(container.textContent).toContain("Search for “types”");

    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it("renders a mobile search entry outside the search route", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/courses"]}>
            <Header publicUI />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    const entry = container.querySelector<HTMLAnchorElement>('a[href="/search"]');
    expect(entry?.getAttribute("aria-label")).toBe("Search");
    expect(entry?.className).toContain("md:hidden");

    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });
});

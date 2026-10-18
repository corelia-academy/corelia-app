// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  roles: ["student"] as string[],
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({
    isAuthenticated: auth.isAuthenticated,
    authInitialized: true,
    profile: auth.isAuthenticated
      ? {
        id: "user-1",
        username: "learner",
        full_name: "Corelia Learner",
        ocid: null,
        role: auth.roles[0],
        avatar_url: null,
        avatar_seed: null,
        avatar_config: null,
      }
      : null,
    user: auth.isAuthenticated
      ? { id: "user-1", email: "learner@example.com", user_metadata: { full_name: "Corelia Learner" } }
      : null,
    hasRole: (roles: readonly string[]) => roles.some((role) => auth.roles.includes(role)),
    signOut: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => ({ language: "vi", setLanguage: vi.fn(), canPersistToProfile: true }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("@/lib/xp", () => ({ getXpTotals: async () => ({}) }));
vi.mock("@/lib/routePrefetch", () => ({ prefetchRouteChunk: vi.fn() }));
vi.mock("@/components/layouts/NotificationBell", () => ({ NotificationBell: () => <span data-bell /> }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => <span data-avatar /> }));
vi.mock("@/features/xp/XpBadge", () => ({ XpBadge: () => null }));
vi.mock("@/features/xp/XpRankBadge", () => ({ XpRankBadge: () => null }));

import Header from "./Header";

async function renderHeader() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      queryClient.clear();
      container.remove();
    },
  };
}

describe("Header (shared with the landing site)", () => {
  afterEach(() => {
    auth.isAuthenticated = true;
    auth.roles = ["student"];
    document.body.innerHTML = "";
  });

  it("links the logo to the landing home and searches through an icon", async () => {
    const { container, cleanup } = await renderHeader();
    expect(container.querySelector<HTMLAnchorElement>(".csh-logo")?.getAttribute("href")).toBe("/vi");
    expect(container.querySelector("input")).toBeNull();
    const search = container.querySelector<HTMLAnchorElement>('a.csh-icon-button[href$="/search"]');
    expect(search?.textContent).toBe("Tìm kiếm");
    expect(container.querySelector(".csh-menu-button")).not.toBeNull();
    await cleanup();
  });

  it("uses the shared account menu with the app's extras for the user's roles", async () => {
    auth.roles = ["admin"];
    const { container, cleanup } = await renderHeader();
    expect(container.querySelector("[data-bell]")).not.toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>(".csh-account-trigger")!;
    expect(trigger.textContent).toContain("Corelia Learner");
    await act(async () => trigger.click());
    const labels = [...container.querySelectorAll(".csh-account-link")].map((el) => el.textContent?.trim());
    expect(labels.slice(0, 7)).toEqual(["Học tập của tôi", "Bảng tin", "Dự án", "Thành tích", "Hồ sơ", "CV", "Cài đặt"]);
    const hrefs = [...container.querySelectorAll(".csh-account-link")].map((el) => el.getAttribute("href"));
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/instructor/courses");
    expect(labels.at(-1)).toBe("Đăng xuất");
    await cleanup();
  });

  it("hides role workspaces from learners", async () => {
    const { container, cleanup } = await renderHeader();
    await act(async () => container.querySelector<HTMLButtonElement>(".csh-account-trigger")!.click());
    const hrefs = [...container.querySelectorAll(".csh-account-link")].map((el) => el.getAttribute("href"));
    expect(hrefs).not.toContain("/admin");
    expect(hrefs).not.toContain("/instructor/courses");
    await cleanup();
  });

  it("shows the guest buttons when signed out", async () => {
    auth.isAuthenticated = false;
    const { container, cleanup } = await renderHeader();
    expect(container.querySelector(".csh-account")).toBeNull();
    expect(container.textContent).toContain("Đăng nhập");
    expect(container.textContent).toContain("Đăng ký");
    await cleanup();
  });
});

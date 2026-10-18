// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, hasRole: () => false }),
}));

import AppSidebar from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

describe("AppSidebar navigation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the current primary routes, active route, and landing utility links", async () => {
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
            <SidebarProvider>
              <AppSidebar collapsible="none" />
            </SidebarProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    for (const href of ["/", "/feed", "/courses", "/hackathons", "/projects", "/jobs"]) {
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }

    const activeCourseLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/courses"]',
    );
    expect(activeCourseLink?.getAttribute("aria-current")).toBe("page");
    expect(activeCourseLink?.className).toContain("hover:bg-action-hover");
    expect(container.querySelector('a[href="https://corelia.academy/blog/"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://github.com/corelia-academy/corelia-app/releases"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://corelia.academy/contact/"]')).not.toBeNull();
    expect(
      activeCourseLink?.querySelector('svg path[opacity="0.2"]'),
    ).not.toBeNull();

    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });
});

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
    profile: { username: "learner" },
    user: { id: "user-1" },
  }),
}));

vi.mock("@/features/notifications/notificationQueries", () => ({
  notificationKeys: { list: () => ["notification-test"] },
  notificationsQueryOptions: () => ({
    queryKey: ["notification-test", "list"],
    queryFn: async () => [],
  }),
  notificationInviteContextsQueryOptions: () => ({
    queryKey: ["notification-test", "invite-contexts"],
    queryFn: async () => ({}),
  }),
}));

vi.mock("@/lib/notifications", () => ({
  acceptProjectInviteById: vi.fn(),
  declineProjectInviteById: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("@/lib/coInstructorInvites", () => ({
  acceptCoInstructorInviteById: vi.fn(),
  declineCoInstructorInviteById: vi.fn(),
}));

vi.mock("@/lib/credentialIssuances", () => ({
  openCampusCredentialExplorerUrl: vi.fn(),
}));

import { NotificationBell } from "./NotificationBell";

describe("NotificationBell icon treatment", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders an accessible duotone bell without a button border", async () => {
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
            <NotificationBell />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    const button = container.querySelector<HTMLButtonElement>("button[aria-label]");
    expect(button).not.toBeNull();
    expect(button?.className).not.toContain("border");
    expect(button?.querySelector("svg path[opacity='0.2']")).not.toBeNull();

    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });
});

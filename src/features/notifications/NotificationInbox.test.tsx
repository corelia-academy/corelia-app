// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { NotificationInbox } from "./NotificationInbox";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ read: vi.fn(), all: vi.fn(), query: vi.fn() }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "me" }, profile: {}, authInitialized: true, isAuthenticated: true }) }));
vi.mock("@/components/social/FollowButton", () => ({ FollowButton: () => null }));
vi.mock("@/lib/notifications", () => ({ markNotificationRead: state.read, markAllNotificationsRead: state.all, acceptProjectInviteById: vi.fn(), declineProjectInviteById: vi.fn() }));
vi.mock("@/lib/coInstructorInvites", () => ({ acceptCoInstructorInviteById: vi.fn(), declineCoInstructorInviteById: vi.fn() }));
vi.mock("@/lib/credentialIssuances", () => ({ openCampusCredentialExplorerUrl: vi.fn() }));
vi.mock("./notificationQueries", () => ({
 notificationKeys: { all: ["notifications"], list: () => ["notifications", "me"] },
 notificationsQueryOptions: (_user: string, _enabled: boolean, unread: boolean) => ({
  queryKey: ["notifications", unread], initialPageParam: null,
  queryFn: ({ pageParam }: { pageParam: unknown }) => state.query(pageParam, unread),
  getNextPageParam: (page: { items: { id: string }[] }) => page.items.length === 20 ? page.items.at(-1) : undefined,
 }),
 notificationInviteContextsQueryOptions: () => ({ queryKey: ["invite-context"], queryFn: async () => ({}) }),
}));
const row = (id: number) => ({ id: String(id), user_id: "me", type: "project_liked", group_key: `group${id}`, activity_at: "2026-10-13T00:00:00Z", created_at: "2026-10-13T00:00:00Z", read_at: null, resolved_at: null, payload: { count: 1, title: `Project ${id}`, target_path: `/projects/${id}` } });
beforeEach(async () => {
 vi.clearAllMocks(); await i18n.changeLanguage("en");
 state.read.mockResolvedValue(undefined); state.all.mockResolvedValue(undefined);
 state.query.mockImplementation(async (cursor: unknown) => ({ items: cursor ? [row(21)] : Array.from({ length: 20 }, (_, i) => row(i + 1)), unread_count: 21 }));
});
async function mount() {
 const container = document.createElement("div"); document.body.appendChild(container);
 const root = createRoot(container); const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 await act(async () => { root.render(<QueryClientProvider client={client}><MemoryRouter><NotificationInbox /></MemoryRouter></QueryClientProvider>); });
 await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
 return { container, cleanup: async () => { await act(async () => root.unmount()); client.clear(); container.remove(); } };
}
describe("notification history", () => {
 it("keeps items unread until opened and records the version that was shown", async () => {
  const view = await mount();
  expect(view.container.querySelectorAll("li")).toHaveLength(20);
  expect(state.all).not.toHaveBeenCalled(); expect(state.read).not.toHaveBeenCalled();
  await act(async () => { view.container.querySelector<HTMLAnchorElement>('a[href="/projects/1"]')!.click(); });
  expect(state.read).toHaveBeenCalledWith("1", true, "2026-10-13T00:00:00Z");
  await view.cleanup();
 });
 it("loads older notifications and offers explicit unread/all controls", async () => {
  const view = await mount();
  const button = (label: string) => [...view.container.querySelectorAll("button")].find(el => el.textContent === label)!;
  await act(async () => { button("Load more").click(); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(view.container.querySelectorAll("li")).toHaveLength(21);
  await act(async () => { button("Unread").click(); });
  expect(state.query).toHaveBeenCalledWith(null, true);
  await act(async () => { button("Mark all as read").click(); });
  expect(state.all).toHaveBeenCalledTimes(1);
  await view.cleanup();
 });
});

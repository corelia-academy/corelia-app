// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MilestonePage } from "@/lib/milestoneFeed";

const mocks = vi.hoisted(() => ({ followed: false, failFollow: false, failFeed: false, leaderboard: vi.fn() }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "viewer" }, isAuthenticated: true }) }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => <span>avatar</span> }));
vi.mock("@/features/xp/XpBadge", () => ({ XpBadge: ({ total }: { total: number }) => <span>{total} XP</span> }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));
vi.mock("@/lib/xpLeaderboard", () => ({ getXpLeaderboard: mocks.leaderboard }));
vi.mock("@/lib/follows", () => ({
  isFollowing: async () => mocks.followed,
  listMyFeedFollowingProfiles: async () => mocks.followed ? [{ id: "actor", full_name: "New Person", username: "actor" }] : [],
  listSuggestedFeedProfiles: async () => mocks.followed ? [] : [{ id: "actor", full_name: "New Person", username: "actor", total_xp: 250 }],
  followSubject: async () => { if (mocks.failFollow) throw new Error("offline"); mocks.followed = true; },
  unfollowSubject: async () => { mocks.followed = false; },
}));
vi.mock("@/lib/milestoneFeed", () => ({
  subscribeToMilestones: () => () => {}, setMilestoneLike: async () => {},
  getMilestonePage: async (_user: string, mode: string): Promise<MilestonePage> => {
    if (mocks.failFeed) throw new Error("offline");
    const visible = mode === "following" ? mocks.followed : !mocks.followed;
    return { milestones: visible ? [{ id: 1, actor_id: "actor", kind: "xp_reached", source_key: "250", xp_total: 250, course_id: null, hackathon_id: null, project_id: null, created_at: "2026-09-23T00:00:00Z" }] : [], profiles: { actor: { id: "actor", full_name: "New Person", username: "actor", ocid: null, avatar_url: null, avatar_seed: null } }, sources: {}, likes: {}, liked: new Set() };
  },
}));
import FeedPage from "./FeedPage";
import { FollowButton } from "@/components/social/FollowButton";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let client: QueryClient;
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); }); };
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === label)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); await settle(); };
beforeEach(async () => {
  mocks.leaderboard.mockReset().mockImplementation(async (period: string) => ({
    period, calculated_at: "2026-09-23T00:00:00Z", period_start: null, period_end: null,
    eligible_count: 0, rows: [], viewer: { position: null, total_xp: 1000, period_xp: 0, reason: "no_xp" },
  }));
  mocks.followed = false; mocks.failFollow = false; mocks.failFeed = false;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { act(() => root.unmount()); client.clear(); host.remove(); });
async function render(withProfileFollow = false, initialEntry = "/feed") {
  await act(async () => root.render(<MemoryRouter initialEntries={[initialEntry]}><QueryClientProvider client={client}><FeedPage />{withProfileFollow && <FollowButton subject={{ type: "user", id: "actor" }} showCount={false} />}</QueryClientProvider></MemoryRouter>));
  await settle();
}
it("shows independent suggestions, moves followed activity between tabs, and offers discovery from Following", async () => {
  await render();
  expect(host.querySelectorAll("article")).toHaveLength(1);
  expect(host.querySelector("details")).toBeNull();
  expect(host.querySelectorAll('[aria-label="milestones.suggestedTitle"]')).toHaveLength(2);
  await click(button("follow.follow"));
  expect(host.querySelectorAll("article")).toHaveLength(0);
  expect(host.textContent).toContain("milestones.suggestedEmpty");
  await click(button("milestones.following"));
  expect(host.querySelectorAll("article")).toHaveLength(1);
  expect(button("milestones.following").getAttribute("aria-selected")).toBe("true");
  expect(host.querySelectorAll('[aria-label="milestones.suggestedTitle"]')).toHaveLength(1);
  await click(button("milestones.findPeople"));
  expect(button("milestones.explore").getAttribute("aria-selected")).toBe("true");
});
it("keeps existing activity and suggestions after failed follow and exposes a visible error", async () => {
  mocks.failFollow = true;
  await render(); await click(button("follow.follow"));
  expect(host.querySelectorAll("article")).toHaveLength(1);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("follow.errors.save");
  mocks.failFollow = false; await click(button("follow.follow"));
  expect(host.querySelectorAll("article")).toHaveLength(0);
});
it("recovers from feed failure with retry", async () => {
  mocks.failFeed = true; await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("milestones.error");
  mocks.failFeed = false; await click(button("milestones.retry"));
  expect(host.querySelectorAll("article")).toHaveLength(1);
});
it("supports keyboard navigation between tabs", async () => {
  await render();
  const explore = button("milestones.explore");
  await act(async () => { explore.focus(); explore.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
  await settle();
  expect(document.activeElement).toBe(button("milestones.following"));
  expect(button("milestones.following").getAttribute("aria-selected")).toBe("true");
});

it("moves activity back to Explore after unfollow from a profile control", async () => {
  mocks.followed = true;
  await render(true);
  await click(button("milestones.following"));
  expect(host.querySelectorAll("article")).toHaveLength(1);
  await click(button("follow.following"));
  expect(host.querySelectorAll("article")).toHaveLength(0);
  await click(button("milestones.explore"));
  expect(host.querySelectorAll("article")).toHaveLength(1);
  expect(host.textContent).not.toContain("milestones.suggestedEmpty");
});

it("loads XP ranking inside Feed on demand and keeps its period tabs separate from timeline tabs", async () => {
  await render();
  expect(mocks.leaderboard).not.toHaveBeenCalled();
  await click(button("milestones.leaderboard"));
  expect(host.querySelectorAll("article")).toHaveLength(0);
  expect(button("milestones.leaderboard").getAttribute("aria-selected")).toBe("true");
  expect(host.textContent).toContain("xp.leaderboard.yourPosition");
  await click(button("xp.leaderboard.allTime"));
  expect(mocks.leaderboard).toHaveBeenLastCalledWith("all_time", expect.any(AbortSignal));
  expect(button("milestones.leaderboard").getAttribute("aria-selected")).toBe("true");
  expect(host.querySelectorAll('[aria-label="milestones.suggestedTitle"]')).toHaveLength(1);
  await click(button("milestones.explore"));
  expect(host.querySelectorAll("article")).toHaveLength(1);
});
it("opens the Feed ranking tab directly from a profile link", async () => {
  await render(false, "/feed?tab=leaderboard");
  expect(button("milestones.leaderboard").getAttribute("aria-selected")).toBe("true");
  expect(host.textContent).toContain("xp.leaderboard.yourPosition");
});

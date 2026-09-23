// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { XpLeaderboard, XpPeriod } from "@/lib/xpLeaderboard";

const mocks = vi.hoisted(() => ({ get: vi.fn(), week: "2026-09-21T00:00:00.000Z" }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => <span>avatar</span> }));
vi.mock("@/features/xp/useXpWeek", () => ({ useXpWeek: () => mocks.week }));
vi.mock("@/lib/xpLeaderboard", () => ({ getXpLeaderboard: mocks.get }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, args?: Record<string, unknown>) => args ? `${key} ${JSON.stringify(args)}` : key, i18n: { language: "en" } }) }));
import FeedLeaderboard from "./FeedLeaderboard";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let client: QueryClient;
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === text)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); await settle(); };
function response(period: XpPeriod = "week", reason: XpLeaderboard["viewer"]["reason"] = null): XpLeaderboard {
  return { period, calculated_at: "2026-09-23T12:00:00Z", period_start: "2026-09-21T00:00:00Z", period_end: "2026-09-28T00:00:00Z", eligible_count: 150,
    rows: Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, username: `person${i}`, ocid: null, full_name: `${period}-person-${i}`, avatar_url: null, avatar_seed: null, position: i + 1, total_xp: 1000, period_xp: 10 })),
    viewer: { position: reason ? null : 140, total_xp: 1000, period_xp: 10, reason },
  };
}
async function render() { await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><FeedLeaderboard /></QueryClientProvider></MemoryRouter>)); await settle(); }
beforeEach(() => {
  mocks.week = "2026-09-21T00:00:00.000Z";
  mocks.get.mockReset().mockImplementation(async (period: XpPeriod) => response(period));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { act(() => root.unmount()); client.clear(); host.remove(); });
it("paginates top participants but always includes own position outside the top 100", async () => {
  await render();
  expect(host.querySelectorAll("li")).toHaveLength(20);
  expect(host.textContent).toContain("#140");
  expect(host.textContent).toContain("xp.rank.names.silver"); // Rank uses lifetime 1,000, not weekly 10.
  await click(button("xp.next"));
  expect(host.querySelectorAll("li")).toHaveLength(5);
  await click(button("xp.leaderboard.allTime"));
  expect(host.querySelectorAll("li")).toHaveLength(20);
  expect(host.textContent).toContain("all_time-person-0");
  expect(host.textContent).not.toContain("week-person-");
});
it.each(["private_profile", "ineligible_role", "no_xp"] as const)("explains %s without displaying a fake rank", async reason => {
  mocks.get.mockResolvedValue(response("week", reason)); await render();
  const own = host.querySelector('[aria-label="xp.leaderboard.yourPosition"]')!;
  expect(own.textContent).toContain(`xp.leaderboard.reasons.${reason}`);
  expect(own.textContent).not.toContain("#");
  expect(own.textContent).toContain("xp.rank.names.silver");
});
it("shows errors instead of zero XP and recovers with retry", async () => {
  mocks.get.mockRejectedValue(new Error("offline")); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("xp.leaderboard.error");
  expect(host.textContent).not.toContain("#0");
  mocks.get.mockResolvedValue(response()); await click(button("profile.retry"));
  expect(host.querySelectorAll("li")).toHaveLength(20);
});
it("shows an empty leaderboard without inventing participants", async () => {
  mocks.get.mockResolvedValue({ ...response("week", "no_xp"), rows: [], eligible_count: 0 }); await render();
  expect(host.textContent).toContain("xp.leaderboard.empty");
  expect(host.querySelectorAll("li")).toHaveLength(0);
});
it("returns to page one at a week rollover and refreshes when XP changes", async () => {
  await render(); await click(button("xp.next"));
  mocks.week = "2026-09-28T00:00:00.000Z"; await render();
  expect(host.querySelectorAll("li")).toHaveLength(20);
  mocks.get.mockResolvedValue({ ...response(), rows: [] });
  await act(async () => { await client.invalidateQueries({ queryKey: ["xp"] }); }); await settle();
  expect(host.textContent).toContain("xp.leaderboard.empty");
});
it("supports arrow-key period navigation", async () => {
  await render();
  await act(async () => { const tab = button("xp.leaderboard.week"); tab.focus(); tab.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowRight",bubbles:true})); }); await settle();
  expect(button("xp.leaderboard.allTime").getAttribute("aria-selected")).toBe("true");
});

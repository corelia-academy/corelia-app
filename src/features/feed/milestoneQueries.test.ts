import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { FeedMilestone, MilestonePage } from "@/lib/milestoneFeed";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/milestoneFeed", () => ({ getMilestonePage: mocks.get }));
import { milestoneFeedQuery, milestoneKeys, profileMilestonesQuery, resetFeedTimelines } from "./milestoneQueries";

const milestone = (id: number): FeedMilestone => ({
  id, actor_id: "actor", kind: "xp_reached", source_key: String(id), course_id: null,
  hackathon_id: null, project_id: null, xp_total: id, created_at: `2026-09-23T00:00:${String(id).padStart(2, "0")}Z`,
});
const page = (count: number, offset = 0): MilestonePage => ({
  milestones: Array.from({ length: count }, (_, index) => milestone(offset + index + 1)),
  profiles: {}, sources: {}, likes: {}, liked: new Set(),
});

it("separates viewers, modes and profile activity", () => {
  const keys = [milestoneKeys.timeline("a", "explore"), milestoneKeys.timeline("a", "following"), milestoneKeys.timeline("b", "explore"), milestoneKeys.profile("a", "a")];
  expect(new Set(keys.map(key => JSON.stringify(key))).size).toBe(4);
});

it("loads timeline pages in batches of 10 and stops after 30 items", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.get.mockReset().mockResolvedValueOnce(page(10)).mockResolvedValueOnce(page(10, 10)).mockResolvedValueOnce(page(10, 20));
  const observer = new InfiniteQueryObserver(client, milestoneFeedQuery("a", "explore"));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    expect(mocks.get).toHaveBeenLastCalledWith("a", "explore", undefined, null, 10);
    expect(observer.getCurrentResult().hasNextPage).toBe(true);
    await observer.fetchNextPage();
    expect(observer.getCurrentResult().hasNextPage).toBe(true);
    await observer.fetchNextPage();
    expect(observer.getCurrentResult().data?.pages).toHaveLength(3);
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
    await observer.fetchNextPage();
    expect(mocks.get).toHaveBeenCalledTimes(3);
  } finally { unsubscribe(); client.clear(); }
});

it("stops timeline pagination when a page contains fewer than 10 items", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.get.mockReset().mockResolvedValue(page(9));
  const observer = new InfiniteQueryObserver(client, milestoneFeedQuery("a", "following"));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    expect(observer.getCurrentResult().data?.pages).toHaveLength(1);
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
  } finally { unsubscribe(); client.clear(); }
});

it("keeps profile activity on 20-item pages", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.get.mockReset().mockResolvedValue(page(20));
  await client.fetchInfiniteQuery(profileMilestonesQuery("viewer", "actor"));
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith("viewer", "profile", "actor", null, 20);
  client.clear();
});

it("resets active and inactive timeline pages from the beginning while preserving profiles and other viewers", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const emptyPage: MilestonePage = { milestones: [], profiles: {}, sources: {}, likes: {}, liked: new Set() };
  mocks.get.mockReset().mockResolvedValue(emptyPage);
  const explore = milestoneFeedQuery("a", "explore");
  const following = milestoneFeedQuery("a", "following");
  const profile = profileMilestonesQuery("a", "actor");
  const oldData = { pages: [emptyPage, emptyPage], pageParams: [null, { id: 20 } as FeedMilestone] };
  for (const key of [explore.queryKey, following.queryKey, profile.queryKey, milestoneKeys.timeline("b", "explore")]) client.setQueryData(key, oldData);
  const observer = new InfiniteQueryObserver(client, explore);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await resetFeedTimelines(client, "a");
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith("a", "explore", undefined, null, 10);
    expect(client.getQueryData(explore.queryKey)?.pages).toHaveLength(1);
    expect(client.getQueryData(following.queryKey)).toBeUndefined();
    expect(client.getQueryData(profile.queryKey)).toEqual(oldData);
    expect(client.getQueryData(milestoneKeys.timeline("b", "explore"))).toEqual(oldData);
    await client.fetchInfiniteQuery(following);
    expect(mocks.get).toHaveBeenLastCalledWith("a", "following", undefined, null, 10);
  } finally { unsubscribe(); client.clear(); }
});

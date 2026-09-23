import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { FeedMilestone, MilestonePage } from "@/lib/milestoneFeed";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/milestoneFeed", () => ({ getMilestonePage: mocks.get }));
import { milestoneFeedQuery, milestoneKeys, profileMilestonesQuery, resetFeedTimelines } from "./milestoneQueries";

it("separates viewers, modes and profile activity", () => {
  const keys = [milestoneKeys.timeline("a", "explore"), milestoneKeys.timeline("a", "following"), milestoneKeys.timeline("b", "explore"), milestoneKeys.profile("a", "a")];
  expect(new Set(keys.map(key => JSON.stringify(key))).size).toBe(4);
});

it("resets active and inactive timeline pages from the beginning while preserving profiles and other viewers", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page: MilestonePage = { milestones: [], profiles: {}, sources: {}, likes: {}, liked: new Set() };
  mocks.get.mockReset().mockResolvedValue(page);
  const explore = milestoneFeedQuery("a", "explore");
  const following = milestoneFeedQuery("a", "following");
  const profile = profileMilestonesQuery("a", "actor");
  const oldData = { pages: [page, page], pageParams: [null, { id: 20 } as FeedMilestone] };
  for (const key of [explore.queryKey, following.queryKey, profile.queryKey, milestoneKeys.timeline("b", "explore")]) client.setQueryData(key, oldData);
  const observer = new InfiniteQueryObserver(client, explore);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await resetFeedTimelines(client, "a");
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith("a", "explore", undefined, null);
    expect(client.getQueryData(explore.queryKey)?.pages).toHaveLength(1);
    expect(client.getQueryData(following.queryKey)).toBeUndefined();
    expect(client.getQueryData(profile.queryKey)).toEqual(oldData);
    expect(client.getQueryData(milestoneKeys.timeline("b", "explore"))).toEqual(oldData);
    await client.fetchInfiniteQuery(following);
    expect(mocks.get).toHaveBeenLastCalledWith("a", "following", undefined, null);
  } finally { unsubscribe(); client.clear(); }
});

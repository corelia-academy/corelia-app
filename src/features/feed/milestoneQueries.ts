import { infiniteQueryOptions, type QueryClient } from "@tanstack/react-query";
import { getMilestonePage, type FeedMilestone, type FeedMode } from "@/lib/milestoneFeed";

const FEED_PAGE_SIZE = 10;
const FEED_MAX_PAGES = 3;
const PROFILE_PAGE_SIZE = 20;

export const milestoneKeys = {
  all: ["milestone-feed"] as const,
  timelines: (userId: string) => ["milestone-feed", "timeline-v2", userId] as const,
  timeline: (userId: string, mode: FeedMode) => [...milestoneKeys.timelines(userId), mode] as const,
  profile: (userId: string, actorId: string) => ["milestone-feed", "profile", userId, actorId] as const,
};

export function milestoneFeedQuery(userId: string, mode: FeedMode) {
  return infiniteQueryOptions({
    queryKey: milestoneKeys.timeline(userId, mode),
    queryFn: ({ pageParam }) => getMilestonePage(userId, mode, undefined, pageParam, FEED_PAGE_SIZE),
    enabled: Boolean(userId),
    initialPageParam: null as FeedMilestone | null,
    getNextPageParam: (page, pages) => pages.length < FEED_MAX_PAGES && page.milestones.length === FEED_PAGE_SIZE
      ? page.milestones.at(-1)
      : undefined,
    staleTime: 30_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

export function profileMilestonesQuery(userId: string, actorId: string) {
  return infiniteQueryOptions({
    queryKey: milestoneKeys.profile(userId, actorId),
    queryFn: ({ pageParam }) => getMilestonePage(userId, "profile", actorId, pageParam, PROFILE_PAGE_SIZE),
    initialPageParam: null as FeedMilestone | null,
    getNextPageParam: (page) => page.milestones.length === PROFILE_PAGE_SIZE ? page.milestones.at(-1) : undefined,
    staleTime: 30_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

export async function resetFeedTimelines(client: QueryClient, userId: string) {
  // Reset inactive tabs too; old pages must never survive a follow change.
  const queryKey = milestoneKeys.timelines(userId);
  await client.cancelQueries({ queryKey });
  await client.resetQueries({ queryKey });
}

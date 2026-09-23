import { infiniteQueryOptions, type QueryClient } from "@tanstack/react-query";
import { getMilestonePage, type FeedMilestone, type FeedMode } from "@/lib/milestoneFeed";

export const milestoneKeys = {
  all: ["milestone-feed"] as const,
  timelines: (userId: string) => ["milestone-feed", "timeline-v2", userId] as const,
  timeline: (userId: string, mode: FeedMode) => [...milestoneKeys.timelines(userId), mode] as const,
  profile: (userId: string, actorId: string) => ["milestone-feed", "profile", userId, actorId] as const,
};

export function milestoneFeedQuery(userId: string, mode: FeedMode) {
  return infiniteQueryOptions({
    queryKey: milestoneKeys.timeline(userId, mode),
    queryFn: ({ pageParam }) => getMilestonePage(userId, mode, undefined, pageParam),
    enabled: Boolean(userId),
    initialPageParam: null as FeedMilestone | null,
    getNextPageParam: (page) => page.milestones.length === 20 ? page.milestones.at(-1) : undefined,
    staleTime: 30_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

export function profileMilestonesQuery(userId: string, actorId: string) {
  return infiniteQueryOptions({
    queryKey: milestoneKeys.profile(userId, actorId),
    queryFn: ({ pageParam }) => getMilestonePage(userId, "profile", actorId, pageParam),
    initialPageParam: null as FeedMilestone | null,
    getNextPageParam: (page) => page.milestones.length === 20 ? page.milestones.at(-1) : undefined,
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

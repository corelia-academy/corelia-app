import { infiniteQueryOptions } from "@tanstack/react-query";
import { getMilestonePage, type FeedMilestone } from "@/lib/milestoneFeed";
export const milestoneKeys = {
  all: ["milestone-feed"] as const,
  timeline: (userId: string, following: boolean, actorId?: string) => ["milestone-feed","timeline",userId,following,actorId ?? null] as const,
};
export function milestoneFeedQuery(userId: string, following: boolean, actorId?: string) {
  return infiniteQueryOptions({
    queryKey: milestoneKeys.timeline(userId,following,actorId),
    queryFn: ({ pageParam }) => getMilestonePage(userId,following,actorId,pageParam),
    initialPageParam: null as FeedMilestone | null,
    getNextPageParam: (page) => page.milestones.length===20 ? page.milestones.at(-1) : undefined,
    staleTime: 30_000,
    meta: { scope:"private",userId,showInGlobalLoading:false },
  });
}

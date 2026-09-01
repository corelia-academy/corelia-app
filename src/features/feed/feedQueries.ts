import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { getFeed, getFeedPage } from "@/lib/feed";
import { markFeedRead, readFeedLastReadAt } from "@/lib/feedUnread";
import { listFollowing } from "@/lib/follows";

const MAX_UNREAD_SAMPLE = 50;
export const FEED_PAGE_SIZE = 20;

export const feedKeys = {
  all: ["feed"] as const,
  unread: (userId: string | null) =>
    [...feedKeys.all, "unread", userId ?? "anonymous"] as const,
  timeline: (userId: string | null) =>
    [...feedKeys.all, "timeline", userId ?? "anonymous"] as const,
  following: (userId: string | null) =>
    [...feedKeys.all, "following", userId ?? "anonymous"] as const,
};

function privateMeta(userId: string | null) {
  return userId
    ? ({ scope: "private", userId, showInGlobalLoading: false } as const)
    : ({ scope: "public", showInGlobalLoading: false } as const);
}

export function feedTimelineQueryOptions(userId: string | null) {
  return infiniteQueryOptions({
    queryKey: feedKeys.timeline(userId),
    queryFn: ({ pageParam, signal }) =>
      getFeedPage({ cursor: pageParam, limit: FEED_PAGE_SIZE, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.events.length === FEED_PAGE_SIZE
        ? (lastPage.events.at(-1)?.created_at ?? undefined)
        : undefined,
    enabled: userId != null,
    staleTime: 30_000,
    meta: privateMeta(userId),
  });
}

export function feedFollowingQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: feedKeys.following(userId),
    queryFn: ({ signal }) => listFollowing(signal),
    enabled: userId != null,
    staleTime: 30_000,
    meta: privateMeta(userId),
  });
}

function countUnread(createdAts: string[], lastReadAt: string | null): number {
  if (!lastReadAt) return 0;
  const lastReadTime = new Date(lastReadAt).getTime();
  if (!Number.isFinite(lastReadTime)) return 0;
  return createdAts.filter((value) => new Date(value).getTime() > lastReadTime).length;
}

export function feedUnreadQueryOptions(userId: string | null, enabled: boolean) {
  return queryOptions<number>({
    queryKey: feedKeys.unread(userId),
    queryFn: async () => {
      if (!userId) return 0;
      const events = await getFeed({ limit: MAX_UNREAD_SAMPLE });
      const newest = events[0]?.created_at ?? null;
      const lastReadAt = readFeedLastReadAt(userId);
      if (!lastReadAt && newest) {
        markFeedRead(userId, newest);
        return 0;
      }
      return countUnread(
        events.map((event) => event.created_at),
        lastReadAt,
      );
    },
    enabled: enabled && userId != null,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    meta: privateMeta(userId),
  });
}

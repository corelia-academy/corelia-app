import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { isFollowing, listFollowers, listMyFeedFollowingProfiles, listSuggestedFeedProfiles, listUserFollowing, type FollowerPreviewRow } from "@/lib/follows";
import type { FollowSubject } from "@/types/feed";

export const socialKeys = {
  all: ["social"] as const,
  followingState: (userId: string, subject: FollowSubject) =>
    [...socialKeys.all, "following-state", userId, subject.type, subject.id] as const,
  followers: (subject: FollowSubject, limit: number) =>
    [...socialKeys.all, "followers", subject.type, subject.id, limit] as const,
  userFollowing: (userId: string) =>
    [...socialKeys.all, "user-following", userId] as const,
  myFeedFollowing: (userId: string) =>
    [...socialKeys.all, "my-feed-following", userId] as const,
  feedSuggestions: (userId: string) =>
    [...socialKeys.all, "feed-suggestions", userId] as const,
};

export function followingStateQueryOptions(
  userId: string | undefined,
  subject: FollowSubject,
  enabled = true,
) {
  return queryOptions({
    queryKey: socialKeys.followingState(userId || "missing", subject),
    queryFn: () => isFollowing(subject),
    enabled: Boolean(userId && enabled),
    staleTime: 30_000,
    retry: false,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function followersQueryOptions(
  subject: FollowSubject,
  limit: number,
  enabled = true,
) {
  return queryOptions({
    queryKey: socialKeys.followers(subject, limit),
    queryFn: () => listFollowers(subject, limit),
    enabled,
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function userFollowingQueryOptions(userId: string, enabled = true) {
  return queryOptions({
    queryKey: socialKeys.userFollowing(userId),
    queryFn: () => listUserFollowing(userId),
    enabled,
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function myFeedFollowingQueryOptions(userId: string) {
  return infiniteQueryOptions({
    queryKey: socialKeys.myFeedFollowing(userId),
    queryFn: ({ pageParam }) => listMyFeedFollowingProfiles(userId, pageParam),
    enabled: Boolean(userId),
    initialPageParam: null as Pick<FollowerPreviewRow, "id" | "followed_at"> | null,
    getNextPageParam: (page) => page.length === 20 ? page.at(-1) : undefined,
    staleTime: 30_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

export function feedSuggestionsQueryOptions(userId: string, enabled: boolean) {
  return queryOptions({
    queryKey: socialKeys.feedSuggestions(userId),
    queryFn: () => listSuggestedFeedProfiles(userId),
    enabled: Boolean(userId && enabled),
    staleTime: 5 * 60_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

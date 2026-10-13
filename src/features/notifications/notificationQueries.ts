import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  listNotificationPage,
  type NotificationCursor,
} from "@/lib/notifications";
import {
  fetchProjectInviteDisplayContextByProjectIds,
  type ProjectInviteDisplayContext,
} from "@/lib/notificationInviteContext";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string | null) =>
    [...notificationKeys.all, "list", userId ?? "anonymous"] as const,
  inviteContexts: (userId: string | null, projectIds: readonly string[]) =>
    [...notificationKeys.all, "invite-contexts", userId ?? "anonymous", ...projectIds] as const,
};

export function notificationsQueryOptions(userId: string | null, enabled = true, unread = false) {
  return infiniteQueryOptions({
    queryKey: [...notificationKeys.list(userId), unread],
    queryFn: ({ pageParam }) => listNotificationPage(pageParam, unread),
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: page => page.items.length === 20 ? page.items.at(-1) : undefined,
    enabled: enabled && userId != null,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    meta: userId ? { scope: "private", userId, showInGlobalLoading: false } : { scope: "public", showInGlobalLoading: false },
  });
}
export function notificationInviteContextsQueryOptions(
  userId: string | null,
  projectIds: readonly string[],
) {
  return queryOptions<Record<string, ProjectInviteDisplayContext>>({
    queryKey: notificationKeys.inviteContexts(userId, projectIds),
    queryFn: () => fetchProjectInviteDisplayContextByProjectIds([...projectIds]),
    enabled: userId != null && projectIds.length > 0,
    staleTime: 5 * 60_000,
    meta: userId
      ? { scope: "private", userId, showInGlobalLoading: false }
      : { scope: "public", showInGlobalLoading: false },
  });
}

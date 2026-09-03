import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { feedKeys, feedUnreadQueryOptions } from "@/features/feed/feedQueries";
import { FEED_READ_EVENT } from "@/lib/feedUnread";
import { subscribeToActivityEvents } from "@/lib/feed";
import { useAuth } from "@/stores/authStore";

export function useFeedUnreadCount() {
  const { user, isAuthenticated, authInitialized } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const unreadQuery = useQuery(
    feedUnreadQueryOptions(userId, authInitialized && isAuthenticated),
  );

  useEffect(() => {
    if (!authInitialized || !isAuthenticated || !userId) return;

    const unsubscribe = subscribeToActivityEvents("feed-unread", () => {
      void queryClient.invalidateQueries({ queryKey: feedKeys.unread(userId) });
    });

    const handleRead = () =>
      void queryClient.invalidateQueries({ queryKey: feedKeys.unread(userId) });
    window.addEventListener(FEED_READ_EVENT, handleRead);

    return () => {
      unsubscribe();
      window.removeEventListener(FEED_READ_EVENT, handleRead);
    };
  }, [authInitialized, isAuthenticated, queryClient, userId]);

  return unreadQuery.data ?? 0;
}

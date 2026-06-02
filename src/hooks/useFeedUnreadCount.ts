import { useCallback, useEffect, useRef, useState } from "react";

import { getFeed } from "@/lib/feed";
import { FEED_READ_EVENT, markFeedRead, readFeedLastReadAt } from "@/lib/feedUnread";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";

const MAX_UNREAD_SAMPLE = 50;

function countUnread(createdAts: string[], lastReadAt: string | null): number {
  if (!lastReadAt) return 0;
  const lastReadTime = new Date(lastReadAt).getTime();
  if (!Number.isFinite(lastReadTime)) return 0;

  return createdAts.filter((value) => new Date(value).getTime() > lastReadTime).length;
}

export function useFeedUnreadCount() {
  const { user, isAuthenticated, authInitialized } = useAuth();
  const userId = user?.id ?? null;
  const [count, setCount] = useState(0);
  const bootstrappedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      setCount(0);
      bootstrappedRef.current = false;
      return;
    }

    const events = await getFeed({ limit: MAX_UNREAD_SAMPLE });
    const newest = events[0]?.created_at ?? null;
    const lastReadAt = readFeedLastReadAt(userId);

    if (!lastReadAt && newest && !bootstrappedRef.current) {
      markFeedRead(userId, newest);
      bootstrappedRef.current = true;
      setCount(0);
      return;
    }

    bootstrappedRef.current = true;
    setCount(countUnread(events.map((event) => event.created_at), lastReadAt));
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!authInitialized || !isAuthenticated || !userId) return;

    const initialId = window.setTimeout(() => void refresh(), 0);
    const id = window.setInterval(() => void refresh(), 60000);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
  }, [authInitialized, isAuthenticated, refresh, userId]);

  useEffect(() => {
    if (!authInitialized || !isAuthenticated || !userId) return;

    const channel = supabase
      .channel("activity-feed-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const handleRead = () => void refresh();
    window.addEventListener(FEED_READ_EVENT, handleRead);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener(FEED_READ_EVENT, handleRead);
    };
  }, [authInitialized, isAuthenticated, refresh, userId]);

  return count;
}

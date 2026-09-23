import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";
import { advanceXpNotifications, getXpNotificationEntries, initializeXpNotifications, readXpNotificationCursor, saveXpNotificationCursor } from "@/lib/xpNotifications";
import { xpAwardNotificationQueryKey } from "./xpNotificationKeys";

/** Stays mounted across routes and recovers awards after OAuth redirects. */
export function XpNotifications() {
  const { user } = useAuth();
  return user ? <UserXpNotifications key={user.id} userId={user.id} /> : null;
}

function UserXpNotifications({ userId }: { userId: string }) {
  const { t } = useTranslation("account");
  const queryClient = useQueryClient();
  const connectionsSynced = useRef(false);
  const initialFetchObserved = useRef(false);
  const sync = useQuery({
    queryKey: [...xpAwardNotificationQueryKey, userId],
    queryFn: async () => {
      const cursor = await initializeXpNotifications(userId);
      // Baseline first: old history stays quiet, newly synchronized identities notify.
      if (!connectionsSynced.current) {
        const { error } = await supabase.rpc("xp_sync_connections");
        if (error) throw new Error(error.message);
        connectionsSynced.current = true;
      }
      return getXpNotificationEntries(userId, cursor);
    },
    staleTime: 0,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });

  useEffect(() => {
    if (!sync.data) return;
    const cursor = readXpNotificationCursor(userId);
    if (!cursor) return;
    const next = advanceXpNotifications(cursor, sync.data);
    saveXpNotificationCursor(userId, next.cursor);
    if (!initialFetchObserved.current) {
      initialFetchObserved.current = true;
      return;
    }
    if (next.awards.length) {
      const total = next.awards.reduce((sum, row) => sum + row.points, 0);
      toast.success(t("xp.earned", { count: total }), {
        id: `xp:${userId}:${next.awards.map((row) => row.id).join(":")}`,
        duration: 6500,
        closeButton: true,
      });
    }
    if (next.fresh.length) void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "xp" && query.queryKey[1] !== "notifications",
    });
  }, [sync.data, userId, queryClient, t]);
  return null;
}

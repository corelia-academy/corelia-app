import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/stores/authStore";
import { subscribeToNotifications } from "@/lib/notifications";
import { notificationKeys } from "./notificationQueries";

export function NotificationSync() {
  const { user } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToNotifications(user.id, () => { void client.invalidateQueries({ queryKey: notificationKeys.all }); });
  }, [user?.id, client]);
  return null;
}

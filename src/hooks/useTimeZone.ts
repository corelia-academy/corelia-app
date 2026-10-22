import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentProfileQueryOptions } from "@/features/auth/profileQueries";
import { updateProfileForUser } from "@/lib/profile";
import {
  AUTO_TIMEZONE,
  getTimeZonePreference,
  parseTimeZonePreference,
  resolvedTimeZone,
  setTimeZonePreference,
  subscribeTimeZonePreference,
  type TimeZonePreference,
} from "@/lib/timezone";
import { useAuth } from "@/stores/authStore";
import type { Profile } from "@/types/database";

// Profile writes run one at a time so rapid switches cannot land out of order.
let persistQueue: Promise<unknown> = Promise.resolve();

export function useTimeZone() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const preference = useSyncExternalStore(subscribeTimeZonePreference, getTimeZonePreference);

  const setPreference = useCallback(
    async (value: TimeZonePreference) => {
      const previous = getTimeZonePreference();
      const next = parseTimeZonePreference(value);
      setTimeZonePreference(next);
      if (!user) return;

      const timezone = next === AUTO_TIMEZONE ? null : next;
      try {
        const write = persistQueue.then(() => updateProfileForUser(user, { timezone }));
        persistQueue = write.catch(() => undefined);
        await write;
        queryClient.setQueryData(
          currentProfileQueryOptions(user).queryKey,
          (old: Profile | null | undefined) => (old ? { ...old, timezone } : old),
        );
      } catch (error) {
        // Only roll back if no newer choice has replaced this one meanwhile.
        if (getTimeZonePreference() === next) setTimeZonePreference(previous);
        throw error;
      }
    },
    [queryClient, user],
  );

  return { preference, timeZone: resolvedTimeZone(), setPreference };
}

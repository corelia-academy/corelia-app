import { queryOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { getProfileForUser } from "@/lib/profile";
import type { Profile } from "@/types/database";

export const profileKeys = {
  all: ["profile"] as const,
  current: (userId: string) => [...profileKeys.all, "current", userId] as const,
  anonymous: () => [...profileKeys.all, "anonymous"] as const,
};

export function currentProfileQueryOptions(user: User | null) {
  return queryOptions<Profile | null>({
    queryKey: user ? profileKeys.current(user.id) : profileKeys.anonymous(),
    queryFn: user ? () => getProfileForUser(user) : async () => null,
    enabled: user != null,
    staleTime: 30_000,
    retry: false,
    meta: user
      ? { scope: "private", userId: user.id, showInGlobalLoading: true }
      : { scope: "public", showInGlobalLoading: false },
  });
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { adminKeys, adminProfilesQueryOptions } from "@/features/admin/adminQueries";
import type { Profile } from "@/types/database";
import { useAuth } from "@/stores/authStore";

export function useAdminProfiles({
  fallbackErrorMessage,
}: {
  fallbackErrorMessage: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(adminProfilesQueryOptions(user?.id));
  const [mutationError, setMutationError] = useState<string | null>(null);
  const setProfiles: Dispatch<SetStateAction<Profile[]>> = useCallback(
    (update) => queryClient.setQueryData<Profile[]>(adminKeys.profiles(user?.id ?? "missing"), (previous = []) =>
      typeof update === "function" ? update(previous) : update,
    ),
    [queryClient, user?.id],
  );

  return {
    profiles: query.data ?? [],
    setProfiles,
    loading: query.isPending,
    error: mutationError ?? (query.error instanceof Error ? query.error.message : query.error ? fallbackErrorMessage : null),
    refresh: async () => { await query.refetch(); },
    setError: setMutationError,
  };
}

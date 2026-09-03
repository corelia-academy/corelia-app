import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { adminCourseCountsQueryOptions, adminKeys } from "@/features/admin/adminQueries";
import { useAuth } from "@/stores/authStore";

export function useCourseCountsByInstructor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery(adminCourseCountsQueryOptions(user?.id));
  const setCounts = useCallback(
    (counts: Record<string, number>) =>
      queryClient.setQueryData(adminKeys.courseCounts(user?.id ?? "missing"), counts),
    [queryClient, user?.id],
  );
  return {
    counts: query.data ?? {},
    loading: query.isPending,
    refresh: async () => { await query.refetch(); },
    setCounts,
  };
}

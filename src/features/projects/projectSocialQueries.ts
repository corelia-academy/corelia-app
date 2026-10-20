import { queryOptions } from "@tanstack/react-query";

import {
  listMyProjectHeartIds,
} from "@/lib/projectSocial";

export const projectSocialKeys = {
  all: ["project-social"] as const,
  heart: (userId: string, projectId: string) =>
    [...projectSocialKeys.all, "heart", userId, projectId] as const,
  hearts: (userId: string, projectIds: readonly string[]) =>
    [...projectSocialKeys.all, "hearts", userId, ...projectIds] as const,
  allHearts: (userId: string) =>
    [...projectSocialKeys.all, "hearts", userId, "all"] as const,
};

export function projectHeartQueryOptions(
  userId: string | undefined,
  projectId: string,
  enabled = true,
) {
  return queryOptions({
    queryKey: projectSocialKeys.heart(userId || "missing", projectId),
    queryFn: async () => (await listMyProjectHeartIds([projectId])).has(projectId),
    enabled: Boolean(userId && enabled),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function projectHeartsQueryOptions(
  userId: string | undefined,
  projectIds: string[],
  includeAllProjectIds = false,
) {
  const ids = Array.from(new Set(projectIds.filter(Boolean))).sort();
  return queryOptions({
    queryKey: includeAllProjectIds
      ? projectSocialKeys.allHearts(userId || "missing")
      : projectSocialKeys.hearts(userId || "missing", ids),
    queryFn: () => listMyProjectHeartIds(includeAllProjectIds ? undefined : ids),
    enabled: Boolean(userId && (includeAllProjectIds || ids.length)),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

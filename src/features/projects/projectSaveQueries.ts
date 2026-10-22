import { queryOptions } from "@tanstack/react-query";

import { listMyProjectSaveIds } from "@/lib/projectSaves";
import { keepPreviousDataForUser } from "@/lib/queryClient";

export const projectSaveKeys = {
  all: ["project-saves"] as const,
  project: (userId: string, projectId: string) =>
    [...projectSaveKeys.all, "project", userId, projectId] as const,
  projects: (userId: string, projectIds: readonly string[]) =>
    [...projectSaveKeys.all, userId, ...projectIds] as const,
};

export function projectSaveQueryOptions(
  userId: string | undefined,
  projectId: string,
  enabled = true,
) {
  return queryOptions({
    queryKey: projectSaveKeys.project(userId || "missing", projectId),
    queryFn: async () => (await listMyProjectSaveIds([projectId])).has(projectId),
    enabled: Boolean(userId && enabled),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function projectSavesQueryOptions(
  userId: string | undefined,
  projectIds: string[],
) {
  const ids = Array.from(new Set(projectIds.filter(Boolean))).sort();

  return queryOptions({
    queryKey: projectSaveKeys.projects(userId || "missing", ids),
    queryFn: () => listMyProjectSaveIds(ids),
    enabled: Boolean(userId && ids.length),
    staleTime: 30_000,
    placeholderData: keepPreviousDataForUser(userId),
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

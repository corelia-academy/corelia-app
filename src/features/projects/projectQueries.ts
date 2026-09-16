import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  getProjectBySlugOrId,
  listPublicProjects,
  type PublicProjectSort,
  type PublicProjectSourceFilter,
} from "@/lib/projects";
import { listPublicProjectTeams } from "@/lib/projectCollaboration";

const DIRECTORY_PAGE_SIZE = 12;
const publicMeta = { scope: "public", showInGlobalLoading: false } as const;

export const projectKeys = {
  all: ["projects"] as const,
  directory: (
    locale: string,
    source: PublicProjectSourceFilter,
    sort: PublicProjectSort,
    hackathonId = "all",
    taxonomyKey = "all",
  ) => [...projectKeys.all, "directory", locale, source, sort, hackathonId, taxonomyKey] as const,
  detail: (projectId: string, locale: string) =>
    [...projectKeys.all, "detail", projectId, locale] as const,
  teams: (projectIds: string[]) => [...projectKeys.all, "teams", ...projectIds] as const,
};

export function publicProjectTeamsQueryOptions(projectIds: string[]) {
  const ids = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean))).sort();
  return queryOptions({
    queryKey: projectKeys.teams(ids),
    queryFn: () => listPublicProjectTeams(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicProjectDirectoryQueryOptions(
  locale: string,
  source: PublicProjectSourceFilter,
  sort: PublicProjectSort,
  filters: {
    hackathonId?: string | null;
    trackIds?: string[];
    sectorIds?: string[];
    techStackIds?: string[];
    winnerProjectIds?: string[];
  } = {},
) {
  const taxonomyKey = JSON.stringify([
    filters.trackIds ?? [],
    filters.sectorIds ?? [],
    filters.techStackIds ?? [],
    filters.winnerProjectIds ?? [],
  ]);
  return infiniteQueryOptions({
    queryKey: projectKeys.directory(
      locale,
      source,
      sort,
      filters.hackathonId ?? "all",
      taxonomyKey,
    ),
    queryFn: ({ pageParam }) =>
      listPublicProjects({
        locale,
        source,
        sort,
        ...filters,
        limit: DIRECTORY_PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicProjectDetailQueryOptions(
  projectId: string | undefined,
  locale: string,
) {
  const normalizedId = projectId?.trim() ?? "";
  return queryOptions({
    queryKey: projectKeys.detail(normalizedId || "missing", locale),
    queryFn: () => getProjectBySlugOrId(normalizedId, locale),
    enabled: normalizedId.length > 0,
    staleTime: 60_000,
    meta: publicMeta,
  });
}

/** Editors always load source text; UI language must not overwrite it with a translation. */
export function projectEditorQueryOptions(projectId: string | undefined, userId: string | undefined) {
  return queryOptions({
    queryKey: [...projectKeys.all, "editor", projectId, userId],
    queryFn: () => getProjectBySlugOrId(projectId!, null, true),
    enabled: Boolean(projectId && userId),
    staleTime: 0,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

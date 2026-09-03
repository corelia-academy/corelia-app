import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  getProjectBySlugOrId,
  listPublicProjects,
  type PublicProjectSort,
  type PublicProjectSourceFilter,
} from "@/lib/projects";

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
};

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

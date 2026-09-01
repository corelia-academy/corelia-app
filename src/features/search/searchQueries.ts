import { queryOptions } from "@tanstack/react-query";

import { listTrendingSearches, searchPublic } from "@/lib/search";

export const searchKeys = {
  all: ["search"] as const,
  results: (query: string, limit: number) => [...searchKeys.all, "results", query, limit] as const,
  trending: () => [...searchKeys.all, "trending"] as const,
};

export function searchResultsQueryOptions(query: string, limit: number, enabled = true) {
  const normalized = query.trim();
  return queryOptions({
    queryKey: searchKeys.results(normalized, limit),
    queryFn: () => searchPublic(normalized, limit),
    enabled: enabled && normalized.length > 0,
    staleTime: 30_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function trendingSearchesQueryOptions() {
  return queryOptions({
    queryKey: searchKeys.trending(),
    queryFn: () => listTrendingSearches(8),
    staleTime: 5 * 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

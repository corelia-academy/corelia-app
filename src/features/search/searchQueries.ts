import { normalizeContentLocale } from "@/lib/entityLocales";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { getSearchProfiles, listTrendingSearches, searchPublic } from "@/lib/search";

export const searchKeys = {
  all: ["search"] as const,
  results: (query: string, limit: number, locale?: string) => [...searchKeys.all, "results", query, limit, locale ? normalizeContentLocale(locale) : "default"] as const,
  trending: () => [...searchKeys.all, "trending"] as const,
  profiles: (ids: string[]) => [...searchKeys.all, "profiles", ...ids] as const,
};

export function searchResultsQueryOptions(query: string, limit: number, enabled = true, locale?: string) {
  const normalized = query.trim();
  return queryOptions({
    queryKey: searchKeys.results(normalized, limit, locale),
    queryFn: () => searchPublic(normalized, limit, 0, locale),
    enabled: enabled && normalized.length > 0,
    staleTime: 30_000,
    // A new query keeps the previous results (dimmed) instead of blanking to skeletons.
    placeholderData: keepPreviousData,
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

export function searchProfilesQueryOptions(profileIds: string[]) {
  const ids = Array.from(new Set(profileIds.filter(Boolean))).sort();
  return queryOptions({
    queryKey: searchKeys.profiles(ids),
    queryFn: () => getSearchProfiles(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

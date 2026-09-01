import { queryOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import {
  getContestBySlug,
  getHackathonLocaleContent,
  hasHackathonCoOrganizerAccess,
  listContests,
} from "@/lib/hackathons";
import { listContestShowcasePortfolio } from "@/lib/projects";
import { resolveContestLearningLinks } from "@/lib/hackathonLearning";

export const hackathonKeys = {
  all: ["hackathons"] as const,
  catalog: (viewerId: string, locale: string) =>
    [...hackathonKeys.all, "catalog", viewerId, locale] as const,
  coOrganizerAccess: (userId: string, email: string) =>
    [...hackathonKeys.all, "co-organizer-access", userId, email] as const,
  publicDetail: (slug: string, locale: string) =>
    [...hackathonKeys.all, "public-detail", slug, locale] as const,
  showcase: (contestId: string) =>
    [...hackathonKeys.all, "showcase", contestId] as const,
  learning: (courseIds: string[], trackIds: string[]) =>
    [...hackathonKeys.all, "learning", ...courseIds, "tracks", ...trackIds] as const,
  localeContent: (contestId: string, locale: string, userId: string) =>
    [...hackathonKeys.all, "locale-content", contestId, locale, userId] as const,
};

export function hackathonLocaleContentQueryOptions(input: {
  contestId: string;
  locale: "vi" | "en";
  userId: string | undefined;
  enabled: boolean;
}) {
  return queryOptions({
    queryKey: hackathonKeys.localeContent(
      input.contestId,
      input.locale,
      input.userId ?? "missing",
    ),
    queryFn: ({ signal }) =>
      getHackathonLocaleContent(input.contestId, input.locale, signal),
    enabled: input.enabled && Boolean(input.contestId && input.userId),
    staleTime: 60_000,
    meta: {
      scope: "private",
      userId: input.userId ?? "missing",
      showInGlobalLoading: false,
    },
  });
}

export function hackathonCatalogQueryOptions(
  viewer: User | null,
  locale: string,
  enabled = true,
) {
  const viewerId = viewer?.id ?? "anonymous";
  return queryOptions({
    queryKey: hackathonKeys.catalog(viewerId, locale),
    queryFn: () => listContests(viewer, locale),
    enabled,
    staleTime: 60_000,
    meta: viewer
      ? {
          scope: "private",
          userId: viewer.id,
          showInGlobalLoading: false,
        }
      : { scope: "public", showInGlobalLoading: false },
  });
}

export function publicHackathonShowcaseQueryOptions(contestId: string) {
  return queryOptions({
    queryKey: hackathonKeys.showcase(contestId),
    queryFn: () => listContestShowcasePortfolio(contestId),
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function hackathonLearningLinksQueryOptions(
  courseIds: string[],
  trackIds: string[],
) {
  const normalizedCourseIds = Array.from(new Set(courseIds.filter(Boolean))).sort();
  const normalizedTrackIds = Array.from(new Set(trackIds.filter(Boolean))).sort();
  return queryOptions({
    queryKey: hackathonKeys.learning(normalizedCourseIds, normalizedTrackIds),
    queryFn: () => resolveContestLearningLinks(normalizedCourseIds, normalizedTrackIds),
    enabled: normalizedCourseIds.length > 0 || normalizedTrackIds.length > 0,
    staleTime: 5 * 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function hackathonCoOrganizerAccessQueryOptions(
  userId: string | null | undefined,
  email: string | null | undefined,
  enabled = true,
) {
  const normalized = email?.trim().toLowerCase() ?? "";
  const normalizedUserId = userId ?? "";
  return queryOptions({
    queryKey: hackathonKeys.coOrganizerAccess(
      normalizedUserId || "missing",
      normalized || "missing",
    ),
    queryFn: () => hasHackathonCoOrganizerAccess(normalized),
    enabled: Boolean(enabled && normalizedUserId && normalized),
    staleTime: 5 * 60_000,
    meta: {
      scope: "private",
      userId: normalizedUserId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function publicHackathonDetailQueryOptions(
  slug: string | undefined,
  locale: string,
) {
  const normalizedSlug = slug?.trim() ?? "";
  return queryOptions({
    queryKey: hackathonKeys.publicDetail(normalizedSlug || "missing", locale),
    queryFn: () => getContestBySlug(normalizedSlug, locale),
    enabled: normalizedSlug.length > 0,
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { getProfileCourseSkills, getPublishedCoursesByInstructor } from "@/lib/courses";
import {
  fetchPublicProfileCredentialIssuances,
  issuanceToBadgeItem,
} from "@/lib/credentialIssuances";
import { getActorActivity } from "@/lib/feed";
import { getUserFollowingProfileCount } from "@/lib/follows";
import { getPublicProfileByHandle, getPublicProfileById } from "@/lib/profile";
import { listPublicPortfolioProjects } from "@/lib/projects";
import { listPublicProfileContestPortfolio } from "@/lib/hackathons";

const ACTIVITY_PAGE_SIZE = 5;

export const publicProfileKeys = {
  all: ["public-profiles"] as const,
  layout: (handle: string) => [...publicProfileKeys.all, "layout", handle] as const,
  achievements: (profileId: string) =>
    [...publicProfileKeys.all, "achievements", profileId] as const,
  skills: (profileId: string) => [...publicProfileKeys.all, "skills", profileId] as const,
  courses: (profileId: string) => [...publicProfileKeys.all, "courses", profileId] as const,
  activity: (profileId: string) => [...publicProfileKeys.all, "activity", profileId] as const,
  projects: (profileId: string, locale: string) =>
    [...publicProfileKeys.all, "projects", profileId, locale] as const,
  contests: (profileId: string, isSelf: boolean, locale: string) =>
    [...publicProfileKeys.all, "contests", profileId, isSelf, locale] as const,
};

const publicMeta = { scope: "public", showInGlobalLoading: false } as const;

export function publicProfileLayoutQueryOptions(handle: string | undefined) {
  const normalized = handle?.trim() ?? "";
  return queryOptions({
    queryKey: publicProfileKeys.layout(normalized || "missing"),
    queryFn: async () => {
      const profile = await getPublicProfileByHandle(normalized);
      const followingProfileCount = profile?.profile_public
        ? await getUserFollowingProfileCount(profile.id).catch(() => 0)
        : 0;
      return { profile, followingProfileCount };
    },
    enabled: normalized.length > 0,
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicAchievementsQueryOptions(profileId: string | undefined) {
  return queryOptions({
    queryKey: publicProfileKeys.achievements(profileId || "missing"),
    queryFn: async () => {
      const [profile, issuances] = await Promise.all([
        getPublicProfileById(profileId!),
        fetchPublicProfileCredentialIssuances(profileId!),
      ]);
      return issuances.map((row) => issuanceToBadgeItem(row, profile?.ocid));
    },
    enabled: Boolean(profileId),
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicProfileSkillsQueryOptions(profileId: string) {
  return queryOptions({
    queryKey: publicProfileKeys.skills(profileId),
    queryFn: () => getProfileCourseSkills(profileId),
    staleTime: 5 * 60_000,
    meta: publicMeta,
  });
}

export function publicInstructorCoursesQueryOptions(
  profileId: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: publicProfileKeys.courses(profileId),
    queryFn: () => getPublishedCoursesByInstructor(profileId),
    enabled,
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicProfileActivityQueryOptions(profileId: string) {
  return infiniteQueryOptions({
    queryKey: publicProfileKeys.activity(profileId),
    queryFn: ({ pageParam }) =>
      getActorActivity(profileId, {
        limit: ACTIVITY_PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length === ACTIVITY_PAGE_SIZE
        ? lastPage[lastPage.length - 1]?.created_at ?? undefined
        : undefined,
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicProfileProjectsQueryOptions(profileId: string, locale: string) {
  return queryOptions({
    queryKey: publicProfileKeys.projects(profileId, locale),
    queryFn: () => listPublicPortfolioProjects(profileId, locale),
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function publicProfileContestsQueryOptions(
  profileId: string,
  isSelf: boolean,
  locale: string,
) {
  return queryOptions({
    queryKey: publicProfileKeys.contests(profileId, isSelf, locale),
    queryFn: () => listPublicProfileContestPortfolio(profileId, isSelf, locale),
    staleTime: 60_000,
    meta: isSelf
      ? { scope: "private", userId: profileId, showInGlobalLoading: false }
      : publicMeta,
  });
}

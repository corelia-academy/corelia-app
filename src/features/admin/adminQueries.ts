import { queryOptions } from "@tanstack/react-query";

import { getCoursesForManagement } from "@/lib/courses";
import { getAllProfiles } from "@/lib/profile";
import { getPublicProfileById } from "@/lib/profile";
import {
  countIssuancesByTemplateIds,
  listActivityMilestoneTemplates,
  listManualBadgeTemplates,
} from "@/lib/credentialTemplates";
import { listManualMintHistoryForAdmin } from "@/lib/manualMintHistory";
import { getSystemSetting } from "@/lib/systemSettings";

export const adminKeys = {
  all: ["admin"] as const,
  profiles: (userId: string) => [...adminKeys.all, userId, "profiles"] as const,
  courseCounts: (userId: string) => [...adminKeys.all, userId, "course-counts"] as const,
  manualMintTemplates: (userId: string) => [...adminKeys.all, userId, "manual-mint-templates"] as const,
  manualMintHistory: (userId: string) => [...adminKeys.all, userId, "manual-mint-history"] as const,
  profilePreview: (userId: string, profileId: string) =>
    [...adminKeys.all, userId, "profile-preview", profileId] as const,
  branding: (userId: string) => [...adminKeys.all, userId, "branding"] as const,
  activityMilestones: (userId: string) =>
    [...adminKeys.all, userId, "activity-milestones"] as const,
};

const adminMeta = (userId: string | undefined) => ({
  scope: "private",
  userId: userId ?? "missing",
  showInGlobalLoading: false,
}) as const;

export function adminProfilesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: adminKeys.profiles(userId ?? "missing"),
    queryFn: getAllProfiles,
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: adminMeta(userId),
  });
}

export function adminCourseCountsQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: adminKeys.courseCounts(userId ?? "missing"),
    queryFn: async () => {
      const courses = await getCoursesForManagement("", true);
      const counts: Record<string, number> = {};
      for (const course of courses) {
        counts[course.instructor_id] = (counts[course.instructor_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: adminMeta(userId),
  });
}

export function manualMintTemplatesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: adminKeys.manualMintTemplates(userId ?? "missing"),
    queryFn: listManualBadgeTemplates,
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: adminMeta(userId),
  });
}

export function manualMintHistoryQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: adminKeys.manualMintHistory(userId ?? "missing"),
    queryFn: listManualMintHistoryForAdmin,
    enabled: Boolean(userId),
    staleTime: 15_000,
    meta: adminMeta(userId),
  });
}

export function adminProfilePreviewQueryOptions(
  profileId: string | null,
  userId: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: adminKeys.profilePreview(userId ?? "missing", profileId || "missing"),
    queryFn: () => getPublicProfileById(profileId!),
    enabled: Boolean(profileId && userId && enabled),
    staleTime: 60_000,
    meta: adminMeta(userId),
  });
}

export function adminBrandingQueryOptions(
  logoKey: string,
  appBaseUrlKey: string,
  userId: string | undefined,
) {
  return queryOptions({
    queryKey: adminKeys.branding(userId ?? "missing"),
    queryFn: async () => {
      const [logoUrl, appBaseUrl] = await Promise.all([
        getSystemSetting(logoKey),
        getSystemSetting(appBaseUrlKey),
      ]);
      return { logoUrl: logoUrl ?? "", appBaseUrl: appBaseUrl ?? "" };
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    meta: adminMeta(userId),
  });
}

export function activityMilestonesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: adminKeys.activityMilestones(userId ?? "missing"),
    queryFn: async () => {
      const templates = await listActivityMilestoneTemplates();
      const rows = templates.filter((row) => row.trigger_type !== "manual");
      const counts = await countIssuancesByTemplateIds(rows.map((row) => row.id));
      return { rows, counts };
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: adminMeta(userId),
  });
}

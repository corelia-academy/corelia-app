import type { Profile } from "@/types/database";
import type { Contest, ContestScopedViewerRole } from "@/types/contests";
import type { OfflineCohort } from "@/types/offline";
import { ROLE_GROUPS } from "@/config/roles";

export function canManageContests(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return ROLE_GROUPS.admin.includes(profile.role);
}

export function canManageOfflineAcademy(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "support_staff") return true;
  if (profile.role === "instructor" && profile.instructor_origin === "corelia") {
    return true;
  }
  return false;
}

export function canCoordinateOfflineRoster(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === "admin" || profile.role === "support_staff";
}

export function canManageOfflineCohort(
  cohort: OfflineCohort | null | undefined,
  profile: Profile | null | undefined,
): boolean {
  if (!cohort || !profile || !canManageOfflineAcademy(profile)) return false;
  if (profile.role === "admin" || profile.role === "support_staff") return true;
  return (
    cohort.instructor_id === profile.id ||
    (cohort.coordinator_ids ?? []).includes(profile.id)
  );
}

export function getContestScopedViewerRoles(
  contest: Contest | null | undefined,
  email: string | null | undefined,
): ContestScopedViewerRole[] {
  if (!contest || !email) return [];
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const roles: ContestScopedViewerRole[] = [];
  if ((contest.judge_emails ?? []).some((item) => item.toLowerCase() === normalized)) {
    roles.push("judge");
  }
  if (
    (contest.co_host_viewer_emails ?? []).some(
      (item) => item.toLowerCase() === normalized,
    )
  ) {
    roles.push("co_host_viewer");
  }
  return roles;
}

export function canReviewContestApplications(
  contest: Contest | null | undefined,
  profile: Profile | null | undefined,
): boolean {
  return contest != null && canManageContests(profile);
}

export function canScoreContest(
  contest: Contest | null | undefined,
  profile: Profile | null | undefined,
  email: string | null | undefined,
): boolean {
  return (
    canManageContests(profile) ||
    getContestScopedViewerRoles(contest, email).includes("judge")
  );
}

export function canViewContestAggregateMetrics(
  contest: Contest | null | undefined,
  profile: Profile | null | undefined,
  email: string | null | undefined,
): boolean {
  return (
    canManageContests(profile) || getContestScopedViewerRoles(contest, email).length > 0
  );
}

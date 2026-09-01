import { ROLE_GROUPS } from "../config/roles";
import type { Profile } from "../types/database";
import type { Contest, ContestScopedViewerRole } from "../types/hackathons";

export function canManageContests(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return ROLE_GROUPS.contestManagers.includes(profile.role);
}

export function canAccessContestManagementCatalog(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return canManageContests(profile);
}

export function getContestScopedViewerRoles(
  contest: Contest | null | undefined,
  email: string | null | undefined,
): ContestScopedViewerRole[] {
  void contest;
  void email;
  return [];
}

export function canReviewContestApplications(
  contest: Contest | null | undefined,
  profile: Profile | null | undefined,
): boolean {
  if (!contest) return false;
  if (canManageContests(profile)) return true;
  if (!profile?.email) return false;
  return getContestScopedViewerRoles(contest, profile.email).includes("reviewer");
}

export function canScoreContest(
  contest: Contest | null | undefined,
  profile: Profile | null | undefined,
  email: string | null | undefined,
): boolean {
  return (
    canManageContests(profile) ||
    getContestScopedViewerRoles(contest, email).some((role) =>
      ["judge", "co_organizer"].includes(role),
    )
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

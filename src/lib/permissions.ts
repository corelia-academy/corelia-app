import type { Profile } from "@/types/database";
import type { Contest, ContestScopedViewerRole } from "@/types/hackathons";
import { ROLE_GROUPS } from "@/config/roles";

export function canManageContests(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return ROLE_GROUPS.admin.includes(profile.role);
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
    (contest.co_organizer_emails ?? []).some(
      (item) => item.toLowerCase() === normalized,
    )
  ) {
    roles.push("co_organizer");
  }
  if (
    (contest.co_host_viewer_emails ?? []).some(
      (item) => item.toLowerCase() === normalized,
    )
  ) {
    roles.push("co_host_viewer");
  }
  if (
    (contest.partner_viewer_emails ?? []).some(
      (item) => item.toLowerCase() === normalized,
    )
  ) {
    roles.push("partner_viewer");
  }
  if ((contest.mentor_emails ?? []).some((item) => item.toLowerCase() === normalized)) {
    roles.push("mentor");
  }
  if (
    (contest.reviewer_emails ?? []).some(
      (item) => item.toLowerCase() === normalized,
    )
  ) {
    roles.push("reviewer");
  }
  return roles;
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

import {
  canManageContests,
  canReviewContestApplications,
  canScoreContest,
  canViewContestAggregateMetrics,
  getContestScopedViewerRoles,
} from "@/lib/permissions";
import type { Contest } from "@/types/contests";
import type { Profile } from "@/types/database";

export type ContestDetailPermissions = {
  isManager: boolean;
  canReview: boolean;
  canJudge: boolean;
  canViewAggregate: boolean;
  viewerRoles: ReturnType<typeof getContestScopedViewerRoles>;
  isManageView: boolean;
  canAccessWorkspace: boolean;
};

export function deriveContestDetailPermissions({
  contest,
  profile,
  userEmail,
  forceManageView,
  pathname,
}: {
  contest: Contest | null;
  profile: Profile | null;
  userEmail: string | null | undefined;
  forceManageView?: boolean;
  pathname: string;
}): ContestDetailPermissions {
  const isManager = canManageContests(profile);
  const canReview = canReviewContestApplications(contest, profile);
  const canJudge = canScoreContest(contest, profile, userEmail);
  const canViewAggregate = canViewContestAggregateMetrics(contest, profile, userEmail);
  const viewerRoles = getContestScopedViewerRoles(contest, userEmail);
  const isManageView = forceManageView ?? pathname.endsWith("/manage");
  const canAccessWorkspace = isManager || canJudge || canViewAggregate;

  return {
    isManager,
    canReview,
    canJudge,
    canViewAggregate,
    viewerRoles,
    isManageView,
    canAccessWorkspace,
  };
}


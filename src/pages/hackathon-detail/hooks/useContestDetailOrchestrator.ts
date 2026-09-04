import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  blastContestEmail,
  buildContestLeaderboard,
  createContestAccessInvite,
  deleteContest,
  publishContestResults,
  refreshContestMetricsSnapshot,
  registerForContest,
  respondToContestAccessInvite,
  reviewContestRegistration,
  revokeContestAccessInvite,
  scoreContestSubmission,
  updateContest,
  upsertContestSubmission,
  isPastContestRegistrationDeadline,
  isPastContestSubmissionDeadline,
  type BlastEmailFilter,
  type BlastEmailResult,
} from "@/lib/hackathons";
import {
  createProjectCollaborationInvite,
  removeProjectCollaborator,
  revokeProjectCollaborationInvite,
  type InvitableUserRow,
  type ProjectCollaborationInviteRow,
  type ProjectCollaboratorRow,
} from "@/lib/projectCollaboration";
import {
  invitableHackathonUsersQueryOptions,
  projectCollaborationWorkspaceQueryOptions,
} from "@/features/projects/projectCollaborationQueries";
import {
  deleteStorageObjectByPath,
  uploadContestBanner,
  uploadContestOrganizationalPartnerLogo,
  uploadContestThumbnail,
} from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type {
  Contest,
  ContestAccessInvite,
  ContestScopedViewerRole,
  ContestScore,
  ContestWinnerInput,
  ContestTimelineMilestone,
} from "@/types/hackathons";
import { useTranslation } from "react-i18next";
import { buildContestTimelineRows } from "@/components/hackathons/contestTimelineBuilders";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
} from "@/pages/hackathon-detail/utils/datetime";
import { validateContestScheduleInputs } from "@/lib/hackathonScheduleValidation";
import {
  formatContestCountdown,
  downloadTextFile,
} from "@/pages/hackathon-detail/utils/contestDetailHelpers";
import { contestPublicShowcaseProjectsNavVisible } from "@/pages/hackathon-detail/utils/contestShowcase";
import {
  deriveHackathonLifecycle,
  getContestLifecycleDatetimes,
  getHackathonCountdownTarget,
  parseLifecycleInstantMs,
} from "@/pages/hackathon-detail/utils/contestLifecycle";
import { formatContestDate } from "@/pages/hackathon-detail/utils/formatContestDate";
import { contestDetailPayloadQueryOptions } from "@/features/hackathons/contestDetailQuery";
import { hackathonKeys } from "@/features/hackathons/hackathonQueries";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";
import { deriveContestDetailPermissions } from "./useContestDetailPermissions";
import { useContestInviteWorkspace } from "./useContestInviteWorkspace";
import { useContestJudgingWorkspace } from "./useContestJudgingWorkspace";
import { useContestLoad } from "./useContestLoad";
import { useContestDetailLabels } from "./useContestDetailLabels";
import { useContestManagerWorkspace } from "./useContestManagerWorkspace";
import {
  useContestRegistrationFlow,
  type RegistrationDecisionStatus,
} from "./useContestRegistrationFlow";

const API_ERROR_I18N: Record<string, string> = {
  "unauthenticated": "detail.errors.unauthenticated",
  "forbidden:manage_contest": "detail.errors.forbiddenManage",
  "forbidden:score_contest": "detail.errors.forbiddenScore",
  "forbidden:review_applications": "detail.errors.forbiddenReview",
  "forbidden:submission_not_approved": "detail.errors.submissionNotApproved",
  "forbidden:submission_deadline_passed": "detail.errors.submissionDeadlinePassed",
  "not_found:contest": "detail.errors.notFound",
  "not_found:registration": "detail.errors.notFound",
  "not_found:invite": "detail.errors.notFound",
  "invalid_input:invite_email": "detail.errors.invalidInviteEmail",
  "invalid_input:score_out_of_range": "detail.toasts.scoreCriterionOutOfRange",
  "missing_email:account": "detail.errors.missingAccountEmail",
};

const EMPTY_COLLAB_MEMBERS: ProjectCollaboratorRow[] = [];
const EMPTY_COLLAB_INVITES: ProjectCollaborationInviteRow[] = [];
const EMPTY_INVITABLE_USERS: InvitableUserRow[] = [];

function translateApiError(
  err: unknown,
  translate: (key: string) => string,
  fallbackKey: string,
): string {
  if (err instanceof Error) {
    const mapped = API_ERROR_I18N[err.message];
    if (mapped) return translate(mapped);
    return err.message;
  }
  return translate(fallbackKey);
}

export function useContestDetailOrchestrator({
  forceManageView,
  prefetchedContest,
  onContestSynced,
}: {
  forceManageView?: boolean;
  prefetchedContest?: Contest | null;
  onContestSynced?: (next: Contest) => void;
} = {}) {
  const { t, i18n } = useTranslation("contests");
  const queryClient = useQueryClient();
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { slug, section: manageSectionParam } = useParams<{
    slug: string;
    section?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    profile,
    profileLoading,
    user,
    isAuthenticated,
    authInitialized,
  } = useAuth();

  const contestLoad = useContestLoad({
    contestSlug: slug,
    prefetchedContest,
  });
  const { contest, setContest } = contestLoad;
  const id = contest?.id;

  const registrationFlow = useContestRegistrationFlow();
  const {
    registration,
    setRegistration,
    registrations,
    reviewNotes,
    setReviewNotes,
    savingReviewId,
    setSavingReviewId,
    motivation,
    setMotivation,
    applying,
    setApplying,
    hydrateFromPayload: hydrateRegistrationFromPayload,
  } = registrationFlow;

  const judging = useContestJudgingWorkspace();
  const {
    submissions,
    scores,
    mySubmission,
    setMySubmission,
    savingScoreId,
    setSavingScoreId,
    selectedTrackId,
    setSelectedTrackId,
    selectedRoundId,
    setSelectedRoundId,
    submissionTitle,
    setSubmissionTitle,
    submissionSummary,
    setSubmissionSummary,
    submissionDemoUrl,
    setSubmissionDemoUrl,
    submissionRepoUrl,
    setSubmissionRepoUrl,
    submissionSlideUrl,
    setSubmissionSlideUrl,
    submissionVideoUrl,
    setSubmissionVideoUrl,
    savingSubmission,
    setSavingSubmission,
    winnerAwards,
    setWinnerAwards,
    winnerNotes,
    setWinnerNotes,
    scoreDrafts,
    setScoreDrafts,
    hydrateFromPayload: hydrateJudgingFromPayload,
  } = judging;

  const [collabInviteeQuery, setCollabInviteeQuery] = useState("");
  const [debouncedCollabInviteeQuery, setDebouncedCollabInviteeQuery] = useState("");
  const [inviteSendingUserId, setInviteSendingUserId] = useState<string | null>(null);
  const collaborationOptions = projectCollaborationWorkspaceQueryOptions({
    userId: user?.id,
    contestId: id,
    enabled:
      registration?.status === "approved" && Boolean(mySubmission),
  });
  const collaborationQuery = useQuery(collaborationOptions);
  const refetchCollaboration = collaborationQuery.refetch;
  const collabProject = collaborationQuery.data?.project ?? null;
  const collabMembers = collaborationQuery.data?.members ?? EMPTY_COLLAB_MEMBERS;
  const collabInvites = collaborationQuery.data?.invites ?? EMPTY_COLLAB_INVITES;
  const invitableQuery = useQuery(
    invitableHackathonUsersQueryOptions({
      userId: user?.id,
      projectId: collabProject?.id,
      search: debouncedCollabInviteeQuery,
    }),
  );
  const invitableUsers = invitableQuery.data ?? EMPTY_INVITABLE_USERS;
  const collabLoading = collaborationQuery.isPending && collaborationQuery.fetchStatus !== "idle";
  const invitableLoading = invitableQuery.isFetching;

  const invitesWs = useContestInviteWorkspace();
  const {
    invites,
    myInvite,
    savingInvite,
    setSavingInvite,
    inviteEmail,
    setInviteEmail,
    inviteDisplayName,
    setInviteDisplayName,
    inviteOrganization,
    setInviteOrganization,
    inviteNote,
    setInviteNote,
    inviteRoles,
    setInviteRoles,
    inviteActionId,
    setInviteActionId,
    hydrateFromPayload: hydrateInvitesFromPayload,
  } = invitesWs;

  const managerWs = useContestManagerWorkspace();
  const {
    managerStatus,
    setManagerStatus,
    savingStatus,
    setSavingStatus,
    slugDraft,
    setSlugDraft,
    savingSlug,
    setSavingSlug,
    refreshingMetrics,
    setRefreshingMetrics,
    savingRubric,
    setSavingRubric,
    savingTracksRounds,
    setSavingTracksRounds,
    deletingContest,
    setDeletingContest,
    rubricWeights,
    setRubricWeights,
    tracksDraft,
    setTracksDraft,
    roundsDraft,
    setRoundsDraft,
    activeRoundIdDraft,
    setActiveRoundIdDraft,
    anonymousJudgingDraft,
    setAnonymousJudgingDraft,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    publishingResults,
    setPublishingResults,
    savingPublicContent,
    setSavingPublicContent,
    bannerUploading,
    setBannerUploading,
    thumbnailUploading,
    setThumbnailUploading,
    partnerLogoUploadingIndex,
    setPartnerLogoUploadingIndex,
    publicDraft,
    setPublicDraft,
    hydrateContestMetaFromPayload,
  } = managerWs;

  const [blasting, setBlasting] = useState(false);

  const { statusLabel, registrationStatusLabel, locationLabel } =
    useContestDetailLabels(translate);

  const formatDateTime = useCallback(
    (value: string | null): string =>
      formatContestDate(value, "long", translate("detail.notUpdated")),
    [translate],
  );

  const formatDate = useCallback(
    (value: string | null): string =>
      formatContestDate(value, "short", translate("detail.notUpdated")),
    [translate],
  );

  const [countdownTick, setCountdownTick] = useState(0);

  const {
    isManager,
    canReview,
    canJudge,
    canViewAggregate,
    viewerRoles,
    isManageView,
    canAccessWorkspace,
  } = useMemo(
    () =>
      deriveContestDetailPermissions({
        contest,
        profile,
        userEmail: user?.email,
        forceManageView,
        pathname: location.pathname,
      }),
    [contest, forceManageView, location.pathname, profile, user?.email],
  );

  const allowedManageSectionIds = useMemo(() => {
    const ids = [
      "overview",
      ...(canReview ? ["applications"] : []),
      ...(canJudge ? ["judging"] : []),
      ...(canViewAggregate ? ["analytics"] : []),
      ...(isManager ? ["translations", "awards", "email", "settings"] : []),
    ];
    return ids;
  }, [canJudge, canReview, canViewAggregate, isManager]);

  const activeManageSection = useMemo(() => {
    if (!isManageView) return "overview";
    const raw = manageSectionParam ?? "overview";
    if (allowedManageSectionIds.includes(raw)) return raw;
    return allowedManageSectionIds[0] ?? "overview";
  }, [allowedManageSectionIds, isManageView, manageSectionParam]);

  const manageSections = useMemo(
    () =>
      [
        canReview
          ? {
              id: "applications",
              label: translate("workspace.manage.sections.applications.label"),
              description: translate(
                "workspace.manage.sections.applications.description",
              ),
            }
          : null,
        canJudge
          ? {
              id: "judging",
              label: translate("workspace.manage.sections.judging.label"),
              description: translate(
                "workspace.manage.sections.judging.description",
              ),
            }
          : null,
        canViewAggregate
          ? {
              id: "analytics",
              label: translate("workspace.manage.sections.results.label"),
              description: translate(
                "workspace.manage.sections.results.description",
              ),
            }
          : null,
      ].filter(
        (item): item is { id: string; label: string; description: string } =>
          item != null,
      ),
    [canJudge, canReview, canViewAggregate, translate],
  );

  const leaderboard = useMemo(
    () => {
      const roundId =
        selectedRoundId ?? contest?.judging?.active_round_id ?? "final";
      const trackId = selectedTrackId ?? contest?.tracks?.[0]?.id ?? null;
      const filteredSubmissions = trackId
        ? submissions.filter((s) => (s.track_id ?? null) === trackId)
        : submissions;
      const filteredScores = scores.filter(
        (s) => (s.round_id ?? "final") === roundId,
      );
      return buildContestLeaderboard(filteredSubmissions, filteredScores);
    },
    [
      contest?.judging?.active_round_id,
      contest?.tracks,
      scores,
      selectedRoundId,
      selectedTrackId,
      submissions,
    ],
  );

  const activeManageSectionMeta = useMemo(() => {
    if (activeManageSection === "overview") {
      return {
        label: translate("workspace.manage.overview.label"),
        description: translate("workspace.manage.overview.description"),
      };
    }
    if (activeManageSection === "translations") {
      return {
        label: translate("workspace.manage.translations.label", {
          defaultValue: "Translations",
        }),
        description: translate("workspace.manage.translations.description", {
          defaultValue: "Maintain localized versions of the public hackathon content.",
        }),
      };
    }
    if (activeManageSection === "awards") {
      return {
        label: translate("workspace.awards.heroTitle", { defaultValue: "Open Campus awards" }),
        description: translate("workspace.awards.heroDescription", {
          defaultValue: "Configure award templates and mint on-chain credentials for winners.",
        }),
      };
    }
    if (activeManageSection === "email") {
      return {
        label: translate("workspace.email.tabLabel"),
        description: translate("workspace.email.heroDescription"),
      };
    }
    if (activeManageSection === "settings") {
      return {
        label: translate("workspace.tabs.settings"),
        description: translate("workspace.settings.description"),
      };
    }
    return (
      manageSections.find((section) => section.id === activeManageSection) ?? {
        label: translate("workspace.manage.fallback.label"),
        description: translate("workspace.manage.fallback.description"),
      }
    );
  }, [activeManageSection, manageSections, translate]);

  const publicJourney = useMemo(
    () => [
      {
        title: translate("detail.journey.step1.title"),
        description: translate("detail.journey.step1.description"),
      },
      {
        title: translate("detail.journey.step2.title"),
        description: translate("detail.journey.step2.description"),
      },
      {
        title: translate("detail.journey.step3.title"),
        description: translate("detail.journey.step3.description"),
      },
    ],
    [translate],
  );

  const manageCollaborationLanes = useMemo(
    () => [
      {
        title: translate("workspace.manage.lanes.ops.title"),
        description: translate("workspace.manage.lanes.ops.description"),
      },
      {
        title: translate("workspace.manage.lanes.judge.title"),
        description: translate("workspace.manage.lanes.judge.description"),
      },
      {
        title: translate("workspace.manage.lanes.observer.title"),
        description: translate("workspace.manage.lanes.observer.description"),
      },
    ],
    [translate],
  );

  const judgeOwnScores = useMemo(() => {
    if (!user) return new Map<string, ContestScore>();
    const roundId = selectedRoundId ?? contest?.judging?.active_round_id ?? "final";
    return new Map(
      scores
        .filter(
          (score) =>
            score.judge_uid === user.id &&
            (score.round_id ?? "final") === roundId,
        )
        .map((score) => [score.submission_id, score]),
    );
  }, [contest?.judging?.active_round_id, scores, selectedRoundId, user]);

  useEffect(() => {
    if (!contest) return;
    if (!canJudge || !isManageView) return;

    setSelectedTrackId((prev) => prev ?? contest.tracks?.[0]?.id ?? "general");
    setSelectedRoundId(
      (prev) =>
        prev ??
        contest.judging?.active_round_id ??
        contest.rounds?.[0]?.id ??
        "final",
    );
  }, [canJudge, contest, isManageView, setSelectedRoundId, setSelectedTrackId]);

  const timelineRows = useMemo(() => {
    if (!contest) return [];
    return buildContestTimelineRows({
      milestones: contest.timeline_milestones ?? [],
      registrationDeadline: contest.registration_deadline,
      startsAt: contest.starts_at,
      submissionDeadline: contest.submission_deadline,
      endsAt: contest.ends_at,
      formatDateTime,
      defaultLabels: {
        registrationDeadline: translate("detail.timeline.registrationDeadline"),
        kickoff: translate("detail.timeline.kickoff"),
        submissionDeadline: translate("detail.timeline.submissionDeadline"),
        end: translate("detail.timeline.end"),
      },
    });
  }, [contest, formatDateTime, translate]);

  const contestLifecycleDatetimes = useMemo(
    () => (contest ? getContestLifecycleDatetimes(contest) : null),
    [contest],
  );

  const hackathonLifecycle = useMemo(
    () => {
      void countdownTick;
      return contest ? deriveHackathonLifecycle(contest, Date.now()) : null;
    },
    [contest, countdownTick],
  );

  const lifecycleBadgeLabel = useMemo(() => {
    if (!contest || hackathonLifecycle == null) return "";
    switch (hackathonLifecycle) {
      case "draft":
        return statusLabel(contest.status);
      case "upcoming":
        return translate("detail.lifecycle.badge.upcoming");
      case "registration_open":
        return translate("detail.lifecycle.badge.registrationOpen");
      case "in_progress":
        return translate("detail.lifecycle.badge.inProgress");
      case "judging":
        return translate("detail.lifecycle.badge.judging");
      case "ended":
        return translate("detail.lifecycle.badge.ended");
      default:
        return statusLabel(contest.status);
    }
  }, [contest, hackathonLifecycle, statusLabel, translate]);

  const publicHeroHighlights = useMemo(() => {
    void countdownTick;
    if (
      !contest ||
      isManageView ||
      hackathonLifecycle == null ||
      contestLifecycleDatetimes == null
    ) {
      return [];
    }

    const now = Date.now();
    const total = Number(contest.metrics_snapshot.registrations_total ?? 0);
    const approved = Number(contest.metrics_snapshot.approved_registrations ?? 0);
    const lines: string[] = [];

    switch (hackathonLifecycle) {
      case "upcoming": {
        lines.push(translate("detail.lifecycle.hero.upcomingBody"));
        break;
      }
      case "registration_open": {
        if (total > 0) {
          lines.push(
            translate("detail.phase.hero.registrationsCount", {
              count: total,
            }),
          );
        } else {
          lines.push(translate("detail.phase.hero.noApplicationsYet"));
        }
        break;
      }
      case "in_progress": {
        if (contest.starts_at) {
          const kickoff = new Date(contest.starts_at).getTime();
          if (now < kickoff) {
            lines.push(
              translate("detail.phase.hero.kickoffCountdown", {
                time: formatContestCountdown(kickoff - now, translate),
              }),
            );
          }
        }
        if (approved >= 5) {
          lines.push(
            translate("detail.phase.hero.approvedTeams", { count: approved }),
          );
        }
        break;
      }
      case "judging": {
        lines.push(translate("detail.lifecycle.hero.judgingBody"));
        break;
      }
      case "ended":
      default: {
        lines.push(translate("detail.phase.hero.contestConcluded"));
        if (approved >= 5) {
          lines.push(
            translate("detail.phase.hero.participatedTeams", {
              count: approved,
            }),
          );
        }
      }
    }

    return lines.slice(0, 4);
  }, [
    contest,
    contestLifecycleDatetimes,
    countdownTick,
    hackathonLifecycle,
    isManageView,
    translate,
  ]);

  const publicHeroCountdown = useMemo(() => {
    void countdownTick;
    if (
      !contest ||
      isManageView ||
      hackathonLifecycle == null ||
      contestLifecycleDatetimes == null
    ) {
      return null;
    }
    const target = getHackathonCountdownTarget(
      hackathonLifecycle,
      contestLifecycleDatetimes,
    );
    if (!target) return null;
    const end = parseLifecycleInstantMs(target.iso);
    if (end == null || Date.now() >= end) return null;
    const msLeft = end - Date.now();
    const time = formatContestCountdown(msLeft, translate);
    return {
      text: translate(target.labelKey, { time }),
      urgent: msLeft < 3600000,
    };
  }, [
    contest,
    contestLifecycleDatetimes,
    countdownTick,
    hackathonLifecycle,
    isManageView,
    translate,
  ]);

  const publicCta = useMemo(() => {
    if (isManageView || !contest || hackathonLifecycle == null) return null;
    const hrefSlug = contest.slug?.trim();
    const base = hrefSlug ? `/hackathons/${hrefSlug}` : "/hackathons";
    const participantWorkspaceHash = `${base}#participant-workspace`;
    const participantSubmissionHash = `${base}#participant-submission`;
    const showProjects = contestPublicShowcaseProjectsNavVisible(contest);
    const registrationWindowOpen =
      (contest.status === "published" || contest.status === "running") &&
      !isPastContestRegistrationDeadline(contest);
    const autoApproveRegistrations = Boolean(
      contest.config?.auto_approve_registrations,
    );

    const loginRedirect = (path: string) =>
      `/login?redirect=${encodeURIComponent(path)}`;

    const buildRegistrationCta = () => {
      if (!isAuthenticated) {
        return {
          label: translate("detail.lifecycle.cta.loginToRegister"),
          helper: translate("detail.lifecycle.cta.loginToRegisterHelper"),
          variant: "default" as const,
          navigateTo: loginRedirect(participantWorkspaceHash),
        };
      }
      if (registration?.status === "pending") {
        return {
          label: translate("detail.lifecycle.cta.pendingReview"),
          helper: translate("detail.lifecycle.cta.pendingReviewHelper"),
          variant: "outline" as const,
          navigateTo: participantWorkspaceHash,
          disabled: true,
        };
      }
      if (registration?.status === "approved") {
        return {
          label: translate("detail.lifecycle.cta.goToDashboard"),
          helper: translate("detail.lifecycle.cta.dashboardHelper"),
          variant: "default" as const,
          navigateTo: participantSubmissionHash,
        };
      }
      if (registration?.status === "rejected") {
        return {
          label: translate("detail.lifecycle.cta.applicationNotApproved"),
          helper: translate("detail.lifecycle.cta.applicationNotApprovedHelper"),
          variant: "outline" as const,
          navigateTo: `${base}#faq`,
        };
      }
      return {
        label: translate("detail.lifecycle.cta.registerWithProfile"),
        helper: translate(
          autoApproveRegistrations
            ? "detail.lifecycle.cta.registerWithProfileHelperInstant"
            : "detail.lifecycle.cta.registerWithProfileHelper",
        ),
        variant: "default" as const,
        action: "apply" as const,
        navigateTo: participantWorkspaceHash,
      };
    };

    if (hackathonLifecycle === "upcoming") {
      return {
        label: translate("detail.lifecycle.cta.notifyWhenOpen"),
        helper: translate("detail.lifecycle.cta.notifyWhenOpenHelper"),
        variant: "outline" as const,
        navigateTo: isAuthenticated ? "/account/settings" : loginRedirect(base),
        disabled: false as boolean | undefined,
      };
    }

    if (hackathonLifecycle === "registration_open") {
      return buildRegistrationCta();
    }

    if (hackathonLifecycle === "in_progress") {
      if (registrationWindowOpen && registration?.status !== "approved") {
        return buildRegistrationCta();
      }
      if (registration?.status === "approved") {
        if (mySubmission) {
          return {
            label: translate("detail.lifecycle.cta.viewSubmission"),
            helper: translate("detail.lifecycle.cta.viewSubmissionHelper"),
            variant: "default" as const,
            navigateTo: participantSubmissionHash,
          };
        }
        return {
          label: translate("detail.lifecycle.cta.submitWork"),
          helper: translate("detail.lifecycle.cta.submitWorkHelper"),
          variant: "default" as const,
          navigateTo: participantSubmissionHash,
        };
      }
      return {
        label: translate("detail.lifecycle.cta.followBuildPhase"),
        helper: translate("detail.lifecycle.cta.followBuildPhaseHelper"),
        variant: "outline" as const,
        navigateTo: showProjects ? `${base}#projects` : `${base}#timeline`,
      };
    }

    if (hackathonLifecycle === "judging") {
      return {
        label: translate("detail.lifecycle.cta.viewSubmissionsGallery"),
        helper: translate("detail.lifecycle.cta.viewSubmissionsGalleryHelper"),
        variant: "outline" as const,
        navigateTo: showProjects ? `${base}#projects` : `${base}#timeline`,
      };
    }

    return {
      label: translate("detail.lifecycle.cta.viewWinners"),
      helper: translate("detail.lifecycle.cta.viewWinnersHelper"),
      variant: "outline" as const,
      navigateTo: showProjects ? `${base}#projects` : `${base}#results`,
    };
  }, [
    contest,
    hackathonLifecycle,
    isAuthenticated,
    isManageView,
    mySubmission,
    registration,
    translate,
  ]);

  const registrationDraftReady = useMemo(() => {
    if (!isAuthenticated || !authInitialized) return false;
    const email = profile?.email?.trim() || user?.email?.trim() || "";
    return email.length > 0;
  }, [authInitialized, isAuthenticated, profile?.email, user?.email]);

  const registrationWorkspaceEditable = useMemo(() => {
    void countdownTick;
    if (!contest || contest.status !== "published") return false;
    return !isPastContestRegistrationDeadline(contest);
  }, [contest, countdownTick]);

  const submissionWorkspaceEditable = useMemo(() => {
    void countdownTick;
    if (!contest || registration?.status !== "approved") return false;
    return !isPastContestSubmissionDeadline(contest);
  }, [contest, countdownTick, registration?.status]);

  const submissionDraftDirty = useMemo(
    () =>
      registration?.status === "approved" &&
      (submissionTitle !== (mySubmission?.title ?? "") ||
        submissionSummary !== (mySubmission?.summary ?? "") ||
        submissionDemoUrl !== (mySubmission?.demo_url ?? "") ||
        submissionRepoUrl !== (mySubmission?.repo_url ?? "") ||
        submissionSlideUrl !== (mySubmission?.slide_url ?? "") ||
        submissionVideoUrl !== (mySubmission?.video_url ?? "")),
    [
      mySubmission?.demo_url,
      mySubmission?.repo_url,
      mySubmission?.slide_url,
      mySubmission?.summary,
      mySubmission?.title,
      mySubmission?.video_url,
      registration?.status,
      submissionDemoUrl,
      submissionRepoUrl,
      submissionSlideUrl,
      submissionSummary,
      submissionTitle,
      submissionVideoUrl,
    ],
  );

  const leaderboardReadyForPublish = useMemo(
    () => leaderboard.filter((entry) => entry.score_count > 0),
    [leaderboard],
  );

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const detailOptions = contestDetailPayloadQueryOptions({
    slug,
    viewer: user,
    profile,
    profileReady: authInitialized && (!user || !profileLoading),
    locale,
    isManager,
    translate,
    prefetchedContest: contest ?? prefetchedContest,
  });
  const detailQuery = useQuery(detailOptions);
  const refetchDetail = detailQuery.refetch;
  const operationMutation = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...hackathonKeys.all, "catalog"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...hackathonKeys.all, "public-detail"],
      });
    },
  });
  const mutateOperation = operationMutation.mutateAsync;
  const executeWrite = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> =>
      (await mutateOperation(operation)) as T,
    [mutateOperation],
  );
  const applyDetailPayload = useCallback(
    (payload: ContestDetailFetchedPayload) => {
      setContest(payload.contest);
      hydrateContestMetaFromPayload(payload);
      hydrateRegistrationFromPayload(payload);
      hydrateJudgingFromPayload(payload);
      hydrateInvitesFromPayload(payload);
    },
    [
      hydrateContestMetaFromPayload,
      hydrateInvitesFromPayload,
      hydrateJudgingFromPayload,
      hydrateRegistrationFromPayload,
      setContest,
    ],
  );
  const loadContestData = useCallback(
    async (opts?: { silent?: boolean }) => {
      void opts;
      const result = await refetchDetail();
      if (result.data) applyDetailPayload(result.data);
    },
    [applyDetailPayload, refetchDetail],
  );
  const loading =
    !authInitialized ||
    profileLoading ||
    (detailQuery.isPending && detailQuery.fetchStatus !== "idle");
  const error = detailQuery.error
    ? translateApiError(detailQuery.error, translate, "detail.errors.loadFailed")
    : null;

  const loadCollaboration = useCallback(async () => {
    await refetchCollaboration();
  }, [refetchCollaboration]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedCollabInviteeQuery(collabInviteeQuery);
    }, 320);
    return () => window.clearTimeout(handle);
  }, [collabInviteeQuery]);

  useEffect(() => {
    if (detailQuery.data) applyDetailPayload(detailQuery.data);
  }, [applyDetailPayload, detailQuery.data]);

  useEffect(() => {
    if (!contest) return;
    if (isManageView) {
      const idInterval = window.setInterval(
        () => setCountdownTick((x) => x + 1),
        60000,
      );
      return () => window.clearInterval(idInterval);
    }

    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      setCountdownTick((x) => x + 1);
      const life = deriveHackathonLifecycle(contest, Date.now());
      const d = getContestLifecycleDatetimes(contest);
      const target = getHackathonCountdownTarget(life, d);
      const end = target ? parseLifecycleInstantMs(target.iso) : null;
      const msLeft = end != null ? end - Date.now() : Infinity;
      const delay =
        msLeft === Infinity || msLeft <= 0
          ? 60000
          : msLeft < 3600000
            ? 1000
            : 60000;
      timeoutId = window.setTimeout(scheduleNext, delay);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [contest, isManageView]);

  useEffect(() => {
    if (
      !contest ||
      activeManageSection !== "settings" ||
      !isManager ||
      !isManageView
    )
      return;
    setPublicDraft({
      prize_pool_summary: contest.prize_pool_summary ?? "",
      prizes:
        contest.prizes && contest.prizes.length > 0
          ? contest.prizes.map((p) => ({ ...p }))
          : [{ rank_label: "", title: "", value_display: "", description: "" }],
      faqs:
        contest.faqs && contest.faqs.length > 0
          ? contest.faqs.map((f) => ({ ...f }))
          : [{ question: "", answer: "" }],
      organizational_partners:
        contest.organizational_partners && contest.organizational_partners.length > 0
          ? contest.organizational_partners.map((p) => ({
              id: p.id?.trim() || crypto.randomUUID(),
              logo_url: p.logo_url ?? "",
              logo_path: p.logo_path ?? "",
              title: p.title,
              description: p.description ?? "",
            }))
          : [
              {
                id: crypto.randomUUID(),
                logo_url: "",
                logo_path: "",
                title: "",
                description: "",
              },
            ],
      auto_approve_registrations: Boolean(
        contest.config?.auto_approve_registrations,
      ),
      registration_deadline_local: contest.registration_deadline
        ? isoToDatetimeLocal(contest.registration_deadline)
        : "",
      submission_deadline_local: contest.submission_deadline
        ? isoToDatetimeLocal(contest.submission_deadline)
        : "",
      starts_at_local: contest.starts_at ? isoToDatetimeLocal(contest.starts_at) : "",
      ends_at_local: contest.ends_at ? isoToDatetimeLocal(contest.ends_at) : "",
      milestones:
        contest.timeline_milestones && contest.timeline_milestones.length > 0
          ? contest.timeline_milestones.map((m) => ({
              title: m.title,
              atLocal: isoToDatetimeLocal(m.at),
            }))
          : [{ title: "", atLocal: "" }],
    });
  }, [contest, activeManageSection, isManager, isManageView, setPublicDraft]);

  useEffect(() => {
    if (isManageView) return;
    if (loading) return;
    if (!contest) return;
    if (contest.status !== "draft") return;
    if (canAccessWorkspace) return;
    toast.message(translate("detail.toasts.draftRedirect"));
    navigate("/hackathons", { replace: true });
  }, [canAccessWorkspace, contest, isManageView, loading, navigate, translate]);

  useEffect(() => {
    if (!id) return;
    setMotivation("");
  }, [id, setMotivation]);

  useEffect(() => {
    if (!isManageView || !canAccessWorkspace || !slug) return;
    const raw = manageSectionParam ?? "overview";
    if (allowedManageSectionIds.includes(raw)) return;
    const fallback = allowedManageSectionIds[0] ?? "overview";
    navigate(`/hackathons/${slug}/manage/${fallback}`, {
      replace: true,
    });
  }, [
    allowedManageSectionIds,
    canAccessWorkspace,
    slug,
    isManageView,
    manageSectionParam,
    navigate,
  ]);

  useEffect(() => {
    setScoreDrafts((prev) => {
      const next = { ...prev };
      for (const submission of submissions) {
        const existing = judgeOwnScores.get(submission.id);
        if (!next[submission.id]) {
          next[submission.id] = {
            product: existing ? String(existing.product_score) : "0",
            technical: existing ? String(existing.technical_score) : "0",
            presentation: existing ? String(existing.presentation_score) : "0",
            impact: existing ? String(existing.impact_score) : "0",
            note: existing?.note ?? "",
          };
        }
      }
      return next;
    });
  }, [judgeOwnScores, submissions, setScoreDrafts]);

  useEffect(() => {
    if (!submissionDraftDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submissionDraftDirty]);

  const handleDeleteContest = useCallback(async () => {
    if (!contest) return;

    setDeletingContest(true);
    try {
      await executeWrite(() => deleteContest(contest.id));
      toast.success(translate("detail.actions.deleteSuccess"));
      navigate("/hackathons", { replace: true });
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.actions.deleteErrorFallback"));
    } finally {
      setDeletingContest(false);
    }
  }, [contest, executeWrite, navigate, setDeletingContest, translate]);

  const handleApply = useCallback(async () => {
    if (!id || applying) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (!contest || !registrationWorkspaceEditable) {
      toast.error(translate("detail.participant.registrationClosedBody"));
      return;
    }
    const resolvedEmail = profile?.email?.trim() || user?.email?.trim() || "";
    if (!resolvedEmail) {
      toast.error(translate("detail.toasts.contactEmailRequired"));
      return;
    }
    const resolvedPhone = profile?.phone?.trim() || "";
    const resolvedPortfolio =
      profile?.website?.trim() || profile?.instructor_website?.trim() || "";
    setApplying(true);
    try {
      const result = await executeWrite(() =>
        registerForContest(id, {
          contact_email: resolvedEmail,
          contact_phone: resolvedPhone || undefined,
          portfolio_url: resolvedPortfolio || undefined,
          motivation: motivation.trim() || undefined,
          user_full_name: profile?.full_name ?? undefined,
        }),
      );
      setRegistration(result);
      toast.success(
        translate(
          result.status === "approved"
            ? "detail.toasts.applicationSubmittedApproved"
            : "detail.toasts.applicationSubmitted",
        ),
      );
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.applicationSubmitFailed"));
    } finally {
      setApplying(false);
    }
  }, [
    applying,
    contest,
    executeWrite,
    id,
    isAuthenticated,
    location,
    motivation,
    navigate,
    profile?.email,
    profile?.full_name,
    profile?.instructor_website,
    profile?.phone,
    profile?.website,
    registrationWorkspaceEditable,
    setApplying,
    setRegistration,
    translate,
    user?.email,
  ]);

  const handleReview = useCallback(
    async (userId: string, status: RegistrationDecisionStatus) => {
      if (!id || !canReview || savingReviewId) return;
      setSavingReviewId(userId);
      try {
        await executeWrite(() =>
          reviewContestRegistration(id, userId, {
            status,
            review_note: reviewNotes[userId] ?? "",
          }),
        );
        toast.success(
          status === "approved"
            ? translate("detail.toasts.applicationReviewedApproved")
            : translate("detail.toasts.applicationReviewedRejected"),
        );
        await loadContestData({ silent: true });
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.applicationReviewUpdateFailed"));
      } finally {
        setSavingReviewId(null);
      }
    },
    [
      canReview,
      executeWrite,
      id,
      loadContestData,
      reviewNotes,
      savingReviewId,
      setSavingReviewId,
      translate,
    ],
  );

  const handleStatusSave = useCallback(async () => {
    if (
      !id ||
      !contest ||
      !isManager ||
      savingStatus ||
      managerStatus === contest.status
    ) {
      return;
    }
    setSavingStatus(true);
    try {
      await executeWrite(() => updateContest(id, { status: managerStatus }));
      setContest((prev) => (prev ? { ...prev, status: managerStatus } : prev));
      toast.success(translate("detail.toasts.contestStatusUpdated"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.contestStatusUpdateFailed"));
    } finally {
      setSavingStatus(false);
    }
  }, [
    contest,
    executeWrite,
    id,
    isManager,
    managerStatus,
    savingStatus,
    setContest,
    setSavingStatus,
    translate,
  ]);

  const handleSlugSave = useCallback(async () => {
    if (!id || !contest || !isManager || savingSlug) return;
    const nextSlug = slugDraft.trim();
    if (nextSlug === (contest.slug ?? "")) return;
    setSavingSlug(true);
    try {
      const fresh = await executeWrite(() => updateContest(id, { slug: nextSlug }));
      setContest(fresh);
      onContestSynced?.(fresh);
      if (fresh.slug && slug && fresh.slug !== slug) {
        const rest = location.pathname.split("/").slice(3).join("/");
        const target = rest.length > 0 ? `/hackathons/${fresh.slug}/${rest}` : `/hackathons/${fresh.slug}`;
        navigate(target, { replace: true });
      }
      toast.success(translate("detail.toasts.publicContentUpdated"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.publicContentUpdateFailed"));
    } finally {
      setSavingSlug(false);
    }
  }, [
    contest,
    executeWrite,
    id,
    isManager,
    location.pathname,
    navigate,
    onContestSynced,
    savingSlug,
    setContest,
    setSavingSlug,
    slug,
    slugDraft,
    translate,
  ]);

  const handleInviteCreate = useCallback(async () => {
    if (!id || !isManager || savingInvite || !inviteEmail.trim()) return;
    setSavingInvite(true);
    try {
      await executeWrite(() =>
        createContestAccessInvite(id, {
          email: inviteEmail,
          roles: inviteRoles.length > 0 ? inviteRoles : ["judge"],
          display_name: inviteDisplayName,
          organization_name: inviteOrganization,
          note: inviteNote,
        }),
      );
      setInviteEmail("");
      setInviteDisplayName("");
      setInviteOrganization("");
      setInviteNote("");
      setInviteRoles(["judge"]);
      toast.success(translate("detail.toasts.inviteCreated"));
      await loadContestData({ silent: true });
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.inviteCreateFailed"));
    } finally {
      setSavingInvite(false);
    }
  }, [
    executeWrite,
    id,
    inviteDisplayName,
    inviteEmail,
    inviteNote,
    inviteOrganization,
    inviteRoles,
    isManager,
    loadContestData,
    savingInvite,
    setInviteDisplayName,
    setInviteEmail,
    setInviteNote,
    setInviteOrganization,
    setInviteRoles,
    setSavingInvite,
    translate,
  ]);

  const handleBulkInviteCsv = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !id || !isManager || savingInvite) return;

      setSavingInvite(true);
      try {
        const text = await file.text();
        const rows = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (rows.length === 0) {
          toast.error(translate("workspace.manage.bulkInviteEmpty"));
          return;
        }

        let successCount = 0;
        let failCount = 0;
        const allowedRoles: ContestScopedViewerRole[] = [
          "judge",
          "co_organizer",
          "partner_viewer",
          "mentor",
          "reviewer",
          "co_host_viewer",
        ];

        for (const row of rows) {
          const cells = row.split(",").map((cell) => cell.trim());
          const email = cells[0] ?? "";
          const rolesCell = cells[1] ?? "";
          if (!email || email.toLowerCase() === "email") continue; // header

          const rawRoles = rolesCell
            .split(/[|;]/g)
            .map((r) => r.trim())
            .filter(Boolean);
          const roles = rawRoles.filter((role): role is ContestScopedViewerRole =>
            allowedRoles.includes(role as ContestScopedViewerRole),
          );

          try {
            await executeWrite(() =>
              createContestAccessInvite(id, {
                email,
                roles: roles.length > 0 ? roles : ["judge"],
              }),
            );
            successCount += 1;
          } catch {
            failCount += 1;
          }
        }

        toast.success(
          translate("workspace.manage.bulkInviteDone", {
            success: successCount,
            failed: failCount,
          }),
        );
        await loadContestData({ silent: true });
      } catch (err) {
        toast.error(translateApiError(err, translate, "workspace.manage.bulkInviteFailed"));
      } finally {
        setSavingInvite(false);
      }
    },
    [executeWrite, id, isManager, loadContestData, savingInvite, setSavingInvite, translate],
  );

  const handleInviteResponse = useCallback(
    async (status: "accepted" | "declined") => {
      if (!id || !myInvite) return;
      setInviteActionId(myInvite.id);
      try {
        await executeWrite(() => respondToContestAccessInvite(id, status));
        toast.success(
          status === "accepted"
            ? translate("detail.toasts.inviteAccepted")
            : translate("detail.toasts.inviteDeclined"),
        );
        await loadContestData({ silent: true });
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.inviteUpdateFailed"));
      } finally {
        setInviteActionId(null);
      }
    },
    [executeWrite, id, loadContestData, myInvite, setInviteActionId, translate],
  );

  const handleInviteRevoke = useCallback(
    async (email: string) => {
      if (!id || !isManager) return;
      setInviteActionId(email);
      try {
        await executeWrite(() => revokeContestAccessInvite(id, email));
        toast.success(translate("detail.toasts.inviteRevoked"));
        await loadContestData({ silent: true });
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.inviteRevokeFailed"));
      } finally {
        setInviteActionId(null);
      }
    },
    [executeWrite, id, isManager, loadContestData, setInviteActionId, translate],
  );

  const handleRubricSave = useCallback(async () => {
    if (!id || !isManager || savingRubric) return;
    setSavingRubric(true);
    try {
      const weights = {
        product: Number(rubricWeights.product) || 0,
        technical: Number(rubricWeights.technical) || 0,
        presentation: Number(rubricWeights.presentation) || 0,
        impact: Number(rubricWeights.impact) || 0,
      };
      const totalWeight = Object.values(weights).reduce(
        (sum, value) => sum + value,
        0,
      );
      if (totalWeight !== 100) {
        toast.error(translate("detail.toasts.rubricWeightMustBe100"));
        return;
      }
      await executeWrite(() => updateContest(id, { rubric_weights: weights }));
      setContest((prev) =>
        prev ? { ...prev, rubric_weights: weights } : prev,
      );
      toast.success(translate("detail.toasts.rubricUpdated"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.rubricUpdateFailed"));
    } finally {
      setSavingRubric(false);
    }
  }, [
    executeWrite,
    id,
    isManager,
    rubricWeights.impact,
    rubricWeights.presentation,
    rubricWeights.product,
    rubricWeights.technical,
    savingRubric,
    setContest,
    setSavingRubric,
    translate,
  ]);

  const handleTracksRoundsSave = useCallback(async () => {
    if (!id || !contest || !isManager || savingTracksRounds) return;
    setSavingTracksRounds(true);
    try {
      const tracks = (tracksDraft ?? [])
        .map((t) => ({
          id: String(t.id ?? "").trim(),
          name: String(t.name ?? "").trim(),
          description: t.description ?? null,
          active: t.active ?? true,
          rubric: t.rubric,
        }))
        .filter((t) => t.id.length > 0 && t.name.length > 0);
      const rounds = (roundsDraft ?? [])
        .map((r) => ({
          id: String(r.id ?? "").trim(),
          name: String(r.name ?? "").trim(),
          opens_at: r.opens_at ?? null,
          closes_at: r.closes_at ?? null,
          active: r.active ?? true,
        }))
        .filter((r) => r.id.length > 0 && r.name.length > 0);

      if (tracks.length === 0) {
        toast.error(translate("workspace.manage.tracksNeedOne"));
        return;
      }
      if (rounds.length === 0) {
        toast.error(translate("workspace.manage.roundsNeedOne"));
        return;
      }

      const activeRound =
        activeRoundIdDraft && rounds.some((r) => r.id === activeRoundIdDraft)
          ? activeRoundIdDraft
          : rounds[0]!.id;

      const fresh = await executeWrite(() =>
        updateContest(id, {
          tracks,
          rounds,
          judging: { active_round_id: activeRound },
          config: { ...(contest.config ?? {}), anonymous_judging: anonymousJudgingDraft },
        }),
      );
      setContest(fresh);
      onContestSynced?.(fresh);
      toast.success(translate("workspace.manage.tracksRoundsSaved"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "workspace.manage.tracksRoundsSaveFailed"));
    } finally {
      setSavingTracksRounds(false);
    }
  }, [
    activeRoundIdDraft,
    anonymousJudgingDraft,
    contest,
    executeWrite,
    id,
    isManager,
    onContestSynced,
    roundsDraft,
    savingTracksRounds,
    setContest,
    setSavingTracksRounds,
    tracksDraft,
    translate,
  ]);

  const handleSendCollaborationInvite = useCallback(
    async (inviteeUserId: string) => {
      if (!collabProject) return;
      setInviteSendingUserId(inviteeUserId);
      try {
        const { token } = await executeWrite(() =>
          createProjectCollaborationInvite(collabProject.id, inviteeUserId),
        );
        const link = `${window.location.origin}/invites/project/${token}`;
        await navigator.clipboard.writeText(link);
        toast.success(translate("detail.toasts.collabInviteLinkCopied"));
        await loadCollaboration();
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.collabInviteFailed"));
      } finally {
        setInviteSendingUserId(null);
      }
    },
    [collabProject, executeWrite, loadCollaboration, translate],
  );

  const handleRevokeCollabInvite = useCallback(
    async (inviteId: string) => {
      try {
        await executeWrite(() => revokeProjectCollaborationInvite(inviteId));
        toast.success(translate("detail.toasts.collabInviteRevoked"));
        await loadCollaboration();
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.collabRevokeFailed"));
      }
    },
    [executeWrite, loadCollaboration, translate],
  );

  const handleRemoveCollaborator = useCallback(
    async (memberUserId: string) => {
      if (!collabProject) return;
      try {
        await executeWrite(() =>
          removeProjectCollaborator(collabProject.id, memberUserId),
        );
        toast.success(translate("detail.toasts.collaboratorRemoved"));
        await loadCollaboration();
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.collaboratorRemoveFailed"));
      }
    },
    [collabProject, executeWrite, loadCollaboration, translate],
  );

  const handleSubmissionSave = useCallback(async () => {
    if (!id || savingSubmission || !submissionTitle.trim()) return;
    if (!submissionWorkspaceEditable) {
      toast.error(translate("detail.toasts.submissionDeadlinePassed"));
      return;
    }
    if (submissionSummary.trim().length < 32) {
      toast.error(translate("detail.toasts.submissionSummaryTooShort"));
      return;
    }
    setSavingSubmission(true);
    try {
      const saved = await executeWrite(() =>
        upsertContestSubmission(id, {
          title: submissionTitle,
          summary: submissionSummary,
          demo_url: submissionDemoUrl,
          repo_url: submissionRepoUrl,
          slide_url: submissionSlideUrl,
          logo_path: mySubmission?.logo_path ?? null,
          screenshot_paths: mySubmission?.screenshot_paths ?? [],
          video_url: submissionVideoUrl,
        }),
      );
      setMySubmission(saved);
      await loadCollaboration();
      toast.success(translate("detail.toasts.submissionSaved"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.submissionSaveFailed"));
    } finally {
      setSavingSubmission(false);
    }
  }, [
    executeWrite,
    id,
    mySubmission?.logo_path,
    mySubmission?.screenshot_paths,
    savingSubmission,
    setMySubmission,
    setSavingSubmission,
    submissionDemoUrl,
    submissionRepoUrl,
    submissionSlideUrl,
    submissionVideoUrl,
    submissionSummary,
    submissionTitle,
    translate,
    loadCollaboration,
    submissionWorkspaceEditable,
  ]);

  const handleScoreSave = useCallback(
    async (submissionId: string) => {
      if (!id || !canJudge || !scoreDrafts[submissionId]) return;
      const draft = scoreDrafts[submissionId];
      const values = [
        Number(draft.product) || 0,
        Number(draft.technical) || 0,
        Number(draft.presentation) || 0,
        Number(draft.impact) || 0,
      ];
      if (values.some((value) => value < 0 || value > 25)) {
        toast.error(translate("detail.toasts.scoreCriterionOutOfRange"));
        return;
      }
      setSavingScoreId(submissionId);
      try {
        await executeWrite(() =>
          scoreContestSubmission(id, submissionId, {
            product_score: values[0],
            technical_score: values[1],
            presentation_score: values[2],
            impact_score: values[3],
            note: draft.note,
          }),
        );
        toast.success(translate("detail.toasts.scoreSaved"));
        await loadContestData({ silent: true });
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.scoreSaveFailed"));
      } finally {
        setSavingScoreId(null);
      }
    },
    [
      canJudge,
      executeWrite,
      id,
      loadContestData,
      scoreDrafts,
      setSavingScoreId,
      translate,
    ],
  );

  const handleBlastEmail = useCallback(
    async (params: {
      subject: string;
      html: string;
      recipientFilter: BlastEmailFilter;
    }): Promise<BlastEmailResult | null> => {
      if (!id || !isManager || blasting) return null;
      setBlasting(true);
      try {
        const result = await executeWrite(() => blastContestEmail(id, params));
        if (result.reason === "email_not_configured") {
          toast.error(translate("workspace.email.systemUnavailable"));
        } else {
          toast.success(translate("workspace.email.toastSuccess"));
        }
        return result;
      } catch {
        toast.error(translate("workspace.email.systemUnavailable"));
        return null;
      } finally {
        setBlasting(false);
      }
    },
    [blasting, executeWrite, id, isManager, translate],
  );

  const handleRefreshMetrics = useCallback(async () => {
    if (!id || !isManager || refreshingMetrics) return;
    setRefreshingMetrics(true);
    try {
      const snapshot = await executeWrite(() => refreshContestMetricsSnapshot(id));
      setContest((prev) =>
        prev ? { ...prev, metrics_snapshot: snapshot } : prev,
      );
      toast.success(translate("detail.toasts.metricsRefreshed"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.metricsRefreshFailed"));
    } finally {
      setRefreshingMetrics(false);
    }
  }, [
    executeWrite,
    id,
    isManager,
    refreshingMetrics,
    setContest,
    setRefreshingMetrics,
    translate,
  ]);

  const handlePublishResults = useCallback(async () => {
    if (!id || !isManager || publishingResults) return;
    if (leaderboardReadyForPublish.length === 0) {
      toast.error(translate("detail.toasts.publishNeedsScoredSubmission"));
      return;
    }
    const winnerInputs: ContestWinnerInput[] = Object.entries(winnerAwards)
      .filter(([, awardTitle]) => awardTitle.trim().length > 0)
      .map(([submissionId, awardTitle]) => ({
        submission_id: submissionId,
        award_title: awardTitle,
        note: winnerNotes[submissionId] ?? "",
      }));
    if (winnerInputs.length === 0) {
      toast.error(translate("detail.toasts.publishNeedsAward"));
      return;
    }

    setPublishingResults(true);
    try {
      const result = await executeWrite(() => publishContestResults(id, winnerInputs));
      setContest((prev) =>
        prev
          ? {
              ...prev,
              published_leaderboard: result.leaderboard,
              winner_announcements: result.winners,
            }
          : prev,
      );
      toast.success(translate("detail.toasts.resultsPublished"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.publishFailed"));
    } finally {
      setPublishingResults(false);
    }
  }, [
    executeWrite,
    id,
    isManager,
    leaderboardReadyForPublish.length,
    publishingResults,
    setContest,
    setPublishingResults,
    translate,
    winnerAwards,
    winnerNotes,
  ]);

  const handleContestBannerChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !id || !contest || !isManager) return;
      setBannerUploading(true);
      try {
        const next = await executeWrite(async () => {
          const { url, path } = await uploadContestBanner(
            id,
            file,
            contest.cover_image_path ?? null,
          );
          return updateContest(id, { cover_image_url: url, cover_image_path: path });
        });
        setContest(next);
        onContestSynced?.(next);
        toast.success(translate("detail.toasts.contestBannerUpdated"));
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.contestBannerUploadFailed"));
      } finally {
        setBannerUploading(false);
      }
    },
    [
      contest,
      executeWrite,
      id,
      isManager,
      onContestSynced,
      setBannerUploading,
      setContest,
      translate,
    ],
  );

  const handleContestThumbnailChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !id || !contest || !isManager) return;
      setThumbnailUploading(true);
      try {
        const next = await executeWrite(async () => {
          const { url, path } = await uploadContestThumbnail(
            id,
            file,
            contest.thumbnail_path ?? null,
          );
          return updateContest(id, { thumbnail_url: url, thumbnail_path: path });
        });
        setContest(next);
        onContestSynced?.(next);
        toast.success(translate("detail.toasts.contestThumbnailUpdated"));
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.contestThumbnailUploadFailed"));
      } finally {
        setThumbnailUploading(false);
      }
    },
    [
      contest,
      executeWrite,
      id,
      isManager,
      onContestSynced,
      setContest,
      setThumbnailUploading,
      translate,
    ],
  );

  const handleOrganizationalPartnerLogoChange = useCallback(
    async (index: number, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !id || !contest || !isManager) return;
      const row = publicDraft.organizational_partners[index];
      if (!row?.title.trim()) {
        toast.error(translate("detail.toasts.organizationalPartnerNeedsTitle"));
        return;
      }
      const partnerId = row.id?.trim() || crypto.randomUUID();
      const prevPath = row.logo_path?.trim() || null;
      setPartnerLogoUploadingIndex(index);
      try {
        const fresh = await executeWrite(async () => {
          const { url, path } = await uploadContestOrganizationalPartnerLogo(
            id,
            partnerId,
            file,
            prevPath,
          );
          const organizational_partners = publicDraft.organizational_partners.map((p, i) =>
            i === index ? { ...p, id: partnerId, logo_url: url, logo_path: path } : p,
          );
          return updateContest(id, { organizational_partners });
        });
        setContest(fresh);
        onContestSynced?.(fresh);
        toast.success(translate("detail.toasts.organizationalPartnerLogoUpdated"));
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.organizationalPartnerLogoUploadFailed"));
      } finally {
        setPartnerLogoUploadingIndex(null);
      }
    },
    [
      contest,
      executeWrite,
      id,
      isManager,
      onContestSynced,
      publicDraft.organizational_partners,
      setContest,
      setPartnerLogoUploadingIndex,
      translate,
    ],
  );

  const handleOrganizationalPartnerLogoRemove = useCallback(
    async (index: number) => {
      if (!id || !contest || !isManager) return;
      const row = publicDraft.organizational_partners[index];
      const prevPath = row?.logo_path?.trim() || null;
      try {
        const organizational_partners = publicDraft.organizational_partners.map((p, i) =>
          i === index ? { ...p, logo_url: null, logo_path: null } : p,
        );
        const fresh = await executeWrite(async () => {
          if (prevPath) await deleteStorageObjectByPath(prevPath);
          return updateContest(id, { organizational_partners });
        });
        setContest(fresh);
        onContestSynced?.(fresh);
        toast.success(translate("detail.toasts.organizationalPartnerLogoRemoved"));
      } catch (err) {
        toast.error(translateApiError(err, translate, "detail.toasts.organizationalPartnerLogoRemoveFailed"));
      }
    },
    [
      contest,
      executeWrite,
      id,
      isManager,
      onContestSynced,
      publicDraft.organizational_partners,
      setContest,
      translate,
    ],
  );

  const handleSavePublicContent = useCallback(async () => {
    if (!id || !isManager || savingPublicContent || !contest || !isManageView)
      return;
    const schedule = validateContestScheduleInputs({
      startsAt: publicDraft.starts_at_local,
      endsAt: publicDraft.ends_at_local,
      submissionDeadline: publicDraft.submission_deadline_local,
    });
    if (!schedule.ok) {
      toast.error(
        translate(
          schedule.reason === "submission_after_end"
              ? "manage.validation.submissionAfterEnd"
              : "manage.validation.endsNotAfterStart",
        ),
      );
      return;
    }
    setSavingPublicContent(true);
    try {
      const milestones: ContestTimelineMilestone[] = publicDraft.milestones
        .map((m) => {
          const at = datetimeLocalToIso(m.atLocal);
          if (!m.title.trim() || !at) return null;
          return { title: m.title.trim(), at };
        })
        .filter((m): m is ContestTimelineMilestone => m != null);
      const prizes = publicDraft.prizes
        .map((p) => ({
          rank_label: p.rank_label.trim(),
          title: p.title.trim(),
          value_display: p.value_display?.trim() || null,
          description: p.description?.trim() || null,
        }))
        .filter((p) => p.rank_label.length > 0 && p.title.length > 0);
      const faqs = publicDraft.faqs
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
        .filter((f) => f.question.length > 0 && f.answer.length > 0);
      const organizational_partners = publicDraft.organizational_partners
        .map((p) => {
          const title = p.title.trim();
          if (!title) return null;
          const rowId = p.id?.trim();
          return {
            ...(rowId ? { id: rowId } : {}),
            logo_url: p.logo_url?.trim() || null,
            logo_path: p.logo_path?.trim() || null,
            title,
            description: p.description?.trim() || null,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null);
      const prevLogoPaths = new Set(
        (contest.organizational_partners ?? [])
          .map((p) => p.logo_path?.trim())
          .filter(Boolean) as string[],
      );
      const nextLogoPaths = new Set(
        organizational_partners
          .map((p) => p.logo_path?.trim())
          .filter(Boolean) as string[],
      );
      const fresh = await executeWrite(async () => {
        for (const path of prevLogoPaths) {
          if (!nextLogoPaths.has(path)) await deleteStorageObjectByPath(path);
        }
        return updateContest(id, {
          config: {
            ...(contest.config ?? {}),
            auto_approve_registrations: publicDraft.auto_approve_registrations,
          },
          registration_deadline: datetimeLocalToIso(publicDraft.registration_deadline_local),
          submission_deadline: datetimeLocalToIso(publicDraft.submission_deadline_local),
          starts_at: datetimeLocalToIso(publicDraft.starts_at_local),
          ends_at: datetimeLocalToIso(publicDraft.ends_at_local),
          prize_pool_summary: publicDraft.prize_pool_summary.trim() || null,
          prizes,
          faqs,
          timeline_milestones: milestones,
          organizational_partners,
        });
      });
      setContest(fresh);
      onContestSynced?.(fresh);
      toast.success(translate("detail.toasts.publicContentSaved"));
    } catch (err) {
      toast.error(translateApiError(err, translate, "detail.toasts.publicContentSaveFailed"));
    } finally {
      setSavingPublicContent(false);
    }
  }, [
    contest,
    executeWrite,
    id,
    isManageView,
    isManager,
    onContestSynced,
    publicDraft.auto_approve_registrations,
    publicDraft.faqs,
    publicDraft.registration_deadline_local,
    publicDraft.submission_deadline_local,
    publicDraft.starts_at_local,
    publicDraft.ends_at_local,
    publicDraft.milestones,
    publicDraft.prize_pool_summary,
    publicDraft.prizes,
    publicDraft.organizational_partners,
    savingPublicContent,
    setContest,
    setSavingPublicContent,
    translate,
  ]);

  const scoreDraftTotal = useCallback(
    (submissionId: string): number => {
      const draft = scoreDrafts[submissionId];
      if (!draft) return 0;
      return (
        (Number(draft.product) || 0) +
        (Number(draft.technical) || 0) +
        (Number(draft.presentation) || 0) +
        (Number(draft.impact) || 0)
      );
    },
    [scoreDrafts],
  );

  const handleCopyInviteLink = useCallback(
    async (email: string) => {
      if (!id) return;
      const pathSlug = contest?.slug ?? slug ?? id;
      const link = `${window.location.origin}/hackathons/${pathSlug}/manage/overview?invite=${encodeURIComponent(email)}`;
      await navigator.clipboard.writeText(link);
      toast.success(translate("detail.toasts.inviteLinkCopied"));
    },
    [contest?.slug, id, slug, translate],
  );

  const handleInviteMailTo = useCallback(
    (invite: ContestAccessInvite) => {
      if (!id || !contest) return;
      const pathSlug = contest.slug ?? slug ?? id;
      const link = `${window.location.origin}/hackathons/${pathSlug}/manage/overview?invite=${encodeURIComponent(invite.email)}`;
      const subject = encodeURIComponent(
        translate("detail.inviteEmail.subjectPrefix", { title: contest.title }),
      );
      const body = encodeURIComponent(
        `${translate("detail.inviteEmail.greeting", {
          name: invite.display_name || invite.email,
        })}\n\n` +
          `${translate("detail.inviteEmail.invitedLine", {
            title: contest.title,
            roles: invite.roles.join(", "),
          })}\n` +
          `${translate("detail.inviteEmail.accessLinkLine", { link })}\n\n` +
          `${invite.note ? `${translate("detail.inviteEmail.notePrefix", { note: invite.note })}\n\n` : ""}` +
          `${translate("detail.inviteEmail.signOff")}\n${translate("detail.inviteEmail.brand")}`,
      );
      window.open(
        `mailto:${invite.email}?subject=${subject}&body=${body}`,
        "_blank",
      );
    },
    [contest, id, slug, translate],
  );

  const handleExportLeaderboardCsv = useCallback(() => {
    if (!contest) return;
    const rows = [
      [
        "rank",
        "submission_title",
        "contestant",
        "team_name",
        "average_score",
        "score_count",
      ],
      ...contest.published_leaderboard.map((entry) => [
        String(entry.rank),
        entry.submission_title,
        entry.contestant_name || entry.contestant_user_id,
        entry.team_name || "",
        String(entry.average_score),
        String(entry.score_count),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    downloadTextFile(`contest-${contest.id}-leaderboard.csv`, csv);
  }, [contest]);

  return {
    translate,
    id,
    location,
    navigate,
    profile,
    user,
    isAuthenticated,
    contest,
    setContest,
    loading,
    error,
    registration,
    registrations,
    reviewNotes,
    setReviewNotes,
    savingReviewId,
    motivation,
    setMotivation,
    applying,
    submissions,
    scores,
    mySubmission,
    savingScoreId,
    selectedTrackId,
    setSelectedTrackId,
    selectedRoundId,
    setSelectedRoundId,
    submissionTitle,
    setSubmissionTitle,
    submissionSummary,
    setSubmissionSummary,
    submissionDemoUrl,
    setSubmissionDemoUrl,
    submissionRepoUrl,
    setSubmissionRepoUrl,
    submissionSlideUrl,
    setSubmissionSlideUrl,
    submissionVideoUrl,
    setSubmissionVideoUrl,
    savingSubmission,
    winnerAwards,
    setWinnerAwards,
    winnerNotes,
    setWinnerNotes,
    scoreDrafts,
    setScoreDrafts,
    invites,
    myInvite,
    savingInvite,
    inviteEmail,
    setInviteEmail,
    inviteDisplayName,
    setInviteDisplayName,
    inviteOrganization,
    setInviteOrganization,
    inviteNote,
    setInviteNote,
    inviteRoles,
    setInviteRoles,
    inviteActionId,
    managerStatus,
    setManagerStatus,
    savingStatus,
    refreshingMetrics,
    savingRubric,
    savingTracksRounds,
    deletingContest,
    rubricWeights,
    setRubricWeights,
    tracksDraft,
    setTracksDraft,
    roundsDraft,
    setRoundsDraft,
    activeRoundIdDraft,
    setActiveRoundIdDraft,
    anonymousJudgingDraft,
    setAnonymousJudgingDraft,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    publishingResults,
    savingPublicContent,
    bannerUploading,
    thumbnailUploading,
    partnerLogoUploadingIndex,
    publicDraft,
    setPublicDraft,
    activeManageSection,
    countdownTick,
    isManager,
    canReview,
    canJudge,
    canViewAggregate,
    viewerRoles,
    isManageView,
    canAccessWorkspace,
    manageSections,
    leaderboard,
    activeManageSectionMeta,
    publicJourney,
    manageCollaborationLanes,
    judgeOwnScores,
    timelineRows,
    hackathonLifecycle,
    contestLifecycleDatetimes,
    lifecycleBadgeLabel,
    publicHeroHighlights,
    publicHeroCountdown,
    publicCta,
    registrationDraftReady,
    registrationWorkspaceEditable,
    submissionWorkspaceEditable,
    collabProject,
    collabMembers,
    collabInvites,
    collabLoading,
    collabInviteeQuery,
    setCollabInviteeQuery,
    invitableUsers,
    invitableLoading,
    inviteSendingUserId,
    handleSendCollaborationInvite,
    handleRevokeCollabInvite,
    handleRemoveCollaborator,
    submissionDraftDirty,
    leaderboardReadyForPublish,
    statusLabel,
    registrationStatusLabel,
    locationLabel,
    formatDateTime,
    formatDate,
    handleDeleteContest,
    handleApply,
    handleReview,
    handleStatusSave,
    slugDraft,
    setSlugDraft,
    savingSlug,
    handleSlugSave,
    handleInviteCreate,
    handleBulkInviteCsv,
    handleInviteResponse,
    handleInviteRevoke,
    handleRubricSave,
    handleTracksRoundsSave,
    handleSubmissionSave,
    handleScoreSave,
    blasting,
    handleBlastEmail,
    handleRefreshMetrics,
    handlePublishResults,
    handleContestBannerChange,
    handleContestThumbnailChange,
    handleOrganizationalPartnerLogoChange,
    handleOrganizationalPartnerLogoRemove,
    handleSavePublicContent,
    scoreDraftTotal,
    handleCopyInviteLink,
    handleInviteMailTo,
    handleExportLeaderboardCsv,
    loadContestData,
  };
}

export type ContestDetailOrchestrator = ReturnType<
  typeof useContestDetailOrchestrator
>;

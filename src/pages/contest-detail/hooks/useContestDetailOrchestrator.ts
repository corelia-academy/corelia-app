import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  canManageContests,
  canReviewContestApplications,
  canScoreContest,
  canViewContestAggregateMetrics,
  getContestScopedViewerRoles,
} from "@/lib/permissions";
import {
  buildContestLeaderboard,
  createContestAccessInvite,
  deleteContest,
  getContest,
  publishContestResults,
  refreshContestMetricsSnapshot,
  registerForContest,
  respondToContestAccessInvite,
  reviewContestRegistration,
  revokeContestAccessInvite,
  scoreContestSubmission,
  updateContest,
  upsertContestSubmission,
} from "@/lib/contests";
import { uploadContestBanner, uploadContestThumbnail } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type {
  Contest,
  ContestAccessInvite,
  ContestRegistrationStatus,
  ContestScore,
  ContestWinnerInput,
  ContestTimelineMilestone,
} from "@/types/contests";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { buildContestTimelineRows } from "@/components/contests/contestTimelineBuilders";
import type { ContestPublicSection } from "@/pages/contest-detail/types";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
} from "@/pages/contest-detail/utils/datetime";
import {
  formatContestCountdown,
  scrollToElementById,
  downloadTextFile,
} from "@/pages/contest-detail/utils/contestDetailHelpers";
import { fetchContestDetailPayload } from "./fetchContestDetailPayload";
import { useContestInviteWorkspace } from "./useContestInviteWorkspace";
import { useContestJudgingWorkspace } from "./useContestJudgingWorkspace";
import { useContestLoad } from "./useContestLoad";
import { useContestManagerWorkspace } from "./useContestManagerWorkspace";
import {
  useContestRegistrationFlow,
  type RegistrationDecisionStatus,
} from "./useContestRegistrationFlow";

export function useContestDetailOrchestrator({
  forceManageView,
  prefetchedContest,
  publicSection,
  onContestSynced,
}: {
  forceManageView?: boolean;
  prefetchedContest?: Contest | null;
  publicSection?: ContestPublicSection;
  onContestSynced?: (next: Contest) => void;
} = {}) {
  const { t } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, isAuthenticated, authInitialized } = useAuth();

  const contestLoad = useContestLoad({
    contestId: id,
    prefetchedContest,
  });
  const {
    contest,
    setContest,
    loading,
    setLoading,
    error,
    setError,
  } = contestLoad;

  const registrationFlow = useContestRegistrationFlow();
  const {
    registration,
    setRegistration,
    registrations,
    reviewNotes,
    setReviewNotes,
    savingReviewId,
    setSavingReviewId,
    teamName,
    setTeamName,
    teamMembers,
    setTeamMembers,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    portfolioUrl,
    setPortfolioUrl,
    motivation,
    setMotivation,
    applying,
    setApplying,
    hydrateFromPayload: hydrateRegistrationFromPayload,
    parsedTeamMembers,
  } = registrationFlow;

  const judging = useContestJudgingWorkspace();
  const {
    submissions,
    scores,
    mySubmission,
    setMySubmission,
    savingScoreId,
    setSavingScoreId,
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
    inviteRole,
    setInviteRole,
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
    refreshingMetrics,
    setRefreshingMetrics,
    savingRubric,
    setSavingRubric,
    deletingContest,
    setDeletingContest,
    rubricWeights,
    setRubricWeights,
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
    publicDraft,
    setPublicDraft,
    hydrateContestMetaFromPayload,
  } = managerWs;

  const statusLabel = useCallback(
    (status: Contest["status"]): string =>
      translate(`status.${status}`, {
        defaultValue: translate("status.unknown"),
      }),
    [translate],
  );

  const registrationStatusLabel = useCallback(
    (status: ContestRegistrationStatus): string =>
      translate(`registrationStatus.${status}`, {
        defaultValue: translate("registrationStatus.unknown"),
      }),
    [translate],
  );

  const locationLabel = useCallback(
    (loc: Contest["location"]): string =>
      translate(`location.${loc}`, {
        defaultValue: translate("location.unknown"),
      }),
    [translate],
  );

  const formatDateTime = useCallback(
    (value: string | null): string => {
      if (!value) return translate("detail.notUpdated");
      return new Date(value).toLocaleString(intlLocale());
    },
    [translate],
  );

  const formatDate = useCallback(
    (value: string | null): string => {
      if (!value) return translate("detail.notUpdated");
      return new Date(value).toLocaleDateString(intlLocale());
    },
    [translate],
  );

  const [countdownTick, setCountdownTick] = useState(0);
  const [activeManageSection, setActiveManageSection] =
    useState<string>("overview");

  const isManager = canManageContests(profile);
  const canReview = canReviewContestApplications(contest, profile);
  const canJudge = canScoreContest(contest, profile, user?.email);
  const canViewAggregate = canViewContestAggregateMetrics(
    contest,
    profile,
    user?.email,
  );
  const viewerRoles = getContestScopedViewerRoles(contest, user?.email);
  const isManageView = forceManageView ?? location.pathname.endsWith("/manage");
  const canAccessWorkspace = isManager || canJudge || canViewAggregate;

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
              id: "results",
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
    () => buildContestLeaderboard(submissions, scores),
    [submissions, scores],
  );

  const activeManageSectionMeta = useMemo(() => {
    if (activeManageSection === "overview") {
      return {
        label: translate("workspace.manage.overview.label"),
        description: translate("workspace.manage.overview.description"),
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
    return new Map(
      scores
        .filter((score) => score.judge_uid === user.id)
        .map((score) => [score.submission_id, score]),
    );
  }, [scores, user]);

  const timelineRows = useMemo(() => {
    if (!contest) return [];
    return buildContestTimelineRows({
      milestones: contest.timeline_milestones ?? [],
      registrationDeadline: contest.registration_deadline,
      startsAt: contest.starts_at,
      endsAt: contest.ends_at,
      formatDateTime,
      defaultLabels: {
        registrationDeadline: translate("detail.timeline.registrationDeadline"),
        kickoff: translate("detail.timeline.kickoff"),
        end: translate("detail.timeline.end"),
      },
    });
  }, [contest, formatDateTime, translate]);

  const registrationCountdownLabel = useMemo(
    () => {
      if (!contest?.registration_deadline) return null;
      const end = new Date(contest.registration_deadline).getTime();
      const now = Date.now();
      if (now >= end) return translate("detail.hero.registrationClosed");
      return translate("detail.hero.registrationCountdown", {
        time: formatContestCountdown(end - now, translate),
      });
    },
    // countdownTick periodically refreshes hero countdown copy (~30s interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdownTick intentionally busts memo
    [contest?.registration_deadline, countdownTick, translate],
  );

  const contestEndsLabel = useMemo(
    () => {
      if (!contest?.ends_at) return null;
      const end = new Date(contest.ends_at).getTime();
      const now = Date.now();
      if (now >= end) return translate("detail.hero.contestEnded");
      return translate("detail.hero.contestEndsCountdown", {
        time: formatContestCountdown(end - now, translate),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdownTick intentionally busts memo
    [contest?.ends_at, countdownTick, translate],
  );

  const publicCta = useMemo(() => {
    if (isManageView) return null;
    if (registration?.status === "approved") {
      return {
        label: mySubmission
          ? translate("detail.cta.continueSubmission")
          : translate("detail.cta.submitSubmission"),
        helper: translate("detail.cta.approvedHelper"),
      };
    }
    if (registration) {
      return {
        label: translate("detail.cta.viewApplicationStatus"),
        helper: translate("detail.cta.pendingHelper"),
      };
    }
    if (contest?.status === "published") {
      return {
        label: translate("detail.cta.register"),
        helper: translate("detail.cta.registerHelper"),
      };
    }
    return {
      label: translate("detail.cta.trackTimeline"),
      helper: translate("detail.cta.trackTimelineHelper"),
    };
  }, [contest?.status, isManageView, mySubmission, registration, translate]);

  const registrationDraftReady = useMemo(() => {
    return contactEmail.trim().length > 0 && motivation.trim().length >= 24;
  }, [contactEmail, motivation]);

  const submissionDraftDirty = useMemo(
    () =>
      registration?.status === "approved" &&
      (submissionTitle !== (mySubmission?.title ?? "") ||
        submissionSummary !== (mySubmission?.summary ?? "") ||
        submissionDemoUrl !== (mySubmission?.demo_url ?? "") ||
        submissionRepoUrl !== (mySubmission?.repo_url ?? "") ||
        submissionSlideUrl !== (mySubmission?.slide_url ?? "")),
    [
      mySubmission?.demo_url,
      mySubmission?.repo_url,
      mySubmission?.slide_url,
      mySubmission?.summary,
      mySubmission?.title,
      registration?.status,
      submissionDemoUrl,
      submissionRepoUrl,
      submissionSlideUrl,
      submissionSummary,
      submissionTitle,
    ],
  );

  const leaderboardReadyForPublish = useMemo(
    () => leaderboard.filter((entry) => entry.score_count > 0),
    [leaderboard],
  );

  const loadAbortRef = useRef<AbortController | null>(null);

  const loadContestData = useCallback(async () => {
    if (!id || !authInitialized) return;
    loadAbortRef.current?.abort();
    const ctrl = new AbortController();
    loadAbortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchContestDetailPayload({
        id,
        profile,
        userEmail: user?.email ?? undefined,
        viewer: user ?? null,
        isManager,
        translate,
        signal: ctrl.signal,
      });
      if (loadAbortRef.current !== ctrl) return;
      if (result.status === "aborted") return;
      if (result.status === "error") {
        setContest(null);
        setError(result.errorMessage);
        return;
      }
      const p = result.payload;
      setContest(p.contest);
      hydrateContestMetaFromPayload(p);
      hydrateRegistrationFromPayload(p);
      hydrateJudgingFromPayload(p);
      hydrateInvitesFromPayload(p);
    } catch (err) {
      if (loadAbortRef.current !== ctrl) return;
      setError(
        err instanceof Error
          ? err.message
          : translate("detail.errors.loadFailed"),
      );
    } finally {
      if (loadAbortRef.current === ctrl) {
        setLoading(false);
      }
    }
  }, [
    hydrateContestMetaFromPayload,
    hydrateInvitesFromPayload,
    hydrateJudgingFromPayload,
    hydrateRegistrationFromPayload,
    id,
    isManager,
    authInitialized,
    profile,
    setContest,
    setError,
    setLoading,
    translate,
    user?.email,
  ]);

  useEffect(() => {
    void loadContestData();
  }, [loadContestData]);

  useEffect(() => {
    const idInterval = window.setInterval(
      () => setCountdownTick((x) => x + 1),
      30000,
    );
    return () => window.clearInterval(idInterval);
  }, []);

  useEffect(() => {
    if (
      !window.location.hash ||
      window.location.hash !== "#participant-workspace"
    )
      return;
    const timer = window.setTimeout(
      () => scrollToElementById("participant-workspace"),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [loading, contest?.id]);

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
    navigate("/contests", { replace: true });
  }, [canAccessWorkspace, contest, isManageView, loading, navigate, translate]);

  useEffect(() => {
    setContactEmail(profile?.email ?? "");
    setContactPhone(profile?.phone ?? "");
  }, [profile?.email, profile?.phone, setContactEmail, setContactPhone]);

  useEffect(() => {
    if (!isManageView) return;
    const valid = [
      "overview",
      ...(canReview ? ["applications"] : []),
      ...(canJudge ? ["judging"] : []),
      ...(isManager ? ["settings"] : []),
    ];
    setActiveManageSection((prev) =>
      valid.includes(prev) ? prev : (valid[0] ?? "overview"),
    );
  }, [canJudge, canReview, isManageView, isManager]);

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
      await deleteContest(contest.id);
      toast.success(translate("detail.actions.deleteSuccess"));
      navigate("/admin/contests", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : translate("detail.actions.deleteErrorFallback");
      toast.error(message);
    } finally {
      setDeletingContest(false);
    }
  }, [contest, navigate, setDeletingContest, translate]);

  const handleApply = useCallback(async () => {
    if (!id || applying) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (!contactEmail.trim()) {
      toast.error(translate("detail.toasts.contactEmailRequired"));
      return;
    }
    if (motivation.trim().length < 24) {
      toast.error(translate("detail.toasts.applicationMotivationTooShort"));
      return;
    }
    setApplying(true);
    try {
      const result = await registerForContest(id, {
        team_name: teamName,
        team_members: parsedTeamMembers,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        portfolio_url: portfolioUrl,
        motivation,
        user_full_name: profile?.full_name ?? undefined,
      });
      setRegistration(result);
      toast.success(translate("detail.toasts.applicationSubmitted"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.applicationSubmitFailed"),
      );
    } finally {
      setApplying(false);
    }
  }, [
    applying,
    contactEmail,
    contactPhone,
    id,
    isAuthenticated,
    location,
    motivation,
    navigate,
    parsedTeamMembers,
    portfolioUrl,
    profile?.full_name,
    setApplying,
    setRegistration,
    teamName,
    translate,
  ]);

  const handleReview = useCallback(
    async (userId: string, status: RegistrationDecisionStatus) => {
      if (!id || !canReview || savingReviewId) return;
      setSavingReviewId(userId);
      try {
        await reviewContestRegistration(id, userId, {
          status,
          review_note: reviewNotes[userId] ?? "",
        });
        toast.success(
          status === "approved"
            ? translate("detail.toasts.applicationReviewedApproved")
            : translate("detail.toasts.applicationReviewedRejected"),
        );
        await loadContestData();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate("detail.toasts.applicationReviewUpdateFailed"),
        );
      } finally {
        setSavingReviewId(null);
      }
    },
    [
      canReview,
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
      await updateContest(id, { status: managerStatus });
      setContest((prev) => (prev ? { ...prev, status: managerStatus } : prev));
      toast.success(translate("detail.toasts.contestStatusUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.contestStatusUpdateFailed"),
      );
    } finally {
      setSavingStatus(false);
    }
  }, [
    contest,
    id,
    isManager,
    managerStatus,
    savingStatus,
    setContest,
    setSavingStatus,
    translate,
  ]);

  const handleInviteCreate = useCallback(async () => {
    if (!id || !isManager || savingInvite || !inviteEmail.trim()) return;
    setSavingInvite(true);
    try {
      await createContestAccessInvite(id, {
        email: inviteEmail,
        roles: [inviteRole],
        display_name: inviteDisplayName,
        organization_name: inviteOrganization,
        note: inviteNote,
      });
      setInviteEmail("");
      setInviteDisplayName("");
      setInviteOrganization("");
      setInviteNote("");
      toast.success(translate("detail.toasts.inviteCreated"));
      await loadContestData();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.inviteCreateFailed"),
      );
    } finally {
      setSavingInvite(false);
    }
  }, [
    id,
    inviteDisplayName,
    inviteEmail,
    inviteNote,
    inviteOrganization,
    inviteRole,
    isManager,
    loadContestData,
    savingInvite,
    setInviteDisplayName,
    setInviteEmail,
    setInviteNote,
    setInviteOrganization,
    setSavingInvite,
    translate,
  ]);

  const handleInviteResponse = useCallback(
    async (status: "accepted" | "declined") => {
      if (!id || !myInvite) return;
      setInviteActionId(myInvite.id);
      try {
        await respondToContestAccessInvite(id, status);
        toast.success(
          status === "accepted"
            ? translate("detail.toasts.inviteAccepted")
            : translate("detail.toasts.inviteDeclined"),
        );
        await loadContestData();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate("detail.toasts.inviteUpdateFailed"),
        );
      } finally {
        setInviteActionId(null);
      }
    },
    [id, loadContestData, myInvite, setInviteActionId, translate],
  );

  const handleInviteRevoke = useCallback(
    async (email: string) => {
      if (!id || !isManager) return;
      setInviteActionId(email);
      try {
        await revokeContestAccessInvite(id, email);
        toast.success(translate("detail.toasts.inviteRevoked"));
        await loadContestData();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate("detail.toasts.inviteRevokeFailed"),
        );
      } finally {
        setInviteActionId(null);
      }
    },
    [id, isManager, loadContestData, setInviteActionId, translate],
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
      await updateContest(id, { rubric_weights: weights });
      setContest((prev) =>
        prev ? { ...prev, rubric_weights: weights } : prev,
      );
      toast.success(translate("detail.toasts.rubricUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.rubricUpdateFailed"),
      );
    } finally {
      setSavingRubric(false);
    }
  }, [
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

  const handleSubmissionSave = useCallback(async () => {
    if (!id || savingSubmission || !submissionTitle.trim()) return;
    if (submissionSummary.trim().length < 32) {
      toast.error(translate("detail.toasts.submissionSummaryTooShort"));
      return;
    }
    setSavingSubmission(true);
    try {
      const saved = await upsertContestSubmission(id, {
        title: submissionTitle,
        summary: submissionSummary,
        demo_url: submissionDemoUrl,
        repo_url: submissionRepoUrl,
        slide_url: submissionSlideUrl,
      });
      setMySubmission(saved);
      toast.success(translate("detail.toasts.submissionSaved"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.submissionSaveFailed"),
      );
    } finally {
      setSavingSubmission(false);
    }
  }, [
    id,
    savingSubmission,
    setMySubmission,
    setSavingSubmission,
    submissionDemoUrl,
    submissionRepoUrl,
    submissionSlideUrl,
    submissionSummary,
    submissionTitle,
    translate,
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
        await scoreContestSubmission(id, submissionId, {
          product_score: values[0],
          technical_score: values[1],
          presentation_score: values[2],
          impact_score: values[3],
          note: draft.note,
        });
        toast.success(translate("detail.toasts.scoreSaved"));
        await loadContestData();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate("detail.toasts.scoreSaveFailed"),
        );
      } finally {
        setSavingScoreId(null);
      }
    },
    [
      canJudge,
      id,
      loadContestData,
      scoreDrafts,
      setSavingScoreId,
      translate,
    ],
  );

  const handleRefreshMetrics = useCallback(async () => {
    if (!id || !isManager || refreshingMetrics) return;
    setRefreshingMetrics(true);
    try {
      const snapshot = await refreshContestMetricsSnapshot(id);
      setContest((prev) =>
        prev ? { ...prev, metrics_snapshot: snapshot } : prev,
      );
      toast.success(translate("detail.toasts.metricsRefreshed"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.metricsRefreshFailed"),
      );
    } finally {
      setRefreshingMetrics(false);
    }
  }, [
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
      const result = await publishContestResults(id, winnerInputs);
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
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.publishFailed"),
      );
    } finally {
      setPublishingResults(false);
    }
  }, [
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
        const { url, path } = await uploadContestBanner(
          id,
          file,
          contest.cover_image_path ?? null,
        );
        await updateContest(id, { cover_image_url: url, cover_image_path: path });
        const next: Contest = {
          ...contest,
          cover_image_url: url,
          cover_image_path: path,
        };
        setContest(next);
        onContestSynced?.(next);
        toast.success(translate("detail.toasts.contestBannerUpdated"));
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate("detail.toasts.contestBannerUploadFailed"),
        );
      } finally {
        setBannerUploading(false);
      }
    },
    [
      contest,
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
        const { url, path } = await uploadContestThumbnail(
          id,
          file,
          contest.thumbnail_path ?? null,
        );
        await updateContest(id, { thumbnail_url: url, thumbnail_path: path });
        const next: Contest = {
          ...contest,
          thumbnail_url: url,
          thumbnail_path: path,
        };
        setContest(next);
        onContestSynced?.(next);
        toast.success(translate("detail.toasts.contestThumbnailUpdated"));
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate("detail.toasts.contestThumbnailUploadFailed"),
        );
      } finally {
        setThumbnailUploading(false);
      }
    },
    [
      contest,
      id,
      isManager,
      onContestSynced,
      setContest,
      setThumbnailUploading,
      translate,
    ],
  );

  const handleSavePublicContent = useCallback(async () => {
    if (!id || !isManager || savingPublicContent || !contest || !isManageView)
      return;
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
      await updateContest(id, {
        prize_pool_summary: publicDraft.prize_pool_summary.trim() || null,
        prizes,
        faqs,
        timeline_milestones: milestones,
      });
      const fresh = await getContest(id);
      if (fresh) {
        setContest(fresh);
        onContestSynced?.(fresh);
      }
      toast.success(translate("detail.toasts.publicContentSaved"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : translate("detail.toasts.publicContentSaveFailed"),
      );
    } finally {
      setSavingPublicContent(false);
    }
  }, [
    contest,
    id,
    isManageView,
    isManager,
    onContestSynced,
    publicDraft.faqs,
    publicDraft.milestones,
    publicDraft.prize_pool_summary,
    publicDraft.prizes,
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
      const link = `${window.location.origin}/admin/contests/${id}/manage?invite=${encodeURIComponent(email)}`;
      await navigator.clipboard.writeText(link);
      toast.success(translate("detail.toasts.inviteLinkCopied"));
    },
    [id, translate],
  );

  const handleInviteMailTo = useCallback(
    (invite: ContestAccessInvite) => {
      if (!id || !contest) return;
      const link = `${window.location.origin}/admin/contests/${id}/manage?invite=${encodeURIComponent(invite.email)}`;
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
    [contest, id, translate],
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
    loading,
    error,
    registration,
    registrations,
    reviewNotes,
    setReviewNotes,
    savingReviewId,
    teamName,
    setTeamName,
    teamMembers,
    setTeamMembers,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    portfolioUrl,
    setPortfolioUrl,
    motivation,
    setMotivation,
    applying,
    submissions,
    scores,
    mySubmission,
    savingScoreId,
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
    inviteRole,
    setInviteRole,
    inviteActionId,
    managerStatus,
    setManagerStatus,
    savingStatus,
    refreshingMetrics,
    savingRubric,
    deletingContest,
    rubricWeights,
    setRubricWeights,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    publishingResults,
    savingPublicContent,
    bannerUploading,
    thumbnailUploading,
    publicDraft,
    setPublicDraft,
    activeManageSection,
    setActiveManageSection,
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
    registrationCountdownLabel,
    contestEndsLabel,
    publicCta,
    registrationDraftReady,
    submissionDraftDirty,
    leaderboardReadyForPublish,
    statusLabel,
    registrationStatusLabel,
    locationLabel,
    formatDateTime,
    formatDate,
    publicSection,
    parsedTeamMembers,
    handleDeleteContest,
    handleApply,
    handleReview,
    handleStatusSave,
    handleInviteCreate,
    handleInviteResponse,
    handleInviteRevoke,
    handleRubricSave,
    handleSubmissionSave,
    handleScoreSave,
    handleRefreshMetrics,
    handlePublishResults,
    handleContestBannerChange,
    handleContestThumbnailChange,
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

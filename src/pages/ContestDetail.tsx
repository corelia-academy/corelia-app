import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Buildings,
  CalendarBlank,
  Checks,
  ClockCountdown,
  EnvelopeSimple,
  Gavel,
  MapPin,
  Spinner,
  ShieldCheck,
  Trash,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import {
  canManageContests,
  canReviewContestApplications,
  canScoreContest,
  canViewContestAggregateMetrics,
  getContestScopedViewerRoles,
} from "@/lib/permissions";
import {
  createContestAccessInvite,
  deleteContest,
  getContest,
  getContestRegistrations,
  getMyContestAccessInvite,
  getMyContestRegistration,
  getMyContestSubmission,
  listContestAccessInvites,
  listContestScores,
  listContestSubmissions,
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
import { useAuth } from "@/stores/authStore";
import type {
  Contest,
  ContestAccessInvite,
  ContestLeaderboardEntry,
  ContestRegistration,
  ContestRegistrationStatus,
  ContestScore,
  ContestScopedViewerRole,
  ContestStatus,
  ContestSubmission,
  ContestWinnerInput,
} from "@/types/contests";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";

function parseLineList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function scrollToElementById(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildLeaderboard(
  submissions: ContestSubmission[],
  scores: ContestScore[],
): ContestLeaderboardEntry[] {
  const scoreMap = new Map<string, ContestScore[]>();
  for (const score of scores) {
    const list = scoreMap.get(score.submission_id) ?? [];
    list.push(score);
    scoreMap.set(score.submission_id, list);
  }

  return submissions
    .map((submission) => {
      const relatedScores = scoreMap.get(submission.id) ?? [];
      const total = relatedScores.reduce((sum, score) => sum + score.total_score, 0);
      const average = relatedScores.length === 0 ? 0 : total / relatedScores.length;
      return {
        submission_id: submission.id,
        contestant_user_id: submission.user_id,
        contestant_name: submission.contestant_name,
        submission_title: submission.title,
        average_score: Number(average.toFixed(2)),
        score_count: relatedScores.length,
        rank: 0,
        team_name: submission.team_name,
      };
    })
    .sort((a, b) => {
      if (b.average_score !== a.average_score) return b.average_score - a.average_score;
      return b.score_count - a.score_count;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export default function ContestDetail() {
  const { t } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) => String(t(key as never, options as never)),
    [t],
  );
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, isAuthenticated } = useAuth();

  const statusLabel = (status: Contest["status"]): string =>
    translate(`status.${status}`, { defaultValue: translate("status.unknown") });

  const registrationStatusLabel = (status: ContestRegistrationStatus): string =>
    translate(`registrationStatus.${status}`, {
      defaultValue: translate("registrationStatus.unknown"),
    });

  const locationLabel = (loc: Contest["location"]): string =>
    translate(`location.${loc}`, { defaultValue: translate("location.unknown") });

  const formatDateTime = (value: string | null): string => {
    if (!value) return translate("detail.notUpdated");
    return new Date(value).toLocaleString(intlLocale());
  };

  const formatDate = (value: string | null): string => {
    if (!value) return translate("detail.notUpdated");
    return new Date(value).toLocaleDateString(intlLocale());
  };

  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [registration, setRegistration] = useState<ContestRegistration | null>(null);
  const [registrations, setRegistrations] = useState<ContestRegistration[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<ContestSubmission[]>([]);
  const [scores, setScores] = useState<ContestScore[]>([]);
  const [mySubmission, setMySubmission] = useState<ContestSubmission | null>(null);
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);

  const [invites, setInvites] = useState<ContestAccessInvite[]>([]);
  const [myInvite, setMyInvite] = useState<ContestAccessInvite | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteOrganization, setInviteOrganization] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteRole, setInviteRole] = useState<ContestScopedViewerRole>("judge");
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [contactEmail, setContactEmail] = useState(profile?.email ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [motivation, setMotivation] = useState("");
  const [applying, setApplying] = useState(false);

  const [submissionTitle, setSubmissionTitle] = useState("");
  const [submissionSummary, setSubmissionSummary] = useState("");
  const [submissionDemoUrl, setSubmissionDemoUrl] = useState("");
  const [submissionRepoUrl, setSubmissionRepoUrl] = useState("");
  const [submissionSlideUrl, setSubmissionSlideUrl] = useState("");
  const [savingSubmission, setSavingSubmission] = useState(false);

  const [managerStatus, setManagerStatus] = useState<ContestStatus>("draft");
  const [savingStatus, setSavingStatus] = useState(false);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [savingRubric, setSavingRubric] = useState(false);
  const [deletingContest, setDeletingContest] = useState(false);
  const [rubricWeights, setRubricWeights] = useState({
    product: "25",
    technical: "25",
    presentation: "25",
    impact: "25",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [winnerAwards, setWinnerAwards] = useState<Record<string, string>>({});
  const [winnerNotes, setWinnerNotes] = useState<Record<string, string>>({});
  const [publishingResults, setPublishingResults] = useState(false);

  const [scoreDrafts, setScoreDrafts] = useState<
    Record<
      string,
      {
        product: string;
        technical: string;
        presentation: string;
        impact: string;
        note: string;
      }
    >
  >({});

  const isManager = canManageContests(profile);
  const canReview = canReviewContestApplications(contest, profile);
  const canJudge = canScoreContest(contest, profile, user?.email);
  const canViewAggregate = canViewContestAggregateMetrics(contest, profile, user?.email);
  const viewerRoles = getContestScopedViewerRoles(contest, user?.email);
  const isManageView = location.pathname.endsWith("/manage");
  const canAccessWorkspace = isManager || canJudge || canViewAggregate;
  const manageSections = useMemo(
    () =>
      [
        canReview
          ? {
              id: "applications",
              label: translate("detail.manage.sections.applications.label"),
              description: translate("detail.manage.sections.applications.description"),
            }
          : null,
        canJudge
          ? {
              id: "judging",
              label: translate("detail.manage.sections.judging.label"),
              description: translate("detail.manage.sections.judging.description"),
            }
          : null,
        canViewAggregate
          ? {
              id: "results",
              label: translate("detail.manage.sections.results.label"),
              description: translate("detail.manage.sections.results.description"),
            }
          : null,
      ].filter((item): item is { id: string; label: string; description: string } => item != null),
    [canJudge, canReview, canViewAggregate, translate],
  );
  const [activeManageSection, setActiveManageSection] = useState<string>("overview");

  const leaderboard = useMemo(() => buildLeaderboard(submissions, scores), [submissions, scores]);
  const activeManageSectionMeta = useMemo(() => {
    if (activeManageSection === "overview") {
      return {
        label: translate("detail.manage.overview.label"),
        description: translate("detail.manage.overview.description"),
      };
    }
    return (
      manageSections.find((section) => section.id === activeManageSection) ?? {
        label: translate("detail.manage.fallback.label"),
        description: translate("detail.manage.fallback.description"),
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
  const collaborationLanes = useMemo(
    () => [
      {
        title: translate("detail.lanes.ops.title"),
        description: translate("detail.lanes.ops.description"),
      },
      {
        title: translate("detail.lanes.judge.title"),
        description: translate("detail.lanes.judge.description"),
      },
      {
        title: translate("detail.lanes.observer.title"),
        description: translate("detail.lanes.observer.description"),
      },
    ],
    [translate],
  );
  const judgeOwnScores = useMemo(() => {
    if (!user) return new Map<string, ContestScore>();
    return new Map(
      scores
        .filter((score) => score.judge_uid === user.uid)
        .map((score) => [score.submission_id, score]),
    );
  }, [scores, user]);

  async function handleDeleteContest() {
    if (!contest) return;

    setDeletingContest(true);
    try {
      await deleteContest(contest.id);
      toast.success(translate("detail.actions.deleteSuccess"));
      navigate("/instructor/contests", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : translate("detail.actions.deleteErrorFallback");
      toast.error(message);
    } finally {
      setDeletingContest(false);
    }
  }
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
  const parsedTeamMembers = useMemo(() => parseLineList(teamMembers), [teamMembers]);
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

  const loadContestData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const contestData = await getContest(id);
      if (!contestData) {
        setContest(null);
        setError(translate("detail.errors.notFound"));
        return;
      }

      setContest(contestData);
      setManagerStatus(contestData.status);
      setRubricWeights({
        product: String(contestData.rubric_weights.product),
        technical: String(contestData.rubric_weights.technical),
        presentation: String(contestData.rubric_weights.presentation),
        impact: String(contestData.rubric_weights.impact),
      });

      const aggregateViewer = canViewContestAggregateMetrics(
        contestData,
        profile,
        user?.email,
      );
      const reviewer = canReviewContestApplications(contestData, profile);
      const judge = canScoreContest(contestData, profile, user?.email);

      const tasks: Promise<unknown>[] = [];

      if (reviewer) {
        tasks.push(
          getContestRegistrations(id, { status: "all" }).then((items) => {
            setRegistrations(items);
            setReviewNotes(
              Object.fromEntries(items.map((item) => [item.user_id, item.review_note ?? ""])),
            );
          }),
        );
      } else {
        tasks.push(
          getMyContestRegistration(id).then((item) => {
            setRegistration(item);
            setTeamName(item?.team_name ?? "");
            setTeamMembers((item?.team_members ?? []).join("\n"));
          }),
        );
      }

      if (judge || isManager) {
        tasks.push(
          listContestSubmissions(id).then((items) => {
            setSubmissions(items);
            const defaultAwards: Record<string, string> = {};
            for (const [index, entry] of items.slice(0, 3).entries()) {
              defaultAwards[entry.id] = index === 0 ? "Champion" : index === 1 ? "Runner-up" : "Best Demo";
            }
            setWinnerAwards(defaultAwards);
          }),
        );
        tasks.push(listContestScores(id).then((items) => setScores(items)));
      } else {
        tasks.push(
          getMyContestSubmission(id).then((item) => {
            setMySubmission(item);
            setSubmissionTitle(item?.title ?? "");
            setSubmissionSummary(item?.summary ?? "");
            setSubmissionDemoUrl(item?.demo_url ?? "");
            setSubmissionRepoUrl(item?.repo_url ?? "");
            setSubmissionSlideUrl(item?.slide_url ?? "");
          }),
        );
      }

      if (isManager) {
        tasks.push(listContestAccessInvites(id).then((items) => setInvites(items)));
      } else {
        tasks.push(getMyContestAccessInvite(id).then((item) => setMyInvite(item)));
      }

      await Promise.all(tasks);

      if (aggregateViewer && !reviewer) {
        setRegistrations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : translate("detail.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, isManager, profile, translate, user?.email]);

  useEffect(() => {
    void loadContestData();
  }, [loadContestData]);

  useEffect(() => {
    setContactEmail(profile?.email ?? "");
    setContactPhone(profile?.phone ?? "");
  }, [profile?.email, profile?.phone]);

  useEffect(() => {
    if (!isManageView) return;
    const valid = ["overview", ...manageSections.map((section) => section.id)];
    setActiveManageSection((prev) => (valid.includes(prev) ? prev : valid[0] ?? "overview"));
  }, [isManageView, manageSections]);

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
  }, [judgeOwnScores, submissions]);

  useEffect(() => {
    if (!submissionDraftDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submissionDraftDirty]);

  async function handleApply() {
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
        err instanceof Error ? err.message : translate("detail.toasts.applicationSubmitFailed"),
      );
    } finally {
      setApplying(false);
    }
  }

  async function handleReview(
    userId: string,
    status: Extract<ContestRegistrationStatus, "approved" | "rejected">,
  ) {
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
        err instanceof Error ? err.message : translate("detail.toasts.applicationReviewUpdateFailed"),
      );
    } finally {
      setSavingReviewId(null);
    }
  }

  async function handleStatusSave() {
    if (!id || !contest || !isManager || savingStatus || managerStatus === contest.status) {
      return;
    }
    setSavingStatus(true);
    try {
      await updateContest(id, { status: managerStatus });
      setContest((prev) => (prev ? { ...prev, status: managerStatus } : prev));
      toast.success(translate("detail.toasts.contestStatusUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : translate("detail.toasts.contestStatusUpdateFailed"),
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleInviteCreate() {
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
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.inviteCreateFailed"));
    } finally {
      setSavingInvite(false);
    }
  }

  async function handleInviteResponse(status: "accepted" | "declined") {
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
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.inviteUpdateFailed"));
    } finally {
      setInviteActionId(null);
    }
  }

  async function handleInviteRevoke(email: string) {
    if (!id || !isManager) return;
    setInviteActionId(email);
    try {
      await revokeContestAccessInvite(id, email);
      toast.success(translate("detail.toasts.inviteRevoked"));
      await loadContestData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.inviteRevokeFailed"));
    } finally {
      setInviteActionId(null);
    }
  }

  async function handleRubricSave() {
    if (!id || !isManager || savingRubric) return;
    setSavingRubric(true);
    try {
      const weights = {
        product: Number(rubricWeights.product) || 0,
        technical: Number(rubricWeights.technical) || 0,
        presentation: Number(rubricWeights.presentation) || 0,
        impact: Number(rubricWeights.impact) || 0,
      };
      const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
      if (totalWeight !== 100) {
        toast.error(translate("detail.toasts.rubricWeightMustBe100"));
        return;
      }
      await updateContest(id, { rubric_weights: weights });
      setContest((prev) => (prev ? { ...prev, rubric_weights: weights } : prev));
      toast.success(translate("detail.toasts.rubricUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.rubricUpdateFailed"));
    } finally {
      setSavingRubric(false);
    }
  }

  async function handleSubmissionSave() {
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
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.submissionSaveFailed"));
    } finally {
      setSavingSubmission(false);
    }
  }

  async function handleScoreSave(submissionId: string) {
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
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.scoreSaveFailed"));
    } finally {
      setSavingScoreId(null);
    }
  }

  async function handleRefreshMetrics() {
    if (!id || !isManager || refreshingMetrics) return;
    setRefreshingMetrics(true);
    try {
      const snapshot = await refreshContestMetricsSnapshot(id);
      setContest((prev) => (prev ? { ...prev, metrics_snapshot: snapshot } : prev));
      toast.success(translate("detail.toasts.metricsRefreshed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.metricsRefreshFailed"));
    } finally {
      setRefreshingMetrics(false);
    }
  }

  async function handlePublishResults() {
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
      toast.error(err instanceof Error ? err.message : translate("detail.toasts.publishFailed"));
    } finally {
      setPublishingResults(false);
    }
  }

  function scoreDraftTotal(submissionId: string): number {
    const draft = scoreDrafts[submissionId];
    if (!draft) return 0;
    return (
      (Number(draft.product) || 0) +
      (Number(draft.technical) || 0) +
      (Number(draft.presentation) || 0) +
      (Number(draft.impact) || 0)
    );
  }

  async function handleCopyInviteLink(email: string) {
    if (!id) return;
    const link = `${window.location.origin}/instructor/contests/${id}/manage?invite=${encodeURIComponent(email)}`;
    await navigator.clipboard.writeText(link);
    toast.success(translate("detail.toasts.inviteLinkCopied"));
  }

  function handleInviteMailTo(invite: ContestAccessInvite) {
    if (!id || !contest) return;
    const link = `${window.location.origin}/instructor/contests/${id}/manage?invite=${encodeURIComponent(invite.email)}`;
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
    window.open(`mailto:${invite.email}?subject=${subject}&body=${body}`, "_blank");
  }

  function handleExportLeaderboardCsv() {
    if (!contest) return;
    const rows = [
      ["rank", "submission_title", "contestant", "team_name", "average_score", "score_count"],
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
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    downloadTextFile(`contest-${contest.id}-leaderboard.csv`, csv);
  }

  if (loading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Card>
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full border border-border-subtle bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {translate("detail.loading.eyebrow")}
            </div>
            <div className="mt-4 text-[15px] font-medium text-foreground">
              {translate("detail.loading.title")}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">
              {translate("detail.loading.description")}
            </div>
            <div className="mt-6 grid w-full max-w-3xl gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border-subtle bg-background p-4 text-left">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="mt-3 h-4 w-3/4 rounded-full bg-muted" />
                <div className="mt-2 h-4 w-2/3 rounded-full bg-muted" />
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4 text-left">
                <div className="h-3 w-20 rounded-full bg-muted" />
                <div className="mt-3 h-4 w-4/5 rounded-full bg-muted" />
                <div className="mt-2 h-4 w-1/2 rounded-full bg-muted" />
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4 text-left">
                <div className="h-3 w-28 rounded-full bg-muted" />
                <div className="mt-3 h-4 w-2/3 rounded-full bg-muted" />
                <div className="mt-2 h-4 w-3/5 rounded-full bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-destructive">
              {translate("detail.errors.deleteAccessDeniedTitle")}
            </div>
            <div className="text-[16px] font-medium text-foreground">
              {error || translate("detail.errors.deleteAccessDeniedFallback")}
            </div>
            <div className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {translate("detail.errorState.description")}
            </div>
            <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground" />
            <Button
              render={<NavLink to="/contests" />}
              nativeButton={false}
              variant="ghost"
              className="mt-4"
            >
              {translate("detail.errorState.backToList")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isManageView && !canAccessWorkspace) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <div className="text-[16px] font-medium text-foreground">
              {translate("detail.errors.workspaceAccessDenied")}
            </div>
            <Button
              render={<NavLink to={`/contests/${contest.id}`} />}
              nativeButton={false}
              variant="ghost"
              className="mt-4"
            >
              Về trang cuộc thi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-4">
        <Button
          render={<NavLink to="/contests" />}
          nativeButton={false}
          variant="ghost"
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Quay lại cuộc thi
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,240px)_minmax(0,1.55fr)_minmax(340px,0.9fr)]">
        {isManageView ? (
          <nav className="h-fit rounded-2xl border border-border-subtle bg-card p-3 shadow-card xl:sticky xl:top-24">
            <div className="mb-3 px-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Điều hướng workspace
                
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Không gian phối hợp nhiều bên cho Corelia, ban giám khảo và đơn vị đồng tổ chức.
              </p>
            </div>
            <ul className="flex gap-1.5 overflow-x-auto pb-1 xl:grid xl:gap-1.5 xl:overflow-visible xl:pb-0">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveManageSection("overview")}
                  className={`flex min-w-[180px] flex-col rounded-xl px-3 py-2.5 text-left transition-colors xl:min-w-0 ${
                    activeManageSection === "overview"
                      ? "bg-primary/10 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="text-sm font-medium">Tổng quan</span>
                  <span className="mt-0.5 text-[12px]">Vai trò, health và nhịp vận hành</span>
                </button>
              </li>
              {manageSections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => setActiveManageSection(section.id)}
                    className={`flex min-w-[180px] flex-col rounded-xl px-3 py-2.5 text-left transition-colors xl:min-w-0 ${
                      activeManageSection === section.id
                        ? "bg-primary/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="text-sm font-medium">{section.label}</span>
                    <span className="mt-0.5 text-[12px]">{section.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className="hidden xl:block" />
        )}

        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {isManageView ? translate("detail.labels.manageArea") : translate("detail.labels.publicType")}
                  </div>
                  <h1 className="mt-2 text-3xl font-normal tracking-tight text-foreground">
                    {contest.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-[15px] text-muted-foreground">
                    {isManageView
                      ? activeManageSectionMeta.description
                      : contest.tagline}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground">
                  {statusLabel(contest.status)}
                </span>
              </div>

              {isManageView && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {isManager && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      Vận hành Corelia
                    </span>
                  )}
                  {canJudge && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      Ban giám khảo
                    </span>
                  )}
                  {viewerRoles.includes("co_host_viewer") && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      Đồng tổ chức quan sát
                    </span>
                  )}
                </div>
              )}

              {isManageView && (
                <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    variant={activeManageSection === "overview" ? "default" : "outline"}
                    onClick={() => setActiveManageSection("overview")}
                  >
                    Tổng quan
                  </Button>
                  {manageSections.map((section) => (
                    <Button
                      key={section.id}
                      type="button"
                      size="sm"
                      className="shrink-0"
                      variant={activeManageSection === section.id ? "default" : "outline"}
                      onClick={() => setActiveManageSection(section.id)}
                    >
                      {section.label}
                    </Button>
                  ))}
                </div>
              )}

              {!isManageView && canAccessWorkspace && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    render={<NavLink to={`/instructor/contests/${contest.id}/manage`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    Mở khu vực vận hành
                  </Button>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
                    Bạn đang có quyền xem bề mặt vận hành của cuộc thi này
                  </span>
                </div>
              )}

              {!isManageView && publicCta && (
                <div className="mt-5 rounded-2xl border border-border-subtle bg-muted/25 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Bước tiếp theo
                      </div>
                      <div className="mt-1 text-sm text-foreground">{publicCta.helper}</div>
                    </div>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant={contest.status === "published" && !registration ? "default" : "outline"}
                      onClick={() => scrollToElementById("participant-workspace")}
                    >
                      {publicCta.label}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <CalendarBlank className="size-5 text-primary" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Bắt đầu
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {formatDateTime(contest.starts_at)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <ClockCountdown className="size-5 text-primary" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Kết thúc
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {formatDateTime(contest.ends_at)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="size-5 text-primary" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Hình thức
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {locationLabel(contest.location)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <UsersThree className="size-5 text-primary" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Giới hạn duyệt
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {contest.max_participants ?? translate("detail.labels.unlimited")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isManageView && (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Hồ sơ vào vòng
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {contest.metrics_snapshot.approved_registrations}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Submission
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {contest.metrics_snapshot.submissions_total}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Đã chấm điểm
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {contest.metrics_snapshot.scored_submissions}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Lần cập nhật cuối
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {formatDateTime(contest.metrics_snapshot.updated_at)}
                    </div>
                  </div>
                </div>
              )}

              {!isManageView && (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Duyệt tham gia
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      Mọi hồ sơ đều được Corelia xét duyệt trước khi vào contest.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Nộp bài theo đội
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      Sau khi được duyệt, đội có thể gửi submission và cập nhật tài nguyên.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Kết quả công bố
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      Leaderboard và winners chỉ hiển thị khi Corelia publish chính thức.
                    </div>
                  </div>
                </div>
              )}

              {!isManageView && (
                <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Hành trình tham gia
                    </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {publicJourney.map((step) => (
                        <div
                          key={step.title}
                          className="rounded-2xl border border-border-subtle bg-card p-4"
                        >
                          <div className="text-sm font-medium text-foreground">{step.title}</div>
                          <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                            {step.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Cột mốc chính
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="rounded-2xl border border-border-subtle bg-card px-4 py-3">
                        <div className="text-sm font-medium text-foreground">
                          Hạn đăng ký
                        </div>
                        <div className="mt-1 text-[13px] text-muted-foreground">
                          {formatDate(contest.registration_deadline)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border-subtle bg-card px-4 py-3">
                        <div className="text-sm font-medium text-foreground">Khai mạc</div>
                        <div className="mt-1 text-[13px] text-muted-foreground">
                          {formatDate(contest.starts_at)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border-subtle bg-card px-4 py-3">
                        <div className="text-sm font-medium text-foreground">Công bố kết quả</div>
                        <div className="mt-1 text-[13px] text-muted-foreground">
                          {formatDate(contest.ends_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(!isManageView || activeManageSection === "overview") && contest.description && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-medium tracking-tight text-foreground">
                  {isManageView
                    ? translate("detail.labels.contextManage")
                    : translate("detail.labels.contextPublic")}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-muted-foreground">
                  {contest.description}
                </p>
              </CardContent>
            </Card>
          )}

          {(!isManageView || activeManageSection === "overview") && (
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-lg font-medium tracking-tight text-foreground">
                {isManageView
                  ? translate("detail.labels.rulesManage")
                  : translate("detail.labels.rulesPublic")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-muted-foreground">
                {contest.rules?.trim()
                  ? contest.rules
                  : translate("detail.labels.rulesEmpty")}
              </p>
            </CardContent>
          </Card>
          )}

          {isManageView && activeManageSection === "overview" && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Operating model
                    </h2>
                    <p className="mt-1.5 text-[14px] text-muted-foreground">
                      Contest này được tổ chức như một workspace đa bên, không phải một editor nội dung đơn lẻ.
                    </p>
                  </div>
                  <div className="rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] text-muted-foreground">
                    Section hiện tại: {activeManageSectionMeta.label}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {collaborationLanes.map((lane) => (
                    <div
                      key={lane.title}
                      className="rounded-2xl border border-border-subtle bg-background p-4"
                    >
                      <div className="text-sm font-medium text-foreground">{lane.title}</div>
                      <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                        {lane.description}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Giai đoạn 1
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      Applications
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Thu hồ sơ và duyệt đầu vào.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Giai đoạn 2
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      Submission flow
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Mở quyền nộp bài cho các đội đã được duyệt.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Giai đoạn 3
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      Judge scoring
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Judges chấm theo rubric có trọng số.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Giai đoạn 4
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      Publish outcomes
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Công bố leaderboard và winners ra public surface.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isManageView && canReview && activeManageSection === "applications" && (
            <Card id="applications">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Application review
                    </h2>
                    <p className="mt-1.5 text-[14px] text-muted-foreground">
                      Chỉ người của Corelia mới duyệt hồ sơ. Judges và đồng tổ chức không thấy khu này.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void handleRefreshMetrics()}>
                    {refreshingMetrics
                      ? translate("detail.labels.refreshing")
                      : translate("detail.labels.refreshMetrics")}
                  </Button>
                </div>

                <div className="mt-5 space-y-4">
                  {registrations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-6 text-center">
                      <div className="text-sm font-medium text-foreground">
                        Chưa có hồ sơ đăng ký nào
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        Khi thí sinh gửi hồ sơ, khu duyệt đầu vào của Corelia sẽ xuất hiện tại đây.
                      </div>
                    </div>
                  ) : (
                    registrations.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                              {registrationStatusLabel(item.status)}
                            </div>
                            <div className="mt-1 text-lg font-medium text-foreground">
                              {item.user_full_name || item.user_id}
                            </div>
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              {item.team_name || translate("detail.labels.defaultSoloRegistration")}
                            </div>
                            {item.team_members.length > 0 && (
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                Thành viên: {item.team_members.join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={item.status === "approved" ? "default" : "outline"}
                              disabled={savingReviewId === item.user_id}
                              onClick={() => void handleReview(item.user_id, "approved")}
                            >
                              Duyệt
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={item.status === "rejected" ? "destructive" : "outline"}
                              disabled={savingReviewId === item.user_id}
                              onClick={() => void handleReview(item.user_id, "rejected")}
                            >
                              Từ chối
                            </Button>
                          </div>
                        </div>

                        {item.motivation && (
                          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">
                            {item.motivation}
                          </p>
                        )}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-[13px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {translate("detail.labels.contact")}
                            </span>{" "}
                            {item.contact_email || translate("detail.labels.notProvided")} ·{" "}
                            {item.contact_phone || translate("detail.labels.noDataDash")}
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-[13px] text-muted-foreground">
                            <span className="font-medium text-foreground">Portfolio:</span>{" "}
                            {item.portfolio_url || translate("detail.labels.notProvided")}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label
                            htmlFor={`review-note-${item.user_id}`}
                            className="text-sm font-medium text-foreground"
                          >
                            Ghi chú duyệt
                          </label>
                          <textarea
                            id={`review-note-${item.user_id}`}
                            rows={3}
                            value={reviewNotes[item.user_id] ?? ""}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [item.user_id]: e.target.value,
                              }))
                            }
                            className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isManageView && canJudge && activeManageSection === "judging" && (
            <Card id="judging">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <Gavel className="size-5 text-primary" weight="duotone" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Judging panel
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Chấm điểm theo 4 tiêu chí và lưu điểm trực tiếp cho từng submission.
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Trọng số: Product {contest.rubric_weights.product}% · Technical{" "}
                      {contest.rubric_weights.technical}% · Presentation{" "}
                      {contest.rubric_weights.presentation}% · Impact {contest.rubric_weights.impact}%
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {submissions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-6 text-center">
                      <div className="text-sm font-medium text-foreground">
                        Chưa có submission nào được gửi
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        Judges sẽ thấy bài nộp tại đây ngay khi các đội đã được duyệt bắt đầu cập nhật submission.
                      </div>
                    </div>
                  ) : (
                    submissions.map((submission) => {
                      const draft = scoreDrafts[submission.id] ?? {
                        product: "0",
                        technical: "0",
                        presentation: "0",
                        impact: "0",
                        note: "",
                      };
                      const boardEntry = leaderboard.find(
                        (item) => item.submission_id === submission.id,
                      );
                      return (
                        <div
                          key={submission.id}
                          className="rounded-2xl border border-border-subtle bg-background p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                                Rank hiện tại #{boardEntry?.rank ?? "—"}
                              </div>
                              <div className="mt-1 text-lg font-medium text-foreground">
                                {submission.title}
                              </div>
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                {submission.contestant_name || submission.user_id}
                                {submission.team_name ? ` · ${submission.team_name}` : ""}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-[13px] text-muted-foreground">
                              Trung bình:{" "}
                              <span className="font-medium text-foreground">
                                {boardEntry?.average_score ?? 0}
                              </span>{" "}
                              · {boardEntry?.score_count ?? 0} lượt chấm
                            </div>
                          </div>

                          {submission.summary && (
                            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">
                              {submission.summary}
                            </p>
                          )}

                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-[13px] text-muted-foreground">
                              Demo: {submission.demo_url || translate("detail.labels.noDemo")}
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-[13px] text-muted-foreground">
                              Repo: {submission.repo_url || translate("detail.labels.noDemo")}
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-[13px] text-muted-foreground">
                              Slide: {submission.slide_url || translate("detail.labels.noDemo")}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                              ["product", "Product"],
                              ["technical", "Technical"],
                              ["presentation", "Presentation"],
                              ["impact", "Impact"],
                            ].map(([key, label]) => (
                              <div key={key}>
                                <label className="text-sm font-medium text-foreground">
                                  {label}
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={25}
                                  value={draft[key as keyof typeof draft] as string}
                                  onChange={(e) =>
                                    setScoreDrafts((prev) => ({
                                      ...prev,
                                      [submission.id]: {
                                        ...draft,
                                        [key]: e.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="mt-4">
                            <label className="text-sm font-medium text-foreground">
                              Note
                            </label>
                            <textarea
                              rows={3}
                              value={draft.note}
                              onChange={(e) =>
                                setScoreDrafts((prev) => ({
                                  ...prev,
                                  [submission.id]: { ...draft, note: e.target.value },
                                }))
                              }
                              className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>

                          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border-subtle bg-card px-3 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>
                              Tổng điểm thô hiện tại:{" "}
                              <span className="font-medium text-foreground">
                                {scoreDraftTotal(submission.id)}
                              </span>
                              /100
                            </span>
                            <span>Mỗi tiêu chí chấm từ 0 đến 25.</span>
                          </div>

                          <Button
                            type="button"
                            className="mt-4"
                            disabled={savingScoreId === submission.id}
                            onClick={() => void handleScoreSave(submission.id)}
                          >
                            {savingScoreId === submission.id
                              ? translate("detail.labels.saving")
                              : translate("detail.labels.saveScore")}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isManageView ? (
            canViewAggregate && activeManageSection === "results" && (
            <Card id="results">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <Trophy className="size-5 text-primary" weight="duotone" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Outcomes dashboard
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Co-host chỉ thấy aggregate metrics, leaderboard đã publish và danh sách giải thưởng.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Hồ sơ
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {contest.metrics_snapshot.registrations_total}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Đã duyệt
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {contest.metrics_snapshot.approved_registrations}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Submission
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {contest.metrics_snapshot.submissions_total}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Winners
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {contest.metrics_snapshot.published_winners}
                    </div>
                  </div>
                </div>

                {isManager && leaderboard.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-border-subtle bg-background p-4">
                    <h3 className="text-base font-medium text-foreground">
                      Publish kết quả
                    </h3>
                    <div className="mt-4 space-y-4">
                      {leaderboard.slice(0, 5).map((entry) => (
                        <div key={entry.submission_id} className="rounded-xl border border-border-subtle bg-card p-3">
                          <div className="text-sm font-medium text-foreground">
                            #{entry.rank} · {entry.submission_title}
                          </div>
                          <div className="mt-1 text-[13px] text-muted-foreground">
                            {entry.contestant_name || entry.contestant_user_id} · {entry.average_score} điểm
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input
                              value={winnerAwards[entry.submission_id] ?? ""}
                              onChange={(e) =>
                                setWinnerAwards((prev) => ({
                                  ...prev,
                                  [entry.submission_id]: e.target.value,
                                }))
                              }
                              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                              placeholder={translate("detail.forms.awards.awardPlaceholder")}
                            />
                            <input
                              value={winnerNotes[entry.submission_id] ?? ""}
                              onChange={(e) =>
                                setWinnerNotes((prev) => ({
                                  ...prev,
                                  [entry.submission_id]: e.target.value,
                                }))
                              }
                              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                              placeholder={translate("detail.forms.awards.notePlaceholder")}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      className="mt-4"
                      disabled={publishingResults}
                      onClick={() => void handlePublishResults()}
                    >
                      {publishingResults
                        ? translate("detail.labels.publishing")
                        : translate("detail.labels.publishResults")}
                    </Button>
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-medium text-foreground">
                      Leaderboard đã publish
                    </h3>
                    {contest.published_leaderboard.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleExportLeaderboardCsv}
                      >
                        Export CSV
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 space-y-3">
                    {contest.published_leaderboard.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          Chưa publish leaderboard
                        </div>
                        <div className="mt-1.5 text-sm text-muted-foreground">
                          Kết quả tổng hợp sẽ xuất hiện sau khi Corelia chốt bảng điểm và publish chính thức.
                        </div>
                      </div>
                    ) : (
                      contest.published_leaderboard.slice(0, 10).map((entry) => (
                        <div key={entry.submission_id} className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                #{entry.rank} · {entry.submission_title}
                              </div>
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                {entry.contestant_name || entry.contestant_user_id}
                              </div>
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              {entry.average_score}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-base font-medium text-foreground">Winners</h3>
                  <div className="mt-3 space-y-3">
                    {contest.winner_announcements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          Chưa công bố giải thưởng
                        </div>
                        <div className="mt-1.5 text-sm text-muted-foreground">
                          Danh sách giải thưởng sẽ hiển thị tại đây khi ban tổ chức công bố winners.
                        </div>
                      </div>
                    ) : (
                      contest.winner_announcements.map((winner) => (
                        <div key={winner.submission_id} className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                          <div className="text-sm font-medium text-foreground">
                            {winner.award_title}
                          </div>
                          <div className="mt-1 text-[13px] text-muted-foreground">
                            {winner.contestant_name || winner.contestant_user_id} · {winner.submission_title}
                          </div>
                          {winner.note && (
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              {winner.note}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          ) : (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <Trophy className="size-5 text-primary" weight="duotone" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Kết quả contest
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Những kết quả đã được Corelia công bố sẽ hiển thị tại đây.
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-base font-medium text-foreground">
                    Leaderboard đã publish
                  </h3>
                  <div className="mt-3 space-y-3">
                    {contest.published_leaderboard.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          Chưa publish leaderboard
                        </div>
                        <div className="mt-1.5 text-sm text-muted-foreground">
                          Khi contest được chốt điểm, bảng xếp hạng chính thức sẽ xuất hiện tại đây.
                        </div>
                      </div>
                    ) : (
                      contest.published_leaderboard.slice(0, 10).map((entry) => (
                        <div
                          key={entry.submission_id}
                          className="rounded-2xl border border-border-subtle bg-background px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                #{entry.rank} · {entry.submission_title}
                              </div>
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                {entry.contestant_name || entry.contestant_user_id}
                              </div>
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              {entry.average_score}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-base font-medium text-foreground">Winners</h3>
                  <div className="mt-3 space-y-3">
                    {contest.winner_announcements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          Chưa công bố giải thưởng
                        </div>
                        <div className="mt-1.5 text-sm text-muted-foreground">
                          Hãy theo dõi trang này để xem winners khi Corelia publish kết quả.
                        </div>
                      </div>
                    ) : (
                      contest.winner_announcements.map((winner) => (
                        <div
                          key={winner.submission_id}
                          className="rounded-2xl border border-border-subtle bg-background px-4 py-3"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {winner.award_title}
                          </div>
                          <div className="mt-1 text-[13px] text-muted-foreground">
                            {winner.contestant_name || winner.contestant_user_id} ·{" "}
                            {winner.submission_title}
                          </div>
                          {winner.note && (
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              {winner.note}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          {isManageView && isManager ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-primary" weight="duotone" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Operations controls
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Điều phối trạng thái, rubric và quyền truy cập cho các bên tham gia vận hành contest.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-foreground">
                    Trạng thái cuộc thi
                  </label>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    value={managerStatus}
                    onChange={(e) => setManagerStatus(e.target.value as ContestStatus)}
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="published">Mở đăng ký</option>
                    <option value="running">Đang diễn ra</option>
                    <option value="ended">Đã kết thúc</option>
                  </select>
                </div>

                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={savingStatus || managerStatus === contest.status}
                  onClick={() => void handleStatusSave()}
                >
                  {savingStatus ? translate("detail.labels.saving") : translate("detail.labels.saveStatus")}
                </Button>

                <div className="mt-6 border-t border-border-subtle pt-6">
                  <h3 className="text-base font-medium text-foreground">Judge rubric</h3>
                  <p className="mt-1.5 text-[14px] text-muted-foreground">
                    Điều chỉnh trọng số cho 4 tiêu chí. Tổng nên bằng 100 để điểm tổng rõ ràng hơn.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["product", "Product"],
                      ["technical", "Technical"],
                      ["presentation", "Presentation"],
                      ["impact", "Impact"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-sm font-medium text-foreground">{label}</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rubricWeights[key as keyof typeof rubricWeights]}
                          onChange={(e) =>
                            setRubricWeights((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-border-subtle bg-background px-3 py-2 text-[13px] text-muted-foreground">
                    Tổng hiện tại:{" "}
                    <span className="font-medium text-foreground">
                      {[
                        Number(rubricWeights.product) || 0,
                        Number(rubricWeights.technical) || 0,
                        Number(rubricWeights.presentation) || 0,
                        Number(rubricWeights.impact) || 0,
                      ].reduce((sum, value) => sum + value, 0)}
                    </span>
                    /100
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="outline"
                    disabled={savingRubric}
                    onClick={() => void handleRubricSave()}
                  >
                    {savingRubric ? translate("detail.labels.saving") : translate("detail.labels.saveRubric")}
                  </Button>
                </div>

                <div className="mt-6 border-t border-border-subtle pt-6">
                  <h3 className="text-base font-medium text-foreground">
                    Access & invites
                  </h3>
                  <div className="mt-4 space-y-3">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.invite.emailPlaceholder")}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as ContestScopedViewerRole)}
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="judge">Judge</option>
                        <option value="co_host_viewer">Đồng tổ chức</option>
                      </select>
                      <input
                        value={inviteDisplayName}
                        onChange={(e) => setInviteDisplayName(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={translate("detail.forms.invite.displayNamePlaceholder")}
                      />
                    </div>
                    <input
                      value={inviteOrganization}
                      onChange={(e) => setInviteOrganization(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.invite.organizationPlaceholder")}
                    />
                    <textarea
                      rows={3}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.invite.notePlaceholder")}
                    />
                    <Button type="button" className="w-full" disabled={savingInvite || !inviteEmail.trim()} onClick={() => void handleInviteCreate()}>
                      {savingInvite
                        ? translate("detail.labels.creating")
                        : translate("detail.labels.sendInvite")}
                    </Button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {invites.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                        Chưa có lời mời nào.
                      </div>
                    ) : (
                      invites.map((invite) => (
                        <div key={invite.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                          <div className="text-sm font-medium text-foreground">
                            {invite.display_name || invite.email}
                          </div>
                          <div className="mt-1 text-[13px] text-muted-foreground">
                            {invite.email} · {invite.roles.join(", ")} · {invite.status}
                          </div>
                          {invite.organization_name && (
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              {invite.organization_name}
                            </div>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            disabled={inviteActionId === invite.email}
                            onClick={() => void handleInviteRevoke(invite.email)}
                          >
                            Thu hồi
                          </Button>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={inviteActionId === invite.email}
                              onClick={() => void handleCopyInviteLink(invite.email)}
                            >
                              Copy link
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={inviteActionId === invite.email}
                              onClick={() => handleInviteMailTo(invite)}
                            >
                              Mở email
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6 border-t border-destructive/20 pt-6">
                  <h3 className="text-base font-medium text-foreground">Vùng nguy hiểm</h3>
                  <p className="mt-1.5 text-[14px] text-muted-foreground">
                    Xoá contest sẽ xoá toàn bộ hồ sơ đăng ký, lời mời cộng tác, bài nộp
                    và điểm chấm liên quan. Hành động này không thể hoàn tác.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash className="size-4" weight="duotone" />
                    Xoá contest
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isManageView && myInvite ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  {myInvite.roles.includes("judge") ? (
                    <Gavel className="size-5 text-primary" weight="duotone" />
                  ) : (
                    <Buildings className="size-5 text-primary" weight="duotone" />
                  )}
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Lời mời cộng tác
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Vai trò: {myInvite.roles.join(", ")} · trạng thái: {myInvite.status}
                    </p>
                  </div>
                </div>
                {myInvite.note && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {myInvite.note}
                  </p>
                )}
                {myInvite.status === "pending" && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      disabled={inviteActionId === myInvite.id}
                      onClick={() => void handleInviteResponse("accepted")}
                    >
                      Nhận lời mời
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={inviteActionId === myInvite.id}
                      onClick={() => void handleInviteResponse("declined")}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : !isManageView && registration?.status === "approved" ? (
            <Card id="participant-workspace" className="xl:sticky xl:top-24">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <Checks className="size-5 text-primary" weight="duotone" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Submission workspace
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Hồ sơ của bạn đã được duyệt. Bạn có thể nộp và cập nhật submission tại đây.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <input
                    value={submissionTitle}
                    onChange={(e) => setSubmissionTitle(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate("detail.forms.submission.titlePlaceholder")}
                  />
                  <textarea
                    rows={5}
                    value={submissionSummary}
                    onChange={(e) => setSubmissionSummary(e.target.value)}
                    className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate("detail.forms.submission.summaryPlaceholder")}
                  />
                  <input
                    value={submissionDemoUrl}
                    onChange={(e) => setSubmissionDemoUrl(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate("detail.forms.submission.demoUrlPlaceholder")}
                  />
                  <input
                    value={submissionRepoUrl}
                    onChange={(e) => setSubmissionRepoUrl(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate("detail.forms.submission.repoUrlPlaceholder")}
                  />
                  <input
                    value={submissionSlideUrl}
                    onChange={(e) => setSubmissionSlideUrl(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate("detail.forms.submission.slideUrlPlaceholder")}
                  />
                  {submissionDraftDirty && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-300">
                      Bạn có thay đổi chưa lưu. Nếu rời trang lúc này, nội dung mới có thể bị mất.
                    </div>
                  )}
                  <Button type="button" className="w-full" disabled={savingSubmission || !submissionTitle.trim()} onClick={() => void handleSubmissionSave()}>
                    {savingSubmission
                      ? translate("common:status.loading")
                      : mySubmission
                        ? translate("detail.forms.submission.updateLabel")
                        : translate("detail.forms.submission.submitLabel")}
                  </Button>
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    Submission nên có tiêu đề rõ ràng, phần tóm tắt đủ chi tiết và ít nhất một đường dẫn demo hoặc repo nếu đã sẵn sàng.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : !isManageView ? (
            <Card id="participant-workspace" className="xl:sticky xl:top-24">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <Checks className="size-5 text-primary" weight="duotone" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Hồ sơ tham gia
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Bạn chỉ chính thức được tham gia contest sau khi đội ngũ Corelia duyệt.
                    </p>
                  </div>
                </div>

                {registration ? (
                  <div className="mt-4 rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {registrationStatusLabel(registration.status)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Gửi lúc {new Date(registration.applied_at).toLocaleString(intlLocale())}
                    </div>
                    {registration.review_note && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {registration.review_note}
                      </p>
                    )}
                  </div>
                ) : contest.status !== "published" ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                    {translate("detail.forms.application.closedHint")}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.application.teamNamePlaceholder")}
                    />
                    <textarea
                      rows={4}
                      value={teamMembers}
                      onChange={(e) => setTeamMembers(e.target.value)}
                      className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.application.teamMembersPlaceholder")}
                    />
                    <div className="rounded-2xl border border-border-subtle bg-background p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            Team preview
                          </div>
                          <div className="mt-1 text-sm text-foreground">
                            {teamName.trim() || translate("detail.labels.soloOrUnnamedTeam")}
                          </div>
                        </div>
                        <div className="rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-[12px] text-muted-foreground">
                          {parsedTeamMembers.length} thành viên bổ sung
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {parsedTeamMembers.length === 0 ? (
                          <span className="text-[13px] text-muted-foreground">
                            Bạn có thể để trống nếu đăng ký cá nhân.
                          </span>
                        ) : (
                          parsedTeamMembers.map((member) => (
                            <span
                              key={member}
                              className="inline-flex items-center rounded-full border border-border-subtle bg-card px-3 py-1.5 text-[12px] text-foreground"
                            >
                              {member}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.application.contactEmailPlaceholder")}
                    />
                    <input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.application.contactPhonePlaceholder")}
                    />
                    <input
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.application.portfolioPlaceholder")}
                    />
                    <textarea
                      rows={6}
                      value={motivation}
                      onChange={(e) => setMotivation(e.target.value)}
                      className="min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={translate("detail.forms.application.motivationPlaceholder")}
                    />
                    <Button className="w-full" disabled={applying || !registrationDraftReady} onClick={() => void handleApply()}>
                      {applying
                        ? translate("common:status.loading")
                        : translate("detail.forms.application.submitLabel")}
                    </Button>
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      Sau khi gửi, hồ sơ sẽ chuyển sang trạng thái chờ duyệt. Bạn chỉ có thể nộp submission khi được Corelia phê duyệt.
                    </p>
                    {!registrationDraftReady && (
                      <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3 text-[13px] text-muted-foreground">
                        Hãy điền email liên hệ và phần động lực đủ rõ trước khi gửi hồ sơ.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isManageView && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      Quay lại bề mặt public
                    </h2>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Trang public chỉ dành cho học viên/người tham gia xem contest và kết quả đã công bố.
                    </p>
                  </div>
                  <Button
                    render={<NavLink to={`/contests/${contest.id}`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    Xem trang public
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <EnvelopeSimple className="size-5 text-primary" weight="duotone" />
                <div>
                  <h2 className="text-lg font-medium tracking-tight text-foreground">
                    Mốc quan trọng
                  </h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    Dùng các mốc này để truyền thông và nhắc mọi bên chuẩn bị đúng tiến độ.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                  Hạn đăng ký: <span className="text-foreground">{formatDateTime(contest.registration_deadline)}</span>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                  Bắt đầu contest: <span className="text-foreground">{formatDateTime(contest.starts_at)}</span>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                  Kết thúc contest: <span className="text-foreground">{formatDateTime(contest.ends_at)}</span>
                </div>
                {viewerRoles.length > 0 && (
                  <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                    Vai trò được cấp: <span className="text-foreground">{viewerRoles.join(", ")}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deletingContest) setDeleteDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate("detail.dialogs.delete.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {contest?.title
              ? `Contest "${contest.title}" cùng toàn bộ hồ sơ đăng ký, lời mời, bài nộp và điểm chấm sẽ bị xoá. Hành động này không thể hoàn tác.`
              : translate("detail.dialogs.delete.descriptionManager")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingContest}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteContest()}
              disabled={!contest || deletingContest}
            >
              {deletingContest ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Đang xoá
                </>
              ) : (
                <>
                  <Trash className="size-4" weight="duotone" />
                  Xoá contest
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCheck,
  Download,
  Gavel,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
  Timer,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layouts/PagePrimitives";
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
  buildContestLeaderboard,
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
import { uploadContestBanner, uploadContestThumbnail } from "@/lib/storage";
import { useAuth } from "@/stores/authStore";
import type {
  Contest,
  ContestAccessInvite,
  ContestFaqEntry,
  ContestPrizeEntry,
  ContestRegistration,
  ContestRegistrationStatus,
  ContestScore,
  ContestScopedViewerRole,
  ContestStatus,
  ContestSubmission,
  ContestTimelineMilestone,
  ContestWinnerInput,
} from "@/types/contests";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { AdminPreviewBar } from "@/components/contests/AdminPreviewBar";
import {
  buildContestTimelineRows,
  buildDefaultContestTimelineItems,
  ContestTimeline,
  ContestTimelineVertical,
} from "@/components/contests/ContestTimeline";
import { downloadContestCalendarIcs } from "@/lib/contestCalendar";
import type { ContestPublicSection } from "@/pages/contest-detail/types";
import { parseLineList } from "@/pages/contest-detail/utils/parse";
import { renderTextAsList } from "@/pages/contest-detail/utils/text";
import { ContestPublicTimelineSection } from "@/pages/contest-detail/components/ContestPublicTimelineSection";
import { ContestPublicPrizesSection } from "@/pages/contest-detail/components/ContestPublicPrizesSection";
import { ContestPublicRulesSection } from "@/pages/contest-detail/components/ContestPublicRulesSection";
import { ContestPublicFaqsSection } from "@/pages/contest-detail/components/ContestPublicFaqsSection";
import { ContestPublicProjectsSection } from "@/pages/contest-detail/components/ContestPublicProjectsSection";

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

function formatContestCountdown(
  ms: number,
  translate: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (ms <= 0) return "";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  if (days >= 1) return translate("detail.hero.countdownDays", { count: days });
  const hours = Math.floor(sec / 3600);
  if (hours >= 1) return translate("detail.hero.countdownHours", { count: hours });
  const mins = Math.max(1, Math.floor(sec / 60));
  return translate("detail.hero.countdownMinutes", { count: mins });
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string | null {
  if (!local.trim()) return null;
  const t = new Date(local).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export default function ContestDetail({
  forceManageView,
  prefetchedContest,
  publicSection,
  onContestSynced,
}: {
  forceManageView?: boolean;
  prefetchedContest?: Contest | null;
  publicSection?: ContestPublicSection;
  /** Keeps parent layouts (e.g. public sticky header) in sync after image uploads. */
  onContestSynced?: (next: Contest) => void;
} = {}) {
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

  const [contest, setContest] = useState<Contest | null>(
    prefetchedContest && prefetchedContest.id === id ? prefetchedContest : null,
  );
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [winnerAwards, setWinnerAwards] = useState<Record<string, string>>({});
  const [winnerNotes, setWinnerNotes] = useState<Record<string, string>>({});
  const [publishingResults, setPublishingResults] = useState(false);
  const [countdownTick, setCountdownTick] = useState(0);
  const [savingPublicContent, setSavingPublicContent] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [publicDraft, setPublicDraft] = useState<{
    prize_pool_summary: string;
    prizes: ContestPrizeEntry[];
    faqs: ContestFaqEntry[];
    milestones: { title: string; atLocal: string }[];
  }>({ prize_pool_summary: "", prizes: [], faqs: [], milestones: [] });

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
  const isManageView = forceManageView ?? location.pathname.endsWith("/manage");
  const canAccessWorkspace = isManager || canJudge || canViewAggregate;
  const manageSections = useMemo(
    () =>
      [
        canReview
          ? {
              id: "applications",
              label: translate("workspace.manage.sections.applications.label"),
              description: translate("workspace.manage.sections.applications.description"),
            }
          : null,
        canJudge
          ? {
              id: "judging",
              label: translate("workspace.manage.sections.judging.label"),
              description: translate("workspace.manage.sections.judging.description"),
            }
          : null,
        canViewAggregate
          ? {
              id: "results",
              label: translate("workspace.manage.sections.results.label"),
              description: translate("workspace.manage.sections.results.description"),
            }
          : null,
      ].filter((item): item is { id: string; label: string; description: string } => item != null),
    [canJudge, canReview, canViewAggregate, translate],
  );
  const [activeManageSection, setActiveManageSection] = useState<string>("overview");

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
        .filter((score) => score.judge_uid === user.uid)
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

  const registrationCountdownLabel = useMemo(() => {
    if (!contest?.registration_deadline) return null;
    const end = new Date(contest.registration_deadline).getTime();
    const now = Date.now();
    if (now >= end) return translate("detail.hero.registrationClosed");
    return translate("detail.hero.registrationCountdown", {
      time: formatContestCountdown(end - now, translate),
    });
  }, [contest?.registration_deadline, countdownTick, translate]);

  const contestEndsLabel = useMemo(() => {
    if (!contest?.ends_at) return null;
    const end = new Date(contest.ends_at).getTime();
    const now = Date.now();
    if (now >= end) return translate("detail.hero.contestEnded");
    return translate("detail.hero.contestEndsCountdown", {
      time: formatContestCountdown(end - now, translate),
    });
  }, [contest?.ends_at, countdownTick, translate]);

  async function handleDeleteContest() {
    if (!contest) return;

    setDeletingContest(true);
    try {
      await deleteContest(contest.id);
      toast.success(translate("detail.actions.deleteSuccess"));
      navigate("/admin/contests", { replace: true });
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
              defaultAwards[entry.id] =
                index === 0
                  ? translate("workspace.manage.defaultAwardChampion")
                  : index === 1
                    ? translate("workspace.manage.defaultAwardRunnerUp")
                    : translate("workspace.manage.defaultAwardBestDemo");
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
    const idInterval = window.setInterval(() => setCountdownTick((x) => x + 1), 30000);
    return () => window.clearInterval(idInterval);
  }, []);

  useEffect(() => {
    if (!window.location.hash || window.location.hash !== "#participant-workspace") return;
    const timer = window.setTimeout(() => scrollToElementById("participant-workspace"), 400);
    return () => window.clearTimeout(timer);
  }, [loading, contest?.id]);

  useEffect(() => {
    if (!contest || activeManageSection !== "settings" || !isManager || !isManageView) return;
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
  }, [contest, activeManageSection, isManager, isManageView]);

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
  }, [profile?.email, profile?.phone]);

  useEffect(() => {
    if (!isManageView) return;
    const valid = [
      "overview",
      ...(canReview ? ["applications"] : []),
      ...(canJudge ? ["judging"] : []),
      ...(isManager ? ["settings"] : []),
    ];
    setActiveManageSection((prev) => (valid.includes(prev) ? prev : valid[0] ?? "overview"));
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

  async function handleContestBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !id || !contest || !isManager) return;
    setBannerUploading(true);
    try {
      const { url, path } = await uploadContestBanner(id, file, contest.cover_image_path ?? null);
      await updateContest(id, { cover_image_url: url, cover_image_path: path });
      const next: Contest = { ...contest, cover_image_url: url, cover_image_path: path };
      setContest(next);
      onContestSynced?.(next);
      toast.success(translate("detail.toasts.contestBannerUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : translate("detail.toasts.contestBannerUploadFailed"),
      );
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleContestThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !id || !contest || !isManager) return;
    setThumbnailUploading(true);
    try {
      const { url, path } = await uploadContestThumbnail(id, file, contest.thumbnail_path ?? null);
      await updateContest(id, { thumbnail_url: url, thumbnail_path: path });
      const next: Contest = { ...contest, thumbnail_url: url, thumbnail_path: path };
      setContest(next);
      onContestSynced?.(next);
      toast.success(translate("detail.toasts.contestThumbnailUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : translate("detail.toasts.contestThumbnailUploadFailed"),
      );
    } finally {
      setThumbnailUploading(false);
    }
  }

  async function handleSavePublicContent() {
    if (!id || !isManager || savingPublicContent || !contest || !isManageView) return;
    setSavingPublicContent(true);
    try {
      const milestones: ContestTimelineMilestone[] = publicDraft.milestones
        .map((m) => {
          const at = datetimeLocalToIso(m.atLocal);
          if (!m.title.trim() || !at) return null;
          return { title: m.title.trim(), at };
        })
        .filter((m): m is ContestTimelineMilestone => m != null);
      const prizes: ContestPrizeEntry[] = publicDraft.prizes
        .map((p) => ({
          rank_label: p.rank_label.trim(),
          title: p.title.trim(),
          value_display: p.value_display?.trim() || null,
          description: p.description?.trim() || null,
        }))
        .filter((p) => p.rank_label.length > 0 && p.title.length > 0);
      const faqs: ContestFaqEntry[] = publicDraft.faqs
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
        err instanceof Error ? err.message : translate("detail.toasts.publicContentSaveFailed"),
      );
    } finally {
      setSavingPublicContent(false);
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
    const link = `${window.location.origin}/admin/contests/${id}/manage?invite=${encodeURIComponent(email)}`;
    await navigator.clipboard.writeText(link);
    toast.success(translate("detail.toasts.inviteLinkCopied"));
  }

  function handleInviteMailTo(invite: ContestAccessInvite) {
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
      <PageContainer>
        <Card>
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full border border-border-subtle bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {translate("detail.loading.eyebrow")}
            </div>
            <div className="mt-4 text-sm font-medium text-foreground">
              {translate("detail.loading.title")}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {translate("detail.loading.description")}
            </div>
            <div className="mt-4 grid w-full max-w-3xl gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border-subtle bg-background p-4 text-left">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="mt-3 h-4 w-3/4 rounded-full" />
                <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4 text-left">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="mt-3 h-4 w-4/5 rounded-full" />
                <Skeleton className="mt-2 h-4 w-1/2 rounded-full" />
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4 text-left">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="mt-3 h-4 w-2/3 rounded-full" />
                <Skeleton className="mt-2 h-4 w-3/5 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (error || !contest) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-destructive">
              {translate("detail.errors.deleteAccessDeniedTitle")}
            </div>
            <div className="text-base font-medium text-foreground">
              {error || translate("detail.errors.deleteAccessDeniedFallback")}
            </div>
            <div className="mt-2 max-w-xl text-sm text-muted-foreground">
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
      </PageContainer>
    );
  }

  if (isManageView && !canAccessWorkspace) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
            <div className="text-base font-medium text-foreground">
              {translate("detail.errors.workspaceAccessDenied")}
            </div>
            <Button
              render={<NavLink to={`/contests/${contest.id}/overview`} />}
              nativeButton={false}
              variant="ghost"
              className="mt-4"
            >
              {translate("workspace.manage.backToContestPage")}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!isManageView && publicSection && publicSection !== "overview") {
    const milestonesCustom = (contest.timeline_milestones ?? []).length > 0;
    return (
      <PageContainer>
        <div className="mb-4">
          <Button
            render={<NavLink to={`/contests/${contest.id}/overview`} />}
            nativeButton={false}
            variant="ghost"
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {translate("detail.hero.backToOverview")}
          </Button>
        </div>
        {!isManageView && canAccessWorkspace ? (
          <AdminPreviewBar
            statusLabel={statusLabel(contest.status)}
            primaryAction={{
              label: translate("previewBar.openWorkspace"),
              to: `/admin/contests/${contest.id}/manage`,
            }}
          />
        ) : null}

        {publicSection === "timeline" ? (
          <ContestPublicTimelineSection
            contest={contest}
            t={translate}
            milestonesCustom={milestonesCustom}
            timelineRows={timelineRows}
            formatDateTime={formatDateTime}
          />
        ) : null}

        {publicSection === "prizes" ? (
          <ContestPublicPrizesSection contest={contest} t={translate} />
        ) : null}

        {publicSection === "rules" ? (
          <ContestPublicRulesSection contest={contest} t={translate} />
        ) : null}

        {publicSection === "faqs" ? (
          <ContestPublicFaqsSection contest={contest} t={translate} />
        ) : null}

        {publicSection === "projects" ? (
          <ContestPublicProjectsSection contest={contest} t={translate} />
        ) : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {!(publicSection === "overview" && !isManageView) ? (
        <div className="mb-4">
          <Button
            render={<NavLink to={isManageView ? "/admin/contests" : "/contests"} />}
            nativeButton={false}
            variant="ghost"
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {isManageView
              ? translate("workspace.manage.backToContests")
              : translate("detail.hero.backToContests")}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            {contest.cover_image_url?.trim() ? (
              <div className="relative aspect-[21/9] max-h-[min(360px,40vh)] w-full bg-muted">
                <img
                  src={contest.cover_image_url.trim()}
                  alt={translate("detail.visual.bannerAlt", { title: contest.title })}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {isManageView ? translate("detail.labels.manageArea") : translate("detail.labels.publicType")}
                  </div>
                  <h1 className="mt-2 text-3xl font-normal tracking-tight text-foreground">
                    {contest.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {isManageView
                      ? activeManageSectionMeta.description
                      : contest.tagline}
                  </p>
                  {!isManageView && contest.prize_pool_summary?.trim() ? (
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {contest.prize_pool_summary}
                    </p>
                  ) : null}
                  {!isManageView ? (
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4 shrink-0 text-primary" aria-hidden />
                        {translate("detail.hero.applicationsLine", {
                          total: contest.metrics_snapshot.registrations_total,
                        })}
                      </span>
                      {contest.metrics_snapshot.pending_registrations > 0 ? (
                        <span>
                          {translate("detail.hero.pendingLine", {
                            count: contest.metrics_snapshot.pending_registrations,
                          })}
                        </span>
                      ) : null}
                      {contest.metrics_snapshot.approved_registrations > 0 ? (
                        <span>
                          {translate("detail.hero.approvedLine", {
                            count: contest.metrics_snapshot.approved_registrations,
                          })}
                        </span>
                      ) : null}
                      {registrationCountdownLabel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="size-4 shrink-0 text-primary" aria-hidden />
                          {registrationCountdownLabel}
                        </span>
                      ) : null}
                      {contestEndsLabel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Timer className="size-4 shrink-0 text-primary" aria-hidden />
                          {contestEndsLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {statusLabel(contest.status)}
                </span>
              </div>

              {isManageView && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {isManager && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                      {translate("workspace.manage.roleCoreliaOps")}
                    </span>
                  )}
                  {canJudge && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                      {translate("workspace.manage.roleJudgePanel")}
                    </span>
                  )}
                  {viewerRoles.includes("co_host_viewer") && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                      {translate("workspace.manage.roleCoHostObserver")}
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
                    {translate("workspace.tabs.overview")}
                  </Button>
                  {canReview ? (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      variant={activeManageSection === "applications" ? "default" : "outline"}
                      onClick={() => setActiveManageSection("applications")}
                    >
                      {translate("workspace.tabs.applications")}
                    </Button>
                  ) : null}
                  {canJudge ? (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      variant={activeManageSection === "judging" ? "default" : "outline"}
                      onClick={() => setActiveManageSection("judging")}
                    >
                      {translate("workspace.tabs.judging")}
                    </Button>
                  ) : null}
                  {isManager ? (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      variant={activeManageSection === "settings" ? "default" : "outline"}
                      onClick={() => setActiveManageSection("settings")}
                    >
                      {translate("workspace.tabs.settings")}
                    </Button>
                  ) : null}
                </div>
              )}

              {!isManageView && canAccessWorkspace ? (
                <AdminPreviewBar
                  statusLabel={statusLabel(contest.status)}
                  primaryAction={{
                    label: translate("previewBar.openWorkspace"),
                    to: `/admin/contests/${contest.id}/manage`,
                  }}
                />
              ) : null}

              {!isManageView && publicCta && (
                <div className="mt-5 rounded-2xl border border-border-subtle bg-muted/25 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {translate("detail.cta.nextStepEyebrow")}
                      </div>
                      <div className="mt-1 text-sm text-foreground">{publicCta.helper}</div>
                    </div>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant={contest.status === "published" && !registration ? "default" : "outline"}
                      onClick={() =>
                        navigate(
                          contest.status === "published"
                            ? `/contests/${contest.id}/apply#participant-workspace`
                            : `/contests/${contest.id}/timeline`,
                        )
                      }
                    >
                      {publicCta.label}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="size-5 text-primary" aria-hidden />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {isManageView
                          ? translate("workspace.manage.heroStart")
                          : translate("detail.hero.start")}
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {formatDateTime(contest.starts_at)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Timer className="size-5 text-primary" aria-hidden />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {isManageView
                          ? translate("workspace.manage.heroEnd")
                          : translate("detail.hero.end")}
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {formatDateTime(contest.ends_at)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="size-5 text-primary" aria-hidden />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {isManageView
                          ? translate("workspace.manage.heroFormat")
                          : translate("detail.hero.format")}
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        {locationLabel(contest.location)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Users className="size-5 text-primary" aria-hidden />
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {isManageView
                          ? translate("workspace.manage.heroApprovalLimit")
                          : translate("detail.hero.participantLimit")}
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
                      {translate("workspace.manage.overviewApplications")}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.registrations_total ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.overviewApproved")}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.approved_registrations ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.overviewSubmissions")}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.submissions_total ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.overviewScored")}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.scored_submissions ?? 0)}
                    </div>
                  </div>
                </div>
              )}

              {!isManageView && (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("detail.public.infoCards.reviewTitle")}
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {translate("detail.public.infoCards.reviewBody")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("detail.public.infoCards.teamSubmitTitle")}
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {translate("detail.public.infoCards.teamSubmitBody")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("detail.public.infoCards.resultsTitle")}
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {translate("detail.public.infoCards.resultsBody")}
                    </div>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {(!isManageView || activeManageSection === "overview") &&
            contest.description &&
            (!publicSection || publicSection === "overview") && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-medium tracking-tight text-foreground">
                  {isManageView
                    ? translate("detail.labels.contextManage")
                    : translate("detail.labels.contextPublic")}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {contest.description}
                </p>
              </CardContent>
            </Card>
          )}

          {(!isManageView || activeManageSection === "overview") &&
            (!publicSection || publicSection === "overview") && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-medium tracking-tight text-foreground">
                {isManageView
                  ? translate("detail.labels.rulesManage")
                  : translate("detail.labels.rulesPublic")}
              </h2>
              {contest.rules?.trim()
                ? renderTextAsList(contest.rules)
                : renderTextAsList(translate("detail.labels.rulesEmpty"))}
            </CardContent>
          </Card>
          )}

          {!isManageView && (!publicSection || publicSection === "overview") ? (
            <>
              {(contest.prizes ?? []).length > 0 ? (
                <Card id="prizes">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("detail.prizes.sectionTitle")}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {translate("detail.prizes.sectionDescription")}
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(contest.prizes ?? []).map((prize, index) => (
                        <div
                          key={`${prize.rank_label}-${prize.title}-${index}`}
                          className="rounded-2xl border border-border-subtle bg-muted/15 p-5"
                        >
                          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {prize.rank_label}
                          </div>
                          <div className="mt-2 text-base font-semibold text-foreground">{prize.title}</div>
                          {prize.value_display ? (
                            <div className="mt-2 text-sm font-medium text-primary">
                              {prize.value_display}
                            </div>
                          ) : null}
                          {prize.description ? (
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                              {prize.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {(contest.faqs ?? []).length > 0 ? (
                <Card id="faqs">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("detail.faqs.sectionTitle")}
                    </h2>
                    <div className="mt-6 space-y-3">
                      {(contest.faqs ?? []).map((faq, index) => (
                        <details
                          key={`${faq.question}-${index}`}
                          className="group rounded-2xl border border-border-subtle bg-background px-4 py-3"
                        >
                          <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center justify-between gap-2">
                              {faq.question}
                              <span className="text-xs text-muted-foreground group-open:rotate-180">
                                ▼
                              </span>
                            </span>
                          </summary>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {faq.answer}
                          </p>
                        </details>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card id="timeline">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-medium tracking-tight text-foreground">
                        {translate("detail.sections.timeline")}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {translate("detail.sections.timelineDescription")}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {translate("detail.sections.timelineUtcNote")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-2"
                      onClick={() => downloadContestCalendarIcs(contest)}
                    >
                      <Download className="size-4" aria-hidden />
                      {translate("detail.sections.addToCalendar")}
                    </Button>
                  </div>
                  <div className="mt-6">
                    {(contest.timeline_milestones ?? []).length > 0 ? (
                      <ContestTimelineVertical rows={timelineRows} />
                    ) : (
                      <ContestTimeline
                        items={buildDefaultContestTimelineItems({
                          registrationDeadline: contest.registration_deadline,
                          startsAt: contest.starts_at,
                          endsAt: contest.ends_at,
                          formatDate,
                          labels: {
                            registrationDeadline: translate("detail.timeline.registrationDeadline"),
                            kickoff: translate("detail.timeline.kickoff"),
                            end: translate("detail.timeline.end"),
                          },
                        })}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-medium tracking-tight text-foreground">
                    {translate("detail.sections.howToParticipate")}
                  </h2>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {publicJourney.map((step) => (
                      <div
                        key={step.title}
                        className="rounded-2xl border border-border-subtle bg-background p-4"
                      >
                        <div className="text-sm font-medium text-foreground">{step.title}</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">
                          {step.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {isManageView && activeManageSection === "overview" && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.operatingModelTitle")}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {translate("workspace.manage.operatingModelDescription")}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {manageCollaborationLanes.map((lane) => (
                    <div
                      key={lane.title}
                      className="rounded-2xl border border-border-subtle bg-background p-4"
                    >
                      <div className="text-sm font-medium text-foreground">{lane.title}</div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        {lane.description}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.phase1Header")}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {translate("workspace.manage.phase1Title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.phase1Body")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.phase2Header")}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {translate("workspace.manage.phase2Title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.phase2Body")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.phase3Header")}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {translate("workspace.manage.phase3Title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.phase3Body")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.phase4Header")}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {translate("workspace.manage.phase4Title")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.phase4Body")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isManageView && canReview && activeManageSection === "applications" && (
            <Card id="applications">
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.applicationsReviewTitle")}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {translate("workspace.manage.applicationsReviewDescription")}
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
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <Users className="size-6 text-muted-foreground" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {translate("workspace.manage.applicationsEmptyTitle")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {translate("workspace.manage.applicationsEmptyHint")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    registrations.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {registrationStatusLabel(item.status)}
                            </div>
                            <div className="mt-1 text-lg font-medium text-foreground">
                              {item.user_full_name || item.user_id}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {item.team_name || translate("detail.labels.defaultSoloRegistration")}
                            </div>
                            {item.team_members.length > 0 && (
                              <div className="mt-1 text-sm text-muted-foreground">
                                {translate("workspace.manage.teamMembersPrefix")}{" "}
                                {item.team_members.join(", ")}
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
                              {translate("workspace.manage.approve")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={item.status === "rejected" ? "destructive" : "outline"}
                              disabled={savingReviewId === item.user_id}
                              onClick={() => void handleReview(item.user_id, "rejected")}
                            >
                              {translate("workspace.manage.reject")}
                            </Button>
                          </div>
                        </div>

                        {item.motivation && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {item.motivation}
                          </p>
                        )}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {translate("detail.labels.contact")}
                            </span>{" "}
                            {item.contact_email || translate("detail.labels.notProvided")} ·{" "}
                            {item.contact_phone || translate("detail.labels.noDataDash")}
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {translate("workspace.manage.portfolioLabel")}
                            </span>{" "}
                            {item.portfolio_url || translate("detail.labels.notProvided")}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label
                            htmlFor={`review-note-${item.user_id}`}
                            className="text-sm font-medium text-foreground"
                          >
                            {translate("workspace.manage.reviewNoteLabel")}
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
                            className="mt-2 min-h-24 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Gavel className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.judgingTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.judgingDescription")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.judgingWeightsLine", {
                        product: contest.rubric_weights.product,
                        technical: contest.rubric_weights.technical,
                        presentation: contest.rubric_weights.presentation,
                        impact: contest.rubric_weights.impact,
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {submissions.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <Trophy className="size-6 text-muted-foreground" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {translate("workspace.manage.judgingEmptyTitle")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {translate("workspace.manage.judgingEmptyHint")}
                        </p>
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
                              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                {translate("workspace.manage.rankCurrent", {
                                  rank: boardEntry?.rank ?? "—",
                                })}
                              </div>
                              <div className="mt-1 text-lg font-medium text-foreground">
                                {submission.title}
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {submission.contestant_name || submission.user_id}
                                {submission.team_name ? ` · ${submission.team_name}` : ""}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                              {translate("workspace.manage.averageScores")}{" "}
                              <span className="font-medium text-foreground">
                                {boardEntry?.average_score ?? 0}
                              </span>{" "}
                              ·{" "}
                              {translate("workspace.manage.scoreAttempts", {
                                count: boardEntry?.score_count ?? 0,
                              })}
                            </div>
                          </div>

                          {submission.summary && (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                              {submission.summary}
                            </p>
                          )}

                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                              {translate("workspace.manage.demoPrefix")}{" "}
                              {submission.demo_url || translate("detail.labels.noDemo")}
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                              {translate("workspace.manage.repoPrefix")}{" "}
                              {submission.repo_url || translate("detail.labels.noDemo")}
                            </div>
                            <div className="rounded-xl border border-border-subtle bg-card px-3 py-2 text-sm text-muted-foreground">
                              {translate("workspace.manage.slidePrefix")}{" "}
                              {submission.slide_url || translate("detail.labels.noDemo")}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {(
                              [
                                ["product", "workspace.manage.criterionProduct"],
                                ["technical", "workspace.manage.criterionTechnical"],
                                ["presentation", "workspace.manage.criterionPresentation"],
                                ["impact", "workspace.manage.criterionImpact"],
                              ] as const
                            ).map(([key, labelKey]) => (
                              <div key={key}>
                                <label className="text-sm font-medium text-foreground">
                                  {translate(labelKey)}
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
                              {translate("workspace.manage.scoreNoteLabel")}
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

                          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border-subtle bg-card px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <span>
                              {translate("workspace.manage.rawTotal")}{" "}
                              <span className="font-medium text-foreground">
                                {scoreDraftTotal(submission.id)}
                              </span>
                              /100
                            </span>
                            <span>{translate("workspace.manage.criteriaHint")}</span>
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
            canViewAggregate && activeManageSection === "overview" && (
            <Card id="results">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Trophy className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.outcomesTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.outcomesDescription")}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.metricApplications")}
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.registrations_total ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.metricApproved")}
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.approved_registrations ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.metricSubmissions")}
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.submissions_total ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {translate("workspace.manage.metricScored")}
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {Number(contest.metrics_snapshot.scored_submissions ?? 0)}
                    </div>
                  </div>
                </div>

                {isManager && leaderboard.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-border-subtle bg-background p-4">
                    <h3 className="text-base font-medium text-foreground">
                      {translate("workspace.manage.publishResultsHeading")}
                    </h3>
                    <div className="mt-4 space-y-4">
                      {leaderboard.slice(0, 5).map((entry) => (
                        <div key={entry.submission_id} className="rounded-xl border border-border-subtle bg-card p-3">
                          <div className="text-sm font-medium text-foreground">
                            #{entry.rank} · {entry.submission_title}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.contestant_name || entry.contestant_user_id} ·{" "}
                            {translate("workspace.manage.entryAverageScore", {
                              score: entry.average_score,
                            })}
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

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-medium text-foreground">
                      {translate("workspace.manage.publishedLeaderboard")}
                    </h3>
                    {contest.published_leaderboard.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleExportLeaderboardCsv}
                      >
                        {translate("workspace.manage.exportCsv")}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 space-y-3">
                    {contest.published_leaderboard.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          {translate("workspace.manage.leaderboardNotPublishedTitle")}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {translate("workspace.manage.leaderboardNotPublishedHint")}
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
                              <div className="mt-1 text-sm text-muted-foreground">
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

                <div className="mt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.winnersHeading")}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {contest.winner_announcements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          {translate("workspace.manage.winnersEmptyTitle")}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {translate("workspace.manage.winnersEmptyHint")}
                        </div>
                      </div>
                    ) : (
                      contest.winner_announcements.map((winner) => (
                        <div key={winner.submission_id} className="rounded-2xl border border-border-subtle bg-background px-4 py-3">
                          <div className="text-sm font-medium text-foreground">
                            {winner.award_title}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {winner.contestant_name || winner.contestant_user_id} · {winner.submission_title}
                          </div>
                          {winner.note && (
                            <div className="mt-1 text-sm text-muted-foreground">
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
          ) : contest.status === "ended" &&
            (contest.published_leaderboard.length > 0 || contest.winner_announcements.length > 0) ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Trophy className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("detail.public.results.cardTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("detail.public.results.cardDescription")}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("detail.public.results.leaderboardHeading")}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {contest.published_leaderboard.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          {translate("detail.public.results.leaderboardEmptyTitle")}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {translate("detail.public.results.leaderboardEmptyHint")}
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
                              <div className="mt-1 text-sm text-muted-foreground">
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

                <div className="mt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("detail.public.results.winnersHeading")}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {contest.winner_announcements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5">
                        <div className="text-sm font-medium text-foreground">
                          {translate("detail.public.results.winnersEmptyTitle")}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {translate("detail.public.results.winnersEmptyHint")}
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
                          <div className="mt-1 text-sm text-muted-foreground">
                            {winner.contestant_name || winner.contestant_user_id} ·{" "}
                            {winner.submission_title}
                          </div>
                          {winner.note && (
                            <div className="mt-1 text-sm text-muted-foreground">
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
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {isManageView && isManager && activeManageSection === "settings" ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.operationsControlsTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.operationsControlsDescription")}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-foreground">
                    {translate("workspace.manage.contestStatusLabel")}
                  </label>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    value={managerStatus}
                    onChange={(e) => setManagerStatus(e.target.value as ContestStatus)}
                  >
                    <option value="draft">{translate("workspace.manage.statusDraft")}</option>
                    <option value="published">{translate("workspace.manage.statusPublished")}</option>
                    <option value="running">{translate("workspace.manage.statusRunning")}</option>
                    <option value="ended">{translate("workspace.manage.statusEnded")}</option>
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

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.rubricTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.rubricDescription")}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["product", "workspace.manage.criterionProduct"],
                        ["technical", "workspace.manage.criterionTechnical"],
                        ["presentation", "workspace.manage.criterionPresentation"],
                        ["impact", "workspace.manage.criterionImpact"],
                      ] as const
                    ).map(([key, labelKey]) => (
                      <div key={key}>
                        <label className="text-sm font-medium text-foreground">
                          {translate(labelKey)}
                        </label>
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
                  <div className="mt-3 rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.rubricTotalPrefix")}{" "}
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

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.accessInvitesTitle")}
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
                        <option value="judge">{translate("workspace.manage.inviteRoleJudge")}</option>
                        <option value="co_host_viewer">
                          {translate("workspace.manage.inviteRoleCoHost")}
                        </option>
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
                        {translate("workspace.manage.invitesEmpty")}
                      </div>
                    ) : (
                      invites.map((invite) => (
                        <div key={invite.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                          <div className="text-sm font-medium text-foreground">
                            {invite.display_name || invite.email}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {invite.email} · {invite.roles.join(", ")} · {invite.status}
                          </div>
                          {invite.organization_name && (
                            <div className="mt-1 text-sm text-muted-foreground">
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
                            {translate("workspace.manage.revoke")}
                          </Button>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={inviteActionId === invite.email}
                              onClick={() => void handleCopyInviteLink(invite.email)}
                            >
                              {translate("workspace.manage.copyLink")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={inviteActionId === invite.email}
                              onClick={() => handleInviteMailTo(invite)}
                            >
                              {translate("workspace.manage.openEmail")}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.publicPageContentTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.publicPageContentDescription")}
                  </p>

                  <div className="mt-6 rounded-xl border border-border-subtle bg-muted/30 p-4">
                    <div className="text-sm font-medium text-foreground">
                      {translate("workspace.manage.mediaTitle")}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {translate("workspace.manage.mediaDescription")}
                    </p>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor="contest-settings-banner"
                        >
                          {translate("workspace.manage.bannerUploadLabel")}
                        </label>
                        <input
                          id="contest-settings-banner"
                          type="file"
                          accept="image/*"
                          disabled={bannerUploading}
                          onChange={(e) => void handleContestBannerChange(e)}
                          className="mt-2 block w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border-subtle file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          {bannerUploading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              {translate("workspace.manage.uploadingBanner")}
                            </>
                          ) : null}
                        </div>
                        {contest.cover_image_url?.trim() ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background">
                            <img
                              src={contest.cover_image_url.trim()}
                              alt={translate("detail.visual.bannerAlt", { title: contest.title })}
                              className="aspect-[21/9] w-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium text-foreground"
                          htmlFor="contest-settings-thumbnail"
                        >
                          {translate("workspace.manage.thumbnailUploadLabel")}
                        </label>
                        <input
                          id="contest-settings-thumbnail"
                          type="file"
                          accept="image/*"
                          disabled={thumbnailUploading}
                          onChange={(e) => void handleContestThumbnailChange(e)}
                          className="mt-2 block w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border-subtle file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          {thumbnailUploading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              {translate("workspace.manage.uploadingThumbnail")}
                            </>
                          ) : null}
                        </div>
                        {contest.thumbnail_url?.trim() ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background">
                            <img
                              src={contest.thumbnail_url.trim()}
                              alt={translate("detail.visual.thumbnailAlt", { title: contest.title })}
                              className="aspect-square max-h-36 w-full max-w-36 object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-foreground">
                    {translate("workspace.manage.prizePoolSummaryLabel")}
                  </label>
                  <input
                    value={publicDraft.prize_pool_summary}
                    onChange={(e) =>
                      setPublicDraft((prev) => ({ ...prev, prize_pool_summary: e.target.value }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={translate("workspace.manage.prizePoolSummaryPlaceholder")}
                  />

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("detail.prizes.sectionTitle")}
                    </div>
                    <div className="mt-3 space-y-4">
                      {publicDraft.prizes.map((prize, index) => (
                        <div
                          key={`prize-${index}`}
                          className="grid gap-3 rounded-xl border border-border-subtle bg-background p-4 sm:grid-cols-2"
                        >
                          <input
                            value={prize.rank_label}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index ? { ...p, rank_label: e.target.value } : p,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate("workspace.manage.prizeRankPlaceholder")}
                          />
                          <input
                            value={prize.title}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index ? { ...p, title: e.target.value } : p,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate("workspace.manage.prizeTitlePlaceholder")}
                          />
                          <input
                            value={prize.value_display ?? ""}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index ? { ...p, value_display: e.target.value } : p,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.prizeValuePlaceholder")}
                          />
                          <textarea
                            rows={2}
                            value={prize.description ?? ""}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                prizes: prev.prizes.map((p, i) =>
                                  i === index ? { ...p, description: e.target.value } : p,
                                ),
                              }))
                            }
                            className="min-h-16 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate("workspace.manage.prizeDescriptionPlaceholder")}
                          />
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPublicDraft((prev) => ({
                                  ...prev,
                                  prizes: prev.prizes.filter((_, i) => i !== index),
                                }))
                              }
                            >
                              {translate("workspace.manage.removeRow")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPublicDraft((prev) => ({
                          ...prev,
                          prizes: [
                            ...prev.prizes,
                            { rank_label: "", title: "", value_display: "", description: "" },
                          ],
                        }))
                      }
                    >
                      {translate("workspace.manage.addPrizeRow")}
                    </Button>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("detail.faqs.sectionTitle")}
                    </div>
                    <div className="mt-3 space-y-4">
                      {publicDraft.faqs.map((faq, index) => (
                        <div
                          key={`faq-${index}`}
                          className="space-y-3 rounded-xl border border-border-subtle bg-background p-4"
                        >
                          <input
                            value={faq.question}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                faqs: prev.faqs.map((f, i) =>
                                  i === index ? { ...f, question: e.target.value } : f,
                                ),
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.faqQuestionPlaceholder")}
                          />
                          <textarea
                            rows={3}
                            value={faq.answer}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                faqs: prev.faqs.map((f, i) =>
                                  i === index ? { ...f, answer: e.target.value } : f,
                                ),
                              }))
                            }
                            className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={translate("workspace.manage.faqAnswerPlaceholder")}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                faqs: prev.faqs.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            {translate("workspace.manage.removeRow")}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPublicDraft((prev) => ({
                          ...prev,
                          faqs: [...prev.faqs, { question: "", answer: "" }],
                        }))
                      }
                    >
                      {translate("workspace.manage.addFaqRow")}
                    </Button>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">
                      {translate("detail.sections.timeline")}
                    </div>
                    <div className="mt-3 space-y-4">
                      {publicDraft.milestones.map((milestone, index) => (
                        <div
                          key={`ms-${index}`}
                          className="grid gap-3 rounded-xl border border-border-subtle bg-background p-4 sm:grid-cols-2"
                        >
                          <input
                            value={milestone.title}
                            onChange={(e) =>
                              setPublicDraft((prev) => ({
                                ...prev,
                                milestones: prev.milestones.map((m, i) =>
                                  i === index ? { ...m, title: e.target.value } : m,
                                ),
                              }))
                            }
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
                            placeholder={translate("workspace.manage.milestoneTitlePlaceholder")}
                          />
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              {translate("workspace.manage.milestoneAtLabel")}
                            </label>
                            <input
                              type="datetime-local"
                              value={milestone.atLocal}
                              onChange={(e) =>
                                setPublicDraft((prev) => ({
                                  ...prev,
                                  milestones: prev.milestones.map((m, i) =>
                                    i === index ? { ...m, atLocal: e.target.value } : m,
                                  ),
                                }))
                              }
                              className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPublicDraft((prev) => ({
                                  ...prev,
                                  milestones: prev.milestones.filter((_, i) => i !== index),
                                }))
                              }
                            >
                              {translate("workspace.manage.removeRow")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setPublicDraft((prev) => ({
                          ...prev,
                          milestones: [...prev.milestones, { title: "", atLocal: "" }],
                        }))
                      }
                    >
                      {translate("workspace.manage.addMilestoneRow")}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    className="mt-6 w-full"
                    disabled={savingPublicContent}
                    onClick={() => void handleSavePublicContent()}
                  >
                    {savingPublicContent
                      ? translate("detail.labels.saving")
                      : translate("workspace.manage.savePublicPageContent")}
                  </Button>
                </div>

                <div className="mt-4 border-t border-destructive/20 pt-4">
                  <h3 className="text-base font-medium text-foreground">
                    {translate("workspace.manage.dangerZoneTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {translate("workspace.manage.dangerZoneDescription")}
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {translate("workspace.manage.deleteContest")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isManageView && activeManageSection === "settings" && myInvite ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  {myInvite.roles.includes("judge") ? (
                    <Gavel className="size-5 text-primary" aria-hidden />
                  ) : (
                    <Building2 className="size-5 text-primary" aria-hidden />
                  )}
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.inviteCollaborationTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.inviteMetaLine", {
                        roles: myInvite.roles.join(", "),
                        status: myInvite.status,
                      })}
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
                      {translate("workspace.manage.inviteAccept")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={inviteActionId === myInvite.id}
                      onClick={() => void handleInviteResponse("declined")}
                    >
                      {translate("workspace.manage.inviteDecline")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : !isManageView && registration?.status === "approved" ? (
            <Card id="participant-workspace">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCheck className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("detail.participant.submissionWorkspaceTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("detail.participant.submissionWorkspaceApprovedBody")}
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
                    <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                      {translate("detail.participant.submissionDirtyWarning")}
                    </div>
                  )}
                  <Button type="button" className="w-full" disabled={savingSubmission || !submissionTitle.trim()} onClick={() => void handleSubmissionSave()}>
                    {savingSubmission
                      ? translate("common:status.loading")
                      : mySubmission
                        ? translate("detail.forms.submission.updateLabel")
                        : translate("detail.forms.submission.submitLabel")}
                  </Button>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {translate("detail.participant.submissionFooterHint")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : !isManageView ? (
            <Card id="participant-workspace">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCheck className="size-5 text-primary" aria-hidden />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("detail.participant.applicationCardTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("detail.participant.applicationCardPendingBody")}
                    </p>
                  </div>
                </div>

                {registration ? (
                  <div className="mt-4 rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {registrationStatusLabel(registration.status)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {translate("detail.participant.sentAt", {
                        datetime: new Date(registration.applied_at).toLocaleString(intlLocale()),
                      })}
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
                            {translate("detail.participant.teamPreviewLabel")}
                          </div>
                          <div className="mt-1 text-sm text-foreground">
                            {teamName.trim() || translate("detail.labels.soloOrUnnamedTeam")}
                          </div>
                        </div>
                    <div className="rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                          {translate("detail.participant.extraMembersCount", {
                            count: parsedTeamMembers.length,
                          })}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {parsedTeamMembers.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                            {translate("detail.participant.soloMembersHint")}
                          </span>
                        ) : (
                          parsedTeamMembers.map((member) => (
                            <span
                              key={member}
                          className="inline-flex items-center rounded-full border border-border-subtle bg-card px-3 py-2 text-xs text-foreground"
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
                  <p className="text-xs leading-5 text-muted-foreground">
                      {translate("detail.participant.postSubmitHint")}
                    </p>
                    {!registrationDraftReady && (
                      <div className="rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm text-muted-foreground">
                        {translate("detail.participant.draftNotReadyHint")}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isManageView && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                      {translate("workspace.manage.backToPublicSurfaceTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("workspace.manage.backToPublicSurfaceDescription")}
                    </p>
                  </div>
                  <Button
                    render={<NavLink to={`/contests/${contest.id}/overview`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    {translate("workspace.manage.viewPublicPage")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deletingContest) {
            setDeleteDialogOpen(open);
            if (open) setDeleteConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate("workspace.manage.deleteDialogTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {contest?.title
              ? translate("workspace.manage.deleteDialogBodyWithTitle", { title: contest.title })
              : translate("detail.dialogs.delete.descriptionManager")}
          </p>
          {contest?.title ? (
            <div className="mt-3 space-y-2">
              <div className="text-sm font-medium text-foreground">
                {translate("workspace.manage.deleteTypeToConfirm", { title: contest.title })}
              </div>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={contest.title}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingContest}
            >
              {translate("workspace.manage.deleteDialogCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteContest()}
              disabled={!contest || deletingContest || deleteConfirmText.trim() !== (contest?.title ?? "")}
            >
              {deletingContest ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {translate("workspace.manage.deleteDialogDeleting")}
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden />
                  {translate("workspace.manage.deleteContestConfirm")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

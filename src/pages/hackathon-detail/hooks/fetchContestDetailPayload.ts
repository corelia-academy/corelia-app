import {
  canReviewContestApplications,
  canScoreContest,
  canViewContestAggregateMetrics,
} from "@/lib/permissions";
import {
  getContestBySlug,
  getContestRegistrations,
  getMyContestAccessInvite,
  getMyContestRegistration,
  getMyContestSubmission,
  listContestAccessInvites,
  listContestScores,
  listContestSubmissions,
  type PrefetchedContestActorContext,
} from "@/lib/hackathons";
import type {
  Contest,
  ContestAccessInvite,
  ContestRegistration,
  ContestScore,
  ContestSubmission,
  ContestStatus,
} from "@/types/hackathons";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export type RubricWeightsForm = {
  product: string;
  technical: string;
  presentation: string;
  impact: string;
};

export type ContestDetailFetchedPayload = {
  contest: Contest;
  managerStatus: ContestStatus;
  rubricWeights: RubricWeightsForm;
  registrations: ContestRegistration[];
  reviewNotes: Record<string, string>;
  registrationSelf: ContestRegistration | null;
  submissions: ContestSubmission[];
  scores: ContestScore[];
  mySubmission: ContestSubmission | null;
  submissionTitle: string;
  submissionSummary: string;
  submissionDemoUrl: string;
  submissionRepoUrl: string;
  submissionSlideUrl: string;
  submissionScreenshotUrl: string;
  submissionCoverImageUrl: string;
  submissionVideoUrl: string;
  winnerAwards: Record<string, string>;
  invites: ContestAccessInvite[];
  myInvite: ContestAccessInvite | null;
  clearRegistrationsForAggregateViewer: boolean;
};

export type FetchContestDetailPayloadInput = {
  slug: string;
  profile: Profile | null;
  userEmail: string | undefined;
  uiLocale?: string | null;
  /** Resolved viewer after auth init; avoids redundant `getUser` in parallel contest fetches. */
  viewer?: User | null;
  isManager: boolean;
  translate: (key: string, options?: Record<string, unknown>) => string;
  signal: AbortSignal;
  /** When `ContestPublicLayout` already loaded the contest row, skip duplicate `getContest`. */
  prefetchedContest?: Contest | null;
};

export type FetchContestDetailPayloadResult =
  | { status: "aborted" }
  | { status: "error"; errorMessage: string }
  | { status: "ok"; payload: ContestDetailFetchedPayload };

export async function fetchContestDetailPayload({
  slug,
  profile,
  userEmail,
  uiLocale,
  viewer,
  isManager,
  translate,
  signal,
  prefetchedContest,
}: FetchContestDetailPayloadInput): Promise<FetchContestDetailPayloadResult> {
  const contestData =
    prefetchedContest && prefetchedContest.slug === slug
      ? prefetchedContest
      : await getContestBySlug(slug, uiLocale ?? null);
  if (signal.aborted) return { status: "aborted" };

  if (!contestData) {
    return { status: "error", errorMessage: translate("detail.errors.notFound") };
  }

  const contestId = contestData.id;

  const aggregateViewer = canViewContestAggregateMetrics(
    contestData,
    profile,
    userEmail,
  );
  const reviewer = canReviewContestApplications(contestData, profile);
  const judge = canScoreContest(contestData, profile, userEmail);

  const actorPrefetch: PrefetchedContestActorContext | undefined =
    viewer ? { contest: contestData, viewer, profile } : undefined;

  let registrations: ContestRegistration[] = [];
  let reviewNotes: Record<string, string> = {};
  let registrationSelf: ContestRegistration | null = null;
  let submissions: ContestSubmission[] = [];
  let scores: ContestScore[] = [];
  let mySubmission: ContestSubmission | null = null;
  let submissionTitle = "";
  let submissionSummary = "";
  let submissionDemoUrl = "";
  let submissionRepoUrl = "";
  let submissionSlideUrl = "";
  let submissionScreenshotUrl = "";
  let submissionCoverImageUrl = "";
  let submissionVideoUrl = "";
  const winnerAwards: Record<string, string> = {};

  let invites: ContestAccessInvite[] = [];
  let myInvite: ContestAccessInvite | null = null;

  const tasks: Promise<void>[] = [];

  if (reviewer) {
    tasks.push(
      getContestRegistrations(contestId, {
        status: "all",
        prefetch: actorPrefetch,
      }).then((items) => {
        registrations = items;
        reviewNotes = Object.fromEntries(
          items.map((item) => [item.user_id, item.review_note ?? ""]),
        );
      }),
    );
  } else {
    tasks.push(
      getMyContestRegistration(contestId, viewer).then((item) => {
        registrationSelf = item;
      }),
    );
  }

  if (judge || isManager) {
    tasks.push(
      listContestSubmissions(contestId, actorPrefetch).then((items) => {
        submissions = items;
        for (const [index, entry] of items.slice(0, 3).entries()) {
          winnerAwards[entry.id] =
            index === 0
              ? translate("workspace.manage.defaultAwardChampion")
              : index === 1
                ? translate("workspace.manage.defaultAwardRunnerUp")
                : translate("workspace.manage.defaultAwardBestDemo");
        }
      }),
    );
    tasks.push(
      listContestScores(contestId, actorPrefetch).then((items) => {
        scores = items;
      }),
    );
  } else {
    tasks.push(
      getMyContestSubmission(contestId, viewer).then((item) => {
        mySubmission = item;
        submissionTitle = item?.title ?? "";
        submissionSummary = item?.summary ?? "";
        submissionDemoUrl = item?.demo_url ?? "";
        submissionRepoUrl = item?.repo_url ?? "";
        submissionSlideUrl = item?.slide_url ?? "";
        submissionScreenshotUrl = item?.screenshot_url ?? "";
        submissionCoverImageUrl = item?.cover_image_url ?? "";
        submissionVideoUrl = item?.video_url ?? "";
      }),
    );
  }

  if (isManager) {
    tasks.push(
      listContestAccessInvites(contestId).then((items) => {
        invites = items;
      }),
    );
  } else {
    tasks.push(
      getMyContestAccessInvite(contestId, viewer).then((item) => {
        myInvite = item;
      }),
    );
  }

  await Promise.all(tasks);
  if (signal.aborted) return { status: "aborted" };

  const clearRegistrationsForAggregateViewer =
    aggregateViewer && !reviewer;

  const payload: ContestDetailFetchedPayload = {
    contest: contestData,
    managerStatus: contestData.status,
    rubricWeights: {
      product: String(contestData.rubric_weights.product),
      technical: String(contestData.rubric_weights.technical),
      presentation: String(contestData.rubric_weights.presentation),
      impact: String(contestData.rubric_weights.impact),
    },
    registrations,
    reviewNotes,
    registrationSelf,
    submissions,
    scores,
    mySubmission,
    submissionTitle,
    submissionSummary,
    submissionDemoUrl,
    submissionRepoUrl,
    submissionSlideUrl,
    submissionScreenshotUrl,
    submissionCoverImageUrl,
    submissionVideoUrl,
    winnerAwards,
    invites,
    myInvite,
    clearRegistrationsForAggregateViewer,
  };

  return { status: "ok", payload };
}

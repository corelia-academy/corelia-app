import {
  canReviewContestApplications,
  canScoreContest,
  canViewContestAggregateMetrics,
} from "@/lib/permissions";
import {
  getContest,
  getContestRegistrations,
  getMyContestAccessInvite,
  getMyContestRegistration,
  getMyContestSubmission,
  listContestAccessInvites,
  listContestScores,
  listContestSubmissions,
} from "@/lib/contests";
import type {
  Contest,
  ContestAccessInvite,
  ContestRegistration,
  ContestScore,
  ContestSubmission,
  ContestStatus,
} from "@/types/contests";
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
  teamName: string;
  teamMembersText: string;
  submissions: ContestSubmission[];
  scores: ContestScore[];
  mySubmission: ContestSubmission | null;
  submissionTitle: string;
  submissionSummary: string;
  submissionDemoUrl: string;
  submissionRepoUrl: string;
  submissionSlideUrl: string;
  winnerAwards: Record<string, string>;
  invites: ContestAccessInvite[];
  myInvite: ContestAccessInvite | null;
  clearRegistrationsForAggregateViewer: boolean;
};

export type FetchContestDetailPayloadInput = {
  id: string;
  profile: Profile | null;
  userEmail: string | undefined;
  /** Resolved viewer after auth init; avoids redundant `getUser` in parallel contest fetches. */
  viewer?: User | null;
  isManager: boolean;
  translate: (key: string, options?: Record<string, unknown>) => string;
  signal: AbortSignal;
};

export type FetchContestDetailPayloadResult =
  | { status: "aborted" }
  | { status: "error"; errorMessage: string }
  | { status: "ok"; payload: ContestDetailFetchedPayload };

export async function fetchContestDetailPayload({
  id,
  profile,
  userEmail,
  viewer,
  isManager,
  translate,
  signal,
}: FetchContestDetailPayloadInput): Promise<FetchContestDetailPayloadResult> {
  const contestData = await getContest(id);
  if (signal.aborted) return { status: "aborted" };

  if (!contestData) {
    return { status: "error", errorMessage: translate("detail.errors.notFound") };
  }

  const aggregateViewer = canViewContestAggregateMetrics(
    contestData,
    profile,
    userEmail,
  );
  const reviewer = canReviewContestApplications(contestData, profile);
  const judge = canScoreContest(contestData, profile, userEmail);

  let registrations: ContestRegistration[] = [];
  let reviewNotes: Record<string, string> = {};
  let registrationSelf: ContestRegistration | null = null;
  let teamName = "";
  let teamMembersText = "";

  let submissions: ContestSubmission[] = [];
  let scores: ContestScore[] = [];
  let mySubmission: ContestSubmission | null = null;
  let submissionTitle = "";
  let submissionSummary = "";
  let submissionDemoUrl = "";
  let submissionRepoUrl = "";
  let submissionSlideUrl = "";
  const winnerAwards: Record<string, string> = {};

  let invites: ContestAccessInvite[] = [];
  let myInvite: ContestAccessInvite | null = null;

  const tasks: Promise<void>[] = [];

  if (reviewer) {
    tasks.push(
      getContestRegistrations(id, { status: "all" }).then((items) => {
        registrations = items;
        reviewNotes = Object.fromEntries(
          items.map((item) => [item.user_id, item.review_note ?? ""]),
        );
      }),
    );
  } else {
    tasks.push(
      getMyContestRegistration(id, viewer).then((item) => {
        registrationSelf = item;
        teamName = item?.team_name ?? "";
        teamMembersText = (item?.team_members ?? []).join("\n");
      }),
    );
  }

  if (judge || isManager) {
    tasks.push(
      listContestSubmissions(id).then((items) => {
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
      listContestScores(id).then((items) => {
        scores = items;
      }),
    );
  } else {
    tasks.push(
      getMyContestSubmission(id, viewer).then((item) => {
        mySubmission = item;
        submissionTitle = item?.title ?? "";
        submissionSummary = item?.summary ?? "";
        submissionDemoUrl = item?.demo_url ?? "";
        submissionRepoUrl = item?.repo_url ?? "";
        submissionSlideUrl = item?.slide_url ?? "";
      }),
    );
  }

  if (isManager) {
    tasks.push(
      listContestAccessInvites(id).then((items) => {
        invites = items;
      }),
    );
  } else {
    tasks.push(
      getMyContestAccessInvite(id, viewer).then((item) => {
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
    teamName,
    teamMembersText,
    submissions,
    scores,
    mySubmission,
    submissionTitle,
    submissionSummary,
    submissionDemoUrl,
    submissionRepoUrl,
    submissionSlideUrl,
    winnerAwards,
    invites,
    myInvite,
    clearRegistrationsForAggregateViewer,
  };

  return { status: "ok", payload };
}

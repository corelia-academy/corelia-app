import { useCallback, useState } from "react";
import type {
  ContestScore,
  ContestSubmission,
} from "@/types/hackathons";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";

export function useContestJudgingWorkspace() {
  const [submissions, setSubmissions] = useState<ContestSubmission[]>([]);
  const [scores, setScores] = useState<ContestScore[]>([]);
  const [mySubmission, setMySubmission] = useState<ContestSubmission | null>(
    null,
  );
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const [submissionTitle, setSubmissionTitle] = useState("");
  const [submissionSummary, setSubmissionSummary] = useState("");
  const [submissionDemoUrl, setSubmissionDemoUrl] = useState("");
  const [submissionRepoUrl, setSubmissionRepoUrl] = useState("");
  const [submissionSlideUrl, setSubmissionSlideUrl] = useState("");
  const [submissionVideoUrl, setSubmissionVideoUrl] = useState("");
  const [savingSubmission, setSavingSubmission] = useState(false);

  const [winnerAwards, setWinnerAwards] = useState<Record<string, string>>({});
  const [winnerNotes, setWinnerNotes] = useState<Record<string, string>>({});

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

  const hydrateFromPayload = useCallback((payload: ContestDetailFetchedPayload) => {
    setSubmissions(payload.submissions);
    setScores(payload.scores);
    setMySubmission(payload.mySubmission);
    setSubmissionTitle(payload.submissionTitle);
    setSubmissionSummary(payload.submissionSummary);
    setSubmissionDemoUrl(payload.submissionDemoUrl);
    setSubmissionRepoUrl(payload.submissionRepoUrl);
    setSubmissionSlideUrl(payload.submissionSlideUrl);
    setSubmissionVideoUrl(payload.submissionVideoUrl);
    setWinnerAwards(payload.winnerAwards);
  }, []);

  return {
    submissions,
    setSubmissions,
    scores,
    setScores,
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
    hydrateFromPayload,
  };
}

export type ContestJudgingWorkspaceApi = ReturnType<
  typeof useContestJudgingWorkspace
>;

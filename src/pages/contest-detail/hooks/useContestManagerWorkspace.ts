import { useCallback, useState } from "react";
import type {
  ContestFaqEntry,
  ContestPrizeEntry,
  ContestRound,
  ContestStatus,
  ContestTrack,
} from "@/types/contests";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";

export function useContestManagerWorkspace() {
  const [managerStatus, setManagerStatus] = useState<ContestStatus>("draft");
  const [savingStatus, setSavingStatus] = useState(false);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [savingRubric, setSavingRubric] = useState(false);
  const [savingTracksRounds, setSavingTracksRounds] = useState(false);
  const [deletingContest, setDeletingContest] = useState(false);
  const [rubricWeights, setRubricWeights] = useState({
    product: "25",
    technical: "25",
    presentation: "25",
    impact: "25",
  });
  const [tracksDraft, setTracksDraft] = useState<ContestTrack[]>([]);
  const [roundsDraft, setRoundsDraft] = useState<ContestRound[]>([]);
  const [activeRoundIdDraft, setActiveRoundIdDraft] = useState<string>("");
  const [anonymousJudgingDraft, setAnonymousJudgingDraft] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [publishingResults, setPublishingResults] = useState(false);
  const [savingPublicContent, setSavingPublicContent] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [publicDraft, setPublicDraft] = useState<{
    prize_pool_summary: string;
    prizes: ContestPrizeEntry[];
    faqs: ContestFaqEntry[];
    registration_deadline_local: string;
    starts_at_local: string;
    ends_at_local: string;
    milestones: { title: string; atLocal: string }[];
  }>({
    prize_pool_summary: "",
    prizes: [],
    faqs: [],
    registration_deadline_local: "",
    starts_at_local: "",
    ends_at_local: "",
    milestones: [],
  });

  const hydrateContestMetaFromPayload = useCallback(
    (payload: ContestDetailFetchedPayload) => {
      setManagerStatus(payload.managerStatus);
      setRubricWeights(payload.rubricWeights);
      setTracksDraft(payload.contest.tracks ?? []);
      setRoundsDraft(payload.contest.rounds ?? []);
      setActiveRoundIdDraft(payload.contest.judging?.active_round_id ?? "");
      setAnonymousJudgingDraft(
        Boolean(payload.contest.config?.anonymous_judging),
      );
    },
    [],
  );

  return {
    managerStatus,
    setManagerStatus,
    savingStatus,
    setSavingStatus,
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
    publicDraft,
    setPublicDraft,
    hydrateContestMetaFromPayload,
  };
}

export type ContestManagerWorkspaceApi = ReturnType<
  typeof useContestManagerWorkspace
>;

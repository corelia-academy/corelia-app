import { useCallback, useState } from "react";
import type {
  ContestFaqEntry,
  ContestPrizeEntry,
  ContestStatus,
} from "@/types/contests";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";

export function useContestManagerWorkspace() {
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

  const [publishingResults, setPublishingResults] = useState(false);
  const [savingPublicContent, setSavingPublicContent] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [publicDraft, setPublicDraft] = useState<{
    prize_pool_summary: string;
    prizes: ContestPrizeEntry[];
    faqs: ContestFaqEntry[];
    milestones: { title: string; atLocal: string }[];
  }>({ prize_pool_summary: "", prizes: [], faqs: [], milestones: [] });

  const hydrateContestMetaFromPayload = useCallback(
    (payload: ContestDetailFetchedPayload) => {
      setManagerStatus(payload.managerStatus);
      setRubricWeights(payload.rubricWeights);
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
  };
}

export type ContestManagerWorkspaceApi = ReturnType<
  typeof useContestManagerWorkspace
>;

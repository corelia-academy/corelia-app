import { ContestDetailAnalyticsPanel } from "@/pages/hackathon-detail/components/ContestDetailAnalyticsPanel";
import { ContestDetailApplicationsPanel } from "@/pages/hackathon-detail/components/ContestDetailApplicationsPanel";
import { ContestDetailJudgingPanel } from "@/pages/hackathon-detail/components/ContestDetailJudgingPanel";
import { ContestDetailResultsBlocks } from "@/pages/hackathon-detail/components/ContestDetailResultsBlocks";
import { ContestDetailTranslationsPanel } from "@/pages/hackathon-detail/components/ContestDetailTranslationsPanel";
import { ContestDetailWorkspaceExtrasPlaceholder } from "@/pages/hackathon-detail/components/ContestDetailWorkspaceExtrasPlaceholder";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";

/** Manage workspace-only blocks (each panel returns null when inactive). */
export function ContestDetailManageWorkspacePanels() {
  const vm = useContestDetailVm();
  return (
    <>
      <ContestDetailWorkspaceExtrasPlaceholder />
      <ContestDetailApplicationsPanel vm={vm} />
      <ContestDetailJudgingPanel vm={vm} />
      <ContestDetailAnalyticsPanel vm={vm} />
      <ContestDetailTranslationsPanel vm={vm} />
      <ContestDetailResultsBlocks vm={vm} />
    </>
  );
}

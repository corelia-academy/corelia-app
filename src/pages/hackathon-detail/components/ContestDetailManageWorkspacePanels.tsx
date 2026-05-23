import { ContestDetailAnalyticsPanel } from "@/pages/hackathon-detail/components/ContestDetailAnalyticsPanel";
import { ContestDetailApplicationsPanel } from "@/pages/hackathon-detail/components/ContestDetailApplicationsPanel";
import { ContestDetailBlastEmailPanel } from "@/pages/hackathon-detail/components/ContestDetailBlastEmailPanel";
import { ContestDetailJudgingPanel } from "@/pages/hackathon-detail/components/ContestDetailJudgingPanel";
import { ContestDetailResultsBlocks } from "@/pages/hackathon-detail/components/ContestDetailResultsBlocks";
import { ContestDetailTranslationsPanel } from "@/pages/hackathon-detail/components/ContestDetailTranslationsPanel";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";

/** Manage workspace-only blocks (each panel returns null when inactive). */
export function ContestDetailManageWorkspacePanels() {
  const vm = useContestDetailVm();
  return (
    <>
      <ContestDetailApplicationsPanel vm={vm} />
      <ContestDetailJudgingPanel vm={vm} />
      <ContestDetailAnalyticsPanel vm={vm} />
      <ContestDetailTranslationsPanel vm={vm} />
      <ContestDetailBlastEmailPanel vm={vm} />
      <ContestDetailResultsBlocks vm={vm} />
    </>
  );
}

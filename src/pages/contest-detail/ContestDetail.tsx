import type { ContestPublicSection } from "@/pages/contest-detail/types";
import type { Contest } from "@/types/contests";
import { ContestDetailApplicationsPanel } from "@/pages/contest-detail/components/ContestDetailApplicationsPanel";
import { ContestDetailDeleteContestDialog } from "@/pages/contest-detail/components/ContestDetailDeleteContestDialog";
import {
  ContestDetailErrorCard,
  ContestDetailLoadingCard,
  ContestDetailWorkspaceAccessDenied,
} from "@/pages/contest-detail/components/ContestDetailGateStates";
import { ContestDetailHeroCard } from "@/pages/contest-detail/components/ContestDetailHeroCard";
import { ContestDetailJudgingPanel } from "@/pages/contest-detail/components/ContestDetailJudgingPanel";
import { ContestDetailMainLayout } from "@/pages/contest-detail/components/ContestDetailMainLayout";
import { ContestDetailOverviewBlocks } from "@/pages/contest-detail/components/ContestDetailOverviewBlocks";
import { ContestDetailPublicSectionPage } from "@/pages/contest-detail/components/ContestDetailPublicSectionPage";
import { ContestDetailResultsBlocks } from "@/pages/contest-detail/components/ContestDetailResultsBlocks";
import { ContestDetailRightColumn } from "@/pages/contest-detail/components/ContestDetailRightColumn";
import { useContestDetailOrchestrator } from "@/pages/contest-detail/hooks/useContestDetailOrchestrator";
import { narrowContestDetailView } from "@/pages/contest-detail/viewModel";

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
  const ctx = useContestDetailOrchestrator({
    forceManageView,
    prefetchedContest,
    publicSection,
    onContestSynced,
  });

  if (ctx.loading) {
    return <ContestDetailLoadingCard translate={ctx.translate} />;
  }

  if (ctx.error || !ctx.contest) {
    return (
      <ContestDetailErrorCard translate={ctx.translate} error={ctx.error} />
    );
  }

  const vm = narrowContestDetailView(ctx)!;

  if (vm.isManageView && !vm.canAccessWorkspace) {
    return (
      <ContestDetailWorkspaceAccessDenied
        translate={vm.translate}
        contestId={vm.contest.id}
      />
    );
  }

  if (!vm.isManageView && publicSection && publicSection !== "overview") {
    return (
      <ContestDetailPublicSectionPage
        contest={vm.contest}
        publicSection={publicSection}
        translate={vm.translate}
        formatDateTime={vm.formatDateTime}
        timelineRows={vm.timelineRows}
        canAccessWorkspace={vm.canAccessWorkspace}
        isManageView={vm.isManageView}
        statusLabel={vm.statusLabel}
      />
    );
  }

  return (
    <ContestDetailMainLayout
      showBackLink={!(publicSection === "overview" && !vm.isManageView)}
      isManageView={vm.isManageView}
      translate={vm.translate}
      leftColumn={
        <>
          <ContestDetailHeroCard vm={vm} />
          <ContestDetailOverviewBlocks vm={vm} publicSection={publicSection} />
          <ContestDetailApplicationsPanel vm={vm} />
          <ContestDetailJudgingPanel vm={vm} />
          <ContestDetailResultsBlocks vm={vm} />
        </>
      }
      rightColumn={<ContestDetailRightColumn vm={vm} />}
      afterGrid={
        <ContestDetailDeleteContestDialog
          translate={vm.translate}
          contest={vm.contest}
          deleteDialogOpen={vm.deleteDialogOpen}
          setDeleteDialogOpen={vm.setDeleteDialogOpen}
          deleteConfirmText={vm.deleteConfirmText}
          setDeleteConfirmText={vm.setDeleteConfirmText}
          deletingContest={vm.deletingContest}
          handleDeleteContest={vm.handleDeleteContest}
        />
      }
    />
  );
}

import type { ContestPublicSection } from "@/pages/hackathon-detail/types";
import type { Contest } from "@/types/hackathons";
import { ContestDetailApplicationsPanel } from "@/pages/hackathon-detail/components/ContestDetailApplicationsPanel";
import { ContestDetailDeleteContestDialog } from "@/pages/hackathon-detail/components/ContestDetailDeleteContestDialog";
import {
  ContestDetailErrorCard,
  ContestDetailLoadingCard,
  ContestDetailWorkspaceAccessDenied,
} from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { ContestDetailHeroCard } from "@/pages/hackathon-detail/components/ContestDetailHeroCard";
import { ContestDetailJudgingPanel } from "@/pages/hackathon-detail/components/ContestDetailJudgingPanel";
import { ContestDetailAnalyticsPanel } from "@/pages/hackathon-detail/components/ContestDetailAnalyticsPanel";
import { ContestDetailManageSectionTabs } from "@/pages/hackathon-detail/components/ContestDetailManageSectionTabs";
import { ContestDetailMainLayout } from "@/pages/hackathon-detail/components/ContestDetailMainLayout";
import { ContestDetailOverviewBlocks } from "@/pages/hackathon-detail/components/ContestDetailOverviewBlocks";
import { ContestDetailPublicSectionPage } from "@/pages/hackathon-detail/components/ContestDetailPublicSectionPage";
import { ContestDetailResultsBlocks } from "@/pages/hackathon-detail/components/ContestDetailResultsBlocks";
import { ContestDetailRightColumn } from "@/pages/hackathon-detail/components/ContestDetailRightColumn";
import { ContestPublicNav } from "@/pages/hackathon-detail/ContestPublicNav";
import { ContestDetailProvider } from "@/pages/hackathon-detail/ContestDetailContext";
import { useContestDetail } from "@/pages/hackathon-detail/hooks/useContestDetail";
import { narrowContestDetailView } from "@/pages/hackathon-detail/viewModel";

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
  const ctx = useContestDetail({
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
      <ContestDetailMainLayout
        isManageView={false}
        heroCard={
          <ContestDetailProvider vm={vm}>
            <ContestDetailHeroCard
              vm={vm}
              titleAs="h1"
              publicSection={publicSection}
            />
          </ContestDetailProvider>
        }
        leftColumn={
          <ContestDetailProvider vm={vm}>
            <ContestPublicNav contestId={vm.contest.id} contest={vm.contest} />
            <ContestDetailPublicSectionPage
              embedded
              publicSection={publicSection}
            />
          </ContestDetailProvider>
        }
        rightColumn={<ContestDetailRightColumn vm={vm} />}
      />
    );
  }

  return (
    <ContestDetailMainLayout
      isManageView={vm.isManageView}
      heroCard={
        <ContestDetailProvider vm={vm}>
          <ContestDetailHeroCard
            vm={vm}
            titleAs="h1"
            publicSection={publicSection}
          />
        </ContestDetailProvider>
      }
      leftColumn={
        <ContestDetailProvider vm={vm}>
          {!vm.isManageView ? (
            <ContestPublicNav contestId={vm.contest.id} contest={vm.contest} />
          ) : null}
          {vm.isManageView ? <ContestDetailManageSectionTabs vm={vm} /> : null}
          <ContestDetailOverviewBlocks vm={vm} publicSection={publicSection} />
          <ContestDetailApplicationsPanel vm={vm} />
          <ContestDetailJudgingPanel vm={vm} />
          <ContestDetailAnalyticsPanel vm={vm} />
          <ContestDetailResultsBlocks vm={vm} />
        </ContestDetailProvider>
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

/** Manage route `/hackathons/:id/manage` — avoids a separate wrapper module. */
export function ContestDetailManagePage() {
  return <ContestDetail forceManageView />;
}

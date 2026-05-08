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
import { ContestDetailAnalyticsPanel } from "@/pages/contest-detail/components/ContestDetailAnalyticsPanel";
import { ContestDetailManageSectionTabs } from "@/pages/contest-detail/components/ContestDetailManageSectionTabs";
import { ContestDetailMainLayout } from "@/pages/contest-detail/components/ContestDetailMainLayout";
import { ContestDetailOverviewBlocks } from "@/pages/contest-detail/components/ContestDetailOverviewBlocks";
import { ContestDetailPublicSectionPage } from "@/pages/contest-detail/components/ContestDetailPublicSectionPage";
import { ContestDetailResultsBlocks } from "@/pages/contest-detail/components/ContestDetailResultsBlocks";
import { ContestDetailRightColumn } from "@/pages/contest-detail/components/ContestDetailRightColumn";
import { ContestPublicNav } from "@/pages/contest-detail/ContestPublicNav";
import { ContestDetailProvider } from "@/pages/contest-detail/ContestDetailContext";
import { useContestDetail } from "@/pages/contest-detail/hooks/useContestDetail";
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

/** Manage route `/contests/:id/manage` — avoids a separate wrapper module. */
export function ContestDetailManagePage() {
  return <ContestDetail forceManageView />;
}

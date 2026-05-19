import type { Contest } from "@/types/hackathons";
import { ContestDetailDeleteContestDialog } from "@/pages/hackathon-detail/components/ContestDetailDeleteContestDialog";
import {
  ContestDetailErrorCard,
  ContestDetailLoadingCard,
  ContestDetailWorkspaceAccessDenied,
} from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { ContestDetailHeroCard } from "@/pages/hackathon-detail/components/ContestDetailHeroCard";
import { ContestDetailMobileStickyCta } from "@/pages/hackathon-detail/components/ContestDetailMobileStickyCta";
import { ContestWorkspaceFAB } from "@/pages/hackathon-detail/components/ContestWorkspaceFAB";
import { ContestDetailMainLayout } from "@/pages/hackathon-detail/components/ContestDetailMainLayout";
import { ContestDetailLeftColumn } from "@/pages/hackathon-detail/components/ContestDetailLeftColumn";
import { ContestDetailRightColumn } from "@/pages/hackathon-detail/components/ContestDetailRightColumn";
import { ContestPublicHashScroll } from "@/pages/hackathon-detail/components/ContestPublicHashScroll";
import { ContestDetailProvider } from "@/pages/hackathon-detail/ContestDetailContext";
import { useContestDetail } from "@/pages/hackathon-detail/hooks/useContestDetail";
import { narrowContestDetailView } from "@/pages/hackathon-detail/viewModel";

export default function ContestDetail({
  forceManageView,
  prefetchedContest,
  onContestSynced,
}: {
  forceManageView?: boolean;
  prefetchedContest?: Contest | null;
  /** Keeps parent layouts (e.g. public sticky header) in sync after image uploads. */
  onContestSynced?: (next: Contest) => void;
} = {}) {
  const ctx = useContestDetail({
    forceManageView,
    prefetchedContest,
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

  /** Two-column layout is for public detail only (participant rail). Manage uses full-width main column. */
  const twoColumnGrid = !vm.isManageView;

  return (
    <ContestDetailProvider vm={vm}>
      {!vm.isManageView ? (
        <>
          <ContestPublicHashScroll enabled />
          <ContestDetailMobileStickyCta />
          {vm.canAccessWorkspace ? (
            <ContestWorkspaceFAB vm={vm} mobileStickyReserve />
          ) : null}
        </>
      ) : null}
      <ContestDetailMainLayout
        heroCard={<ContestDetailHeroCard vm={vm} titleAs="h1" />}
        leftColumn={<ContestDetailLeftColumn />}
        rightColumn={<ContestDetailRightColumn />}
        twoColumnGrid={twoColumnGrid}
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
    </ContestDetailProvider>
  );
}

/** Manage route `/hackathons/:slug/manage/:section` — avoids a separate wrapper module. */
export function ContestDetailManagePage() {
  return <ContestDetail forceManageView />;
}

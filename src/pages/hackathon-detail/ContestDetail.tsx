import { ChevronRight, Settings } from "lucide-react";
import { Link } from "react-router";
import type { Contest } from "@/types/hackathons";
import { Button } from "@/components/ui/button";
import { ContestDetailDeleteContestDialog } from "@/pages/hackathon-detail/components/ContestDetailDeleteContestDialog";
import {
  ContestDetailErrorCard,
  ContestDetailLoadingCard,
  ContestDetailWorkspaceAccessDenied,
} from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { ContestDetailHeroCard } from "@/pages/hackathon-detail/components/ContestDetailHeroCard";
import { ContestDetailMobileStickyCta } from "@/pages/hackathon-detail/components/ContestDetailMobileStickyCta";
import { ContestDetailMainLayout } from "@/pages/hackathon-detail/components/ContestDetailMainLayout";
import { ContestDetailLeftColumn } from "@/pages/hackathon-detail/components/ContestDetailLeftColumn";
import { ContestDetailRightColumn } from "@/pages/hackathon-detail/components/ContestDetailRightColumn";
import { ContestPublicHashScroll } from "@/pages/hackathon-detail/components/ContestPublicHashScroll";
import { ContestDetailProvider } from "@/pages/hackathon-detail/ContestDetailContext";
import { useContestDetail } from "@/pages/hackathon-detail/hooks/useContestDetail";
import { narrowContestDetailView } from "@/pages/hackathon-detail/viewModel";
import { shouldShowParticipantRail } from "@/pages/hackathon-detail/utils/contestLifecycle";
import { usePageMeta } from "@/hooks/usePageMeta";

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

  usePageMeta({
    title: ctx.contest?.title ?? undefined,
    description: ctx.contest?.description ?? undefined,
    image: ctx.contest?.cover_image_url ?? ctx.contest?.thumbnail_url ?? undefined,
    url: window.location.href,
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

  /**
   * Two-column layout is for public detail only (participant rail). When the rail has no actionable
   * content (ended contests without a viewer registration, draft, etc.), fall back to single column
   * so the main content can use the full width.
   */
  const showParticipantRail =
    !vm.isManageView &&
    shouldShowParticipantRail({
      lifecycle: vm.hackathonLifecycle,
      hasExistingRegistration: Boolean(vm.registration),
    });
  const twoColumnGrid = showParticipantRail;

  return (
    <ContestDetailProvider vm={vm}>
      {!vm.isManageView ? (
        <>
          <ContestPublicHashScroll enabled />
          <ContestDetailMobileStickyCta />
        </>
      ) : null}
      <ContestDetailMainLayout
        aboveHero={
          !vm.isManageView ? (
            <div className="space-y-3 sm:space-y-4">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1 text-xs text-foreground-muted"
              >
                <Link to="/hackathons" className="hover:text-foreground">
                  {vm.translate("catalog.heroTitle")}
                </Link>
                <ChevronRight className="size-3" aria-hidden />
                <span className="truncate font-medium text-foreground">
                  {vm.contest.title}
                </span>
              </nav>
            </div>
          ) : null
        }
        heroCard={<ContestDetailHeroCard vm={vm} titleAs="h1" />}
        leftColumn={<ContestDetailLeftColumn />}
        rightColumn={showParticipantRail ? <ContestDetailRightColumn /> : null}
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
      {!vm.isManageView && vm.canAccessWorkspace ? (
        <Button
          type="button"
          variant="secondary"
          className="fixed bottom-20 right-4 z-40 min-h-11 gap-2 border border-border-strong md:bottom-6 md:right-6"
          onClick={() =>
            vm.navigate(
              vm.contest.slug?.trim()
                ? `/hackathons/${vm.contest.slug.trim()}/manage/overview`
                : "/hackathons/manage",
            )
          }
        >
          <Settings className="size-4" aria-hidden />
          {vm.translate("detail.workspaceFab.label")}
        </Button>
      ) : null}
    </ContestDetailProvider>
  );
}

/** Manage route `/hackathons/:slug/manage/:section` — avoids a separate wrapper module. */
export function ContestDetailManagePage() {
  return <ContestDetail forceManageView />;
}

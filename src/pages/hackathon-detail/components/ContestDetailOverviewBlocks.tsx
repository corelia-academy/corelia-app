import { Card, CardContent } from "@/components/ui/card";
import { ContestManageOverviewDashboard } from "@/pages/hackathon-detail/components/ContestManageOverviewDashboard";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

/**
 * Public view renders the contest description card (used as the "about" anchor on the public
 * detail page). Inside the manage workspace, Overview is a dashboard (metrics + role-aware
 * quick actions) — read-only description / rules / operating-model content lives on the
 * public page; the workspace is for editing and operating, not viewing.
 */
export function ContestDetailOverviewBlocks({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const { contest, translate, isManageView, activeManageSection } = vm;

  if (isManageView) {
    if (activeManageSection !== "overview") return null;
    return <ContestManageOverviewDashboard vm={vm} />;
  }

  if (!contest.description?.trim()) return null;

  return (
    <Card id="about" className="scroll-mt-36">
      <CardContent className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {translate("detail.labels.contextPublic")}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
          {contest.description}
        </p>
      </CardContent>
    </Card>
  );
}

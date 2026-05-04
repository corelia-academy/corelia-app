import { Card, CardContent } from "@/components/ui/card";
import { ContestDetailPublicOverviewExtras } from "@/pages/contest-detail/components/ContestDetailPublicOverviewExtras";
import type { ContestPublicSection } from "@/pages/contest-detail/types";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";
import { renderTextAsList } from "@/pages/contest-detail/utils/text";

export function ContestDetailOverviewBlocks({
  vm,
  publicSection,
}: {
  vm: ContestDetailViewModel;
  publicSection?: ContestPublicSection;
}) {
  const {
    contest,
    translate,
    isManageView,
    activeManageSection,
    formatDate,
    timelineRows,
    publicJourney,
    manageCollaborationLanes,
  } = vm;

  return (
    <>
      {(!isManageView || activeManageSection === "overview") &&
        contest.description &&
        (!publicSection || publicSection === "overview") && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-medium tracking-tight text-foreground">
                {isManageView
                  ? translate("detail.labels.contextManage")
                  : translate("detail.labels.contextPublic")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {contest.description}
              </p>
            </CardContent>
          </Card>
        )}

      {(!isManageView || activeManageSection === "overview") &&
        (!publicSection || publicSection === "overview") && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-medium tracking-tight text-foreground">
                {isManageView
                  ? translate("detail.labels.rulesManage")
                  : translate("detail.labels.rulesPublic")}
              </h2>
              {contest.rules?.trim()
                ? renderTextAsList(contest.rules)
                : renderTextAsList(translate("detail.labels.rulesEmpty"))}
            </CardContent>
          </Card>
        )}

      {!isManageView && (!publicSection || publicSection === "overview") ? (
        <ContestDetailPublicOverviewExtras
          contest={contest}
          translate={translate}
          formatDate={formatDate}
          timelineRows={timelineRows}
          publicJourney={publicJourney}
        />
      ) : null}

      {vm.isManageView && vm.activeManageSection === "overview" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-medium tracking-tight text-foreground">
                  {translate("workspace.manage.operatingModelTitle")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {translate("workspace.manage.operatingModelDescription")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {manageCollaborationLanes.map((lane) => (
                <div
                  key={lane.title}
                  className="rounded-2xl border border-border-subtle bg-background p-4"
                >
                  <div className="text-sm font-medium text-foreground">
                    {lane.title}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {lane.description}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {translate("workspace.manage.phase1Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase1Title")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {translate("workspace.manage.phase1Body")}
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {translate("workspace.manage.phase2Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase2Title")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {translate("workspace.manage.phase2Body")}
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {translate("workspace.manage.phase3Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase3Title")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {translate("workspace.manage.phase3Body")}
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-background p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {translate("workspace.manage.phase4Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase4Title")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {translate("workspace.manage.phase4Body")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

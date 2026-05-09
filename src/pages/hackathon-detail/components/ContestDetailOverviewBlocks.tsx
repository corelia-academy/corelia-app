import { Card, CardContent } from "@/components/ui/card";
import type { ContestPublicSection } from "@/pages/hackathon-detail/types";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { renderTextAsList } from "@/pages/hackathon-detail/utils/text";

export function ContestDetailOverviewBlocks({
  vm,
  publicSection,
}: {
  vm: ContestDetailViewModel;
  publicSection?: ContestPublicSection;
}) {
  const { contest, translate, isManageView, activeManageSection, manageCollaborationLanes } =
    vm;

  return (
    <>
      {(!isManageView || activeManageSection === "overview") &&
        contest.description?.trim() &&
        (!publicSection || publicSection === "overview") && (
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold text-foreground">
                {isManageView
                  ? translate("detail.labels.contextManage")
                  : translate("detail.labels.contextPublic")}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                {contest.description}
              </p>
            </CardContent>
          </Card>
        )}

      {(!isManageView || activeManageSection === "overview") &&
        (!publicSection || publicSection === "overview") &&
        (isManageView || contest.rules?.trim()) && (
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold text-foreground">
                {isManageView
                  ? translate("detail.labels.rulesManage")
                  : translate("detail.labels.rulesPublic")}
              </h2>
              {isManageView
                ? contest.rules?.trim()
                  ? renderTextAsList(contest.rules)
                  : renderTextAsList(translate("detail.labels.rulesEmpty"))
                : renderTextAsList(contest.rules ?? "")}
            </CardContent>
          </Card>
        )}

      {vm.isManageView && vm.activeManageSection === "overview" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {translate("workspace.manage.operatingModelTitle")}
                </h2>
                <p className="mt-2 text-sm text-foreground-muted">
                  {translate("workspace.manage.operatingModelDescription")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {manageCollaborationLanes.map((lane) => (
                <div
                  key={lane.title}
                  className="rounded-md border border-border-subtle bg-surface-base p-4"
                >
                  <div className="text-sm font-medium text-foreground">
                    {lane.title}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-foreground-muted">
                    {lane.description}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.phase1Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase1Title")}
                </div>
                <div className="mt-1 text-sm text-foreground-muted">
                  {translate("workspace.manage.phase1Body")}
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.phase2Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase2Title")}
                </div>
                <div className="mt-1 text-sm text-foreground-muted">
                  {translate("workspace.manage.phase2Body")}
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.phase3Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase3Title")}
                </div>
                <div className="mt-1 text-sm text-foreground-muted">
                  {translate("workspace.manage.phase3Body")}
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.phase4Header")}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {translate("workspace.manage.phase4Title")}
                </div>
                <div className="mt-1 text-sm text-foreground-muted">
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

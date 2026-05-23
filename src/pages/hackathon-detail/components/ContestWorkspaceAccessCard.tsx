import { Settings, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

/**
 * Manager-context ribbon shown above the public hero when the viewer has any workspace role.
 * Surfaces (a) which roles grant access, and (b) a direct entry point to the manage workspace,
 * so reviewers/judges/co-hosts don't have to hunt for the entrypoint inside the hero actions.
 */
export function ContestWorkspaceAccessCard({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    contest,
    translate,
    navigate,
    isManager,
    canJudge,
    canReview,
    canViewAggregate,
    viewerRoles,
  } = vm;

  const roles: string[] = [];
  if (isManager) roles.push(translate("workspace.manage.roleCoreliaOps"));
  if (canJudge) roles.push(translate("workspace.manage.roleJudgePanel"));
  if (canReview && !isManager) {
    roles.push(translate("workspace.access.roleReviewer"));
  }
  if (canViewAggregate && !isManager) {
    roles.push(translate("workspace.access.roleAnalytics"));
  }
  if (viewerRoles.includes("co_host_viewer")) {
    roles.push(translate("workspace.manage.roleCoHostObserver"));
  }

  const workspaceHref = contest.slug?.trim()
    ? `/hackathons/${contest.slug.trim()}/manage/overview`
    : "/hackathons/manage";

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-muted text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="text-sm font-semibold text-foreground">
              {translate("workspace.access.cardTitle")}
            </div>
            <p className="text-xs leading-relaxed text-foreground-muted">
              {translate("workspace.access.cardDescription")}
            </p>
            {roles.length > 0 ? (
              <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
                {roles.map((role) => (
                  <li
                    key={role}
                    className="inline-flex items-center rounded-full border border-primary/25 bg-surface-base px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {role}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="min-h-11 shrink-0 gap-2"
          onClick={() => navigate(workspaceHref)}
        >
          <Settings className="size-4" aria-hidden />
          {translate("detail.workspaceFab.label")}
        </Button>
      </CardContent>
    </Card>
  );
}

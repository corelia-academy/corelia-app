import { Card, CardContent } from "@/components/ui/card";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";

/** Placeholder roadmap card for extended workspace tooling (resources, badges, mint). */
export function ContestDetailWorkspaceExtrasPlaceholder() {
  const vm = useContestDetailVm();
  const { translate, isManageView, isManager, activeManageSection } = vm;

  if (!isManageView || !isManager || activeManageSection !== "overview") {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {translate("detail.workspaceExtras.title")}
        </h2>
        <p className="text-sm text-foreground-muted">
          {translate("detail.workspaceExtras.body")}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
          <li>{translate("detail.workspaceExtras.bulletResources")}</li>
          <li>{translate("detail.workspaceExtras.bulletBadges")}</li>
          <li>{translate("detail.workspaceExtras.bulletMint")}</li>
        </ul>
      </CardContent>
    </Card>
  );
}

import { Button } from "@/components/ui/button";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailManageSectionTabs({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    activeManageSection,
    setActiveManageSection,
    canReview,
    canJudge,
    isManager,
  } = vm;

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto rounded-lg border border-border-subtle bg-muted/25 px-3 py-3">
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        variant={activeManageSection === "overview" ? "default" : "outline"}
        onClick={() => setActiveManageSection("overview")}
      >
        {translate("workspace.tabs.overview")}
      </Button>
      {canReview ? (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={
            activeManageSection === "applications" ? "default" : "outline"
          }
          onClick={() => setActiveManageSection("applications")}
        >
          {translate("workspace.tabs.applications")}
        </Button>
      ) : null}
      {canJudge ? (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={activeManageSection === "judging" ? "default" : "outline"}
          onClick={() => setActiveManageSection("judging")}
        >
          {translate("workspace.tabs.judging")}
        </Button>
      ) : null}
      {isManager ? (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={activeManageSection === "settings" ? "default" : "outline"}
          onClick={() => setActiveManageSection("settings")}
        >
          {translate("workspace.tabs.settings")}
        </Button>
      ) : null}
    </div>
  );
}

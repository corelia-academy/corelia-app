import { cn } from "@/lib/utils";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

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
    canViewAggregate,
    isManager,
  } = vm;

  const keys = [
    "overview",
    ...(canReview ? (["applications"] as const) : []),
    ...(canJudge ? (["judging"] as const) : []),
    ...(canViewAggregate ? (["analytics"] as const) : []),
    ...(isManager ? (["settings"] as const) : []),
  ] as const;

  return (
    <nav
      className="-mx-1 mb-6 border-b border-border-subtle sm:mb-8"
      aria-label={translate("workspace.manage.tabs.ariaLabel", {
        defaultValue: "Workspace sections",
      })}
    >
      <div className="-mb-px flex gap-0 overflow-x-auto overscroll-x-contain px-1 pb-px sm:gap-1">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveManageSection(key)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              activeManageSection === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {key === "overview"
              ? translate("workspace.tabs.overview")
              : key === "applications"
                ? translate("workspace.tabs.applications")
                : key === "judging"
                  ? translate("workspace.tabs.judging")
                  : key === "analytics"
                    ? translate("workspace.tabs.analytics")
                    : translate("workspace.tabs.settings")}
          </button>
        ))}
      </div>
    </nav>
  );
}

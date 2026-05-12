import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

export function ContestDetailManageSectionTabs({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    contest,
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
    ...(isManager ? (["translations", "awards", "settings"] as const) : []),
  ] as const;

  const base = contest.slug
    ? `/hackathons/${contest.slug}/manage`
    : "/hackathons/manage/overview";

  return (
    <nav
      className={cn(
        "-mx-1 sticky top-14 z-30 mb-6 border-b border-border-subtle bg-background/95 pb-0 backdrop-blur-md sm:mb-8",
        "supports-[backdrop-filter]:bg-background/85",
      )}
      aria-label={translate("workspace.manage.tabs.ariaLabel")}
    >
      <div className="-mb-px flex gap-0 overflow-x-auto overscroll-x-contain px-1 pb-px [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
        {keys.map((key) => (
          <NavLink
            key={key}
            to={contest.slug ? `${base}/${key}` : base}
            end={key === "overview"}
            className={({ isActive }) =>
              cn(
                "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
              )
            }
          >
            {key === "overview"
              ? translate("workspace.tabs.overview")
              : key === "applications"
                ? translate("workspace.tabs.applications")
                : key === "judging"
                  ? translate("workspace.tabs.judging")
                  : key === "analytics"
                    ? translate("workspace.tabs.analytics")
                    : key === "translations"
                      ? translate("workspace.tabs.translations")
                      : key === "awards"
                        ? translate("workspace.tabs.awards")
                        : translate("workspace.tabs.settings")}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

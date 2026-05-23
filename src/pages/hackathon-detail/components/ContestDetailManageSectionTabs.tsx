import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

type SectionKey =
  | "overview"
  | "applications"
  | "judging"
  | "analytics"
  | "translations"
  | "awards"
  | "email"
  | "settings";

function sectionLabel(
  key: SectionKey,
  translate: (k: string) => string,
): string {
  if (key === "email") return translate("workspace.email.tabLabel");
  return translate(`workspace.tabs.${key}`);
}

export function ContestDetailManageSectionTabs({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const { translate, contest, canReview, canJudge, canViewAggregate, isManager } =
    vm;
  const navigate = useNavigate();

  const visibleSections: SectionKey[] = [
    "overview",
    ...(canReview ? (["applications"] as const) : []),
    ...(canJudge ? (["judging"] as const) : []),
    ...(canViewAggregate ? (["analytics"] as const) : []),
    ...(isManager
      ? (["translations", "awards", "email", "settings"] as const)
      : []),
  ];

  const activeSection = (vm.activeManageSection ?? "overview") as SectionKey;

  const base = contest.slug
    ? `/hackathons/${contest.slug}/manage`
    : "/hackathons/manage/overview";

  const buildHref = (key: SectionKey) =>
    contest.slug ? `${base}/${key}` : base;

  return (
    <nav
      className={cn(
        "-mx-1 sticky top-14 z-30 mb-6 border-b border-border-subtle bg-background/95 pb-0 backdrop-blur-md sm:mb-8",
        "supports-[backdrop-filter]:bg-background/85",
      )}
      aria-label={translate("workspace.manage.tabs.ariaLabel")}
    >
      <div className="-mb-px flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleSections.map((key) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(buildHref(key))}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
              )}
            >
              {sectionLabel(key, translate)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

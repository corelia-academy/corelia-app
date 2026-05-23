import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type GroupKey = "run" | "comms" | "insights" | "configure";

const GROUP_FOR_SECTION: Record<SectionKey, GroupKey> = {
  overview: "run",
  applications: "run",
  judging: "run",
  awards: "run",
  email: "comms",
  translations: "comms",
  analytics: "insights",
  settings: "configure",
};

const GROUP_ORDER: GroupKey[] = ["run", "comms", "insights", "configure"];

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

  const sectionsByGroup: Record<GroupKey, SectionKey[]> = {
    run: [],
    comms: [],
    insights: [],
    configure: [],
  };
  for (const s of visibleSections) sectionsByGroup[GROUP_FOR_SECTION[s]].push(s);

  const activeSection = (vm.activeManageSection ?? "overview") as SectionKey;
  const activeGroup = GROUP_FOR_SECTION[activeSection];

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
        {GROUP_ORDER.map((group) => {
          const groupSections = sectionsByGroup[group];
          if (groupSections.length === 0) return null;
          const isActive = activeGroup === group;
          const groupLabel = translate(`workspace.tabGroups.${group}`);
          const triggerText = isActive
            ? `${groupLabel} · ${sectionLabel(activeSection, translate)}`
            : groupLabel;

          return (
            <DropdownMenu key={group}>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
                )}
                aria-label={groupLabel}
              >
                <span>{triggerText}</span>
                <ChevronDown className="size-4 shrink-0" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {groupSections.map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => navigate(buildHref(key))}
                    className={cn(
                      key === activeSection &&
                        "bg-surface-raised text-foreground",
                    )}
                  >
                    {sectionLabel(key, translate)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </nav>
  );
}

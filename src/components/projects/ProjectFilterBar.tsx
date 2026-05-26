import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { PublicProjectSort, PublicProjectSourceFilter } from "@/lib/projects";

type ProjectFilterBarProps = {
  source: PublicProjectSourceFilter;
  sort: PublicProjectSort;
  onSourceChange: (source: PublicProjectSourceFilter) => void;
  onSortChange: (sort: PublicProjectSort) => void;
  className?: string;
};

const SOURCE_OPTIONS: Array<{
  value: PublicProjectSourceFilter;
  labelKey:
    | "projects.filters.all"
    | "projects.filters.hackathon"
    | "projects.filters.course"
    | "projects.filters.showcase";
}> = [
  { value: "all", labelKey: "projects.filters.all" },
  { value: "hackathon", labelKey: "projects.filters.hackathon" },
  { value: "course", labelKey: "projects.filters.course" },
  { value: "standalone", labelKey: "projects.filters.showcase" },
];

const SORT_OPTIONS: Array<{
  value: PublicProjectSort;
  labelKey:
    | "projects.sort.newest"
    | "projects.sort.mostLiked"
    | "projects.sort.mostCommented";
}> = [
  { value: "newest", labelKey: "projects.sort.newest" },
  { value: "most_liked", labelKey: "projects.sort.mostLiked" },
  { value: "most_commented", labelKey: "projects.sort.mostCommented" },
];

export function ProjectFilterBar({
  source,
  sort,
  onSourceChange,
  onSortChange,
  className,
}: ProjectFilterBarProps) {
  const { t } = useTranslation("common");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-base p-3 shadow-card sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("projects.filters.label")}>
        {SOURCE_OPTIONS.map((option) => {
          const active = option.value === source;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-foreground-muted hover:bg-surface-raised hover:text-foreground",
              )}
              onClick={() => onSourceChange(option.value)}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground-muted">
        <span className="shrink-0">{t("projects.sort.label")}</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as PublicProjectSort)}
          className="h-8 rounded-md border border-border bg-surface-base px-2 text-sm font-medium text-foreground outline-hidden focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

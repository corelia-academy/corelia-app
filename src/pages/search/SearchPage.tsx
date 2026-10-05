import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Search, ShieldAlert } from "lucide-react";
import { FileText, TimerIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import {
  createMockParticipantPreview,
  formatCompactParticipantCount,
  type ParticipantPreviewData,
} from "@/components/participants/participantPreview";
import { searchResultsQueryOptions } from "@/features/search/searchQueries";
import type { SearchEntityType, SearchResultRow } from "@/lib/search";
import { formatDuration, getCourseLevelLabel } from "@/types/courses";

const SEARCH_FILTERS = ["all", "course", "hackathon", "project", "profile"] as const;
const EMPTY_SEARCH_RESULTS: SearchResultRow[] = [];
type SearchFilter = "all" | SearchEntityType;

function isSearchFilter(value: string): value is SearchFilter {
  return SEARCH_FILTERS.some((filter) => filter === value);
}

function useQueryParam(name: string): string {
  const location = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(name) ?? "";
  }, [location.search, name]);
}

function SearchCourseResultCard({
  item,
  participantPreview,
}: {
  item: SearchResultRow;
  participantPreview: ParticipantPreviewData;
}) {
  const { t } = useTranslation("common");
  const [failedImage, setFailedImage] = useState(false);
  const course = item.course;

  if (!course) return null;

  return (
    <NavLink
      to={item.href}
      className="motion-hover-course-card block min-w-0 rounded-xl focus-visible:outline-primary"
    >
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-surface-raised">
        {course.thumbnail_url && !failedImage ? (
          <img
            src={course.thumbnail_url}
            alt=""
            loading="lazy"
            onError={() => setFailedImage(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileText className="size-10 text-foreground-muted" aria-hidden weight="duotone" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 p-4">
        <h2 className="line-clamp-2 text-lg font-display font-medium leading-tight text-foreground">
          {item.title}
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-foreground-muted">
          <span className="shrink-0 rounded-full border border-blue-400 px-1.5 py-1 text-[10px] leading-3 text-blue-400">
            {getCourseLevelLabel(course.level)}
          </span>
          {typeof item.lessonCount === "number" ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <FileText className="size-4" aria-hidden weight="duotone" />
              {t("home.meta.lessonCount", { count: item.lessonCount })}
            </span>
          ) : null}
          {typeof item.lessonCount === "number" ? (
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
          ) : null}
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <TimerIcon className="size-4" aria-hidden weight="duotone" />
            {formatDuration(Number(course.total_duration_seconds) || 0)}
          </span>
        </div>
        <ParticipantSummary
          count={participantPreview.count}
          participants={participantPreview.participants}
          summary={t("home.meta.learners", {
            displayCount: formatCompactParticipantCount(participantPreview.count),
          })}
        />
      </div>
    </NavLink>
  );
}

export default function SearchPage() {
  const { t, i18n } = useTranslation("common");
  const q = useQueryParam("q").trim();
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
  const [previousQuery, setPreviousQuery] = useState(q);
  const resultsQuery = useQuery(searchResultsQueryOptions(q, 30, true, i18n.language));
  const items = resultsQuery.data ?? EMPTY_SEARCH_RESULTS;
  const participantPreviewByCourse = useMemo(
    () => new Map(items
      .filter((item) => item.entity_type === "course" && item.course)
      .map((item) => [item.entity_id, createMockParticipantPreview(item.entity_id)])),
    [items],
  );
  const visibleItems = activeFilter === "all"
    ? items
    : items.filter((item) => item.entity_type === activeFilter);
  const loading = Boolean(q) && resultsQuery.isPending;
  const error = resultsQuery.error instanceof Error
    ? resultsQuery.error.message
    : resultsQuery.error ? t("search.errors.loadFailed") : null;

  if (previousQuery !== q) {
    setPreviousQuery(q);
    setActiveFilter("all");
  }

  return (
    <div className="container-app pb-6 pt-4 sm:py-8">
      <div className="flex items-start gap-3">
        <Search className="mt-1 size-5 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-heading-large font-display text-foreground">
            {q ? t("search.queryLine", { query: q }) : t("search.title")}
          </h1>
          {!q ? (
            <p className="mt-2 text-sm text-foreground-muted">
              {t("search.enterQueryHint")}
            </p>
          ) : null}

        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
              <ShieldAlert
                className="size-6 text-foreground-subtle"
                aria-hidden
              />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
              <Button className="mt-4" variant="cta" hierarchy="secondary" onClick={() => void resultsQuery.refetch()}>{t("actions.retry")}</Button>
            </div>
          </div>
        ) : !q ? null : items.length === 0 ? (
          <div className="flex justify-center py-8 sm:py-10">
            <EmptyStateIllustration
              type="search"
              size="large"
              title={t("search.emptyTitle")}
              description={t("search.empty")}
            />
          </div>
        ) : (
          <Tabs.Root
            value={activeFilter}
            onValueChange={(value) => {
              if (isSearchFilter(value)) setActiveFilter(value);
            }}
            className="space-y-5"
          >
            <Tabs.List
              aria-label={t("search.categories")}
              className="scrollbar-design w-full overflow-x-auto"
              level="3b"
            >
              {SEARCH_FILTERS.map((filter) => (
                <Tabs.Tab
                  key={filter}
                  value={filter}
                  className="min-h-11 shrink-0"
                >
                  {t(`search.group.${filter}` as never, { defaultValue: filter })}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value={activeFilter}>
              {visibleItems.length === 0 ? (
                <div className="flex justify-center py-8 sm:py-10">
                  <EmptyStateIllustration
                    type="search"
                    size="large"
                    title={t("search.filteredEmptyTitle")}
                    description={t("search.filteredEmpty")}
                  />
                </div>
              ) : (
                <div className={
                  visibleItems.every((item) => item.entity_type === "course" && item.course)
                    ? "grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3"
                    : "mobile-bleed-grid divide-y divide-border-subtle"
                }>
                  {visibleItems.map((item) => (
                    item.entity_type === "course" && item.course ? (
                      <SearchCourseResultCard
                        key={`${item.entity_type}:${item.entity_id}`}
                        item={item}
                        participantPreview={participantPreviewByCourse.get(item.entity_id)!}
                      />
                    ) : (
                      <NavLink
                        key={`${item.entity_type}:${item.entity_id}`}
                        to={item.href}
                        className="block rounded-lg bg-surface-base px-4 py-5 transition-colors duration-150 hover:bg-surface-raised"
                      >
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-base font-semibold text-foreground">
                            {item.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
                            <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5">
                              {t(`search.group.${item.entity_type}` as never, {
                                defaultValue: item.entity_type,
                              })}
                            </span>
                            {item.subtitle ? (
                              <span className="truncate">{item.subtitle}</span>
                            ) : null}
                          </div>
                        </div>
                      </NavLink>
                    )
                  ))}
                </div>
              )}
            </Tabs.Panel>
          </Tabs.Root>
        )}
      </div>
    </div>
  );
}

import { Link } from "react-router";
import { BadgeCheck, BookOpen, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDuration,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  getCourseOwnerTypeLabel,
} from "@/types/courses";

import { useCoursesCatalog } from "./hooks/useCoursesCatalog";
import { type CatalogTranslate, getPrimaryPriceLabel } from "./utils/catalog";

export default function CoursesPage() {
  const { t } = useTranslation("courses");
  const translate: CatalogTranslate = (key, options) =>
    String(t(key as never, options as never));
  const {
    loading,
    error,
    filteredOnlineCourses,
    hasActiveFilters,
    activeFilterCount,
    resetFilters,
  } = useCoursesCatalog();

  if (loading) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-8 w-56 rounded-md" />
          <Skeleton className="h-4 w-72 max-w-full rounded" />
        </div>
        <Skeleton className="h-40 w-full rounded-md border border-border-subtle" />
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-sm font-medium text-destructive">
            {t("catalog.loadErrorTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-destructive/90">
            {error}
          </p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("catalog.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("catalog.results", { count: filteredOnlineCourses.length })}
            {hasActiveFilters
              ? t("catalog.activeFilters", { count: activeFilterCount })
              : null}
          </p>
        </div>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={resetFilters}
          >
            {t("catalog.clearFilters")}
          </Button>
        ) : null}
      </div>

      {filteredOnlineCourses.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-md border border-border-subtle bg-card py-16 text-center shadow-card">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <BookOpen className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("catalog.emptyTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("catalog.emptyDescription")}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetFilters}
            >
              {t("catalog.clearFilters")}
            </Button>
          ) : (
            <Button
              render={<Link to="/" />}
              nativeButton={false}
              size="sm"
              variant="outline"
            >
              {t("catalog.backHome", { defaultValue: "Về trang chủ" })}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredOnlineCourses.map((course) => (
            <Link
              key={course.id}
              to={`/courses/${course.slug || course.id}`}
              className="group cursor-pointer overflow-hidden rounded-md border border-border-subtle bg-card text-card-foreground shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
            >
              <div className="relative aspect-video overflow-hidden bg-muted/50">
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="size-full object-cover"
                />
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-medium leading-relaxed text-foreground">
                  {course.title}
                </div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {course.instructor_name}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    <Clock className="size-3 shrink-0" aria-hidden />
                    {formatDuration(Number(course.total_duration_seconds) || 0)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    <BadgeCheck className="size-3 shrink-0" aria-hidden />
                    {getCourseAccessModelLabel(course.access_model)}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {getCourseLevelLabel(course.level)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">
                    {getPrimaryPriceLabel(course, translate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getCourseOwnerTypeLabel(course.owner_type)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

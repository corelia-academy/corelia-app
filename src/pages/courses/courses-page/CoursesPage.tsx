import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicCourseCard } from "@/components/courses/PublicCourseCard";

import { useCoursesCatalog } from "./hooks/useCoursesCatalog";
import {
  useUserCoursesProgress,
} from "./hooks/useUserCoursesProgress";

export default function CoursesPage() {
  const { t } = useTranslation("courses");
  const { t: tCommon } = useTranslation("common");
  const {
    loading,
    error,
    filteredOnlineCourses,
    hasActiveFilters,
    activeFilterCount,
    resetFilters,
    retry,
  } = useCoursesCatalog();
  const { progressByCourse } = useUserCoursesProgress();

  if (loading) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-5 shrink-0 rounded-sm" />
            <Skeleton className="h-8 w-56 max-w-[70%] rounded-md" />
          </div>
          <Skeleton className="mt-1 h-4 w-72 max-w-full rounded" />
        </div>
        <Skeleton className="h-40 w-full rounded-md border border-border-subtle" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive-muted p-5">
          <p className="text-sm font-medium text-destructive">
            {t("catalog.loadErrorTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-destructive/90">
            {error}
          </p>
          <Button className="mt-4" variant="outline" onClick={() => void retry()}>{tCommon("actions.retry")}</Button>
        </div>
      </div>
    );
  }


  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-heading-large font-display text-foreground">
              {t("catalog.title")}
            </h1>
          </div>
          {hasActiveFilters ? (
            <p className="mt-1 text-[13px] text-foreground-muted">
              {t("catalog.activeFilters", { count: activeFilterCount }).replace(/^\s*·\s*/, "")}
            </p>
          ) : null}
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
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
            <BookOpen className="size-6 text-foreground-subtle" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("catalog.emptyTitle")}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOnlineCourses.map((course) => (
            <PublicCourseCard
              key={course.id}
              course={course}
              progress={progressByCourse.get(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

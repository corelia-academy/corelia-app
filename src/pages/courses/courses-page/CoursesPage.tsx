import { Link } from "react-router";
import { ArrowRight, BadgeCheck, BookOpen, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  type Course,
} from "@/types/courses";

import { useCoursesCatalog } from "./hooks/useCoursesCatalog";
import {
  useUserCoursesProgress,
  type CourseProgressEntry,
} from "./hooks/useUserCoursesProgress";
import { type CatalogTranslate, getPrimaryPriceLabel } from "./utils/catalog";

function levelBadgeClass(level?: string | null): string {
  switch (level) {
    case "beginner":
      return "border-success/30 bg-success/15 text-success";
    case "intermediate":
      return "border-brand-accent/30 bg-brand-accent/15 text-brand-accent";
    case "advanced":
      return "border-warning/30 bg-warning/15 text-warning";
    default:
      return "border-border bg-surface-raised text-foreground-muted";
  }
}

function CourseCard({
  course,
  progress,
  translate,
  cardContinueLabel,
  cardStartLabel,
}: {
  course: Course;
  progress: CourseProgressEntry | undefined;
  translate: CatalogTranslate;
  cardContinueLabel: string;
  cardStartLabel: string;
}) {
  const enrolled = !!progress?.enrolled;
  const percent = progress?.percent ?? 0;
  const showProgress = enrolled && percent > 0;
  const ctaLabel = showProgress ? cardContinueLabel : cardStartLabel;

  return (
    <Link
      to={`/courses/${course.slug || course.id}`}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:bg-surface-raised"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-raised">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <BookOpen className="size-10 text-foreground-subtle" aria-hidden />
          </div>
        )}
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm",
            levelBadgeClass(course.level),
          )}
        >
          {getCourseLevelLabel(course.level)}
        </span>
        {showProgress ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
            <div
              className="h-full bg-success"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
          {course.title}
        </h3>

        {course.short_description || course.description ? (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-foreground-muted">
            {course.short_description || course.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {formatDuration(Number(course.total_duration_seconds) || 0)}
          </span>
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
            {getCourseAccessModelLabel(course.access_model)}
          </span>
          <span className="ml-auto font-medium text-foreground">
            {getPrimaryPriceLabel(course, translate)}
          </span>
        </div>

        {enrolled ? (
          <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
            <span className="text-[13px] text-foreground-muted">
              {showProgress ? `${percent}%` : ctaLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">
              {showProgress ? ctaLabel : null}
              <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

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
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        </div>
      </div>
    );
  }

  const cardContinueLabel = t("catalog.card.continueLearning");
  const cardStartLabel = t("catalog.card.startLearning");

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
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
            <CourseCard
              key={course.id}
              course={course}
              progress={progressByCourse.get(course.id)}
              translate={translate}
              cardContinueLabel={cardContinueLabel}
              cardStartLabel={cardStartLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

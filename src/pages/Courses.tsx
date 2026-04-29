import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, BookOpen, Clock } from "lucide-react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedCourses } from "@/lib/courses";
import {
  formatDuration,
  formatVndPrice,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  getCourseOwnerTypeLabel,
} from "@/types/courses";
import type { Course } from "@/types/courses";
import { sortLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";

type SortMode = "featured" | "recent" | "duration_desc" | "title_asc";

type Translate = (key: string, options?: { price?: string; count?: number }) => string;

function getPrimaryPriceLabel(course: Course, t: Translate): string {
  const accessModel = course.access_model ?? "free";
  if (accessModel === "paid_upfront") {
    const promo = Number(course.promo_price_vnd ?? 0);
    if (promo > 0) return t("pricing.fromPrice", { price: formatVndPrice(promo) });
    return formatVndPrice(course.price_vnd);
  }
  if (accessModel === "free_with_paid_certificate") {
    return t("pricing.certificateFee", { price: formatVndPrice(course.certificate_fee_vnd) });
  }
  return t("pricing.freeLearning");
}

function getFeaturedScore(course: Course): number {
  let score = 0;
  score += (course.owner_type ?? "corelia") === "corelia" ? 3 : 1;
  score += (course.access_model ?? "free") === "paid_upfront" ? 2 : 0;
  score += course.short_description ? 1 : 0;
  score += Math.min(
    4,
    Math.round(Number(course.total_duration_seconds ?? 0) / 7200),
  );
  return score;
}

function sortCourses(list: Course[], sort: SortMode): Course[] {
  const next = [...list];
  if (sort === "recent") {
    return next.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  if (sort === "duration_desc") {
    return next.sort(
      (a, b) =>
        Number(b.total_duration_seconds ?? 0) -
        Number(a.total_duration_seconds ?? 0),
    );
  }
  if (sort === "title_asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title, sortLocale()));
  }
  return next.sort((a, b) => {
    const scoreDiff = getFeaturedScore(b) - getFeaturedScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export default function Courses() {
  const { t } = useTranslation("courses");
  const translate: Translate = (key, options) => String(t(key as never, options as never));
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPublishedCourses()
      .then((onlineRows) => {
        if (cancelled) return;
        setCourses(onlineRows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("catalog.loadErrorFallback"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const visibleCourses = useMemo(
    () => sortCourses(courses, "featured"),
    [courses],
  );

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
          <p className="mt-2 text-sm leading-relaxed text-destructive/90">{error}</p>
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
            {t("catalog.results", { count: visibleCourses.length })}
          </p>
        </div>
      </div>
      {visibleCourses.length === 0 ? (
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
            <Button render={<Link to="/" />} nativeButton={false} size="sm" variant="outline">
              {t("catalog.backHome", { defaultValue: "Về trang chủ" })}
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {visibleCourses.map((course) => (
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

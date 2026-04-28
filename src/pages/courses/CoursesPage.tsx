import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, BookOpen, Clock, Search } from "lucide-react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPublishedCourses } from "@/lib/courses";
import {
  formatDuration,
  formatVndPrice,
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  getCourseOwnerTypeLabel,
} from "@/types/courses";
import type { Course, CourseLevel, CourseOwnerType } from "@/types/courses";
import { sortLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";

type PricingFilter = "all" | "free" | "paid" | "certificate";
type OwnerFilter = "all" | CourseOwnerType;
type SortMode = "featured" | "recent" | "duration_desc" | "title_asc";

const LEVEL_OPTIONS = [
  { value: "all" as const, labelKey: "filters.level.all" as const },
  { value: "beginner" as const, labelKey: "filters.level.beginner" as const },
  { value: "intermediate" as const, labelKey: "filters.level.intermediate" as const },
  { value: "advanced" as const, labelKey: "filters.level.advanced" as const },
] as const satisfies ReadonlyArray<{ value: "all" | CourseLevel; labelKey: string }>;

const PRICING_OPTIONS = [
  { value: "all" as const, labelKey: "filters.pricing.all" as const },
  { value: "free" as const, labelKey: "filters.pricing.free" as const },
  { value: "paid" as const, labelKey: "filters.pricing.paid" as const },
  { value: "certificate" as const, labelKey: "filters.pricing.certificate" as const },
] as const satisfies ReadonlyArray<{ value: PricingFilter; labelKey: string }>;

const OWNER_OPTIONS = [
  { value: "all" as const, labelKey: "filters.owner.all" as const },
  { value: "corelia" as const, labelKey: "filters.owner.corelia" as const },
  { value: "external_partner" as const, labelKey: "filters.owner.external_partner" as const },
] as const satisfies ReadonlyArray<{ value: OwnerFilter; labelKey: string }>;

const SORT_OPTIONS = [
  { value: "featured" as const, labelKey: "filters.sort.featured" as const },
  { value: "recent" as const, labelKey: "filters.sort.recent" as const },
  { value: "duration_desc" as const, labelKey: "filters.sort.duration_desc" as const },
  { value: "title_asc" as const, labelKey: "filters.sort.title_asc" as const },
] as const satisfies ReadonlyArray<{ value: SortMode; labelKey: string }>;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesPricing(course: Course, filter: PricingFilter): boolean {
  const accessModel = course.access_model ?? "free";
  if (filter === "all") return true;
  if (filter === "free") return accessModel === "free";
  if (filter === "paid") return accessModel === "paid_upfront";
  return accessModel === "free_with_paid_certificate";
}

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

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary/20 bg-primary-container text-on-primary-container"
          : "border-border-subtle bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function CoursesPage() {
  const { t } = useTranslation("courses");
  const translate: Translate = (key, options) => String(t(key as never, options as never));
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | CourseLevel>("all");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");

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

  const filteredOnlineCourses = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const base = courses.filter((course) => {
      if (levelFilter !== "all" && course.level !== levelFilter) return false;
      if (!matchesPricing(course, pricingFilter)) return false;
      if (
        ownerFilter !== "all" &&
        (course.owner_type ?? "corelia") !== ownerFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;

      const haystack = [
        course.title,
        course.short_description,
        course.description,
        course.instructor_name,
        getCourseOwnerTypeLabel(course.owner_type),
      ]
        .map(normalizeText)
        .join(" ");

      return haystack.includes(normalizedQuery);
    });

    return sortCourses(base, sortMode);
  }, [courses, levelFilter, ownerFilter, pricingFilter, query, sortMode]);

  const activeFilterCount = [
    levelFilter !== "all",
    pricingFilter !== "all",
    ownerFilter !== "all",
    query.trim() !== "",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setQuery("");
    setLevelFilter("all");
    setPricingFilter("all");
    setOwnerFilter("all");
    setSortMode("featured");
  };

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
            {t("catalog.results", { count: filteredOnlineCourses.length })}
            {hasActiveFilters ? t("catalog.activeFilters", { count: activeFilterCount }) : null}
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

      <section className="rounded-md border border-border-subtle bg-card p-3 shadow-card sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("catalog.searchPlaceholder")}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm">{t("catalog.sort")}</Button>}
            />
            <DropdownMenuContent align="end" className="w-56">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSortMode(opt.value)}
                >
                  <span className={opt.value === sortMode ? "font-medium" : ""}>
                    {t(opt.labelKey)}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {LEVEL_OPTIONS.map((opt) => (
              <Pill
                key={opt.value}
                active={levelFilter === opt.value}
                onClick={() => setLevelFilter(opt.value)}
              >
                {t(opt.labelKey)}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRICING_OPTIONS.map((opt) => (
              <Pill
                key={opt.value}
                active={pricingFilter === opt.value}
                onClick={() => setPricingFilter(opt.value)}
              >
                {t(opt.labelKey)}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {OWNER_OPTIONS.map((opt) => (
              <Pill
                key={opt.value}
                active={ownerFilter === opt.value}
                onClick={() => setOwnerFilter(opt.value)}
              >
                {t(opt.labelKey)}
              </Pill>
            ))}
          </div>
        </div>
      </section>

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
            <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
              {t("catalog.clearFilters")}
            </Button>
          ) : (
            <Button render={<Link to="/" />} nativeButton={false} size="sm" variant="outline">
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


import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  Clock,
  MagnifyingGlass,
  SealCheck,
  Spinner,
} from "@phosphor-icons/react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { Button } from "@/components/ui/button";
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

type PricingFilter = "all" | "free" | "paid" | "certificate";
type OwnerFilter = "all" | CourseOwnerType;
type SortMode = "featured" | "recent" | "duration_desc" | "title_asc";

const LEVEL_OPTIONS: Array<{ value: "all" | CourseLevel; label: string }> = [
  { value: "all", label: "Mọi cấp độ" },
  { value: "beginner", label: "Cơ bản" },
  { value: "intermediate", label: "Trung cấp" },
  { value: "advanced", label: "Nâng cao" },
];

const PRICING_OPTIONS: Array<{ value: PricingFilter; label: string }> = [
  { value: "all", label: "Mọi mức phí" },
  { value: "free", label: "Miễn phí" },
  { value: "paid", label: "Trả phí trước" },
  { value: "certificate", label: "Học miễn phí, trả phí chứng nhận" },
];

const OWNER_OPTIONS: Array<{ value: OwnerFilter; label: string }> = [
  { value: "all", label: "Mọi đơn vị" },
  { value: "corelia", label: "Corelia" },
  { value: "external_partner", label: "Giảng viên hợp tác" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "featured", label: "Ưu tiên nổi bật" },
  { value: "recent", label: "Mới cập nhật" },
  { value: "duration_desc", label: "Thời lượng dài nhất" },
  { value: "title_asc", label: "Tên A-Z" },
];

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

function getPrimaryPriceLabel(course: Course): string {
  const accessModel = course.access_model ?? "free";
  if (accessModel === "paid_upfront") {
    const promo = Number(course.promo_price_vnd ?? 0);
    if (promo > 0) return `Từ ${formatVndPrice(promo)}`;
    return formatVndPrice(course.price_vnd);
  }
  if (accessModel === "free_with_paid_certificate") {
    return `Chứng nhận ${formatVndPrice(course.certificate_fee_vnd)}`;
  }
  return "Học miễn phí";
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
    return next.sort((a, b) => a.title.localeCompare(b.title, "vi"));
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

export default function Courses() {
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
          setError(e instanceof Error ? e.message : "Lỗi tải khoá học");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-border-subtle bg-card p-8 text-center shadow-card">
          <Spinner className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-[15px] text-muted-foreground">
            Đang tải danh sách chương trình học...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-6 sm:py-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">
            Không thể tải danh sách khoá học.
          </p>
          <p className="mt-1.5 text-sm text-destructive/90">{error}</p>
          <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-medium tracking-tight text-foreground">
            Khoá học
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredOnlineCourses.length} kết quả
            {hasActiveFilters ? ` · ${activeFilterCount} bộ lọc` : null}
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
            Xoá bộ lọc
          </Button>
        ) : null}
      </div>

      <section className="rounded-lg border border-border-subtle bg-card p-3 shadow-card sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2">
            <MagnifyingGlass className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên khoá, giảng viên..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm">Sắp xếp</Button>} />
            <DropdownMenuContent align="end" className="w-56">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSortMode(opt.value)}
                >
                  <span className={opt.value === sortMode ? "font-medium" : ""}>
                    {opt.label}
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
                {opt.label}
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
                {opt.label}
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
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>
      </section>

        {filteredOnlineCourses.length === 0 ? (
          <div className="mt-5 rounded-lg border border-border-subtle bg-card p-10 text-center shadow-card">
            <BookOpen className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 text-[15px] font-medium text-foreground">
              Chưa có khoá online nào khớp bộ lọc hiện tại.
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Thử bỏ bớt bộ lọc hoặc tìm theo tên giảng viên, lĩnh vực và hình
              thức học.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredOnlineCourses.map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.slug || course.id}`}
                className="group overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-card transition-colors hover:border-border hover:bg-muted/30"
              >
                <div className="relative aspect-video overflow-hidden bg-muted/50">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-[13px] font-medium leading-5 text-foreground">
                    {course.title}
                  </div>
                  <div className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                    {course.instructor_name}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3.5" />
                      {formatDuration(Number(course.total_duration_seconds) || 0)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      <SealCheck className="size-3.5" />
                      {getCourseAccessModelLabel(course.access_model)}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {getCourseLevelLabel(course.level)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">
                      {getPrimaryPriceLabel(course)}
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  Eye,
  PlusCircle,
  GraduationCap,
  Loader2,
  DollarSign,
  EyeOff,
  Pencil,
} from "lucide-react";
import { getCoursesForManagement } from "@/lib/courses";
import {
  getCourseAccessModelLabel,
  getCourseLevelLabel,
  getCourseOwnerTypeLabel,
  formatVndPrice,
} from "@/types/courses";
import type { Course } from "@/types/courses";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { EmptyState, PageContainer, PageSectionCard } from "@/components/layouts/PagePrimitives";

const InstructorCourses = () => {
  const { t } = useTranslation("instructor");
  const { profile, authInitialized, profileLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const canViewAll = isAdmin;

  useEffect(() => {
    let cancelled = false;
    if (!authInitialized || profileLoading) return () => { cancelled = true; };
    if (!isAuthenticated || !profile?.id) {
      queueMicrotask(() => {
        if (cancelled) return;
        setLoading(false);
        setCourses([]);
        setError(t("courseListPage.errors.loadFailed"));
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    getCoursesForManagement(profile.id, canViewAll)
      .then((data) => {
        if (!cancelled) setCourses(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t("courseListPage.errors.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authInitialized, profileLoading, isAuthenticated, profile?.id, canViewAll, t]);

  const stats = useMemo(() => {
    const published = courses.filter((course) => course.published).length;
    const drafts = courses.length - published;
    const paid = courses.filter((course) => course.access_model === "paid_upfront").length;
    const free = courses.filter((course) => course.access_model === "free").length;
    return { total: courses.length, published, drafts, paid, free };
  }, [courses]);

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <PageContainer>
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("courseListPage.stats.total")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.total}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("courseListPage.stats.published")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.published}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("courseListPage.stats.drafts")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.drafts}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <EyeOff className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("courseListPage.stats.paidUpfront")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.paid}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="size-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("courseListPage.stats.free")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stats.free}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="size-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <PageSectionCard className="mt-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("courseListPage.hero.title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-sm">
              {t("courseListPage.hero.description")}
            </p>
          </div>
          <Button
            type="button"
            className="inline-flex items-center gap-2"
            onClick={() => navigate("/instructor/courses/new")}
          >
            <PlusCircle className="size-4" aria-hidden />
            {t("courseListPage.hero.create")}
          </Button>
        </div>
      </PageSectionCard>

      {courses.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border-subtle bg-card shadow-card">
          <EmptyState
            icon={<BookOpen className="size-6 text-muted-foreground" aria-hidden />}
            title={t("courseListPage.empty.title")}
            description={
              t("courseListPage.empty.description", { defaultValue: "" }) || undefined
            }
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate("/instructor/courses/new")}
              >
                {t("courseListPage.empty.createFirst")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className="group flex h-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                className="w-full text-left hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
              >
                <div className="relative aspect-video overflow-hidden border-b border-border-subtle bg-muted/50">
                  <img
                    src={course.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-95"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
                    <span className="inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                      {course.published
                        ? t("courseListPage.coursePills.published")
                        : t("courseListPage.coursePills.draft")}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                      {getCourseLevelLabel(course.level)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                      {getCourseAccessModelLabel(course.access_model)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                      {getCourseOwnerTypeLabel(course.owner_type)}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-lg font-medium tracking-tight text-foreground">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {course.slug}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border-subtle bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("courseListPage.courseCards.pricingLabel")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {course.access_model === "paid_upfront"
                          ? formatVndPrice(course.price_vnd)
                          : course.access_model === "free_with_paid_certificate"
                            ? t("courseListPage.courseCards.certificateFeePrefix", {
                                price: formatVndPrice(course.certificate_fee_vnd),
                              })
                            : t("courseListPage.courseCards.free")}
                      </p>
                    </div>
                    <div className="rounded-md border border-border-subtle bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("courseListPage.courseCards.instructorLabel")}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                        {canViewAll ? course.instructor_name : t("courseListPage.courseCards.you")}
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    window.open(`/courses/${course.slug || course.id}`, "_blank", "noopener");
                  }}
                  title={
                    course.published
                      ? t("courseListPage.actions.viewCourseTitle")
                      : t("courseListPage.actions.previewDraftTitle")
                  }
                >
                  {course.published
                    ? t("courseListPage.actions.viewCourse")
                    : t("courseListPage.actions.preview")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
                  className="inline-flex items-center gap-1"
                >
                  <Pencil className="size-4" aria-hidden />
                  {t("courseListPage.actions.edit")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default InstructorCourses;

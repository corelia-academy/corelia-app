import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap } from "lucide-react";
import { listOfflineCohorts, listOfflineCourses } from "@/lib/offline";
import type { OfflineCohort, OfflineCourse } from "@/types/offline";
import { useTranslation } from "react-i18next";

export default function Cohorts() {
  const { t } = useTranslation("cohorts");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const [items, setItems] = useState<OfflineCourse[]>([]);
  const [cohorts, setCohorts] = useState<OfflineCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOfflineCourses(), listOfflineCohorts()])
      .then(([courseRows, cohortRows]) => {
        if (!cancelled) {
          setItems(courseRows);
          setCohorts(cohortRows);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : translate("catalog.loadErrorFallback"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [translate]);

  const stats = useMemo(
    () => ({
      totalCourses: items.length,
      totalCohorts: cohorts.length,
      running: cohorts.filter((item) => item.status === "running").length,
      recordings: cohorts.reduce(
        (total, item) => total + (item.metrics_snapshot?.published_recordings ?? 0),
        0,
      ),
    }),
    [cohorts, items],
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("catalog.heroEyebrow")}
            </div>
            <h1 className="mt-2 text-3xl font-normal tracking-tight text-foreground">
              {t("catalog.heroTitle")}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              {t("catalog.heroDescription")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.totalCourses")}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {stats.totalCourses}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.totalCohorts")}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {stats.totalCohorts}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-background px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.running")}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {stats.running}
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <Card className="mt-6">
          <CardContent className="p-8">
            <div className="space-y-4">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="rounded-md border border-border-subtle bg-background p-4">
                  <Skeleton className="h-4 w-40 rounded-full" />
                  <Skeleton className="mt-3 h-4 w-3/4 rounded-full" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-20 rounded-md" />
                    <Skeleton className="h-20 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="mt-6 border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive sm:p-6">{error}</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <GraduationCap className="size-6 text-muted-foreground" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("catalog.emptyTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("catalog.emptyDescription")}</p>
              </div>
              <Button size="sm" variant="outline" render={<NavLink to="/courses" />} nativeButton={false}>
                {t("catalog.viewCourse")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((course) => {
            const courseCohorts = cohorts.filter(
              (cohort) => cohort.offline_course_id === course.id,
            );
            return (
            <article
              key={course.id}
              className="overflow-hidden rounded-md border border-border-subtle bg-card shadow-card"
            >
              <div className="border-b border-border-subtle bg-muted/25 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
                    {course.published
                      ? t("catalog.course.statusOpen")
                      : t("catalog.course.statusDraft")}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
                    {course.level}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-medium tracking-tight text-foreground">
                  {course.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {course.tagline}
                </p>
              </div>

              <div className="space-y-4 p-4 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {t("catalog.course.cityLabel")}
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {course.venue_city || t("catalog.course.venueCityFallback")}
                    </div>
                  </div>
                  <div className="rounded-md border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {t("catalog.course.certificateLabel")}
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {course.certificate_title || t("catalog.course.certificateFallback")}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border-subtle bg-background p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("catalog.metrics.sessions")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-foreground">
                      {courseCohorts.reduce(
                        (sum, item) => sum + item.metrics_snapshot.sessions_total,
                        0,
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border border-border-subtle bg-background p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("catalog.metrics.cohorts")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-foreground">
                      {course.metrics_snapshot.cohorts_total || courseCohorts.length}
                    </div>
                  </div>
                  <div className="rounded-md border border-border-subtle bg-background p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {t("catalog.metrics.recordings")}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-foreground">
                      {course.metrics_snapshot.published_recordings}
                    </div>
                  </div>
                </div>

                <Button
                  render={<NavLink to={`/cohorts/${course.id}`} />}
                  nativeButton={false}
                  className="w-full"
                >
                  {t("catalog.viewCourse")}
                </Button>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

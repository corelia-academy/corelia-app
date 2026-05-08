import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import {
  Trophy,
  Calendar,
  CheckCheck,
  Rocket,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listContests } from "@/lib/contests";
import { contestListImageUrl } from "@/lib/contestVisuals";
import { canManageContests } from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Contest } from "@/types/contests";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import {
  contestListLocationLabel,
  contestListStatusLabel,
  formatContestListDateRange,
} from "@/features/contests/list/contestListFormatters";
import {
  ContestListCardDateRowCatalog,
  ContestListCardThumbnail,
  ContestListMetricCellCatalog,
} from "@/features/contests/list/ContestListCardPrimitives";
import { perfMeasureEnd, perfMeasureStart } from "@/lib/perfTelemetry";

function CatalogStatSkeleton() {
  return (
    <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24 rounded-sm" />
          <Skeleton className="h-8 w-16 rounded-sm" />
        </div>
        <Skeleton className="size-11 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

function CatalogGridSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, idx) => (
        <Card key={idx} className="overflow-hidden">
          <Skeleton className="aspect-video w-full rounded-none" />
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-20 rounded-sm" />
                <Skeleton className="h-6 w-full max-w-[220px] rounded-sm" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
            </div>
            <Skeleton className="h-4 w-full rounded-sm" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export default function Contests() {
  const { t } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { profile, user } = useAuth();
  const [items, setItems] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);

    perfMeasureStart("contests.catalog_wave");
    void listContests(user ?? null)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([]);
          setError(
            err instanceof Error
              ? err.message
              : translate("catalog.loadErrorFallback"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          perfMeasureEnd("contests.catalog_wave", {
            viewer: user?.id ?? "guest",
          });
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listContests gates on user; avoid object identity churn
  }, [translate, user?.id, retryToken]);

  const isManager = canManageContests(profile);

  const stats = useMemo(() => {
    const total = items.length;
    const accepting = items.filter(
      (item) => item.status === "published",
    ).length;
    const running = items.filter((item) => item.status === "running").length;
    const ended = items.filter((item) => item.status === "ended").length;
    return { total, accepting, running, ended };
  }, [items]);

  const showData = !loading && !error;
  const showEmpty = showData && items.length === 0;
  const showGrid = showData && items.length > 0;
  const showError = !loading && Boolean(error);

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-5 sm:py-8 lg:px-6">
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("catalog.heroEyebrow")}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {t("catalog.heroTitle")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("catalog.heroDescription")}
            </p>
            {showGrid ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("catalog.statsSummary", {
                  total: stats.total,
                  accepting: stats.accepting,
                  running: stats.running,
                  ended: stats.ended,
                })}
              </p>
            ) : null}
            {showEmpty ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("catalog.statsSummary", {
                  total: 0,
                  accepting: 0,
                  running: 0,
                  ended: 0,
                })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
              {t("catalog.pillReviewed")}
            </span>
            <span className="inline-flex min-h-11 items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
              {t("catalog.pillTeamBased")}
            </span>
          </div>
        </div>
      </section>

      {showError ? null : (
        <div
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-hidden={loading ? true : undefined}
        >
          {loading ? (
            <>
              <CatalogStatSkeleton />
              <CatalogStatSkeleton />
              <CatalogStatSkeleton />
              <CatalogStatSkeleton />
            </>
          ) : (
            <>
              <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("catalog.stats.total")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {stats.total}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Rocket className="size-5" aria-hidden />
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("catalog.stats.accepting")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {stats.accepting}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <CheckCheck className="size-5" aria-hidden />
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("catalog.stats.running")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {stats.running}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Timer className="size-5" aria-hidden />
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("catalog.stats.ended")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {stats.ended}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Calendar className="size-5" aria-hidden />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showError ? (
        <div
          className="mt-6 rounded-md border border-destructive/25 bg-destructive/10 p-6 shadow-card"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-semibold text-foreground">
            {t("catalog.errorTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("catalog.errorDescription")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              onClick={() => setRetryToken((n) => n + 1)}
            >
              {t("catalog.retry")}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <div
        className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy={loading}
        aria-live={
          loading
            ? "polite"
            : showEmpty
              ? "polite"
              : showGrid
                ? "polite"
                : undefined
        }
      >
        {loading ? (
          <div className="contents">{CatalogGridSkeleton()}</div>
        ) : showEmpty ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Trophy
                    className="size-6 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("catalog.emptyTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isManager
                      ? t("catalog.emptyDescriptionManager")
                      : t("catalog.emptyDescriptionUser")}
                  </p>
                </div>
                {isManager ? (
                  <Button
                    render={<NavLink to="/admin/contests" />}
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                  >
                    {t("catalog.openWorkspace")}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : (
          items.map((contest) => {
            const listImageUrl = contestListImageUrl(contest);
            return (
              <NavLink
                key={contest.id}
                to={`/contests/${contest.id}/overview`}
                className="group block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${t("catalog.viewContest")}: ${contest.title}`}
              >
                <Card className="h-full overflow-hidden border-border-subtle transition-shadow duration-200 group-hover:border-border group-hover:shadow-md">
                  <ContestListCardThumbnail
                    src={listImageUrl}
                    alt=""
                    aspectClassName="aspect-video"
                    surfaceClassName="bg-linear-to-br from-primary/12 via-muted to-muted"
                    emptyMinHeightClassName="min-h-28"
                    trophyIconClassName="size-14 text-primary/40"
                  />
                  <CardContent className="flex h-full flex-col p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {contestListStatusLabel(
                            contest.status,
                            translate,
                            "catalog",
                          )}
                        </div>
                        <div className="mt-1 text-lg font-semibold leading-snug text-foreground">
                          {contest.title}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {contestListLocationLabel(
                          contest.location,
                          translate,
                          "catalog",
                        )}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      {contest.tagline}
                    </div>

                    {contest.description ? (
                      <div className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {contest.description}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                      <ContestListCardDateRowCatalog>
                        {formatContestListDateRange(
                          contest.starts_at,
                          contest.ends_at,
                          translate,
                          "catalog",
                        )}
                      </ContestListCardDateRowCatalog>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ContestListMetricCellCatalog icon={Users}>
                          {t("catalog.item.registrationsCount", {
                            count: contest.metrics_snapshot.registrations_total,
                          })}
                        </ContestListMetricCellCatalog>
                        <ContestListMetricCellCatalog icon={Trophy}>
                          {t("catalog.item.submissionsCount", {
                            count: contest.metrics_snapshot.submissions_total,
                          })}
                        </ContestListMetricCellCatalog>
                      </div>
                    </div>

                    <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                      <div className="text-xs text-muted-foreground">
                        {contest.registration_deadline
                          ? t("catalog.registrationDeadlinePrefix", {
                              date: new Date(
                                contest.registration_deadline,
                              ).toLocaleDateString(intlLocale()),
                            })
                          : t("catalog.registrationNoLimit")}
                      </div>
                      <span className="text-sm font-medium text-primary group-hover:underline">
                        {t("catalog.viewContest")} →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </NavLink>
            );
          })
        )}
      </div>
    </div>
  );
}

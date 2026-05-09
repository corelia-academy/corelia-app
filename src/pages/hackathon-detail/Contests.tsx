import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasHackathonCoOrganizerAccess, listContests } from "@/lib/hackathons";
import { contestListImageUrl } from "@/lib/hackathonVisuals";
import { canAccessContestManagementCatalog, canManageContests } from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Contest } from "@/types/hackathons";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  contestListLocationLabel,
  contestListStatusLabel,
  formatContestListDateRange,
} from "@/features/hackathons/list/contestListFormatters";
import {
  ContestListCardDateRowCatalog,
  ContestListCardThumbnail,
  ContestListMetricCellCatalog,
} from "@/features/hackathons/list/ContestListCardPrimitives";
import { perfMeasureEnd, perfMeasureStart } from "@/lib/perfTelemetry";

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
  const { t, i18n } = useTranslation("contests");
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
  }, [translate, user?.id, retryToken, i18n.language]);

  const isManager = canManageContests(profile);
  const canManageCatalog = canAccessContestManagementCatalog(profile);
  const [canManageCatalogScoped, setCanManageCatalogScoped] = useState(false);

  useEffect(() => {
    if (!profile?.email) {
      setCanManageCatalogScoped(false);
      return;
    }
    if (canManageCatalog) {
      setCanManageCatalogScoped(true);
      return;
    }
    let cancelled = false;
    void hasHackathonCoOrganizerAccess(profile.email).then((ok) => {
      if (!cancelled) setCanManageCatalogScoped(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [canManageCatalog, profile?.email]);

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
    <div className="container-app py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
              {t("catalog.heroTitle")}
            </h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("catalog.statsSummary", {
              total: stats.total,
              accepting: stats.accepting,
              running: stats.running,
              ended: stats.ended,
            })}
            {showGrid && null}
            {showEmpty && null}
          </p>
        </div>
        {canManageCatalogScoped ? (
          <div className="flex flex-wrap gap-2">
            <Button
              render={<NavLink to="/hackathons/manage" />}
              nativeButton={false}
              size="sm"
              variant="outline"
              className="min-h-11"
            >
              {t("catalog.openWorkspace")}
            </Button>
          </div>
        ) : null}
      </div>

      {showError ? (
        <div
          className="mt-6 rounded-lg border border-destructive/25 bg-destructive-muted p-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-semibold text-foreground">
            {t("catalog.errorTitle")}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
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
          <p className="mt-3 text-xs text-foreground-muted">{error}</p>
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
                <div className="flex size-12 items-center justify-center rounded-full bg-surface-raised">
                  <Trophy
                    className="size-6 text-foreground-subtle"
                    aria-hidden
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("catalog.emptyTitle")}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {isManager
                      ? t("catalog.emptyDescriptionManager")
                      : t("catalog.emptyDescriptionUser")}
                  </p>
                </div>
                {isManager ? (
                  <Button
                    render={<NavLink to="/hackathons/manage" />}
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
            const contestSlug = contest.slug?.trim() || null;
            return (
              <NavLink
                key={contest.id}
                to={contestSlug ? `/hackathons/${contestSlug}/overview` : "/hackathons"}
                onClick={(e) => {
                  if (contestSlug) return;
                  e.preventDefault();
                  toast.error(t("catalog.missingSlug"));
                }}
                className="group block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${t("catalog.viewContest")}: ${contest.title}`}
              >
                <Card className="h-full overflow-hidden border-border-subtle transition-all duration-200 ease-out group-hover:border-border group-hover:bg-surface-raised group-hover:-translate-y-0.5">
                  <ContestListCardThumbnail
                    src={listImageUrl}
                    alt=""
                    aspectClassName="aspect-video"
                    surfaceClassName="bg-linear-to-br from-primary/12 via-surface-raised to-surface-raised"
                    emptyMinHeightClassName="min-h-28"
                    trophyIconClassName="size-14 text-primary/40"
                  />
                  <CardContent className="flex h-full flex-col p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-foreground-muted">
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
                      <span className="shrink-0 rounded-md bg-surface-raised px-2 py-0.5 text-xs font-medium text-foreground-muted">
                        {contestListLocationLabel(
                          contest.location,
                          translate,
                          "catalog",
                        )}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-foreground-muted">
                      {contest.tagline}
                    </div>

                    {contest.description ? (
                      <div className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground-muted">
                        {contest.description}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 text-xs text-foreground-muted">
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
                      <div className="text-xs text-foreground-muted">
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

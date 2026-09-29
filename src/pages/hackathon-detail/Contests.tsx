import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { ArrowUpRight, CalendarDays, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { contestListImageUrl } from "@/lib/hackathonVisuals";
import { canRegisterForContest } from "@/lib/hackathons";
import { canManageContests } from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Contest } from "@/types/hackathons";
import { formatPrizeAmount } from "./utils/formatPrizeAmount";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import {
  contestListLocationLabel,
  contestListStatusLabel,
  formatContestListDateRange,
} from "@/features/hackathons/list/contestListFormatters";

const EMPTY_CONTESTS: Contest[] = [];

function CatalogGridSkeleton() {
  return <>{Array.from({ length: 3 }).map((_, index) => (
    <div key={index} className="overflow-hidden rounded-2xl border border-border-subtle md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Skeleton className="aspect-[21/9] w-full rounded-none md:aspect-auto md:h-full" />
      <div className="space-y-3 p-4 sm:p-6"><Skeleton className="h-5 w-28" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-12 w-full" /><Skeleton className="h-9 w-40" /></div>
    </div>
  ))}</>;
}

export default function Contests() {
  const { t, i18n } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { profile } = useAuth();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const catalogQuery = useQuery(publicHackathonCatalogQueryOptions(locale));
  const items = catalogQuery.data ?? EMPTY_CONTESTS;
  const loading = catalogQuery.isPending;
  const error = catalogQuery.error
    ? catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : translate("catalog.loadErrorFallback")
    : null;

  const isManager = canManageContests(profile);
  const canManageCatalogScoped = isManager;

  const stats = useMemo(() => {
    const total = items.length;
    const accepting = items.filter(canRegisterForContest).length;
    const running = items.filter((item) => item.status === "running").length;
    const ended = items.filter((item) => item.status === "ended").length;
    return { total, accepting, running, ended };
  }, [items]);

  const showData = !loading && !error;
  const showEmpty = showData && items.length === 0;
  const showGrid = showData && items.length > 0;
  const showError = !loading && Boolean(error);

  return (
    <div className="container-app pb-5 pt-4 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-display-small sm:font-display">
              {t("catalog.heroTitle")}
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted sm:mt-3 sm:text-base">{t("catalog.heroDescription")}</p>
          {showData ? <p className="mt-3 text-xs text-foreground-muted sm:mt-4">{t("catalog.statsSummary", stats)}</p> : null}
        </div>
        {canManageCatalogScoped ? (
          <div className="flex flex-wrap gap-2">
            <Button
              render={<NavLink to="/admin/hackathons" />}
              nativeButton={false}
              size="small"
              variant="cta" hierarchy="secondary"
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
              onClick={() => void catalogQuery.refetch()}
            >
              {t("catalog.retry")}
            </Button>
          </div>
          <p className="mt-3 text-xs text-foreground-muted">{error}</p>
        </div>
      ) : null}

      <div
        className="mobile-bleed-grid grid gap-4 sm:gap-6"
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
          <Card className="w-full">
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
                    render={<NavLink to="/admin/hackathons" />}
                    nativeButton={false}
                    size="small"
                    variant="cta" hierarchy="secondary"
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
                <article className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base transition-[border-color,box-shadow] duration-200 group-hover:border-primary/30 group-hover:shadow-md md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden bg-surface-raised md:aspect-auto md:min-h-64">
                    {listImageUrl ? <img src={listImageUrl} alt="" className="absolute inset-0 size-full object-contain" /> : <Trophy className="size-12 text-primary/30" aria-hidden />}
                  </div>
                  <div className="flex min-w-0 flex-col p-4 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary"><span className="size-1.5 rounded-full bg-current" />{contestListStatusLabel(contest.status, translate, "catalog")}</span>
                      <span className="text-foreground-muted">{contestListLocationLabel(contest.mode ?? contest.location, translate, "catalog")}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">{contest.title}</h2>
                    {contest.short_description || contest.tagline ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground-muted sm:line-clamp-3">{contest.short_description || contest.tagline}</p> : null}
                    <div className="my-4 flex flex-wrap gap-x-6 gap-y-3">
                      {contest.prize_pool?.amount && Number(contest.prize_pool.amount) !== 0 ? <div className="min-w-0"><p className="text-xs text-foreground-muted">{t("public.prizes.total")}</p><p className="mt-1 text-lg font-semibold tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere]">{formatPrizeAmount(contest.prize_pool.amount, locale)} <span className="text-xs font-medium text-foreground-muted">{contest.prize_pool.currency}</span></p></div> : null}
                      {contest.host?.name ? <div className="min-w-0"><p className="text-xs text-foreground-muted">{t("public.hostedBy")}</p><p className="mt-1 break-words text-sm font-medium text-foreground">{contest.host.name}</p></div> : null}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground-muted">
                      {contest.registration_deadline ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" aria-hidden />{t("catalog.registrationDeadlinePrefix", { date: new Date(contest.registration_deadline).toLocaleDateString(locale) })}</span> : contest.starts_at || contest.ends_at ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" aria-hidden />{formatContestListDateRange(contest.starts_at, contest.ends_at, translate, "catalog")}</span> : null}
                      <span className="inline-flex items-center gap-1.5"><Users className="size-4 shrink-0" aria-hidden />{t("catalog.item.registrationsCount", { count: contest.participants_count ?? 0 })}</span>
                    </div>
                    <div className="mt-auto flex justify-end border-t border-border-subtle pt-3">
                      <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary group-hover:underline">{t("catalog.viewContest")}<ArrowUpRight className="size-4" aria-hidden /></span>
                    </div>
                  </div>
                </article>
              </NavLink>
            );
          })
        )}
      </div>
    </div>
  );
}

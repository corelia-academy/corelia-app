import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import {
  MapPin,
  Trophy,
  Calendar,
  CheckCheck,
  Rocket,
  Timer,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listContests } from "@/lib/contests";
import { contestListImageUrl } from "@/lib/contestVisuals";
import { canManageContests } from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Contest } from "@/types/contests";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";
import { AdminPreviewBar } from "@/components/contests/AdminPreviewBar";
import { perfMeasureEnd, perfMeasureStart } from "@/lib/perfTelemetry";

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

  const statusLabel = (status: Contest["status"]): string =>
    translate(`status.${status}`, { defaultValue: translate("status.unknown") });

  const locationLabel = (loc: Contest["location"]): string =>
    translate(`location.${loc}`, { defaultValue: translate("location.unknown") });

  const formatDateRange = (startsAt: string | null, endsAt: string | null): string => {
    if (!startsAt && !endsAt) return translate("catalog.dateRangeUnknown");
    if (startsAt && endsAt) {
      return `${new Date(startsAt).toLocaleDateString(intlLocale())} - ${new Date(
        endsAt,
      ).toLocaleDateString(intlLocale())}`;
    }
    if (startsAt) {
      return translate("catalog.dateStartPrefix", {
        date: new Date(startsAt).toLocaleDateString(intlLocale()),
      });
    }
    return translate("catalog.dateEndPrefix", {
      date: new Date(endsAt as string).toLocaleDateString(intlLocale()),
    });
  };

  useEffect(() => {
    let cancelled = false;
    perfMeasureStart("contests.catalog_wave");
    listContests(user ?? null)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : translate("catalog.loadErrorFallback"));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- translate stable via useCallback; user id gate
  }, [translate, user?.id]);

  const isManager = canManageContests(profile);

  const stats = useMemo(() => {
    const total = items.length;
    const accepting = items.filter((item) => item.status === "published").length;
    const running = items.filter((item) => item.status === "running").length;
    const ended = items.filter((item) => item.status === "ended").length;
    return { total, accepting, running, ended };
  }, [items]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {isManager ? (
        <AdminPreviewBar
          title={t("previewBar.catalogTitle")}
          primaryAction={{ label: t("previewBar.openOperations"), to: "/admin/contests" }}
        />
      ) : null}
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("catalog.heroEyebrow")}
            </div>
            <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
              {t("catalog.heroTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("catalog.heroDescription")}
            </p>
            {!loading ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("catalog.statsSummary", {
                  total: stats.total,
                  accepting: stats.accepting,
                  running: stats.running,
                  ended: stats.ended,
                })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
              {t("catalog.pillReviewed")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-2 text-xs font-medium text-foreground">
              {t("catalog.pillTeamBased")}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.total")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.total}
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
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.accepting")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.accepting}
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
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.running")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.running}
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
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.ended")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.ended}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Calendar className="size-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
              <Loader2 className="size-10 animate-spin text-muted-foreground/60" aria-hidden />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t("catalog.loadingTitle")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("catalog.loadingDescription")}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Trophy className="size-6 text-muted-foreground" aria-hidden />
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
                {isManager && (
                  <Button
                    render={<NavLink to="/admin/contests" />}
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                  >
                    {t("catalog.openWorkspace")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          items.map((contest) => {
            const listImageUrl = contestListImageUrl(contest);
            return (
            <Card
              key={contest.id}
              className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
            >
              <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-primary/12 via-muted to-muted">
                {listImageUrl ? (
                  <img
                    src={listImageUrl}
                    alt={translate("catalog.listCardImageAlt", { title: contest.title })}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[120px] items-center justify-center">
                    <Trophy className="size-14 text-primary/40" aria-hidden />
                  </div>
                )}
              </div>
              <CardContent className="flex h-full flex-col p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {statusLabel(contest.status)}
                    </div>
                    <div className="mt-1 text-lg font-medium leading-snug text-foreground">
                      {contest.title}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {locationLabel(contest.location)}
                  </span>
                </div>

                <div className="mt-2 text-sm text-muted-foreground">
                  {contest.tagline}
                </div>

                {contest.description && (
                  <div className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {contest.description}
                  </div>
                )}

                <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2">
                    <Calendar className="size-4" aria-hidden />
                    <span>{formatDateRange(contest.starts_at, contest.ends_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2">
                    <MapPin className="size-4" />
                    <span>
                      {t("catalog.item.formatPrefix", {
                        format: locationLabel(contest.location),
                      })}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border-subtle bg-background px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Users className="size-4" aria-hidden />
                        <span>
                          {t("catalog.item.registrationsCount", {
                            count: contest.metrics_snapshot.registrations_total,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-background px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="size-4" />
                        <span>
                          {t("catalog.item.submissionsCount", {
                            count: contest.metrics_snapshot.submissions_total,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {contest.registration_deadline
                      ? t("catalog.registrationDeadlinePrefix", {
                          date: new Date(
                            contest.registration_deadline,
                          ).toLocaleDateString(intlLocale()),
                        })
                      : t("catalog.registrationNoLimit")}
                  </div>
                  <Button
                    render={<NavLink to={`/contests/${contest.id}/overview`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    {t("catalog.viewContest")}
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import {
  CalendarBlank,
  Checks,
  ClockCountdown,
  MapPin,
  RocketLaunch,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listContests } from "@/lib/contests";
import { canManageContests } from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Contest } from "@/types/contests";
import { intlLocale } from "@/lib/intl";
import { useTranslation } from "react-i18next";

export default function Contests() {
  const { t } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(t(key as never, options as never)),
    [t],
  );
  const { profile } = useAuth();
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
    listContests()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : translate("catalog.loadErrorFallback"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [translate]);

  const isManager = canManageContests(profile);

  const stats = useMemo(() => {
    const total = items.length;
    const accepting = items.filter((item) => item.status === "published").length;
    const running = items.filter((item) => item.status === "running").length;
    const ended = items.filter((item) => item.status === "ended").length;
    return { total, accepting, running, ended };
  }, [items]);
  const featured = items[0] ?? null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <section className="rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {t("catalog.heroEyebrow")}
            </div>
            <h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
              {t("catalog.heroTitle")}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {t("catalog.heroDescription")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {t("catalog.pillReviewed")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground">
              {t("catalog.pillTeamBased")}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border-subtle bg-card p-5 shadow-card sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              {t("catalog.howItWorksEyebrow")}
            </div>
            <h2 className="mt-2 text-xl font-normal tracking-tight text-foreground">
              {t("catalog.sectionWhyTitle")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
              {t("catalog.howItWorksDescription")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              t("catalog.whyBullets.reviewFirst"),
              t("catalog.whyBullets.realJourney"),
              t("catalog.whyBullets.ecosystem"),
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-border-subtle bg-background p-4 text-[13px] leading-6 text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.total")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.total}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RocketLaunch className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.accepting")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.accepting}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Checks className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.running")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.running}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClockCountdown className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("catalog.stats.ended")}
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {loading ? "..." : stats.ended}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarBlank className="size-5" weight="duotone" />
            </div>
          </div>
        </div>
      </div>

      {featured && !loading && (
        <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("catalog.featuredEyebrow")}
                  </div>
                  <h2 className="mt-2 text-xl font-normal tracking-tight text-foreground">
                    {featured.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
                    {featured.tagline}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground">
                  {statusLabel(featured.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("catalog.featured.schedule")}
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {formatDateRange(featured.starts_at, featured.ends_at)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("catalog.featured.format")}
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {locationLabel(featured.location)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("catalog.featured.registrations")}
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {t("catalog.featured.registrationsCount", {
                      count: featured.metrics_snapshot.registrations_total,
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("catalog.featured.submissions")}
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {t("catalog.featured.submissionsCount", {
                      count: featured.metrics_snapshot.submissions_total,
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  render={<NavLink to={`/contests/${featured.id}`} />}
                  nativeButton={false}
                >
                  Xem cuộc thi
                </Button>
                {isManager && (
                  <Button
                    render={<NavLink to={`/instructor/contests/${featured.id}/manage`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    Mở khu vực vận hành
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Cách tham gia
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-sm font-medium text-foreground">1. Đăng ký</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                    Cá nhân hoặc đội gửi hồ sơ và chờ Corelia xét duyệt.
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-sm font-medium text-foreground">2. Tham gia & nộp bài</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                    Chỉ các đội đã được duyệt mới mở được khu submission và tài nguyên contest.
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-sm font-medium text-foreground">3. Chấm & công bố</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted-foreground">
                    {t("catalog.sidebar.leaderboardHint")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
              <div className="text-[15px] font-medium text-foreground">
                {t("catalog.loadingTitle")}
              </div>
              <div className="mt-1.5 text-sm text-muted-foreground">
                {t("catalog.loadingDescription")}
              </div>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center">
              <div className="text-[15px] font-medium text-foreground">
                {t("catalog.emptyTitle")}
              </div>
              <div className="mt-1.5 text-sm text-muted-foreground">
                {isManager
                  ? t("catalog.emptyDescriptionManager")
                  : t("catalog.emptyDescriptionUser")}
              </div>
              {isManager && (
                <Button
                  render={<NavLink to="/instructor/contests" />}
                  nativeButton={false}
                  variant="ghost"
                  className="mt-3 -ml-2 w-fit text-foreground hover:bg-muted"
                >
                  {t("catalog.openWorkspace")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          items.map((contest) => (
            <Card
              key={contest.id}
              className="overflow-hidden transition-[box-shadow,border-color] hover:border-border hover:shadow-elevation-2"
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] text-muted-foreground">
                      {statusLabel(contest.status)}
                    </div>
                    <div className="mt-1 text-[18px] font-medium leading-snug text-foreground">
                      {contest.title}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {locationLabel(contest.location)}
                  </span>
                </div>

                <div className="mt-2.5 text-[14px] text-muted-foreground">
                  {contest.tagline}
                </div>

                {contest.description && (
                  <div className="mt-3 line-clamp-3 text-[13px] leading-6 text-muted-foreground">
                    {contest.description}
                  </div>
                )}

                <div className="mt-4 grid gap-2 text-[12px] text-muted-foreground">
                  <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background px-3 py-2">
                    <CalendarBlank className="size-4" />
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
                        <UsersThree className="size-4" />
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
                  <div className="text-[12px] text-muted-foreground">
                    {contest.registration_deadline
                      ? t("catalog.registrationDeadlinePrefix", {
                          date: new Date(
                            contest.registration_deadline,
                          ).toLocaleDateString(intlLocale()),
                        })
                      : t("catalog.registrationNoLimit")}
                  </div>
                  <Button
                    render={<NavLink to={`/contests/${contest.id}`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    {t("catalog.viewDetails")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

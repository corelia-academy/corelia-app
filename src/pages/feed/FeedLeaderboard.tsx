import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { XpRankBadge } from "@/features/xp/XpRankBadge";
import { xpLeaderboardQuery } from "@/features/xp/xpQueries";
import { useXpWeek } from "@/features/xp/useXpWeek";
import type { XpPeriod } from "@/lib/xpLeaderboard";
import { useAuth } from "@/stores/authStore";

export default function FeedLeaderboard() {
  const { t } = useTranslation("account");
  const { user } = useAuth();
  const [period, setPeriod] = useState<XpPeriod>("week");
  const week = useXpWeek();
  return <section className="space-y-5" aria-label={t("xp.leaderboard.title")}>
    <header><h2 className="flex items-center gap-2 text-lg font-semibold"><Trophy className="size-5 shrink-0 text-primary" aria-hidden />{t("xp.leaderboard.title")}</h2><p className="mt-2 text-sm text-foreground-muted">{t("xp.leaderboard.description")}</p></header>
    <Tabs.Root value={period} onValueChange={value => { if (value === "week" || value === "all_time") setPeriod(value); }}>
      <Tabs.List activateOnFocus level="2a" aria-label={t("xp.leaderboard.period")}>
        <Tabs.Tab value="week">{t("xp.leaderboard.week")}</Tabs.Tab>
        <Tabs.Tab value="all_time">{t("xp.leaderboard.allTime")}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={period} className="pt-5">
        <LeaderboardResults key={`${user?.id}:${period}:${period === "week" ? week : "all"}`} userId={user?.id ?? ""} period={period} week={week} />
      </Tabs.Panel>
    </Tabs.Root>
  </section>;
}

function LeaderboardResults({ userId, period, week }: { userId: string; period: XpPeriod; week: string }) {
  const { t, i18n } = useTranslation("account");
  const query = useQuery(xpLeaderboardQuery(userId, period, week));
  const [requestedPage, setPage] = useState(0);
  const format = (value: number) => new Intl.NumberFormat(i18n.language).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
  if (query.isPending) return <div aria-label={t("xp.loading")} className="space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  // Never keep showing a possibly private identity after a failed eligibility refresh.
  if (query.isError) return <div role="alert" className="rounded-xl border border-border-subtle p-5"><p>{t("xp.leaderboard.error")}</p><Button type="button" variant="outline" className="mt-3" onClick={() => void query.refetch()}>{t("profile.retry")}</Button></div>;
  const data = query.data;
  const maxPage = Math.max(0, Math.ceil(data.rows.length / 20) - 1);
  const page = Math.min(requestedPage, maxPage);
  const rows = data.rows.slice(page * 20, (page + 1) * 20);
  return <div className="space-y-5">
    <p className="text-sm text-foreground-muted">{period === "week" && data.period_start && data.period_end
      ? t("xp.leaderboard.weekRange", { start: date(data.period_start), end: date(new Date(new Date(data.period_end).getTime() - 1).toISOString()) })
      : t("xp.leaderboard.lifetime")}</p>
    <section className="rounded-xl border border-border-subtle bg-surface-base p-4" aria-label={t("xp.leaderboard.yourPosition")}>
      <h2 className="font-semibold">{t("xp.leaderboard.yourPosition")}</h2>
      {data.viewer.reason ? <p className="mt-2 text-sm text-foreground-muted">{t(`xp.leaderboard.reasons.${data.viewer.reason}`)}</p>
        : <p className="mt-2 text-lg font-semibold tabular-nums">#{format(data.viewer.position!)} <span className="text-sm font-normal">· {format(data.viewer.period_xp!)} XP</span></p>}
      <div className="mt-2"><XpRankBadge total={data.viewer.total_xp} /></div>
    </section>
    {rows.length === 0 ? <p className="rounded-xl border border-border-subtle p-8 text-center text-foreground-muted">{t("xp.leaderboard.empty")}</p> : <>
      <p className="text-sm text-foreground-muted">{t("xp.leaderboard.top", { count: data.rows.length, eligible: format(data.eligible_count) })}</p>
      <ol start={page * 20 + 1} aria-label={t("xp.leaderboard.title")} className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-base">
        {rows.map(person => {
          const name = person.full_name?.trim() || person.username || person.ocid || t("xp.leaderboard.member");
          const handle = person.username || person.ocid || person.id;
          return <li key={person.id} className={`flex items-center gap-3 p-3 sm:gap-4 sm:p-4 ${person.id === userId ? "bg-primary/5" : ""}`}>
            <span className="w-10 shrink-0 text-center text-sm font-semibold tabular-nums" aria-label={t("xp.leaderboard.position", { rank: person.position })}>#{format(person.position)}</span>
            <NavLink to={`/@${handle}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2">
              <UserAvatar userId={person.id} avatarUrl={person.avatar_url} avatarSeed={person.avatar_seed} avatarConfig={person.avatar_config} alt={name} fallback={name[0]?.toUpperCase() ?? "C"} className="size-10 shrink-0" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{name}</span><XpRankBadge total={person.total_xp} className="mt-1" /></span>
            </NavLink>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{format(person.period_xp)}<span className="block text-xs font-normal text-foreground-muted">XP</span></span>
          </li>;
        })}
      </ol>
      {maxPage > 0 && <nav aria-label={t("xp.leaderboard.pagination")} className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("xp.previous")}</Button>
        <span role="status" className="text-sm">{t("xp.leaderboard.page", { page: page + 1, total: maxPage + 1 })}</span>
        <Button type="button" variant="outline" size="sm" disabled={page === maxPage} onClick={() => setPage(page + 1)}>{t("xp.next")}</Button>
      </nav>}
    </>}
    <p className="text-xs text-foreground-muted">{t("xp.rank.description")}</p>
  </div>;
}

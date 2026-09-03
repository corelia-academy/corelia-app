import { useQuery } from "@tanstack/react-query";
import { BarChart3, BriefcaseBusiness, Globe2, Sparkles, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { humanizeJobSlug } from "@/features/jobs/jobFormat";
import { JobsNav } from "@/features/jobs/JobsNav";
import { jobMarketQueryOptions } from "@/features/jobs/jobQueries";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { MarketDailyStat, MarketDimensionStat } from "@/types/jobs";

type Dimension = "role" | "skill" | "domain" | "seniority";

function dimensionLink(field: Dimension, value: string): string {
  if (field === "role") return `/jobs/market/roles/${encodeURIComponent(value)}`;
  if (field === "skill") return `/jobs/market/skills/${encodeURIComponent(value)}`;
  if (field === "domain") return `/jobs/domains/${encodeURIComponent(value)}`;
  return `/jobs?seniority=${encodeURIComponent(value)}`;
}

function StatList({ rows, field, total }: { rows: MarketDimensionStat[]; field: Dimension; total: number }) {
  return <div className="space-y-3">{rows.slice(0, 8).map((row) => {
    const value = String(row[field] ?? "");
    const count = Number(row.active_jobs ?? 0);
    return <Link key={value} to={dimensionLink(field, value)} className="block rounded-lg p-2 hover:bg-surface-raised"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{humanizeJobSlug(value)}</span><span className="text-foreground-muted">{count.toLocaleString()}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, total ? count / total * 100 : 0)}%` }} /></div></Link>;
  })}</div>;
}

function ActivityChart({ rows }: { rows: MarketDailyStat[] }) {
  const { t } = useTranslation("jobs");
  const visible = rows.slice(-30);
  const max = Math.max(1, ...visible.map((row) => Math.max(row.new_jobs, row.expired_jobs)));
  return <div><div className="flex h-40 items-end gap-1" role="img" aria-label={t("market.activityDescription")}>{visible.map((row) => <div key={row.date} className="flex min-w-0 flex-1 items-end gap-px" title={`${row.date}: +${row.new_jobs} / -${row.expired_jobs}`}><span className="min-h-px flex-1 rounded-t-sm bg-primary" style={{ height: `${Math.max(2, row.new_jobs / max * 100)}%` }} /><span className="min-h-px flex-1 rounded-t-sm bg-destructive/60" style={{ height: `${Math.max(2, row.expired_jobs / max * 100)}%` }} /></div>)}</div><div className="mt-3 flex gap-4 text-xs text-foreground-muted"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-primary" />{t("market.newJobs")}</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-destructive/60" />{t("market.expiredJobs")}</span></div></div>;
}

function growthRows(rows: MarketDimensionStat[], field: "role" | "skill") {
  const dates = Array.from(new Set(rows.map((row) => row.date))).sort();
  if (dates.length < 14) return [];
  const currentDates = new Set(dates.slice(-7));
  const previousDates = new Set(dates.slice(-14, -7));
  const totals = new Map<string, { current: number; previous: number }>();
  for (const row of rows) {
    const key = String(row[field] ?? "");
    if (!key) continue;
    const value = totals.get(key) ?? { current: 0, previous: 0 };
    if (currentDates.has(row.date)) value.current += row.comparable_new_jobs;
    if (previousDates.has(row.date)) value.previous += row.comparable_new_jobs;
    totals.set(key, value);
  }
  return Array.from(totals, ([value, totalsForValue]) => ({
    value,
    ...totalsForValue,
    delta: totalsForValue.current - totalsForValue.previous,
  })).filter((row) => row.delta !== 0).sort((a, b) => b.delta - a.delta || b.current - a.current).slice(0, 8);
}

function GrowthList({ rows, field }: { rows: MarketDimensionStat[]; field: "role" | "skill" }) {
  const { t } = useTranslation("jobs");
  const growth = growthRows(rows, field);
  if (!growth.length) return <p className="py-8 text-center text-sm text-foreground-muted">{t("market.growthPending")}</p>;
  return <div className="space-y-2">{growth.map((row) => <Link key={row.value} to={dimensionLink(field, row.value)} className="flex items-center justify-between rounded-lg p-2 text-sm hover:bg-surface-raised"><span className="font-medium">{humanizeJobSlug(row.value)}</span><span className={row.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{row.delta > 0 ? "+" : ""}{row.delta}</span></Link>)}</div>;
}

export default function JobMarketPage() {
  const { t } = useTranslation("jobs");
  const query = useQuery(jobMarketQueryOptions(90));
  const snapshot = query.data;
  const latest = snapshot?.latest;
  const remoteShare = latest?.active_jobs ? Math.round(latest.remote_jobs / latest.active_jobs * 100) : 0;
  const pageUrl = typeof window === "undefined" ? "https://app.corelia.academy/jobs/market" : `${window.location.origin}/jobs/market`;
  usePageMeta({ title: t("market.title"), description: t("market.subtitle"), url: pageUrl, canonicalUrl: pageUrl, robots: "index,follow" });
  const cards = [
    [t("market.cards.active"), latest?.active_jobs ?? 0, BriefcaseBusiness, "/jobs"],
    [t("market.cards.new"), latest?.new_jobs ?? 0, Sparkles, "/jobs?days=1"],
    [t("market.cards.remote"), `${remoteShare}%`, Globe2, "/jobs/market/remote"],
    [t("market.cards.entry"), latest?.entry_level_jobs ?? 0, UsersRound, "/jobs/market/entry-level"],
  ] as const;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><JobsNav /><header className="mt-6"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><BarChart3 className="size-4" aria-hidden />{t("market.eyebrow")}</div><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("market.title")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">{t("market.subtitle")}</p></header>{query.isPending ? <div className="mt-6 h-80 animate-pulse rounded-2xl bg-surface-raised" /> : !latest ? <Card className="mt-6"><CardContent className="p-12 text-center"><BarChart3 className="mx-auto size-8 text-foreground-subtle" aria-hidden /><h2 className="mt-3 font-semibold">{t("market.empty.title")}</h2><p className="mt-1 text-sm text-foreground-muted">{t("market.empty.description")}</p></CardContent></Card> : <><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon, href]) => <Link key={label} to={href}><Card className="h-full transition-colors hover:bg-surface-raised"><CardContent className="p-5"><Icon className="size-5 text-primary" aria-hidden /><p className="mt-4 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p><p className="mt-1 text-sm text-foreground-muted">{label}</p>{label === t("market.cards.remote") ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-primary" style={{ width: `${remoteShare}%` }} /></div> : null}</CardContent></Card></Link>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.activity")}</h2><div className="mt-4"><ActivityChart rows={snapshot.daily} /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.seniorityMix")}</h2><div className="mt-3"><StatList rows={snapshot.seniorities} field="seniority" total={latest.active_jobs} /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.topRoles")}</h2><div className="mt-3"><StatList rows={snapshot.roles} field="role" total={latest.active_jobs} /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.roleGrowth")}</h2><div className="mt-3"><GrowthList rows={snapshot.roleHistory} field="role" /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.topSkills")}</h2><div className="mt-3"><StatList rows={snapshot.skills} field="skill" total={latest.active_jobs} /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.skillGrowth")}</h2><div className="mt-3"><GrowthList rows={snapshot.skillHistory} field="skill" /></div></CardContent></Card><Card className="lg:col-span-2"><CardContent className="p-5"><h2 className="font-semibold">{t("market.topDomains")}</h2><div className="mt-3 grid gap-x-5 md:grid-cols-2"><StatList rows={snapshot.domains} field="domain" total={latest.active_jobs} /></div></CardContent></Card></div><p className="mt-5 text-xs text-foreground-subtle">{t("market.disclaimer")}</p></>}</div>;
}

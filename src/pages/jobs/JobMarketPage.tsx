import { useQuery } from "@tanstack/react-query";
import { BarChart3, BriefcaseBusiness, Globe2, Sparkles, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { humanizeJobSlug } from "@/features/jobs/jobFormat";
import { JobsNav } from "@/features/jobs/JobsNav";
import { jobMarketQueryOptions } from "@/features/jobs/jobQueries";

function StatList({ rows, field, total }: { rows: Array<Record<string, unknown>>; field: "role" | "skill" | "domain"; total: number }) {
  return <div className="space-y-3">{rows.slice(0, 8).map((row) => { const value = String(row[field] ?? ""); const count = Number(row.active_jobs ?? 0); return <Link key={value} to={`/jobs?${field}=${encodeURIComponent(value)}`} className="block rounded-lg p-2 hover:bg-surface-raised"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{humanizeJobSlug(value)}</span><span className="text-foreground-muted">{count.toLocaleString()}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, total ? count / total * 100 : 0)}%` }} /></div></Link>; })}</div>;
}

export default function JobMarketPage() {
  const { t } = useTranslation("jobs");
  const query = useQuery(jobMarketQueryOptions(90));
  const snapshot = query.data;
  const latest = snapshot?.latest;
  const remoteShare = latest?.active_jobs ? Math.round(latest.remote_jobs / latest.active_jobs * 100) : 0;
  const cards = [
    [t("market.cards.active"), latest?.active_jobs ?? 0, BriefcaseBusiness],
    [t("market.cards.new"), latest?.new_jobs ?? 0, Sparkles],
    [t("market.cards.remote"), `${remoteShare}%`, Globe2],
    [t("market.cards.entry"), latest?.entry_level_jobs ?? 0, UsersRound],
  ] as const;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><JobsNav /><header className="mt-6"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><BarChart3 className="size-4" aria-hidden />{t("market.eyebrow")}</div><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("market.title")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">{t("market.subtitle")}</p></header>{query.isPending ? <div className="mt-6 h-80 animate-pulse rounded-2xl bg-surface-raised" /> : !latest ? <Card className="mt-6"><CardContent className="p-12 text-center"><BarChart3 className="mx-auto size-8 text-foreground-subtle" aria-hidden /><h2 className="mt-3 font-semibold">{t("market.empty.title")}</h2><p className="mt-1 text-sm text-foreground-muted">{t("market.empty.description")}</p></CardContent></Card> : <><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-5"><Icon className="size-5 text-primary" aria-hidden /><p className="mt-4 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p><p className="mt-1 text-sm text-foreground-muted">{label}</p></CardContent></Card>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-3"><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.topRoles")}</h2><div className="mt-3"><StatList rows={snapshot?.roles as Array<Record<string, unknown>>} field="role" total={latest.active_jobs} /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.topSkills")}</h2><div className="mt-3"><StatList rows={snapshot?.skills as Array<Record<string, unknown>>} field="skill" total={latest.active_jobs} /></div></CardContent></Card><Card><CardContent className="p-5"><h2 className="font-semibold">{t("market.topDomains")}</h2><div className="mt-3"><StatList rows={snapshot?.domains as Array<Record<string, unknown>>} field="domain" total={latest.active_jobs} /></div></CardContent></Card></div><p className="mt-5 text-xs text-foreground-subtle">{t("market.disclaimer")}</p></>}</div>;
}

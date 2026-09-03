import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Building2, Check, Database, Loader2, Play, Plus, RefreshCw, ServerCog, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { humanizeJobSlug } from "@/features/jobs/jobFormat";
import {
  adminCrawlerRunsQueryOptions,
  adminJobCompaniesQueryOptions,
  adminJobsQueryOptions,
  adminJobSourcesQueryOptions,
  jobKeys,
  jobMarketQueryOptions,
} from "@/features/jobs/jobQueries";
import {
  refreshJobsAnalytics,
  reviewJob,
  runJobsTarget,
  saveJobCompanyAdmin,
  updateJobSourceAdmin,
} from "@/lib/jobs";
import { useAuth } from "@/stores/authStore";

const sections = [
  ["", "admin.nav.overview", Database],
  ["review", "admin.nav.review", Check],
  ["sources", "admin.nav.sources", ServerCog],
  ["companies", "admin.nav.companies", Building2],
  ["crawlers", "admin.nav.crawlers", Play],
  ["analytics", "admin.nav.analytics", BarChart3],
] as const;
const SELECT_CLASS = "h-9 rounded-md border border-border-subtle bg-surface-base px-3 text-sm outline-none focus:border-primary";

export default function AdminJobsPage() {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const section = location.pathname.replace(/^\/admin\/jobs\/?/, "").split("/")[0] || "";
  const jobsQuery = useQuery(adminJobsQueryOptions(user?.id, section === "review" ? "review" : ""));
  const sourcesQuery = useQuery(adminJobSourcesQueryOptions(user?.id));
  const companiesQuery = useQuery(adminJobCompaniesQueryOptions(user?.id));
  const runsQuery = useQuery(adminCrawlerRunsQueryOptions(user?.id));
  const marketQuery = useQuery(jobMarketQueryOptions(90));
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: jobKeys.admin }),
      queryClient.invalidateQueries({ queryKey: jobKeys.all }),
    ]);
  };
  const runMutation = useMutation({
    mutationFn: ({ type, value }: { type: "company" | "source" | "adapter" | "all"; value?: string }) => runJobsTarget(type, value),
    onSuccess: async (result) => {
      if (Number(result.companies ?? 0) === 0) toast.warning(t("admin.messages.noEligibleCompanies"));
      else toast.success(t("admin.messages.runComplete"));
      await invalidate();
    },
    onError: () => toast.error(t("admin.messages.actionFailed")),
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "rejected" }) => reviewJob(id, status),
    onSuccess: async () => { toast.success(t("admin.messages.saved")); await invalidate(); },
    onError: () => toast.error(t("admin.messages.actionFailed")),
  });
  const sourceMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateJobSourceAdmin(id, { enabled }),
    onSuccess: invalidate,
    onError: () => toast.error(t("admin.messages.actionFailed")),
  });
  const analyticsMutation = useMutation({
    mutationFn: refreshJobsAnalytics,
    onSuccess: async () => { toast.success(t("admin.messages.analyticsRefreshed")); await invalidate(); },
    onError: () => toast.error(t("admin.messages.actionFailed")),
  });
  const loading = jobsQuery.isPending || sourcesQuery.isPending || companiesQuery.isPending || runsQuery.isPending;
  return <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"><header><h1 className="text-2xl font-bold tracking-tight">{t("admin.title")}</h1><p className="mt-1 text-sm text-foreground-muted">{t("admin.subtitle")}</p></header><nav className="mt-5 flex gap-1 overflow-x-auto rounded-lg border border-border-subtle bg-surface-base p-1">{sections.map(([path, key, Icon]) => <Link key={path} to={`/admin/jobs${path ? `/${path}` : ""}`} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${section === path ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface-raised"}`}><Icon className="size-4" aria-hidden />{t(key)}</Link>)}</nav>{loading ? <div className="mt-8 flex items-center gap-2 text-sm text-foreground-muted"><Loader2 className="size-4 animate-spin" aria-hidden />{t("admin.loading")}</div> : <div className="mt-6">{section === "review" ? <ReviewSection jobs={jobsQuery.data ?? []} busy={reviewMutation.isPending} onReview={(id, status) => reviewMutation.mutate({ id, status })} /> : section === "sources" ? <SourcesSection sources={sourcesQuery.data ?? []} busy={sourceMutation.isPending || runMutation.isPending} onToggle={(id, enabled) => sourceMutation.mutate({ id, enabled })} onRun={(id) => runMutation.mutate({ type: "source", value: id })} /> : section === "companies" ? <CompaniesSection companies={companiesQuery.data ?? []} busy={runMutation.isPending} onRun={(id) => runMutation.mutate({ type: "company", value: id })} onSaved={invalidate} /> : section === "crawlers" ? <RunsSection runs={runsQuery.data ?? []} onRunAll={() => runMutation.mutate({ type: "all" })} busy={runMutation.isPending} /> : section === "analytics" ? <AnalyticsSection snapshot={marketQuery.data} busy={analyticsMutation.isPending} onRefresh={() => analyticsMutation.mutate()} /> : <OverviewSection jobs={jobsQuery.data ?? []} sources={sourcesQuery.data ?? []} companies={companiesQuery.data ?? []} runs={runsQuery.data ?? []} onRunAll={() => runMutation.mutate({ type: "all" })} busy={runMutation.isPending} />}</div>}</div>;
}

function OverviewSection({ jobs, sources, companies, runs, onRunAll, busy }: { jobs: Array<{ status: string }>; sources: unknown[]; companies: unknown[]; runs: Array<{ status: string }>; onRunAll: () => void; busy: boolean }) {
  const { t } = useTranslation("jobs");
  const cards = [[t("admin.overview.active"), jobs.filter((job) => job.status === "active").length], [t("admin.overview.review"), jobs.filter((job) => job.status === "review").length], [t("admin.overview.companies"), companies.length], [t("admin.overview.sources"), sources.length], [t("admin.overview.failedRuns"), runs.filter((run) => run.status === "failed").length]];
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-sm text-foreground-muted">{label}</p></CardContent></Card>)}</div><Button type="button" className="mt-5" disabled={busy} onClick={onRunAll}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}{t("admin.actions.runAll")}</Button></>;
}

function ReviewSection({ jobs, busy, onReview }: { jobs: Array<{ id: string; title: string; company_name: string; summary: string | null; primary_role: string | null; domains: string[]; required_skills: string[]; classification_confidence: number | null; review_reason: string | null }>; busy: boolean; onReview: (id: string, status: "active" | "rejected") => void }) {
  const { t } = useTranslation("jobs");
  return jobs.length ? <div className="grid gap-4 lg:grid-cols-2">{jobs.map((job) => <Card key={job.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{job.title}</h2><p className="mt-1 text-sm text-foreground-muted">{job.company_name}</p></div><span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{Math.round((job.classification_confidence ?? 0) * 100)}%</span></div>{job.summary ? <p className="mt-4 text-sm leading-6 text-foreground-muted">{job.summary}</p> : null}<div className="mt-3 flex flex-wrap gap-1.5">{[job.primary_role, ...job.domains, ...job.required_skills].filter(Boolean).slice(0, 8).map((value) => <span key={value} className="rounded-full bg-surface-raised px-2 py-1 text-xs">{humanizeJobSlug(value)}</span>)}</div><p className="mt-4 text-xs text-foreground-subtle">{t("admin.review.reason")}: {job.review_reason || "—"}</p><div className="mt-4 flex gap-2"><Button type="button" disabled={busy} onClick={() => onReview(job.id, "active")}><Check className="size-4" aria-hidden />{t("admin.actions.publish")}</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => onReview(job.id, "rejected")}><X className="size-4" aria-hidden />{t("admin.actions.reject")}</Button></div></CardContent></Card>)}</div> : <p className="rounded-xl border border-border-subtle bg-surface-base p-10 text-center text-sm text-foreground-muted">{t("admin.review.empty")}</p>;
}

function SourcesSection({ sources, busy, onToggle, onRun }: { sources: Array<{ id: string; name: string; source_type: string; enabled: boolean; default_crawl_hours: number; policy_reviewed_at: string | null; last_success_at: string | null; last_error: string | null }>; busy: boolean; onToggle: (id: string, enabled: boolean) => void; onRun: (id: string) => void }) {
  const { t } = useTranslation("jobs");
  return <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border-subtle bg-surface-raised"><tr>{(["source", "type", "cadence", "policy", "lastRun", "status", "actions"] as const).map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`admin.columns.${key}`)}</th>)}</tr></thead><tbody>{sources.map((source) => <tr key={source.id} className="border-b border-border-subtle last:border-0"><td className="px-4 py-3 font-medium">{source.name}</td><td className="px-4 py-3">{source.source_type}</td><td className="px-4 py-3">{source.default_crawl_hours}h</td><td className="px-4 py-3">{source.policy_reviewed_at ? "✓" : "—"}</td><td className="px-4 py-3 text-foreground-muted">{source.last_success_at ? new Date(source.last_success_at).toLocaleString() : "—"}</td><td className="px-4 py-3">{source.last_error ? <span className="text-destructive">{t("admin.status.error")}</span> : source.enabled ? t("admin.status.enabled") : t("admin.status.disabled")}</td><td className="space-x-2 px-4 py-3"><Button type="button" size="sm" variant="outline" disabled={busy || !source.enabled} onClick={() => onRun(source.id)}>{t("admin.actions.run")}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onToggle(source.id, !source.enabled)}>{source.enabled ? t("admin.actions.disable") : t("admin.actions.enable")}</Button></td></tr>)}</tbody></table></div>;
}

function CompaniesSection({ companies, busy, onRun, onSaved }: { companies: Array<{ id: string; name: string; slug: string; source_type: string; source_identifier: string; source_region: string; domains: string[]; verified: boolean; active: boolean; last_success_at: string | null; last_error: string | null }>; busy: boolean; onRun: (id: string) => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation("jobs");
  const [showForm, setShowForm] = useState(false);
  const saveMutation = useMutation({ mutationFn: saveJobCompanyAdmin, onSuccess: async () => { setShowForm(false); toast.success(t("admin.messages.saved")); await onSaved(); }, onError: () => toast.error(t("admin.messages.actionFailed")) });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name") ?? "").trim(); const slug = String(form.get("slug") ?? "").trim(); const source_type = String(form.get("source_type") ?? "").trim(); const source_identifier = String(form.get("source_identifier") ?? "").trim(); if (!name || !slug || !source_type || !source_identifier) return; saveMutation.mutate({ name, slug, source_type, source_identifier, source_region: String(form.get("source_region") ?? "global"), domains: String(form.get("domains") ?? "").split(",").map((value) => value.trim()).filter(Boolean), verified: form.get("verified") === "on", active: true }); };
  return <>{showForm ? <Card className="mb-5"><CardContent className="p-5"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}><Input name="name" required placeholder={t("admin.company.name")} /><Input name="slug" required placeholder={t("admin.company.slug")} /><select name="source_type" className={SELECT_CLASS}>{["greenhouse", "lever", "ashby", "smartrecruiters"].map((value) => <option key={value} value={value}>{value}</option>)}</select><Input name="source_identifier" required placeholder={t("admin.company.identifier")} /><select name="source_region" className={SELECT_CLASS}><option value="global">Global</option><option value="eu">EU</option></select><Input name="domains" placeholder={t("admin.company.domains")} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" />{t("admin.company.verified")}</label><div className="flex gap-2"><Button type="submit" disabled={saveMutation.isPending}>{t("admin.actions.save")}</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t("admin.actions.cancel")}</Button></div></form></CardContent></Card> : <Button type="button" className="mb-5" onClick={() => setShowForm(true)}><Plus className="size-4" aria-hidden />{t("admin.company.add")}</Button>}<div className="grid gap-4 lg:grid-cols-2">{companies.map((company) => <Card key={company.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{company.name}</h2><p className="mt-1 text-sm text-foreground-muted">{company.source_type} · {company.source_identifier}</p></div><span className={`rounded-full px-2 py-1 text-xs ${company.active && company.verified ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-surface-raised text-foreground-muted"}`}>{company.verified ? t("admin.company.verified") : t("admin.company.unverified")}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{company.domains.map((domain) => <span key={domain} className="rounded-full bg-surface-raised px-2 py-1 text-xs">{humanizeJobSlug(domain)}</span>)}</div><p className="mt-3 text-xs text-foreground-muted">{company.last_error || (company.last_success_at ? new Date(company.last_success_at).toLocaleString() : t("admin.company.neverRun"))}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || !company.active} onClick={() => onRun(company.id)}><Play className="size-4" aria-hidden />{t("admin.actions.run")}</Button><Button type="button" size="sm" variant="ghost" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...company, verified: !company.verified })}>{company.verified ? t("admin.actions.unverify") : t("admin.actions.verify")}</Button><Button type="button" size="sm" variant="ghost" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...company, active: !company.active })}>{company.active ? t("admin.actions.disable") : t("admin.actions.enable")}</Button></div></CardContent></Card>)}</div></>;
}

function RunsSection({ runs, onRunAll, busy }: { runs: Array<{ id: string; status: string; trigger_type: string; target_type: string; started_at: string; fetched_count: number; published_count: number; review_count: number; rejected_count: number; failed_count: number; error_message: string | null }>; onRunAll: () => void; busy: boolean }) {
  const { t } = useTranslation("jobs");
  return <><Button type="button" disabled={busy} onClick={onRunAll}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}{t("admin.actions.runAll")}</Button><div className="mt-5 overflow-x-auto rounded-xl border border-border-subtle bg-surface-base"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-border-subtle bg-surface-raised"><tr>{(["started", "trigger", "target", "status", "fetched", "published", "review", "rejected", "failed"] as const).map((key) => <th key={key} className="px-4 py-3">{t(`admin.columns.${key}`)}</th>)}</tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-b border-border-subtle last:border-0"><td className="px-4 py-3">{new Date(run.started_at).toLocaleString()}</td><td className="px-4 py-3">{run.trigger_type}</td><td className="px-4 py-3">{run.target_type}</td><td className="px-4 py-3" title={run.error_message ?? undefined}>{run.status}</td><td className="px-4 py-3">{run.fetched_count}</td><td className="px-4 py-3">{run.published_count}</td><td className="px-4 py-3">{run.review_count}</td><td className="px-4 py-3">{run.rejected_count}</td><td className="px-4 py-3">{run.failed_count}</td></tr>)}</tbody></table></div></>;
}

function AnalyticsSection({ snapshot, busy, onRefresh }: { snapshot: { latest: { active_jobs: number; new_jobs: number; comparable_new_jobs: number; comparable_total_jobs: number } | null } | undefined; busy: boolean; onRefresh: () => void }) {
  const { t } = useTranslation("jobs"); const latest = snapshot?.latest;
  return <><Button type="button" disabled={busy} onClick={onRefresh}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}{t("admin.actions.refreshAnalytics")}</Button><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[t("market.cards.active"), latest?.active_jobs ?? 0], [t("market.cards.new"), latest?.new_jobs ?? 0], [t("admin.analytics.comparableNew"), latest?.comparable_new_jobs ?? 0], [t("admin.analytics.comparableTotal"), latest?.comparable_total_jobs ?? 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-sm text-foreground-muted">{label}</p></CardContent></Card>)}</div></>;
}

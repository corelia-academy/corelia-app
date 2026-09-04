import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Building2, Check, Database, ExternalLink, Loader2, Pencil, Play, Plus, RefreshCw, Rss, ServerCog, X } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { humanizeJobSlug } from "@/features/jobs/jobFormat";
import { detectAtsFromCareersUrl } from "@/features/jobs/atsDetection";
import {
  adminCrawlerRunsQueryOptions,
  adminJobCompaniesQueryOptions,
  adminJobOperationalAlertsQueryOptions,
  adminJobsQueryOptions,
  adminJobSourcesQueryOptions,
  jobKeys,
  jobMarketQueryOptions,
} from "@/features/jobs/jobQueries";
import {
  refreshJobsAnalytics,
  resolveJobOperationalAlert,
  reviewJob,
  runJobsTarget,
  saveRssJobSourceAdmin,
  saveJobCompanyAdmin,
  updateJobSourceAdmin,
} from "@/lib/jobs";
import { useAuth } from "@/stores/authStore";
import type { AdminJob, JobCompanyAdmin, JobOperationalAlert, JobSourceAdmin } from "@/types/jobs";

const sections = [
  ["", "admin.nav.overview", Database],
  ["review", "admin.nav.review", Check],
  ["sources", "admin.nav.sources", ServerCog],
  ["companies", "admin.nav.companies", Building2],
  ["crawlers", "admin.nav.crawlers", Play],
  ["analytics", "admin.nav.analytics", BarChart3],
] as const;
const SELECT_CLASS = "h-9 rounded-md border border-border-subtle bg-surface-base px-3 text-sm outline-none focus:border-primary";
const TEXTAREA_CLASS = "min-h-20 rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus:border-primary";
const EMPLOYER_SOURCE_TYPES = new Set(["greenhouse", "lever", "ashby", "smartrecruiters"]);
type RssSourceInput = Parameters<typeof saveRssJobSourceAdmin>[0];

function operationError(error: unknown, fallback: string, policyRequired: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("source_policy_required")) return policyRequired;
  return message && !message.includes("jobs_operation_failed") ? message : fallback;
}

export default function AdminJobsPage() {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const section = location.pathname.replace(/^\/admin\/jobs\/?/, "").split("/")[0] || "";
  const runSourceFilter = new URLSearchParams(location.search).get("source");
  const jobsQuery = useQuery(adminJobsQueryOptions(user?.id, section === "review" ? "review" : ""));
  const sourcesQuery = useQuery(adminJobSourcesQueryOptions(user?.id));
  const companiesQuery = useQuery(adminJobCompaniesQueryOptions(user?.id));
  const runsQuery = useQuery(adminCrawlerRunsQueryOptions(user?.id));
  const alertsQuery = useQuery(adminJobOperationalAlertsQueryOptions(user?.id));
  const marketQuery = useQuery(jobMarketQueryOptions(90));
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: jobKeys.admin }),
      queryClient.invalidateQueries({ queryKey: jobKeys.all }),
    ]);
  };
  const runMutation = useMutation({
    mutationFn: ({ type, value, mode = "discovery" }: { type: "company" | "source" | "adapter" | "all"; value?: string; mode?: "discovery" | "revalidation" }) => runJobsTarget(type, value, mode),
    onSuccess: async (result) => {
      if (Number(result.companies ?? 0) === 0) toast.warning(t("admin.messages.noEligibleCompanies"));
      else if (Number(result.failures ?? 0) > 0) toast.warning(t("admin.messages.runPartial", { failures: Number(result.failures) }));
      else toast.success(t("admin.messages.runComplete"));
      await invalidate();
    },
    onError: (error) => toast.error(operationError(error, t("admin.messages.actionFailed"), t("admin.messages.policyRequired"))),
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, status, overrides = {} }: { id: string; status: "active" | "review" | "rejected"; overrides?: Record<string, unknown> }) => reviewJob(id, status, overrides),
    onSuccess: async () => { toast.success(t("admin.messages.saved")); await invalidate(); },
    onError: (error) => toast.error(operationError(error, t("admin.messages.actionFailed"), t("admin.messages.policyRequired"))),
  });
  const sourceMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<JobSourceAdmin> }) => updateJobSourceAdmin(id, patch),
    onSuccess: async () => { toast.success(t("admin.messages.saved")); await invalidate(); },
    onError: (error) => toast.error(operationError(error, t("admin.messages.actionFailed"), t("admin.messages.policyRequired"))),
  });
  const rssSourceMutation = useMutation({
    mutationFn: saveRssJobSourceAdmin,
    onSuccess: async () => { toast.success(t("admin.messages.saved")); await invalidate(); },
    onError: (error) => toast.error(operationError(error, t("admin.messages.actionFailed"), t("admin.messages.policyRequired"))),
  });
  const analyticsMutation = useMutation({
    mutationFn: refreshJobsAnalytics,
    onSuccess: async () => { toast.success(t("admin.messages.analyticsRefreshed")); await invalidate(); },
    onError: () => toast.error(t("admin.messages.actionFailed")),
  });
  const resolveAlertMutation = useMutation({
    mutationFn: resolveJobOperationalAlert,
    onSuccess: async () => { toast.success(t("admin.messages.saved")); await invalidate(); },
    onError: () => toast.error(t("admin.messages.actionFailed")),
  });
  const runAll = () => {
    if (window.confirm(t("admin.confirm.runAll"))) runMutation.mutate({ type: "all" });
  };
  const revalidateAll = () => {
    if (window.confirm(t("admin.confirm.revalidateAll"))) runMutation.mutate({ type: "all", mode: "revalidation" });
  };
  const loading = jobsQuery.isPending || sourcesQuery.isPending || companiesQuery.isPending || runsQuery.isPending || alertsQuery.isPending;
  return <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"><header><h1 className="text-2xl font-bold tracking-tight">{t("admin.title")}</h1><p className="mt-1 text-sm text-foreground-muted">{t("admin.subtitle")}</p></header><nav className="mt-5 flex gap-1 overflow-x-auto rounded-lg border border-border-subtle bg-surface-base p-1">{sections.map(([path, key, Icon]) => <Link key={path} to={`/admin/jobs${path ? `/${path}` : ""}`} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${section === path ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface-raised"}`}><Icon className="size-4" aria-hidden />{t(key)}</Link>)}</nav>{loading ? <div className="mt-8 flex items-center gap-2 text-sm text-foreground-muted"><Loader2 className="size-4 animate-spin" aria-hidden />{t("admin.loading")}</div> : <div className="mt-6">{section === "review" ? <ReviewSection jobs={jobsQuery.data ?? []} busy={reviewMutation.isPending} onReview={(id, status, overrides) => reviewMutation.mutate({ id, status, overrides })} /> : section === "sources" ? <SourcesSection sources={sourcesQuery.data ?? []} busy={sourceMutation.isPending || rssSourceMutation.isPending || runMutation.isPending} onToggle={(id, enabled) => sourceMutation.mutate({ id, patch: { enabled } })} onSave={(id, patch) => sourceMutation.mutate({ id, patch })} onCreate={(input) => rssSourceMutation.mutate(input)} onRun={(id) => runMutation.mutate({ type: "source", value: id })} /> : section === "companies" ? <CompaniesSection companies={companiesQuery.data ?? []} sources={sourcesQuery.data ?? []} busy={runMutation.isPending} onRun={(id, mode) => runMutation.mutate({ type: "company", value: id, mode })} onSaved={invalidate} /> : section === "crawlers" ? <RunsSection runs={runsQuery.data ?? []} alerts={alertsQuery.data ?? []} sourceId={runSourceFilter} onRunAll={runAll} onRevalidateAll={revalidateAll} onResolveAlert={(id) => resolveAlertMutation.mutate(id)} busy={runMutation.isPending || resolveAlertMutation.isPending} /> : section === "analytics" ? <AnalyticsSection snapshot={marketQuery.data} busy={analyticsMutation.isPending} onRefresh={() => analyticsMutation.mutate()} /> : <OverviewSection jobs={jobsQuery.data ?? []} sources={sourcesQuery.data ?? []} companies={companiesQuery.data ?? []} runs={runsQuery.data ?? []} onRunAll={runAll} busy={runMutation.isPending} />}</div>}</div>;
}

function OverviewSection({ jobs, sources, companies, runs, onRunAll, busy }: { jobs: Array<{ status: string }>; sources: unknown[]; companies: unknown[]; runs: Array<{ status: string }>; onRunAll: () => void; busy: boolean }) {
  const { t } = useTranslation("jobs");
  const cards = [[t("admin.overview.active"), jobs.filter((job) => job.status === "active").length], [t("admin.overview.review"), jobs.filter((job) => job.status === "review").length], [t("admin.overview.companies"), companies.length], [t("admin.overview.sources"), sources.length], [t("admin.overview.failedRuns"), runs.filter((run) => run.status === "failed").length]];
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-sm text-foreground-muted">{label}</p></CardContent></Card>)}</div><Button type="button" className="mt-5" disabled={busy} onClick={onRunAll}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}{t("admin.actions.runAll")}</Button></>;
}

function ReviewSection({ jobs, busy, onReview }: { jobs: AdminJob[]; busy: boolean; onReview: (id: string, status: "active" | "review" | "rejected", overrides?: Record<string, unknown>) => void }) {
  const { t } = useTranslation("jobs");
  const [editingId, setEditingId] = useState<string | null>(null);
  const submitOverride = (job: AdminJob, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? "review") as "active" | "review";
    const list = (field: string) => String(form.get(field) ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    onReview(job.id, status, {
      title: String(form.get("title") ?? "").trim(),
      summary: String(form.get("summary") ?? "").trim(),
      job_type: String(form.get("job_type") ?? "tech"),
      primary_role: String(form.get("primary_role") ?? "").trim() || null,
      seniority: String(form.get("seniority") ?? "").trim() || null,
      roles: list("roles"),
      domains: list("domains"),
      required_skills: list("required_skills"),
      preferred_skills: list("preferred_skills"),
    });
    setEditingId(null);
  };
  return jobs.length ? <div className="grid gap-4 lg:grid-cols-2">{jobs.map((job) => <Card key={job.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{job.title}</h2><p className="mt-1 text-sm text-foreground-muted">{job.company_name}</p></div><span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{Math.round((job.classification_confidence ?? 0) * 100)}%</span></div>{job.summary ? <p className="mt-4 text-sm leading-6 text-foreground-muted">{job.summary}</p> : null}<div className="mt-3 flex flex-wrap gap-1.5">{[job.job_type, job.primary_role, ...job.domains, ...job.required_skills].filter(Boolean).slice(0, 8).map((value) => <span key={value} className="rounded-full bg-surface-raised px-2 py-1 text-xs">{value === "tech" || value === "non_tech" ? t(`values.${value}`) : humanizeJobSlug(value)}</span>)}</div><p className="mt-4 text-xs text-foreground-subtle">{t("admin.review.reason")}: {job.review_reason || "—"}</p>{editingId === job.id ? <form className="mt-4 grid gap-3" onSubmit={(event) => submitOverride(job, event)}><Input name="title" required defaultValue={job.title} placeholder={t("admin.review.title")} /><textarea name="summary" className={TEXTAREA_CLASS} defaultValue={job.summary ?? ""} placeholder={t("admin.review.summary")} /><div className="grid gap-3 sm:grid-cols-2"><select name="job_type" className={SELECT_CLASS} defaultValue={job.job_type}><option value="tech">Tech</option><option value="non_tech">Non-tech</option></select><Input name="primary_role" defaultValue={job.primary_role ?? ""} placeholder={t("admin.review.primaryRole")} /><Input name="seniority" defaultValue={job.seniority ?? ""} placeholder={t("admin.review.seniority")} /><Input name="roles" defaultValue={job.roles.join(", ")} placeholder={t("admin.review.roles")} /><Input name="domains" defaultValue={job.domains.join(", ")} placeholder={t("admin.review.domains")} /><Input name="required_skills" defaultValue={job.required_skills.join(", ")} placeholder={t("admin.review.requiredSkills")} /><Input name="preferred_skills" defaultValue={job.preferred_skills.join(", ")} placeholder={t("admin.review.preferredSkills")} /></div><div className="flex flex-wrap gap-2"><Button type="submit" name="status" value="review" disabled={busy}>{t("admin.actions.save")}</Button><Button type="submit" name="status" value="active" disabled={busy}><Check className="size-4" aria-hidden />{t("admin.actions.publish")}</Button><Button type="button" variant="ghost" onClick={() => setEditingId(null)}>{t("admin.actions.cancel")}</Button></div></form> : <div className="mt-4 flex gap-2"><Button type="button" disabled={busy} onClick={() => onReview(job.id, "active")}><Check className="size-4" aria-hidden />{t("admin.actions.publish")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setEditingId(job.id)}><Pencil className="size-4" aria-hidden />{t("admin.actions.edit")}</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => onReview(job.id, "rejected")}><X className="size-4" aria-hidden />{t("admin.actions.reject")}</Button></div>}</CardContent></Card>)}</div> : <p className="rounded-xl border border-border-subtle bg-surface-base p-10 text-center text-sm text-foreground-muted">{t("admin.review.empty")}</p>;
}

function SourcesSection({
  sources,
  busy,
  onToggle,
  onSave,
  onCreate,
  onRun,
}: {
  sources: JobSourceAdmin[];
  busy: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onSave: (id: string, patch: Partial<JobSourceAdmin>) => void;
  onCreate: (input: RssSourceInput) => void;
  onRun: (id: string) => void;
}) {
  const { t } = useTranslation("jobs");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingRss, setAddingRss] = useState(false);
  const submitEdit = (source: JobSourceAdmin, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patch: Partial<JobSourceAdmin> = {
      default_crawl_hours: Number(form.get("default_crawl_hours")),
      priority: Number(form.get("priority")),
      attribution_required: form.get("attribution_required") === "on",
      attribution_text: String(form.get("attribution_text") ?? "").trim() || null,
      canonical_link_required: form.get("canonical_link_required") === "on",
      allow_description_display: form.get("allow_description_display") === "on",
      allow_seo_indexing: form.get("allow_seo_indexing") === "on",
      redistribution_notes: String(form.get("redistribution_notes") ?? "").trim() || null,
      terms_url: String(form.get("terms_url") ?? "").trim() || null,
      policy_reviewed_at: form.get("policy_reviewed") === "on" ? source.policy_reviewed_at || new Date().toISOString() : null,
    };
    if (source.source_type === "rss" || source.source_type === "weworkremotely") {
      patch.adapter_config = {
        ...source.adapter_config,
        feed_urls: String(form.get("feed_urls") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      };
    }
    onSave(source.id, patch);
    setEditingId(null);
  };
  const submitRss = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const feed_urls = String(form.get("feed_urls") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!name || !slug || !feed_urls.length) return;
    onCreate({
      name,
      slug,
      base_url: String(form.get("base_url") ?? "").trim() || null,
      feed_urls,
      default_crawl_hours: Number(form.get("default_crawl_hours")) || 24,
      priority: Number(form.get("priority")) || 50,
      attribution_required: form.get("attribution_required") === "on",
      attribution_text: String(form.get("attribution_text") ?? "").trim() || null,
      canonical_link_required: true,
      allow_description_display: form.get("allow_description_display") === "on",
      allow_seo_indexing: form.get("allow_seo_indexing") === "on",
      redistribution_notes: String(form.get("redistribution_notes") ?? "").trim() || null,
      terms_url: String(form.get("terms_url") ?? "").trim() || null,
      policy_reviewed: form.get("policy_reviewed") === "on",
      enabled: false,
    });
    setAddingRss(false);
  };
  const directSources = sources.filter((source) => !EMPLOYER_SOURCE_TYPES.has(source.source_type));
  const atsSources = sources.filter((source) => EMPLOYER_SOURCE_TYPES.has(source.source_type));
  const renderTable = (items: JobSourceAdmin[], companyScoped: boolean) => (
    <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-border-subtle bg-surface-raised"><tr>{(["source", "type", "cadence", "jobsFound", "targets", "credential", "policy", "lastRun", "lastError", "status", "actions"] as const).map((key) => <th key={key} className="px-4 py-3 font-medium">{t(`admin.columns.${key}`)}</th>)}</tr></thead><tbody>{items.map((source) => {
      const hasRunnableTarget = !companyScoped || source.active_target_count > 0;
      const hasCredential = !source.credential_required || source.credential_configured;
      return <Fragment key={source.id}>
        <tr className="border-b border-border-subtle last:border-0"><td className="px-4 py-3 font-medium">{source.name}</td><td className="px-4 py-3">{source.source_type}</td><td className="px-4 py-3">{source.default_crawl_hours}h</td><td className="px-4 py-3">{source.jobs_found}</td><td className="px-4 py-3">{companyScoped ? t("admin.source.targetCount", { active: source.active_target_count, total: source.target_count }) : t("admin.source.direct")}</td><td className="px-4 py-3">{source.credential_required ? <span className={source.credential_configured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}>{source.credential_configured ? t("admin.source.credentialConfigured") : t("admin.source.credentialMissing")}</span> : "—"}</td><td className="px-4 py-3">{source.policy_reviewed_at ? "✓" : "—"}</td><td className="px-4 py-3 text-foreground-muted">{source.last_success_at ? new Date(source.last_success_at).toLocaleString() : "—"}</td><td className="max-w-52 truncate px-4 py-3 text-foreground-muted" title={source.last_error ?? undefined}>{source.last_error || "—"}</td><td className="px-4 py-3">{source.last_error ? <span className="text-destructive">{t("admin.status.error")}</span> : source.enabled ? t("admin.status.enabled") : t("admin.status.disabled")}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{companyScoped && !hasRunnableTarget ? <Button render={<Link to="/admin/jobs/companies" />} size="sm" variant="outline"><Plus className="size-3.5" aria-hidden />{t("admin.actions.addTarget")}</Button> : <Button type="button" size="sm" variant="outline" disabled={busy || !source.enabled || !hasRunnableTarget || !hasCredential} onClick={() => onRun(source.id)}>{t("admin.actions.run")}</Button>}<Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditingId(editingId === source.id ? null : source.id)}><Pencil className="size-3.5" aria-hidden />{t("admin.actions.edit")}</Button><Button render={<Link to={`/admin/jobs/crawlers?source=${source.id}`} />} size="sm" variant="ghost">{t("admin.actions.logs")}</Button><Button type="button" size="sm" variant="ghost" disabled={busy || (!source.policy_reviewed_at && !source.enabled)} onClick={() => onToggle(source.id, !source.enabled)}>{source.enabled ? t("admin.actions.disable") : t("admin.actions.enable")}</Button></div></td></tr>
        {editingId === source.id ? <tr key={`${source.id}-edit`} className="border-b border-border-subtle bg-surface-raised/40"><td colSpan={11} className="p-4"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => submitEdit(source, event)}><Input name="default_crawl_hours" type="number" min="6" max="168" defaultValue={source.default_crawl_hours} aria-label={t("admin.columns.cadence")} /><Input name="priority" type="number" min="0" max="100" defaultValue={source.priority} aria-label={t("admin.source.priority")} /><Input name="terms_url" type="url" defaultValue={source.terms_url ?? ""} placeholder={t("admin.source.termsUrl")} /><Input name="attribution_text" defaultValue={source.attribution_text ?? ""} placeholder={t("admin.source.attributionText")} />{source.source_type === "rss" || source.source_type === "weworkremotely" ? <textarea name="feed_urls" className={`${TEXTAREA_CLASS} sm:col-span-2`} defaultValue={Array.isArray(source.adapter_config?.feed_urls) ? source.adapter_config.feed_urls.map(String).join("\n") : ""} placeholder={t("admin.source.feedUrls")} /> : null}<textarea name="redistribution_notes" className={`${TEXTAREA_CLASS} sm:col-span-2`} defaultValue={source.redistribution_notes ?? ""} placeholder={t("admin.source.redistributionNotes")} /><label className="flex items-center gap-2 text-sm"><input name="policy_reviewed" type="checkbox" defaultChecked={Boolean(source.policy_reviewed_at)} />{t("admin.source.policyReviewed")}</label><label className="flex items-center gap-2 text-sm"><input name="attribution_required" type="checkbox" defaultChecked={source.attribution_required} />{t("admin.source.attributionRequired")}</label><label className="flex items-center gap-2 text-sm"><input name="canonical_link_required" type="checkbox" defaultChecked={source.canonical_link_required} />{t("admin.source.canonicalRequired")}</label><label className="flex items-center gap-2 text-sm"><input name="allow_description_display" type="checkbox" defaultChecked={source.allow_description_display} />{t("admin.source.allowDescription")}</label><label className="flex items-center gap-2 text-sm"><input name="allow_seo_indexing" type="checkbox" defaultChecked={source.allow_seo_indexing} />{t("admin.source.allowSeo")}</label><div className="flex gap-2"><Button type="submit" size="sm" disabled={busy}>{t("admin.actions.save")}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t("admin.actions.cancel")}</Button></div></form></td></tr> : null}
      </Fragment>;
    })}</tbody></table></div>
  );
  return <>
    {addingRss ? <Card className="mb-5"><CardContent className="p-5"><form className="grid gap-3 sm:grid-cols-2" onSubmit={submitRss}>
      <Input name="name" required placeholder={t("admin.source.name")} />
      <Input name="slug" required placeholder={t("admin.source.slug")} />
      <Input name="base_url" type="url" placeholder={t("admin.source.baseUrl")} />
      <Input name="terms_url" type="url" placeholder={t("admin.source.termsUrl")} />
      <textarea name="feed_urls" required className={`${TEXTAREA_CLASS} sm:col-span-2`} placeholder={t("admin.source.feedUrls")} />
      <Input name="attribution_text" placeholder={t("admin.source.attributionText")} />
      <Input name="redistribution_notes" placeholder={t("admin.source.redistributionNotes")} />
      <Input name="default_crawl_hours" type="number" min="6" max="168" defaultValue="24" aria-label={t("admin.columns.cadence")} />
      <Input name="priority" type="number" min="0" max="100" defaultValue="50" aria-label={t("admin.source.priority")} />
      <label className="flex items-center gap-2 text-sm"><input name="attribution_required" type="checkbox" defaultChecked />{t("admin.source.attributionRequired")}</label>
      <label className="flex items-center gap-2 text-sm"><input name="policy_reviewed" type="checkbox" />{t("admin.source.policyReviewed")}</label>
      <label className="flex items-center gap-2 text-sm"><input name="allow_description_display" type="checkbox" />{t("admin.source.allowDescription")}</label>
      <label className="flex items-center gap-2 text-sm"><input name="allow_seo_indexing" type="checkbox" />{t("admin.source.allowSeo")}</label>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{t("admin.actions.save")}</Button><Button type="button" variant="ghost" onClick={() => setAddingRss(false)}>{t("admin.actions.cancel")}</Button></div>
    </form></CardContent></Card> : <Button type="button" className="mb-5" onClick={() => setAddingRss(true)}><Rss className="size-4" aria-hidden />{t("admin.source.addRss")}</Button>}
    <section><h2 className="text-lg font-semibold">{t("admin.source.feedTitle")}</h2><p className="mt-1 text-sm text-foreground-muted">{t("admin.source.feedDescription")}</p><div className="mt-3">{renderTable(directSources, false)}</div></section>
    <section className="mt-8"><h2 className="text-lg font-semibold">{t("admin.source.atsTitle")}</h2><p className="mt-1 text-sm text-foreground-muted">{t("admin.source.atsDescription")}</p><div className="mt-3">{renderTable(atsSources, true)}</div></section>
  </>;
}

function CompaniesSection({ companies, sources, busy, onRun, onSaved }: { companies: JobCompanyAdmin[]; sources: JobSourceAdmin[]; busy: boolean; onRun: (id: string, mode?: "discovery" | "revalidation") => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation("jobs");
  const [draft, setDraft] = useState<Partial<JobCompanyAdmin> | null>(null);
  const saveMutation = useMutation({ mutationFn: saveJobCompanyAdmin, onSuccess: async () => { setDraft(null); toast.success(t("admin.messages.saved")); await onSaved(); }, onError: () => toast.error(t("admin.messages.actionFailed")) });
  const supportedSources = sources.filter((source) => EMPLOYER_SOURCE_TYPES.has(source.source_type));
  const employerCompanies = companies.filter((company) => EMPLOYER_SOURCE_TYPES.has(company.source_type));
  const updateCareersUrl = (careersUrl: string) => {
    const detected = detectAtsFromCareersUrl(careersUrl);
    const detectedSource = detected ? sources.find((source) => source.source_type === detected.sourceType) : null;
    setDraft((current) => {
      const identifierName = detected?.sourceIdentifier
        ? detected.sourceIdentifier.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
        : "";
      return {
        ...current,
        careers_url: careersUrl,
        ...(detected && detectedSource ? {
          name: current?.name || identifierName,
          slug: current?.slug || detected.sourceIdentifier.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          source_id: detectedSource.id,
          source_type: detected.sourceType,
          source_identifier: detected.sourceIdentifier,
          source_region: detected.sourceRegion,
        } : {}),
      };
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft?.name || !draft.slug || !draft.source_id || !draft.source_identifier) return;
    const source = sources.find((item) => item.id === draft.source_id);
    if (!source) return;
    saveMutation.mutate({
      ...draft,
      name: draft.name,
      slug: draft.slug,
      source_id: source.id,
      source_type: source.source_type,
      source_identifier: draft.source_identifier,
      domains: draft.domains ?? [],
    });
  };
  return <>
    <div className="mb-5 rounded-xl border border-border-subtle bg-surface-raised/40 p-4"><h2 className="font-semibold">{t("admin.company.title")}</h2><p className="mt-1 text-sm leading-6 text-foreground-muted">{t("admin.company.description")}</p></div>
    {draft ? <Card className="mb-5"><CardContent className="p-5"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
      <Input required value={draft.name ?? ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t("admin.company.name")} />
      <Input required value={draft.slug ?? ""} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder={t("admin.company.slug")} />
      <Input type="url" value={draft.website_url ?? ""} onChange={(event) => setDraft({ ...draft, website_url: event.target.value })} placeholder={t("admin.company.websiteUrl")} />
      <Input type="url" value={draft.logo_url ?? ""} onChange={(event) => setDraft({ ...draft, logo_url: event.target.value })} placeholder={t("admin.company.logoUrl")} />
      <Input type="url" value={draft.careers_url ?? ""} onChange={(event) => updateCareersUrl(event.target.value)} placeholder={t("admin.company.careersUrl")} />
      <select className={SELECT_CLASS} required value={draft.source_id ?? ""} onChange={(event) => { const source = sources.find((item) => item.id === event.target.value); setDraft({ ...draft, source_id: event.target.value, source_type: source?.source_type ?? "" }); }}><option value="">{t("admin.company.source")}</option>{supportedSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.source_type}</option>)}</select>
      <Input required value={draft.source_identifier ?? ""} onChange={(event) => setDraft({ ...draft, source_identifier: event.target.value })} placeholder={t("admin.company.identifier")} />
      <select className={SELECT_CLASS} value={draft.source_region ?? "global"} onChange={(event) => setDraft({ ...draft, source_region: event.target.value })}><option value="global">Global</option><option value="eu">EU</option></select>
      <Input value={(draft.domains ?? []).join(", ")} onChange={(event) => setDraft({ ...draft, domains: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder={t("admin.company.domains")} />
      <Input type="number" min="6" max="168" value={draft.crawl_interval_hours ?? ""} onChange={(event) => setDraft({ ...draft, crawl_interval_hours: event.target.value ? Number(event.target.value) : null })} placeholder={t("admin.company.cadence")} />
      <Input type="number" min="0" max="100" value={draft.priority ?? 50} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} placeholder={t("admin.company.priority")} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.verified === true} onChange={(event) => setDraft({ ...draft, verified: event.target.checked })} />{t("admin.company.verified")}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active !== false} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />{t("admin.status.enabled")}</label>
      {draft.careers_url && detectAtsFromCareersUrl(draft.careers_url) ? <p className="self-center text-xs text-foreground-muted">{t("admin.company.detected", { source: draft.source_type, identifier: draft.source_identifier })}</p> : null}
      <div className="flex gap-2 lg:col-span-4"><Button type="submit" disabled={saveMutation.isPending}>{t("admin.actions.save")}</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>{t("admin.actions.cancel")}</Button></div>
    </form></CardContent></Card> : <Button type="button" className="mb-5" onClick={() => setDraft({ source_region: "global", domains: [], priority: 50, verified: false, active: true })}><Plus className="size-4" aria-hidden />{t("admin.company.add")}</Button>}
    {employerCompanies.length ? <div className="grid gap-4 lg:grid-cols-2">{employerCompanies.map((company) => <Card key={company.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{company.name}</h2><p className="mt-1 text-sm text-foreground-muted">{company.source_type} · {company.source_identifier}</p></div><span className={`rounded-full px-2 py-1 text-xs ${company.active && company.verified ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-surface-raised text-foreground-muted"}`}>{company.verified ? t("admin.company.verified") : t("admin.company.unverified")}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{company.domains.map((domain) => <span key={domain} className="rounded-full bg-surface-raised px-2 py-1 text-xs">{humanizeJobSlug(domain)}</span>)}</div><div className="mt-3 flex gap-4 text-xs text-foreground-muted"><span>{t("admin.company.openJobs", { count: company.open_jobs })}</span><span>{t("admin.company.priorityValue", { priority: company.priority })}</span></div><p className="mt-3 text-xs text-foreground-muted">{company.last_error || (company.last_success_at ? new Date(company.last_success_at).toLocaleString() : t("admin.company.neverRun"))}</p><p className="mt-1 text-xs text-foreground-muted">{t("admin.company.lastRevalidated")}: {company.last_revalidation_error || (company.last_revalidated_at ? new Date(company.last_revalidated_at).toLocaleString() : t("admin.company.neverRun"))}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || !company.active} onClick={() => onRun(company.id)}><Play className="size-4" aria-hidden />{t("admin.actions.run")}</Button><Button type="button" size="sm" variant="outline" disabled={busy || !company.active} onClick={() => onRun(company.id, "revalidation")}><RefreshCw className="size-4" aria-hidden />{t("admin.actions.revalidate")}</Button><Button type="button" size="sm" variant="ghost" disabled={saveMutation.isPending} onClick={() => setDraft(company)}><Pencil className="size-3.5" aria-hidden />{t("admin.actions.edit")}</Button>{company.careers_url ? <Button render={<a href={company.careers_url} target="_blank" rel="noopener noreferrer" />} size="sm" variant="ghost"><ExternalLink className="size-3.5" aria-hidden />{t("admin.actions.careerPage")}</Button> : null}<Button type="button" size="sm" variant="ghost" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...company, verified: !company.verified })}>{company.verified ? t("admin.actions.unverify") : t("admin.actions.verify")}</Button><Button type="button" size="sm" variant="ghost" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...company, active: !company.active })}>{company.active ? t("admin.actions.disable") : t("admin.actions.enable")}</Button></div></CardContent></Card>)}</div> : <p className="rounded-xl border border-dashed border-border-subtle p-10 text-center text-sm text-foreground-muted">{t("admin.company.empty")}</p>}
  </>;
}

function RunsSection({ runs, alerts, sourceId, onRunAll, onRevalidateAll, onResolveAlert, busy }: { runs: Array<{ id: string; source_id?: string | null; status: string; trigger_type: string; target_type: string; started_at: string; fetched_count: number; published_count: number; review_count: number; rejected_count: number; failed_count: number; ai_failed_count: number; error_message: string | null }>; alerts: JobOperationalAlert[]; sourceId: string | null; onRunAll: () => void; onRevalidateAll: () => void; onResolveAlert: (id: string) => void; busy: boolean }) {
  const { t } = useTranslation("jobs");
  const visibleRuns = sourceId ? runs.filter((run) => run.source_id === sourceId) : runs;
  const visibleAlerts = sourceId ? alerts.filter((alert) => alert.source_id === sourceId) : alerts;
  return <><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={onRunAll}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}{t("admin.actions.runAll")}</Button><Button type="button" variant="outline" disabled={busy} onClick={onRevalidateAll}><RefreshCw className="size-4" aria-hidden />{t("admin.actions.revalidateAll")}</Button>{sourceId ? <Button render={<Link to="/admin/jobs/crawlers" />} variant="ghost">{t("admin.actions.clearLogFilter")}</Button> : null}</div>{visibleAlerts.length ? <section className="mt-5 space-y-2" aria-label={t("admin.alerts.title")}><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-500" aria-hidden />{t("admin.alerts.title")}</h2>{visibleAlerts.map((alert) => <Card key={alert.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className={`text-sm font-medium ${alert.severity === "critical" ? "text-destructive" : "text-amber-700 dark:text-amber-300"}`}>{humanizeJobSlug(alert.alert_type)} · {t("admin.alerts.occurrences", { count: alert.occurrence_count })}</p><p className="mt-1 text-sm text-foreground-muted">{alert.message}</p><p className="mt-1 text-xs text-foreground-subtle">{new Date(alert.last_seen_at).toLocaleString()}</p></div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onResolveAlert(alert.id)}>{t("admin.actions.resolve")}</Button></CardContent></Card>)}</section> : null}<div className="mt-5 overflow-x-auto rounded-xl border border-border-subtle bg-surface-base"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border-subtle bg-surface-raised"><tr>{(["started", "trigger", "target", "status", "fetched", "published", "review", "rejected", "aiFailed", "failed"] as const).map((key) => <th key={key} className="px-4 py-3">{t(`admin.columns.${key}`)}</th>)}</tr></thead><tbody>{visibleRuns.map((run) => <tr key={run.id} className="border-b border-border-subtle last:border-0"><td className="px-4 py-3">{new Date(run.started_at).toLocaleString()}</td><td className="px-4 py-3">{run.trigger_type}</td><td className="px-4 py-3">{run.target_type}</td><td className="px-4 py-3" title={run.error_message ?? undefined}>{run.status}</td><td className="px-4 py-3">{run.fetched_count}</td><td className="px-4 py-3">{run.published_count}</td><td className="px-4 py-3">{run.review_count}</td><td className="px-4 py-3">{run.rejected_count}</td><td className="px-4 py-3">{run.ai_failed_count}</td><td className="px-4 py-3">{run.failed_count}</td></tr>)}</tbody></table></div></>;
}

function AnalyticsSection({ snapshot, busy, onRefresh }: { snapshot: { latest: { active_jobs: number; new_jobs: number; comparable_new_jobs: number; comparable_total_jobs: number } | null } | undefined; busy: boolean; onRefresh: () => void }) {
  const { t } = useTranslation("jobs"); const latest = snapshot?.latest;
  return <><Button type="button" disabled={busy} onClick={onRefresh}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}{t("admin.actions.refreshAnalytics")}</Button><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[t("market.cards.active"), latest?.active_jobs ?? 0], [t("market.cards.new"), latest?.new_jobs ?? 0], [t("admin.analytics.comparableNew"), latest?.comparable_new_jobs ?? 0], [t("admin.analytics.comparableTotal"), latest?.comparable_total_jobs ?? 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-sm text-foreground-muted">{label}</p></CardContent></Card>)}</div></>;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Search, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobCard } from "@/features/jobs/JobCard";
import { JobsNav } from "@/features/jobs/JobsNav";
import { jobKeys, jobsCatalogQueryOptions, jobTaxonomyQueryOptions } from "@/features/jobs/jobQueries";
import { setUserJobState } from "@/lib/jobs";
import { useAuth } from "@/stores/authStore";
import type { UserJobState } from "@/types/jobs";

const SELECT_CLASS = "h-9 min-w-0 rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-foreground outline-none focus:border-primary";

export default function JobsPage() {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10_000, Math.trunc(requestedPage))) : 1;
  const filters = {
    query: params.get("q") || undefined,
    role: params.get("role") || undefined,
    domain: params.get("domain") || undefined,
    skill: params.get("skill") || undefined,
    seniority: params.get("seniority") || undefined,
    remoteType: params.get("remote") || undefined,
    region: params.get("region") || undefined,
    employmentType: params.get("employment") || undefined,
    postedWithinDays: Number(params.get("days")) || undefined,
    salaryMin: Number(params.get("salary")) || undefined,
    salaryCurrency: params.get("currency") || undefined,
    page,
    pageSize: 24,
  };
  const jobsQuery = useQuery(jobsCatalogQueryOptions(filters, user?.id));
  const taxonomyQuery = useQuery(jobTaxonomyQueryOptions());
  const stateMutation = useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">> }) => {
      if (!user?.id) throw new Error("login_required");
      return setUserJobState(user.id, jobId, patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
    onError: (error) => toast.error(error.message === "login_required" ? t("messages.loginRequired") : t("messages.updateFailed")),
  });
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  };
  const mutateState = (jobId: string, patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">>) => {
    if (!user) {
      toast.message(t("messages.loginRequired"));
      return;
    }
    stateMutation.mutate({ jobId, patch });
  };
  const result = jobsQuery.data;
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / 24));
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5">
        <JobsNav />
        <header className="rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><BriefcaseBusiness className="size-4" aria-hidden />{t("eyebrow")}</div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted sm:text-base">{t("subtitle")}</p>
          <form className="mt-5 flex max-w-2xl gap-2" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            updateParam("q", String(form.get("q") ?? "").trim());
          }}>
            <Input name="q" defaultValue={params.get("q") ?? ""} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} />
            <Button type="submit"><Search className="size-4" aria-hidden />{t("search")}</Button>
          </form>
        </header>
        <section className="rounded-xl border border-border-subtle bg-surface-base p-4" aria-label={t("filters.label")}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4" aria-hidden />{t("filters.label")}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <select className={SELECT_CLASS} value={filters.role ?? ""} onChange={(e) => updateParam("role", e.target.value)} aria-label={t("filters.role")}><option value="">{t("filters.allRoles")}</option>{taxonomyQuery.data?.roles.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.domain ?? ""} onChange={(e) => updateParam("domain", e.target.value)} aria-label={t("filters.domain")}><option value="">{t("filters.allDomains")}</option>{taxonomyQuery.data?.domains.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.skill ?? ""} onChange={(e) => updateParam("skill", e.target.value)} aria-label={t("filters.skill")}><option value="">{t("filters.allSkills")}</option>{taxonomyQuery.data?.skills.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.seniority ?? ""} onChange={(e) => updateParam("seniority", e.target.value)} aria-label={t("filters.seniority")}><option value="">{t("filters.allSeniorities")}</option>{(["intern", "fresher", "junior", "mid", "senior", "lead", "manager"] as const).map((value) => <option key={value} value={value}>{t(`values.${value}`)}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.remoteType ?? ""} onChange={(e) => updateParam("remote", e.target.value)} aria-label={t("filters.workMode")}><option value="">{t("filters.allWorkModes")}</option>{(["remote", "hybrid", "onsite"] as const).map((value) => <option key={value} value={value}>{t(`values.${value}`)}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.region ?? ""} onChange={(e) => updateParam("region", e.target.value)} aria-label={t("filters.region")}><option value="">{t("filters.allRegions")}</option>{(["APAC", "EMEA", "AMER"] as const).map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.employmentType ?? ""} onChange={(e) => updateParam("employment", e.target.value)} aria-label={t("filters.employmentType")}><option value="">{t("filters.allEmploymentTypes")}</option>{(["full_time", "part_time", "contract", "temporary", "internship"] as const).map((value) => <option key={value} value={value}>{t(`values.${value}`)}</option>)}</select>
            <select className={SELECT_CLASS} value={filters.salaryCurrency ?? ""} onChange={(e) => updateParam("currency", e.target.value)} aria-label={t("filters.salaryCurrency")}><option value="">{t("filters.allCurrencies")}</option>{["USD", "EUR", "GBP", "SGD", "VND"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <Input type="number" inputMode="numeric" min="0" step="1000" disabled={!filters.salaryCurrency} value={params.get("salary") ?? ""} onChange={(e) => updateParam("salary", e.target.value)} placeholder={t("filters.minimumSalary")} aria-label={t("filters.minimumSalary")} />
            <select className={SELECT_CLASS} value={String(filters.postedWithinDays ?? "")} onChange={(e) => updateParam("days", e.target.value)} aria-label={t("filters.postedDate")}><option value="">{t("filters.anyDate")}</option><option value="7">{t("filters.last7Days")}</option><option value="30">{t("filters.last30Days")}</option></select>
            <Button type="button" variant="ghost" onClick={() => setParams({})}>{t("filters.clear")}</Button>
          </div>
        </section>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-foreground-muted">{t("results", { count: result?.total ?? 0 })}</p></div>
        {jobsQuery.isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-raised" />)}</div> : jobsQuery.isError ? <div className="rounded-xl border border-destructive/30 p-8 text-center text-sm text-destructive" role="alert">{t("messages.loadFailed")} <Button type="button" variant="outline" className="ml-2" onClick={() => void jobsQuery.refetch()}>{t("retry")}</Button></div> : result?.items.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.items.map((job) => {
          const state = result.stateByJobId[job.id];
          return <JobCard key={job.id} job={job} state={state} busy={stateMutation.isPending && stateMutation.variables?.jobId === job.id} onToggleSaved={() => mutateState(job.id, { saved: !state?.saved })} onToggleApplied={() => mutateState(job.id, { applied: !state?.applied })} onHide={() => mutateState(job.id, { hidden: true })} />;
        })}</div> : <div className="rounded-xl border border-border-subtle bg-surface-base p-12 text-center"><BriefcaseBusiness className="mx-auto size-8 text-foreground-subtle" aria-hidden /><h2 className="mt-3 font-semibold">{t("empty.title")}</h2><p className="mt-1 text-sm text-foreground-muted">{t("empty.description")}</p></div>}
        {totalPages > 1 ? <div className="flex items-center justify-center gap-3"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>{t("pagination.previous")}</Button><span className="text-sm text-foreground-muted">{t("pagination.page", { page, total: totalPages })}</span><Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>{t("pagination.next")}</Button></div> : null}
      </div>
    </div>
  );
}

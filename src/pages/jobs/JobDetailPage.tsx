import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, BriefcaseBusiness, Building2, CheckCircle2, ExternalLink, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatJobDate, formatJobDescription, formatJobSalary, humanizeJobSlug } from "@/features/jobs/jobFormat";
import { jobDetailQueryOptions, jobKeys, userJobStateQueryOptions } from "@/features/jobs/jobQueries";
import { setUserJobState } from "@/lib/jobs";
import { useAuth } from "@/stores/authStore";

export default function JobDetailPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation("jobs");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const jobQuery = useQuery(jobDetailQueryOptions(slug));
  const stateQuery = useQuery(userJobStateQueryOptions(user?.id, jobQuery.data?.id));
  const mutation = useMutation({
    mutationFn: async (patch: { saved?: boolean; applied?: boolean }) => {
      if (!user?.id || !jobQuery.data?.id) throw new Error("login_required");
      return setUserJobState(user.id, jobQuery.data.id, patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
    onError: (error) => toast.error(error.message === "login_required" ? t("messages.loginRequired") : t("messages.updateFailed")),
  });
  if (jobQuery.isPending) return <div className="mx-auto max-w-5xl p-8"><div className="h-96 animate-pulse rounded-2xl bg-surface-raised" /></div>;
  if (jobQuery.isError || !jobQuery.data) return <div className="mx-auto max-w-3xl p-8 text-center"><h1 className="text-xl font-semibold">{t("detail.notFound")}</h1><Button render={<Link to="/jobs" />} variant="outline" className="mt-4">{t("detail.back")}</Button></div>;
  const job = jobQuery.data;
  const state = stateQuery.data;
  const salary = formatJobSalary(job, i18n.language);
  const description = formatJobDescription(job.description_plain || job.description_html || job.summary);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description,
    datePosted: job.posted_at ?? job.first_seen_at,
    ...(job.expires_at ? { validThrough: job.expires_at } : {}),
    ...(job.employment_type ? { employmentType: job.employment_type.toUpperCase() } : {}),
    hiringOrganization: { "@type": "Organization", name: job.company_name, ...(job.company_logo_url ? { logo: job.company_logo_url } : {}) },
    ...(job.remote_type === "remote" ? { jobLocationType: "TELECOMMUTE" } : {}),
    url: typeof window === "undefined" ? `/jobs/${job.slug}` : window.location.href,
  };
  const serializedStructuredData = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  const requireLoginOrMutate = (patch: { saved?: boolean; applied?: boolean }) => {
    if (!user) {
      toast.message(t("messages.loginRequired"));
      return;
    }
    mutation.mutate(patch);
  };
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {job.job_sources?.allow_seo_indexing !== false ? <script type="application/ld+json">{serializedStructuredData}</script> : null}
      <Link to="/jobs" className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{t("detail.back")}</Link>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <Card><CardContent className="p-6 sm:p-8"><div className="flex items-start gap-4"><div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">{job.company_logo_url ? <img src={job.company_logo_url} alt="" className="size-full object-contain p-1.5" /> : <Building2 className="size-6 text-foreground-subtle" aria-hidden />}</div><div><p className="text-sm font-medium text-primary">{job.company_name}</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{job.title}</h1><div className="mt-3 flex flex-wrap gap-3 text-sm text-foreground-muted"><span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{job.location_text || humanizeJobSlug(job.remote_type)}</span><span className="inline-flex items-center gap-1"><BriefcaseBusiness className="size-4" aria-hidden />{humanizeJobSlug(job.employment_type)}</span><span>{formatJobDate(job.posted_at ?? job.first_seen_at, i18n.language)}</span></div></div></div>{job.summary ? <p className="mt-6 text-base leading-7 text-foreground-muted">{job.summary}</p> : null}</CardContent></Card>
          <Card><CardContent className="p-6 sm:p-8"><h2 className="text-lg font-semibold">{t("detail.about")}</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground-muted">{description || t("detail.noDescription")}</div></CardContent></Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Card><CardContent className="p-6"><h2 className="font-semibold">{t("detail.requiredSkills")}</h2><div className="mt-3 flex flex-wrap gap-2">{job.required_skills.length ? job.required_skills.map((skill) => <Link key={skill} to={`/jobs?skill=${encodeURIComponent(skill)}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{humanizeJobSlug(skill)}</Link>) : <span className="text-sm text-foreground-muted">—</span>}</div></CardContent></Card>
            <Card><CardContent className="p-6"><h2 className="font-semibold">{t("detail.preferredSkills")}</h2><div className="mt-3 flex flex-wrap gap-2">{job.preferred_skills.length ? job.preferred_skills.map((skill) => <span key={skill} className="rounded-full bg-surface-raised px-2.5 py-1 text-xs text-foreground-muted">{humanizeJobSlug(skill)}</span>) : <span className="text-sm text-foreground-muted">—</span>}</div></CardContent></Card>
          </div>
        </main>
        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--app-header-height)+1rem)] lg:self-start">
          <Card><CardContent className="space-y-3 p-5"><Button render={<a href={job.apply_url} target="_blank" rel="noopener noreferrer" />} className="w-full">{t("actions.apply")}<ExternalLink className="size-4" aria-hidden /></Button><Button type="button" variant="outline" className="w-full" disabled={mutation.isPending} onClick={() => requireLoginOrMutate({ saved: !state?.saved })}><Bookmark className={`size-4 ${state?.saved ? "fill-current" : ""}`} aria-hidden />{state?.saved ? t("actions.unsave") : t("actions.save")}</Button><Button type="button" variant="outline" className="w-full" disabled={mutation.isPending} onClick={() => requireLoginOrMutate({ applied: !state?.applied })}><CheckCircle2 className="size-4" aria-hidden />{state?.applied ? t("actions.applied") : t("actions.markApplied")}</Button></CardContent></Card>
          <Card><CardContent className="space-y-3 p-5 text-sm"><h2 className="font-semibold">{t("detail.overview")}</h2><div><span className="text-foreground-muted">{t("detail.salary")}</span><p className="mt-0.5 font-medium">{salary ?? t("card.salaryNotShown")}</p></div><div><span className="text-foreground-muted">{t("detail.jobType")}</span><p className="mt-0.5 font-medium">{t(`values.${job.job_type}`)}</p></div><div><span className="text-foreground-muted">{t("detail.seniority")}</span><p className="mt-0.5 font-medium">{humanizeJobSlug(job.seniority)}</p></div><div><span className="text-foreground-muted">{t("detail.role")}</span><p className="mt-0.5 font-medium">{humanizeJobSlug(job.primary_role)}</p></div><div><span className="text-foreground-muted">{t("detail.source")}</span><p className="mt-0.5 font-medium">{job.job_sources?.name ?? "—"}</p>{job.job_sources?.attribution_required ? <p className="mt-1 text-xs text-foreground-muted">{job.job_sources.attribution_text || t("detail.sourceAttribution", { source: job.job_sources.name })}</p> : null}</div></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

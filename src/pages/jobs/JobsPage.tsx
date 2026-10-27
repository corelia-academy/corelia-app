import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { parseSalaryFilter } from "./jobFilterUtils";

import { FullPageEmptyState } from "@/components/layouts/FullPageEmptyState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTriggerWithIndicator,
} from "@/components/ui/dropdown-menu";
import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { Input, type InputAccessoryState } from "@/components/ui/input";
import { JobCard } from "@/features/jobs/JobCard";
import { JobCardSkeleton } from "@/features/jobs/JobCardSkeleton";
import { humanizeJobSlug } from "@/features/jobs/jobFormat";
import { JobsNav } from "@/features/jobs/JobsNav";
import { jobKeys, jobsInfiniteCatalogQueryOptions, jobTaxonomyQueryOptions } from "@/features/jobs/jobQueries";
import { setUserJobState } from "@/lib/jobs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/stores/authStore";
import type { JobFilters, UserJobState } from "@/types/jobs";
import { landingUrl } from "@/lib/appUrl";

const FILTER_TRIGGER_CLASS = "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input-field-border bg-surface-base px-3 text-left font-body text-body-large text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const JOB_SALARY_CURRENCIES = ["USD", "EUR", "GBP", "SGD", "VND"] as const;

type JobFilterOption = { value: string; label: string };

function JobFilterDropdown({ label, allLabel, value, options, disabled, fitContentWidth = false, onValueChange }: {
  label: string;
  allLabel: string;
  value: string;
  options: readonly JobFilterOption[];
  disabled?: boolean;
  fitContentWidth?: boolean;
  onValueChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <DropdownMenu>
      <DropdownMenuTriggerWithIndicator type="button" disabled={disabled} aria-label={label} className={FILTER_TRIGGER_CLASS}>
        <span className="min-w-0 truncate">{selectedLabel ?? (value ? humanizeJobSlug(value) : allLabel)}</span>
      </DropdownMenuTriggerWithIndicator>
      <DropdownMenuContent
        layout="multiple-list"
        align="start"
        className={cn(
          fitContentWidth
            ? "w-max min-w-(--anchor-width) max-w-[calc(100vw-2rem)]"
            : "w-(--anchor-width) max-w-[calc(100vw-2rem)]",
        )}
      >
        <DropdownMenuList>
          <DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(String(next))}>
            <DropdownMenuRadioItem className="text-body-large" value=""><DropdownMenuItemContent>{allLabel}</DropdownMenuItemContent></DropdownMenuRadioItem>
            {options.map((option) => <DropdownMenuRadioItem key={option.value} className="text-body-large" value={option.value}><DropdownMenuItemContent>{option.label}</DropdownMenuItemContent></DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function JobSalaryCurrencySelector({
  disabled,
  label,
  value,
  allLabel,
  onValueChange,
}: InputAccessoryState & {
  label: string;
  value: string;
  allLabel: string;
  onValueChange: (value: string) => void;
}) {
  const selectedLabel = JOB_SALARY_CURRENCIES.find((currency) => currency === value)
    ?? (value ? humanizeJobSlug(value) : allLabel);

  return (
    <div className="ml-xs flex h-full shrink-0 items-center border-l border-input-field-divider pl-lg group-has-[:focus-visible]/input-field:border-input-field-divider-focus group-has-[[data-popup-open]]/input-field:border-input-field-divider-focus">
      <DropdownMenu>
        <DropdownMenuTriggerWithIndicator
          type="button"
          disabled={disabled}
          aria-label={label}
          className="inline-flex h-10 max-w-32 shrink-0 items-center gap-md rounded-sm bg-transparent p-0 text-body-large font-body text-foreground outline-none disabled:cursor-not-allowed disabled:text-input-field-disabled-foreground"
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
        </DropdownMenuTriggerWithIndicator>
        <DropdownMenuContent
          layout="multiple-list"
          align="end"
          className="w-max min-w-32 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuList>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(next) => onValueChange(String(next))}
            >
              <DropdownMenuRadioItem className="text-body-large" value="">
                <DropdownMenuItemContent>{allLabel}</DropdownMenuItemContent>
              </DropdownMenuRadioItem>
              {JOB_SALARY_CURRENCIES.map((currency) => (
                <DropdownMenuRadioItem
                  key={currency}
                  className="text-body-large"
                  value={currency}
                >
                  <DropdownMenuItemContent>{currency}</DropdownMenuItemContent>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function landingFilters(pathname: string, route: { skill?: string; domain?: string; role?: string }): { label: string; filters: JobFilters } | null {
  const fixed: Record<string, { label: string; filters: JobFilters }> = {
    "/jobs/frontend": { label: "Frontend Engineering", filters: { role: "frontend-engineering" } },
    "/jobs/backend": { label: "Backend Engineering", filters: { role: "backend-engineering" } },
    "/jobs/ai-engineering": { label: "AI Engineering", filters: { role: "ai-engineering" } },
    "/jobs/devops": { label: "DevOps", filters: { role: "devops" } },
    "/jobs/remote": { label: "Remote", filters: { remoteType: "remote" } },
    "/jobs/vietnam": { label: "Vietnam", filters: { countryCode: "VN", region: undefined } },
    "/jobs/apac": { label: "APAC", filters: { region: "APAC" } },
    "/jobs/market/entry-level": { label: "Entry-level", filters: { entryLevel: true, seniority: undefined } },
    "/jobs/market/remote": { label: "Remote", filters: { remoteType: "remote" } },
  };
  if (fixed[pathname]) return fixed[pathname];
  if (pathname.startsWith("/jobs/skills/") && route.skill) return { label: humanizeJobSlug(route.skill), filters: { skill: route.skill } };
  if (pathname.startsWith("/jobs/domains/") && route.domain) return { label: humanizeJobSlug(route.domain), filters: { domain: route.domain } };
  if (pathname.startsWith("/jobs/market/skills/") && route.skill) return { label: humanizeJobSlug(route.skill), filters: { skill: route.skill } };
  if (pathname.startsWith("/jobs/market/roles/") && route.role) return { label: humanizeJobSlug(route.role), filters: { role: route.role } };
  return null;
}

export default function JobsPage() {
  const { t } = useTranslation("jobs");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const route = useParams<{ skill?: string; domain?: string; role?: string }>();
  const [params, setParams] = useSearchParams();
  const landing = landingFilters(location.pathname, route);
  const filters: JobFilters = {
    query: params.get("q") || undefined,
    jobType: params.get("type") === "tech" || params.get("type") === "non_tech"
      ? params.get("type") as "tech" | "non_tech"
      : undefined,
    role: params.get("role") || undefined,
    domain: params.get("domain") || undefined,
    skill: params.get("skill") || undefined,
    seniority: params.get("seniority") || undefined,
    remoteType: params.get("remote") || undefined,
    region: params.get("region") || undefined,
    employmentType: params.get("employment") || undefined,
    postedWithinDays: Number(params.get("days")) || undefined,
    salaryMin: parseSalaryFilter(params.get("salary")),
    salaryCurrency: params.get("currency") || undefined,
    pageSize: 24,
    ...landing?.filters,
  };
  const canonicalUrl = landingUrl(location.pathname);
  usePageMeta({
    title: landing ? t("landing.title", { label: landing.label }) : t("title"),
    description: landing ? t("landing.subtitle", { label: landing.label }) : t("subtitle"),
    url: canonicalUrl,
    canonicalUrl,
    robots: "noindex,follow",
  });
  const jobsQuery = useInfiniteQuery(jobsInfiniteCatalogQueryOptions(filters, user?.id));
  const taxonomyQuery = useQuery(jobTaxonomyQueryOptions());
  const stateMutation = useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">> }) => {
      if (!user?.id) throw new Error("login_required");
      return setUserJobState(user.id, jobId, patch);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
      if (variables.patch.hidden === true) {
        toast.success(t("messages.hidden"), {
          action: { label: t("messages.viewHidden"), onClick: () => navigate("/jobs/hidden") },
        });
      }
    },
    onError: (error) => toast.error(error.message === "login_required" ? t("messages.loginRequired") : t("messages.updateFailed")),
  });
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const urlSalary = params.get("salary") ?? "";
  const [salaryDraft, setSalaryDraft] = useState(urlSalary);
  const isComposingRef = useRef(false);

  useEffect(() => {
    setSalaryDraft(urlSalary);
  }, [urlSalary]);

  const commitSalary = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      updateParam("salary", "");
      return;
    }
    const parsed = parseSalaryFilter(trimmed);
    if (parsed !== undefined) {
      updateParam("salary", String(parsed));
    } else {
      setSalaryDraft(urlSalary);
    }
  };
  const mutateState = (jobId: string, patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">>) => {
    if (!user) {
      toast.message(t("messages.loginRequired"));
      return;
    }
    stateMutation.mutate({ jobId, patch });
  };
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const jobs = useMemo(() => {
    const seen = new Set<string>();
    return jobsQuery.data?.pages.flatMap((pageResult) => pageResult.items.filter((job) => {
      if (seen.has(job.id)) return false;
      seen.add(job.id);
      return true;
    })) ?? [];
  }, [jobsQuery.data]);
  const stateByJobId = useMemo(() => jobsQuery.data?.pages.reduce<Record<string, UserJobState>>(
    (states, pageResult) => Object.assign(states, pageResult.stateByJobId),
    {},
  ) ?? {}, [jobsQuery.data]);
  const latestPage = jobsQuery.data?.pages.at(-1);
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = jobsQuery;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || isFetchNextPageError || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) {
        void fetchNextPage();
      }
    }, { rootMargin: "600px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  const hasFilterParams = ["q", "type", "role", "remote", "domain", "skill", "seniority", "region", "employment", "currency", "salary", "days"].some((key) => params.has(key));
  if (jobsQuery.isSuccess && !landing && !hasFilterParams && jobs.length === 0 && !latestPage?.hiddenCount) {
    return <FullPageEmptyState title={t("noJobs.title")} description={t("noJobs.description")} />;
  }

  return (
    <div className="course-catalog-page container-app pb-8 pt-6 sm:py-8">
      <main className="course-catalog mx-auto flex w-full max-w-[1072px] flex-col gap-6">
        <JobsNav />
        <header>
          <h1 className="text-heading-large font-display text-foreground">
            {landing ? t("landing.title", { label: landing.label }) : t("title")}
            {latestPage ? <span className="ml-2 text-body-large font-body font-normal text-foreground-subtle">({latestPage.total})</span> : null}
          </h1>
          <p className="mt-2 max-w-3xl text-body-large text-catalog-subtitle">{landing ? t("landing.subtitle", { label: landing.label }) : t("subtitle")}</p>
        </header>
        <section className="course-catalog-filters flex flex-col gap-3" aria-label={t("filters.label")}>
          <div className="grid gap-2 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] xl:items-center">
            <form className="min-w-0" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              updateParam("q", String(form.get("q") ?? "").trim());
            }}>
              <Input name="q" type="search" variant="icon-leading" defaultValue={params.get("q") ?? ""} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} />
            </form>
            <div className="grid gap-2 sm:grid-cols-3">
              <JobFilterDropdown label={t("filters.jobType")} allLabel={t("filters.allJobTypes")} value={filters.jobType ?? ""} options={(["tech", "non_tech"] as const).map((value) => ({ value, label: t(`values.${value}`) }))} onValueChange={(value) => updateParam("type", value)} fitContentWidth />
              <JobFilterDropdown label={t("filters.role")} allLabel={t("filters.allRoles")} value={filters.role ?? ""} disabled={Boolean(landing?.filters.role)} options={taxonomyQuery.data?.roles.map((item) => ({ value: item.slug, label: item.name })) ?? []} onValueChange={(value) => updateParam("role", value)} fitContentWidth />
              <JobFilterDropdown label={t("filters.workMode")} allLabel={t("filters.allWorkModes")} value={filters.remoteType ?? ""} disabled={Boolean(landing?.filters.remoteType)} options={(["remote", "hybrid", "onsite"] as const).map((value) => ({ value, label: t(`values.${value}`) }))} onValueChange={(value) => updateParam("remote", value)} fitContentWidth />
            </div>
          </div>
          <details className="group" open={["domain", "skill", "seniority", "region", "employment", "currency", "salary", "days"].some(key => params.has(key))}>
            <summary className="cursor-pointer py-3 text-sm font-medium text-primary">{t("filters.more")}</summary>
            <div className="grid gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3">
            <JobFilterDropdown label={t("filters.postedDate")} allLabel={t("filters.anyDate")} value={String(filters.postedWithinDays ?? "")} options={[{ value: "7", label: t("filters.last7Days") }, { value: "30", label: t("filters.last30Days") }]} onValueChange={(value) => updateParam("days", value)} />
            <JobFilterDropdown label={t("filters.domain")} allLabel={t("filters.allDomains")} value={filters.domain ?? ""} disabled={Boolean(landing?.filters.domain)} options={taxonomyQuery.data?.domains.map((item) => ({ value: item.slug, label: item.name })) ?? []} onValueChange={(value) => updateParam("domain", value)} />
            <JobFilterDropdown label={t("filters.skill")} allLabel={t("filters.allSkills")} value={filters.skill ?? ""} disabled={Boolean(landing?.filters.skill)} options={taxonomyQuery.data?.skills.map((item) => ({ value: item.slug, label: item.name })) ?? []} onValueChange={(value) => updateParam("skill", value)} />
            <JobFilterDropdown label={t("filters.seniority")} allLabel={landing?.filters.entryLevel ? t("market.cards.entry") : t("filters.allSeniorities")} value={filters.seniority ?? ""} disabled={Boolean(landing?.filters.entryLevel)} options={(["intern", "fresher", "junior", "mid", "senior", "lead", "manager"] as const).map((value) => ({ value, label: t(`values.${value}`) }))} onValueChange={(value) => updateParam("seniority", value)} />
            <JobFilterDropdown label={t("filters.region")} allLabel={landing?.filters.countryCode === "VN" ? "Vietnam" : t("filters.allRegions")} value={filters.region ?? ""} disabled={Boolean(landing?.filters.region || landing?.filters.countryCode)} options={(["APAC", "EMEA", "AMER"] as const).map((value) => ({ value, label: value }))} onValueChange={(value) => updateParam("region", value)} />
            <JobFilterDropdown label={t("filters.employmentType")} allLabel={t("filters.allEmploymentTypes")} value={filters.employmentType ?? ""} options={(["full_time", "part_time", "contract", "temporary", "internship"] as const).map((value) => ({ value, label: t(`values.${value}`) }))} onValueChange={(value) => updateParam("employment", value)} />
            <div className="col-span-full flex min-w-0 flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  inputDisabled={!filters.salaryCurrency}
                  controlClassName="has-[[data-popup-open]]:ring-2 has-[[data-popup-open]]:ring-input-field-focus-ring has-[[data-popup-open]]:ring-offset-1 has-[[data-popup-open]]:ring-offset-background has-[[data-slot=dropdown-menu-trigger]:focus:not(:focus-visible):not([data-popup-open])]:ring-0 has-[[data-slot=dropdown-menu-trigger]:focus:not(:focus-visible):not([data-popup-open])]:ring-offset-0"
                  value={salaryDraft}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    setSalaryDraft(e.currentTarget.value);
                    commitSalary(e.currentTarget.value);
                  }}
                  onChange={(e) => setSalaryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isComposingRef.current) {
                      e.preventDefault();
                      commitSalary(e.currentTarget.value);
                    }
                  }}
                  onBlur={(e) => {
                    if (!isComposingRef.current) {
                      commitSalary(e.currentTarget.value);
                    }
                  }}
                  renderTrailingContent={(state) => (
                    <JobSalaryCurrencySelector
                      {...state}
                      label={t("filters.salaryCurrency")}
                      value={filters.salaryCurrency ?? ""}
                      allLabel={t("filters.allCurrencies")}
                      onValueChange={(value) => updateParam("currency", value)}
                    />
                  )}
                  placeholder={t("filters.minimumSalary")}
                  aria-label={t("filters.minimumSalary")}
                />
              </div>
              <Button type="button" variant="cta" hierarchy="tertiary" className="shrink-0" onClick={() => setParams({})}>{t("filters.clear")}</Button>
            </div>
            </div>
          </details>
        </section>
        {jobsQuery.isPending ? <div className="mobile-bleed-grid grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }).map((_, index) => <JobCardSkeleton key={index} />)}</div> : jobsQuery.isError && !jobsQuery.data ? <div className="mobile-bleed-surface rounded-xl border border-destructive/30 p-8 text-center text-sm text-destructive" role="alert">{t("messages.loadFailed")} <Button type="button" variant="cta" hierarchy="secondary" className="ml-2" onClick={() => void jobsQuery.refetch()}>{t("retry")}</Button></div> : jobs.length ? <div className={cn("mobile-bleed-grid grid gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3", jobsQuery.isPlaceholderData && "opacity-60")} aria-busy={jobsQuery.isPlaceholderData || undefined}>{jobs.map((job) => {
          const state = stateByJobId[job.id];
          return <JobCard publicAppearance key={job.id} job={job} state={state} busy={stateMutation.isPending && stateMutation.variables?.jobId === job.id} onToggleSaved={() => mutateState(job.id, { saved: !state?.saved })} />;
        })}</div> : <div className="flex min-h-[31.25rem] items-center justify-center"><EmptyStateIllustration type="search" size="medium" title={t("empty.title")} description={t("empty.description")} /></div>}
        {jobsQuery.hasNextPage ? <div ref={loadMoreRef} className="flex min-h-10 items-center justify-center text-sm text-foreground-muted" role="status" aria-live="polite">{jobsQuery.isFetchingNextPage ? t("infinite.loading") : jobsQuery.isFetchNextPageError ? <Button type="button" variant="cta" hierarchy="secondary" onClick={() => void jobsQuery.fetchNextPage()}>{t("infinite.retry")}</Button> : typeof IntersectionObserver === "undefined" ? <Button type="button" variant="cta" hierarchy="secondary" onClick={() => void jobsQuery.fetchNextPage()}>{t("infinite.loadMore")}</Button> : <span className="sr-only">{t("infinite.ready")}</span>}</div> : null}
      </main>
    </div>
  );
}

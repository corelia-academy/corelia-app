import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import type {
  AdminJob,
  CrawlerRun,
  Job,
  JobCompanyAdmin,
  JobFilters,
  JobMarketSnapshot,
  JobsPageResult,
  JobSourceAdmin,
  JobTaxonomy,
  UserJobState,
} from "@/types/jobs";

const JOB_SELECT: string = "id,slug,title,company_id,company_name,company_logo_url,description_html,description_plain,summary,job_type,primary_role,roles,domains,required_skills,preferred_skills,mentioned_skills,seniority,experience_min_years,experience_max_years,employment_type,remote_type,location_text,country_codes,regions,remote_eligibility,salary_min,salary_max,salary_currency,salary_period,source_id,source_job_id,source_url,canonical_url,apply_url,posted_at,first_seen_at,last_seen_at,expires_at,status,created_at,updated_at,job_sources!inner(name,slug,enabled,policy_reviewed_at,attribution_required,attribution_text,allow_seo_indexing),job_companies!inner(active,verified)";

function publicJobExpiryFilter(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}

function sanitizeFilters(filters: JobFilters): Required<Pick<JobFilters, "page" | "pageSize">> & JobFilters {
  const rawPage = Number(filters.page);
  const rawPageSize = Number(filters.pageSize);
  const rawPostedWithinDays = Number(filters.postedWithinDays);
  return {
    ...filters,
    query: filters.query?.trim().slice(0, 200) || undefined,
    postedWithinDays: Number.isFinite(rawPostedWithinDays) && rawPostedWithinDays > 0
      ? Math.min(365, Math.trunc(rawPostedWithinDays))
      : undefined,
    page: Number.isFinite(rawPage) ? Math.max(1, Math.min(10_000, Math.trunc(rawPage))) : 1,
    pageSize: Number.isFinite(rawPageSize) ? Math.max(1, Math.min(60, Math.trunc(rawPageSize))) : 24,
  };
}

export async function listJobs(filters: JobFilters, userId?: string | null): Promise<JobsPageResult> {
  const normalized = sanitizeFilters(filters);
  const offset = (normalized.page - 1) * normalized.pageSize;
  let query = supabase
    .from("jobs")
    .select(JOB_SELECT, { count: "exact" })
    .eq("status", "active")
    .or(publicJobExpiryFilter())
    .eq("job_sources.enabled", true)
    .not("job_sources.policy_reviewed_at", "is", null)
    .eq("job_companies.active", true)
    .eq("job_companies.verified", true);
  if (userId) {
    const { data: hidden, error: hiddenError } = await supabase
      .from("user_jobs")
      .select("job_id")
      .eq("user_id", userId)
      .eq("hidden", true);
    if (hiddenError) throw new Error(hiddenError.message);
    const hiddenIds = (hidden ?? []).map((row) => String(row.job_id));
    if (hiddenIds.length) query = query.not("id", "in", `(${hiddenIds.join(",")})`);
  }
  if (normalized.query) query = query.textSearch("search_vector", normalized.query, { type: "websearch", config: "simple" });
  if (normalized.jobType) query = query.eq("job_type", normalized.jobType);
  if (normalized.role) query = query.contains("roles", [normalized.role]);
  if (normalized.domain) query = query.contains("domains", [normalized.domain]);
  if (normalized.skill) query = query.overlaps("mentioned_skills", [normalized.skill]);
  if (normalized.seniority) query = query.eq("seniority", normalized.seniority);
  if (normalized.remoteType) query = query.eq("remote_type", normalized.remoteType);
  if (normalized.region) query = query.contains("regions", [normalized.region]);
  if (normalized.employmentType) query = query.eq("employment_type", normalized.employmentType);
  if (normalized.postedWithinDays) {
    query = query.gte("posted_at", new Date(Date.now() - normalized.postedWithinDays * 86_400_000).toISOString());
  }
  if (normalized.salaryCurrency && normalized.salaryMin != null && Number.isFinite(normalized.salaryMin)) {
    query = query.or(
      `salary_max.gte.${normalized.salaryMin},and(salary_max.is.null,salary_min.gte.${normalized.salaryMin})`,
    );
  }
  if (normalized.salaryCurrency) query = query.eq("salary_currency", normalized.salaryCurrency.toUpperCase());
  const { data, error, count } = await query
    .order("ranking_score", { ascending: false })
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + normalized.pageSize - 1);
  if (error) throw new Error(error.message);
  const items = (data ?? []) as unknown as Job[];
  const jobIds = items.map((job) => job.id);
  const stateResult = userId && jobIds.length
    ? await supabase.from("user_jobs").select("*").eq("user_id", userId).in("job_id", jobIds)
    : { data: [], error: null };
  if (stateResult.error) throw new Error(stateResult.error.message);
  const states = (stateResult.data ?? []) as UserJobState[];
  const stateByJobId = Object.fromEntries(states.map((state) => [state.job_id, state]));
  return { items, total: count ?? items.length, page: normalized.page, pageSize: normalized.pageSize, stateByJobId };
}

export async function getJobBySlug(slug: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .or(publicJobExpiryFilter())
    .eq("job_sources.enabled", true)
    .not("job_sources.policy_reviewed_at", "is", null)
    .eq("job_companies.active", true)
    .eq("job_companies.verified", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Job | null;
}

export async function getJobTaxonomy(): Promise<JobTaxonomy> {
  const [roles, domains, skills] = await Promise.all([
    supabase.from("job_roles").select("slug,name,group_name").order("sort_order"),
    supabase.from("job_domains").select("slug,name").order("sort_order"),
    supabase.from("job_skills").select("slug,name,category").order("sort_order"),
  ]);
  for (const result of [roles, domains, skills]) if (result.error) throw new Error(result.error.message);
  return {
    roles: roles.data ?? [],
    domains: domains.data ?? [],
    skills: skills.data ?? [],
  } as JobTaxonomy;
}

export async function getUserJobState(userId: string, jobId: string): Promise<UserJobState | null> {
  const { data, error } = await supabase.from("user_jobs").select("*").eq("user_id", userId).eq("job_id", jobId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as UserJobState | null;
}

export async function setUserJobState(
  userId: string,
  jobId: string,
  patch: Partial<Pick<UserJobState, "saved" | "applied" | "hidden">>,
): Promise<UserJobState | null> {
  const current = await getUserJobState(userId, jobId);
  const now = new Date().toISOString();
  const next = {
    saved: patch.saved ?? current?.saved ?? false,
    applied: patch.applied ?? current?.applied ?? false,
    hidden: patch.hidden ?? current?.hidden ?? false,
  };
  if (!next.saved && !next.applied && !next.hidden) {
    const { error } = await supabase.from("user_jobs").delete().eq("user_id", userId).eq("job_id", jobId);
    if (error) throw new Error(error.message);
    return null;
  }
  const { data, error } = await supabase.from("user_jobs").upsert({
    user_id: userId,
    job_id: jobId,
    ...next,
    saved_at: next.saved ? current?.saved_at ?? now : null,
    applied_at: next.applied ? current?.applied_at ?? now : null,
    updated_at: now,
  }, { onConflict: "user_id,job_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data as UserJobState;
}

export async function listUserJobs(userId: string, mode: "saved" | "applied" | "hidden"): Promise<Array<{ job: Job; state: UserJobState }>> {
  let stateQuery = supabase
    .from("user_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq(mode, true);
  if (mode !== "hidden") stateQuery = stateQuery.eq("hidden", false);
  const { data: states, error: stateError } = await stateQuery.order(
    mode === "saved" ? "saved_at" : mode === "applied" ? "applied_at" : "updated_at",
    { ascending: false },
  );
  if (stateError) throw new Error(stateError.message);
  const typedStates = (states ?? []) as UserJobState[];
  if (!typedStates.length) return [];
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .in("id", typedStates.map((state) => state.job_id))
    .eq("status", "active")
    .or(publicJobExpiryFilter())
    .eq("job_sources.enabled", true)
    .not("job_sources.policy_reviewed_at", "is", null)
    .eq("job_companies.active", true)
    .eq("job_companies.verified", true);
  if (jobsError) throw new Error(jobsError.message);
  const byId = new Map(((jobs ?? []) as unknown as Job[]).map((job) => [job.id, job]));
  return typedStates.flatMap((state) => {
    const job = byId.get(state.job_id);
    return job ? [{ job, state }] : [];
  });
}

export async function getJobMarketSnapshot(days = 90): Promise<JobMarketSnapshot> {
  const from = new Date(Date.now() - Math.max(7, Math.min(365, days)) * 86_400_000).toISOString().slice(0, 10);
  const { data: daily, error: dailyError } = await supabase
    .from("market_daily_stats")
    .select("*")
    .gte("date", from)
    .order("date", { ascending: true });
  if (dailyError) throw new Error(dailyError.message);
  const latest = daily?.length ? daily[daily.length - 1] : null;
  if (!latest) return { daily: [], latest: null, roles: [], skills: [], domains: [] };
  const [roles, skills, domains] = await Promise.all([
    supabase.from("market_role_daily_stats").select("*").eq("date", latest.date).order("active_jobs", { ascending: false }).limit(12),
    supabase.from("market_skill_daily_stats").select("*").eq("date", latest.date).eq("role", "").eq("domain", "").order("active_jobs", { ascending: false }).limit(16),
    supabase.from("market_domain_daily_stats").select("*").eq("date", latest.date).order("active_jobs", { ascending: false }).limit(12),
  ]);
  for (const result of [roles, skills, domains]) if (result.error) throw new Error(result.error.message);
  return {
    daily: daily ?? [],
    latest,
    roles: roles.data ?? [],
    skills: skills.data ?? [],
    domains: domains.data ?? [],
  } as JobMarketSnapshot;
}

export async function listAdminJobs(status?: string): Promise<AdminJob[]> {
  const result = await callCoreliaApi<{ items: AdminJob[] }>("jobs.admin", {
    action: "jobs.list",
    status: status ?? "",
  });
  return result.items;
}

export async function listJobSourcesAdmin(): Promise<JobSourceAdmin[]> {
  const result = await callCoreliaApi<{ items: JobSourceAdmin[] }>("jobs.admin", { action: "sources.list" });
  return result.items;
}

export async function updateJobSourceAdmin(id: string, patch: Partial<JobSourceAdmin>): Promise<void> {
  await callCoreliaApi("jobs.admin", { action: "sources.update", id, enabled: patch.enabled });
}

export async function listJobCompaniesAdmin(): Promise<JobCompanyAdmin[]> {
  const result = await callCoreliaApi<{ items: JobCompanyAdmin[] }>("jobs.admin", { action: "companies.list" });
  return result.items;
}

export async function saveJobCompanyAdmin(input: Partial<JobCompanyAdmin> & Pick<JobCompanyAdmin, "name" | "slug" | "source_type" | "source_identifier">): Promise<void> {
  const payload = {
    name: input.name,
    slug: input.slug,
    logo_url: input.logo_url ?? null,
    website_url: input.website_url ?? null,
    careers_url: input.careers_url ?? null,
    source_type: input.source_type,
    source_identifier: input.source_identifier,
    source_region: input.source_region || "global",
    domains: input.domains ?? [],
    crawl_interval_hours: input.crawl_interval_hours ?? null,
    priority: input.priority ?? 50,
    active: input.active ?? true,
    verified: input.verified ?? false,
  };
  await callCoreliaApi("jobs.admin", { action: "companies.save", id: input.id ?? "", ...payload });
}

export async function listCrawlerRuns(): Promise<CrawlerRun[]> {
  const result = await callCoreliaApi<{ items: CrawlerRun[] }>("jobs.admin", { action: "runs.list" });
  return result.items;
}

export async function runJobsTarget(targetType: "company" | "source" | "adapter" | "all", targetValue?: string): Promise<Record<string, unknown>> {
  return callCoreliaApi("jobs.run", { target_type: targetType, target_value: targetValue ?? "" });
}

export async function reviewJob(jobId: string, status: "active" | "review" | "rejected" | "expired" | "disabled", overrides: Record<string, unknown> = {}): Promise<Job> {
  const result = await callCoreliaApi<{ job: Job }>("jobs.review", { job_id: jobId, status, overrides });
  return result.job;
}

export async function refreshJobsAnalytics(): Promise<Record<string, unknown>> {
  return callCoreliaApi("jobs.refreshAnalytics", {});
}

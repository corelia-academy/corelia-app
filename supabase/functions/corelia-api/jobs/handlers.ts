import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { crawlCompany, refreshJobAnalytics, revalidateCompany } from "./pipeline.ts";
import type { JobCompanyRow } from "./types.ts";

const COMPANY_SELECT = "id,source_id,name,slug,logo_url,website_url,careers_url,domains,source_type,source_identifier,source_region,active,verified,crawl_interval_hours,priority,last_success_at,last_revalidated_at";
const ADMIN_ROLES = new Set(["admin", "support_staff"]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorResponse(error: unknown): Response {
  const message = errorMessage(error);
  if (/Authorization|session|token/i.test(message)) return json({ message: "unauthenticated" }, 401);
  if (message.startsWith("forbidden")) return json({ message }, 403);
  if (message.startsWith("invalid_input")) return json({ message }, 400);
  if (message.startsWith("not_found")) return json({ message }, 404);
  console.error("[corelia-api] jobs", error);
  return json({ message: "jobs_operation_failed" }, 500);
}

async function requireStaff(req: Request, db: SupabaseClient): Promise<string> {
  const user = await verifyBearerUser(req, db);
  const role = await getUserRole(db, user.id);
  if (!ADMIN_ROLES.has(role)) throw new Error("forbidden:jobs_admin");
  return user.id;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

async function selectCompanies(
  db: SupabaseClient,
  targetType: string,
  targetValue: string,
  maxTargets: number,
): Promise<JobCompanyRow[]> {
  let query = db.from("job_companies").select(COMPANY_SELECT).eq("active", true);
  if (targetType === "company") query = query.eq("id", targetValue);
  else if (targetType === "adapter") query = query.eq("source_type", targetValue);
  else if (targetType === "source") query = query.eq("source_id", targetValue);
  else if (targetType !== "all") {
    throw new Error("invalid_input:target_type");
  }
  const { data, error } = await query.order("priority", { ascending: false }).limit(maxTargets);
  if (error) throw new Error(error.message);
  return (data ?? []) as JobCompanyRow[];
}

function isDue(company: JobCompanyRow, sourceCrawlHours: number): boolean {
  if (!company.last_success_at) return true;
  const crawlHours = company.crawl_interval_hours ?? sourceCrawlHours;
  return new Date(company.last_success_at).getTime() + crawlHours * 3_600_000 <= Date.now();
}

async function runCompanies(
  db: SupabaseClient,
  companies: JobCompanyRow[],
  triggerType: "scheduled" | "manual" | "retry",
  createdBy: string | null,
): Promise<Response> {
  const results: Array<Record<string, unknown>> = [];
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  const openAiModel = Deno.env.get("CORELIA_JOBS_CLASSIFIER_MODEL")?.trim() || "gpt-5.4-mini";
  for (const company of companies) {
    try {
      const result = await crawlCompany(db, company, { triggerType, createdBy, openAiApiKey, openAiModel });
      results.push({ company_id: company.id, company: company.name, ok: !result.partial, ...result });
    } catch (error) {
      results.push({ company_id: company.id, company: company.name, ok: false, error: errorMessage(error) });
    }
  }
  let analytics: Record<string, number> | null = null;
  let analyticsError: string | null = null;
  try {
    analytics = await refreshJobAnalytics(db);
  } catch (error) {
    analyticsError = errorMessage(error);
  }
  const failures = results.filter((result) => !result.ok).length;
  return json({
    ok: failures === 0,
    companies: results.length,
    failures,
    results,
    analytics,
    analytics_error: analyticsError,
  }, failures ? 207 : 200);
}

async function revalidateCompanies(
  db: SupabaseClient,
  companies: JobCompanyRow[],
  triggerType: "scheduled" | "manual" | "retry",
  createdBy: string | null,
): Promise<Response> {
  const results: Array<Record<string, unknown>> = [];
  for (const company of companies) {
    try {
      const result = await revalidateCompany(db, company, { triggerType, createdBy });
      results.push({ company_id: company.id, company: company.name, ok: true, ...result });
    } catch (error) {
      results.push({ company_id: company.id, company: company.name, ok: false, error: errorMessage(error) });
    }
  }
  const failures = results.filter((result) => !result.ok).length;
  return json({ ok: failures === 0, companies: results.length, failures, results }, failures ? 207 : 200);
}

async function runAnalytics(
  db: SupabaseClient,
  triggerType: "scheduled" | "manual",
  createdBy: string | null,
): Promise<Record<string, unknown>> {
  const { data: run, error: runError } = await db.from("crawler_runs").insert({
    trigger_type: triggerType,
    target_type: "analytics",
    status: "running",
    created_by: createdBy,
  }).select("id").single();
  if (runError) throw new Error(runError.message);
  try {
    const result = await refreshJobAnalytics(db);
    const { error } = await db.from("crawler_runs").update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      metadata: result,
    }).eq("id", run.id);
    if (error) throw new Error(error.message);
    return { ok: true, ...result };
  } catch (error) {
    await db.from("crawler_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage(error),
    }).eq("id", run.id);
    throw error;
  }
}

export async function handleJobsRun(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const actorId = await requireStaff(req, db);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mode = String(body.mode ?? "discovery").trim();
    if (!new Set(["discovery", "revalidation"]).has(mode)) throw new Error("invalid_input:jobs_run_mode");
    const targetType = String(body.target_type ?? "all").trim();
    const targetValue = String(body.target_value ?? "").trim();
    if (["company", "source", "adapter"].includes(targetType) && !targetValue) {
      throw new Error("invalid_input:target_value");
    }
    const companies = await selectCompanies(
      db,
      targetType,
      targetValue,
      numberInRange(body.max_targets, targetType === "company" ? 1 : 3, 1, 10),
    );
    return mode === "revalidation"
      ? revalidateCompanies(db, companies, "manual", actorId)
      : runCompanies(db, companies, "manual", actorId);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleJobsRunScheduled(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const expected = Deno.env.get("CORELIA_JOBS_CRON_SECRET")?.trim() ?? "";
    const provided = req.headers.get("x-corelia-jobs-cron-secret")?.trim() ?? "";
    if (!expected || provided !== expected) return json({ message: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const mode = String(body.mode ?? "discovery").trim();
    if (!new Set(["discovery", "revalidation", "analytics"]).has(mode)) {
      throw new Error("invalid_input:jobs_scheduled_mode");
    }
    if (mode === "analytics") return json(await runAnalytics(db, "scheduled", null));
    const { data: sources, error: sourcesError } = await db
      .from("job_sources")
      .select("id,default_crawl_hours")
      .eq("enabled", true)
      .not("policy_reviewed_at", "is", null);
    if (sourcesError) throw new Error(sourcesError.message);
    const crawlHoursBySource = new Map(
      (sources ?? []).map((source) => [String(source.id), Number(source.default_crawl_hours)]),
    );
    const companies = (await selectCompanies(db, "all", "", 1_000))
      .filter((company) => {
        const sourceCrawlHours = crawlHoursBySource.get(company.source_id);
        if (sourceCrawlHours == null) return false;
        if (mode === "revalidation") {
          if (!company.last_revalidated_at) return true;
          const crawlHours = company.crawl_interval_hours ?? sourceCrawlHours;
          return new Date(company.last_revalidated_at).getTime() + crawlHours * 3_600_000 <= Date.now();
        }
        return isDue(company, sourceCrawlHours);
      })
      .slice(0, numberInRange(body.max_targets, 1, 1, 10));
    return mode === "revalidation"
      ? revalidateCompanies(db, companies, "scheduled", null)
      : runCompanies(db, companies, "scheduled", null);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleJobsRefreshAnalytics(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const actorId = await requireStaff(req, db);
    return json(await runAnalytics(db, "manual", actorId));
  } catch (error) {
    return errorResponse(error);
  }
}

const OVERRIDE_SCALAR_FIELDS = new Set([
  "title", "summary", "job_type", "primary_role", "seniority", "employment_type",
  "remote_type", "remote_eligibility", "location_text", "salary_min",
  "salary_max", "salary_currency", "salary_period", "review_reason",
]);
const OVERRIDE_LIST_FIELDS = new Set([
  "roles", "domains", "required_skills", "preferred_skills", "country_codes", "regions",
]);

export async function handleJobsReview(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    await requireStaff(req, db);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const jobId = String(body.job_id ?? "").trim();
    const status = String(body.status ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId) || !["active", "review", "rejected", "expired", "disabled"].includes(status)) {
      throw new Error("invalid_input:job_review");
    }
    const { data: existing, error: existingError } = await db
      .from("jobs")
      .select("manual_overrides")
      .eq("id", jobId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("not_found:job");
    const currentOverrides = existing.manual_overrides && typeof existing.manual_overrides === "object"
      ? existing.manual_overrides as Record<string, unknown>
      : {};
    const requested = body.overrides && typeof body.overrides === "object" && !Array.isArray(body.overrides)
      ? body.overrides as Record<string, unknown>
      : {};
    const overrides: Record<string, unknown> = { ...currentOverrides, status };
    const update: Record<string, unknown> = { status };
    for (const [field, value] of Object.entries(requested)) {
      if (OVERRIDE_SCALAR_FIELDS.has(field)) {
        overrides[field] = value;
        update[field] = value;
      } else if (OVERRIDE_LIST_FIELDS.has(field) && Array.isArray(value)) {
        const list = Array.from(new Set(value.map(String).map((item) => item.trim()).filter(Boolean)));
        overrides[field] = list;
        update[field] = list;
      }
    }
    if (status === "active" && !Object.prototype.hasOwnProperty.call(update, "review_reason")) {
      overrides.review_reason = null;
      update.review_reason = null;
    }
    update.manual_overrides = overrides;
    const { data, error } = await db.from("jobs").update(update).eq("id", jobId).select("*").single();
    if (error) throw new Error(error.message);
    return json({ ok: true, job: data });
  } catch (error) {
    return errorResponse(error);
  }
}

const ADMIN_JOB_STATUSES = new Set(["review", "active", "rejected", "expired", "disabled", "duplicate"]);
const COMPANY_SOURCE_TYPES = new Set([
  "greenhouse", "lever", "ashby", "smartrecruiters", "cryptojobslist", "web3career",
  "himalayas", "weworkremotely", "remotive", "remoteok", "rss",
]);

function stringListInput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).map((item) => item.trim()).filter(Boolean)));
}

function optionalText(value: unknown, maxLength = 2_000): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function httpUrl(value: unknown): string | null {
  const text = optionalText(value, 2_000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid");
    return url.toString();
  } catch {
    throw new Error("invalid_input:url");
  }
}

function feedUrlsInput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls = Array.from(new Set(
    value.map((entry) => {
      const normalized = httpUrl(entry);
      if (!normalized) return null;
      const hostname = new URL(normalized).hostname.toLowerCase().replace(/^\[|\]$/g, "");
      const privateIpv4 = /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
      if (hostname === "localhost" || hostname === "::1" || hostname.endsWith(".localhost") || privateIpv4) {
        throw new Error("invalid_input:feed_url_host");
      }
      return normalized;
    }).filter((entry): entry is string => Boolean(entry)),
  ));
  if (urls.length > 10) throw new Error("invalid_input:feed_urls");
  return urls;
}

async function jobCountsBy(
  db: SupabaseClient,
  field: "source_id" | "company_id",
  activeOnly: boolean,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const pageSize = 1_000;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    let query = db.from("jobs").select(field).not(field, "is", null);
    if (activeOnly) query = query.eq("status", "active");
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const key = String(row[field]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if ((data ?? []).length < pageSize) return counts;
  }
  throw new Error("jobs_admin_count_limit_exceeded");
}

export async function handleJobsAdmin(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const actorId = await requireStaff(req, db);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "").trim();
    if (action === "jobs.list") {
      const status = String(body.status ?? "").trim();
      if (status && !ADMIN_JOB_STATUSES.has(status)) throw new Error("invalid_input:job_status");
      let query = db.from("jobs").select("*").order("updated_at", { ascending: false }).limit(200);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return json({ items: data ?? [] });
    }
    if (action === "sources.list") {
      const [{ data, error }, counts] = await Promise.all([
        db.from("job_sources").select("*").order("priority", { ascending: false }),
        jobCountsBy(db, "source_id", false),
      ]);
      if (error) throw new Error(error.message);
      const items = (data ?? []).map((source) => ({
        ...source,
        jobs_found: counts.get(String(source.id)) ?? 0,
      }));
      return json({ items });
    }
    if (action === "sources.update") {
      const id = String(body.id ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        throw new Error("invalid_input:job_source_update");
      }
      const { data: existing, error: existingError } = await db.from("job_sources")
        .select("adapter_config,policy_reviewed_at")
        .eq("id", id)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (!existing) throw new Error("not_found:job_source");
      const update: Record<string, unknown> = {};
      for (const field of [
        "enabled", "attribution_required", "canonical_link_required",
        "allow_description_display", "allow_seo_indexing",
      ]) {
        if (typeof body[field] === "boolean") update[field] = body[field];
      }
      if (body.default_crawl_hours != null) {
        update.default_crawl_hours = numberInRange(body.default_crawl_hours, 24, 6, 168);
      }
      if (body.priority != null) update.priority = numberInRange(body.priority, 50, 0, 100);
      for (const field of ["attribution_text", "redistribution_notes"]) {
        if (Object.prototype.hasOwnProperty.call(body, field)) update[field] = optionalText(body[field]);
      }
      if (Object.prototype.hasOwnProperty.call(body, "terms_url")) update.terms_url = httpUrl(body.terms_url);
      if (typeof body.policy_reviewed === "boolean") {
        update.policy_reviewed_at = body.policy_reviewed
          ? existing.policy_reviewed_at ?? new Date().toISOString()
          : null;
        if (body.policy_reviewed === false) update.enabled = false;
      }
      if (Object.prototype.hasOwnProperty.call(body, "feed_urls")) {
        update.adapter_config = {
          ...(existing.adapter_config && typeof existing.adapter_config === "object" ? existing.adapter_config : {}),
          feed_urls: feedUrlsInput(body.feed_urls),
        };
      }
      if (!Object.keys(update).length) throw new Error("invalid_input:job_source_update");
      const reviewed = Object.prototype.hasOwnProperty.call(update, "policy_reviewed_at")
        ? update.policy_reviewed_at
        : existing.policy_reviewed_at;
      if (update.enabled === true && !reviewed) throw new Error("invalid_input:source_policy_required");
      const { data, error } = await db.from("job_sources")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return json({ item: data });
    }
    if (action === "sources.save") {
      const name = String(body.name ?? "").trim().slice(0, 120);
      const slug = String(body.slug ?? "").trim().toLowerCase();
      const feedUrls = feedUrlsInput(body.feed_urls);
      if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !feedUrls.length) {
        throw new Error("invalid_input:job_source");
      }
      const policyReviewed = body.policy_reviewed === true;
      const payload = {
        name,
        slug,
        source_type: "rss",
        base_url: httpUrl(body.base_url) ?? feedUrls[0],
        adapter_config: { feed_urls: feedUrls },
        default_crawl_hours: numberInRange(body.default_crawl_hours, 24, 6, 168),
        priority: numberInRange(body.priority, 50, 0, 100),
        enabled: body.enabled === true && policyReviewed,
        attribution_required: body.attribution_required !== false,
        attribution_text: optionalText(body.attribution_text),
        canonical_link_required: body.canonical_link_required !== false,
        allow_description_display: body.allow_description_display === true,
        allow_seo_indexing: body.allow_seo_indexing === true,
        redistribution_notes: optionalText(body.redistribution_notes),
        terms_url: httpUrl(body.terms_url),
        policy_reviewed_at: policyReviewed ? new Date().toISOString() : null,
      };
      const { data, error } = await db.from("job_sources").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      const { error: targetError } = await db.from("job_companies").insert({
        source_id: data.id,
        source_type: "rss",
        name: `${name} feed`,
        slug: `${slug}-feed`,
        website_url: payload.base_url,
        careers_url: feedUrls[0],
        domains: [],
        source_identifier: slug,
        source_region: "global",
        crawl_interval_hours: payload.default_crawl_hours,
        priority: payload.priority,
        verified: policyReviewed,
        active: true,
      });
      if (targetError) {
        await db.from("job_sources").delete().eq("id", data.id);
        throw new Error(targetError.message);
      }
      return json({ item: data });
    }
    if (action === "companies.list") {
      const [{ data, error }, counts] = await Promise.all([
        db.from("job_companies").select("*").order("priority", { ascending: false }),
        jobCountsBy(db, "company_id", true),
      ]);
      if (error) throw new Error(error.message);
      const items = (data ?? []).map((company) => ({
        ...company,
        open_jobs: counts.get(String(company.id)) ?? 0,
      }));
      return json({ items });
    }
    if (action === "companies.save") {
      const id = String(body.id ?? "").trim();
      const name = String(body.name ?? "").trim();
      const slug = String(body.slug ?? "").trim().toLowerCase();
      const requestedSourceId = String(body.source_id ?? "").trim();
      const requestedSourceType = String(body.source_type ?? "").trim();
      const sourceIdentifier = String(body.source_identifier ?? "").trim();
      const sourceRegion = String(body.source_region ?? "global").trim();
      if (
        (id && !/^[0-9a-f-]{36}$/i.test(id)) || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        (!requestedSourceId && !COMPANY_SOURCE_TYPES.has(requestedSourceType)) || !sourceIdentifier || !["global", "eu"].includes(sourceRegion)
      ) {
        throw new Error("invalid_input:job_company");
      }
      let sourceQuery = db.from("job_sources").select("id,source_type");
      sourceQuery = requestedSourceId
        ? sourceQuery.eq("id", requestedSourceId)
        : sourceQuery.eq("source_type", requestedSourceType);
      const { data: sourceRows, error: sourceError } = await sourceQuery.limit(2);
      if (sourceError) throw new Error(sourceError.message);
      if (sourceRows?.length !== 1 || !COMPANY_SOURCE_TYPES.has(String(sourceRows[0].source_type))) {
        throw new Error("invalid_input:job_company_source");
      }
      const sourceId = String(sourceRows[0].id);
      const sourceType = String(sourceRows[0].source_type);
      if (!new Set(["greenhouse", "lever", "ashby", "smartrecruiters"]).has(sourceType)) {
        throw new Error("invalid_input:job_company_managed_source");
      }
      const payload = {
        name,
        slug,
        logo_url: httpUrl(body.logo_url),
        website_url: httpUrl(body.website_url),
        careers_url: httpUrl(body.careers_url),
        domains: stringListInput(body.domains),
        source_id: sourceId,
        source_type: sourceType,
        source_identifier: sourceIdentifier,
        source_region: sourceRegion,
        crawl_interval_hours: body.crawl_interval_hours == null
          ? null
          : numberInRange(body.crawl_interval_hours, 24, 6, 168),
        priority: numberInRange(body.priority, 50, 0, 100),
        verified: body.verified === true,
        active: body.active !== false,
      };
      const query = id
        ? db.from("job_companies").update(payload).eq("id", id)
        : db.from("job_companies").insert(payload);
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.message);
      return json({ item: data });
    }
    if (action === "runs.list") {
      const { data, error } = await db.from("crawler_runs").select("*").order("started_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return json({ items: data ?? [] });
    }
    if (action === "alerts.list") {
      let query = db.from("job_operational_alerts").select("*")
        .order("last_seen_at", { ascending: false }).limit(200);
      if (body.include_resolved !== true) query = query.is("resolved_at", null);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return json({ items: data ?? [] });
    }
    if (action === "alerts.resolve") {
      const id = String(body.id ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("invalid_input:job_alert");
      const { data, error } = await db.from("job_operational_alerts").update({
        resolved_at: new Date().toISOString(),
        resolved_by: actorId,
      }).eq("id", id).is("resolved_at", null).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("not_found:job_alert");
      return json({ item: data });
    }
    throw new Error("invalid_input:jobs_admin_action");
  } catch (error) {
    return errorResponse(error);
  }
}

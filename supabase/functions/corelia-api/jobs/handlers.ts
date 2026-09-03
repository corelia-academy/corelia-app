import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { crawlCompany, refreshJobAnalytics } from "./pipeline.ts";
import type { JobCompanyRow } from "./types.ts";

const COMPANY_SELECT = "id,name,slug,logo_url,website_url,careers_url,domains,source_type,source_identifier,source_region,active,verified,crawl_interval_hours,priority,last_success_at";
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
  else if (targetType === "source") {
    const { data: source, error: sourceError } = await db
      .from("job_sources")
      .select("source_type")
      .eq("id", targetValue)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!source) throw new Error("not_found:job_source");
    query = query.eq("source_type", source.source_type);
  } else if (targetType !== "all") {
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

export async function handleJobsRun(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const actorId = await requireStaff(req, db);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
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
    return runCompanies(db, companies, "manual", actorId);
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
    const { data: sources, error: sourcesError } = await db
      .from("job_sources")
      .select("source_type,default_crawl_hours")
      .eq("enabled", true);
    if (sourcesError) throw new Error(sourcesError.message);
    const crawlHoursBySource = new Map(
      (sources ?? []).map((source) => [String(source.source_type), Number(source.default_crawl_hours)]),
    );
    const companies = (await selectCompanies(db, "all", "", 1_000))
      .filter((company) => {
        const sourceCrawlHours = crawlHoursBySource.get(company.source_type);
        return sourceCrawlHours != null && isDue(company, sourceCrawlHours);
      })
      .slice(0, numberInRange(body.max_targets, 1, 1, 10));
    return runCompanies(db, companies, "scheduled", null);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleJobsRefreshAnalytics(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const actorId = await requireStaff(req, db);
    const { data: run, error: runError } = await db.from("crawler_runs").insert({
      trigger_type: "manual",
      target_type: "analytics",
      status: "running",
      created_by: actorId,
    }).select("id").single();
    if (runError) throw new Error(runError.message);
    try {
      const result = await refreshJobAnalytics(db);
      await db.from("crawler_runs").update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        metadata: result,
      }).eq("id", run.id);
      return json({ ok: true, ...result });
    } catch (error) {
      await db.from("crawler_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage(error),
      }).eq("id", run.id);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}

const OVERRIDE_SCALAR_FIELDS = new Set([
  "title", "summary", "primary_role", "seniority", "employment_type",
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
const COMPANY_SOURCE_TYPES = new Set(["greenhouse", "lever", "ashby", "smartrecruiters"]);

function stringListInput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).map((item) => item.trim()).filter(Boolean)));
}

export async function handleJobsAdmin(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    await requireStaff(req, db);
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
      const { data, error } = await db.from("job_sources").select("*").order("priority", { ascending: false });
      if (error) throw new Error(error.message);
      return json({ items: data ?? [] });
    }
    if (action === "sources.update") {
      const id = String(body.id ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body.enabled !== "boolean") {
        throw new Error("invalid_input:job_source_update");
      }
      const { data, error } = await db.from("job_sources")
        .update({ enabled: body.enabled })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return json({ item: data });
    }
    if (action === "companies.list") {
      const { data, error } = await db.from("job_companies").select("*").order("priority", { ascending: false });
      if (error) throw new Error(error.message);
      return json({ items: data ?? [] });
    }
    if (action === "companies.save") {
      const id = String(body.id ?? "").trim();
      const name = String(body.name ?? "").trim();
      const slug = String(body.slug ?? "").trim().toLowerCase();
      const sourceType = String(body.source_type ?? "").trim();
      const sourceIdentifier = String(body.source_identifier ?? "").trim();
      const sourceRegion = String(body.source_region ?? "global").trim();
      if (
        (id && !/^[0-9a-f-]{36}$/i.test(id)) || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        !COMPANY_SOURCE_TYPES.has(sourceType) || !sourceIdentifier || !["global", "eu"].includes(sourceRegion)
      ) {
        throw new Error("invalid_input:job_company");
      }
      const payload = {
        name,
        slug,
        logo_url: typeof body.logo_url === "string" && body.logo_url.trim() ? body.logo_url.trim() : null,
        website_url: typeof body.website_url === "string" && body.website_url.trim() ? body.website_url.trim() : null,
        careers_url: typeof body.careers_url === "string" && body.careers_url.trim() ? body.careers_url.trim() : null,
        domains: stringListInput(body.domains),
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
    throw new Error("invalid_input:jobs_admin_action");
  } catch (error) {
    return errorResponse(error);
  }
}

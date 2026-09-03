import type { SupabaseClient } from "../lib/supabase.ts";
import { fetchCompanyJobs, sourceHasCompleteSnapshot } from "./adapters.ts";
import {
  classifyJob,
  classifyJobDeterministically,
  CLASSIFIER_VERSION,
  DETERMINISTIC_VERSION,
} from "./classify.ts";
import {
  normalizeUrl,
  sha256,
  slugify,
  stableStringify,
  validateExternalUrl,
} from "./normalization.ts";
import { shouldReplaceCanonical } from "./dedupe.ts";
import { syncRunOperationalAlerts } from "./operations.ts";
import {
  emptyCrawlCounters,
  type CrawlCounters,
  type JobClassification,
  type JobCompanyRow,
  type JobSourceRow,
  type NormalizedSourceJob,
} from "./types.ts";

type ExistingJob = {
  id: string;
  slug: string;
  status: string;
  payload_hash: string;
  input_hash: string;
  classifier_version: string | null;
  manual_overrides: Record<string, unknown> | null;
};

type CanonicalDuplicate = ExistingJob & {
  source_id: string;
  source_job_id: string;
  source_url: string;
  job_sources: {
    source_type: JobCompanyRow["source_type"];
    priority: number;
  } | null;
};

type CrawlOptions = {
  triggerType: "scheduled" | "manual" | "retry";
  createdBy?: string | null;
  openAiApiKey?: string;
  openAiModel?: string;
};

export function hasUnchangedSourceInput(
  existing: Pick<ExistingJob, "payload_hash" | "input_hash" | "classifier_version"> | null,
  payloadHash: string,
  inputHash: string,
  classifierVersion: string,
): boolean {
  return existing?.payload_hash === payloadHash &&
    existing.input_hash === inputHash &&
    existing.classifier_version === classifierVersion;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return unique(value.map((entry) => String(entry).trim()));
}

function normalizeSalary(job: NormalizedSourceJob): void {
  const currency = job.salaryCurrency?.trim().toUpperCase() ?? "";
  const invalidRange = job.salaryMin != null && job.salaryMax != null && job.salaryMax < job.salaryMin;
  if (!/^[A-Z]{3}$/.test(currency) || invalidRange) {
    job.salaryMin = null;
    job.salaryMax = null;
    job.salaryCurrency = null;
    job.salaryPeriod = null;
    return;
  }
  job.salaryCurrency = currency;
}

function applyManualOverrides(
  payload: Record<string, unknown>,
  overrides: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!overrides) return payload;
  const output = { ...payload, manual_overrides: overrides };
  const scalarFields = [
    "title", "summary", "job_type", "primary_role", "seniority", "employment_type",
    "remote_type", "remote_eligibility", "location_text", "salary_min",
    "salary_max", "salary_currency", "salary_period", "status", "review_reason",
  ];
  for (const field of scalarFields) {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) output[field] = overrides[field];
  }
  for (const field of ["roles", "domains", "required_skills", "preferred_skills", "country_codes", "regions"]) {
    const list = stringList(overrides[field]);
    if (list) output[field] = list;
  }
  return output;
}

function qualityGate(
  classification: JobClassification,
  source: JobSourceRow,
  company: JobCompanyRow,
  job: NormalizedSourceJob,
  existing: ExistingJob | null,
): { status: string; reason: string | null } {
  if (!classification.isRelevant) return { status: "rejected", reason: "not_relevant" };
  if (!job.title || !job.companyName || !job.sourceUrl || !job.applyUrl) {
    return { status: "rejected", reason: "missing_essential_data" };
  }
  if (!source.policy_reviewed_at) return { status: "review", reason: "source_policy_not_reviewed" };
  if (!company.verified) return { status: "review", reason: "company_not_verified" };
  if (!classification.primaryRole) return { status: "review", reason: "role_not_confidently_classified" };
  if (classification.model === "deterministic") {
    if (existing?.status === "active") return { status: "active", reason: null };
    return { status: "review", reason: "ai_not_configured_or_unavailable" };
  }
  if (classification.confidence >= 0.8 && classification.qualityScore >= 60) {
    return { status: "active", reason: null };
  }
  if (classification.confidence < 0.5 || classification.qualityScore < 40) {
    return { status: "rejected", reason: "low_quality_or_confidence" };
  }
  return { status: "review", reason: "needs_human_review" };
}

function rankingScore(job: NormalizedSourceJob, source: JobSourceRow, classification: JobClassification): number {
  const ageDays = job.postedAt
    ? Math.max(0, (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000)
    : 30;
  const freshness = Math.max(0, 40 - Math.min(40, ageDays * 1.5));
  return Math.round((
    freshness +
    source.priority * 0.25 +
    (job.salaryMin != null || job.salaryMax != null ? 5 : 0) +
    (classification.requiredSkills.length ? 5 : 0) +
    (job.descriptionPlain.length >= 400 ? 5 : 0) +
    (/^https:\/\//.test(job.applyUrl) ? 5 : 0)
  ) * 100) / 100;
}

async function lookupSource(db: SupabaseClient, sourceId: string): Promise<JobSourceRow> {
  const { data, error } = await db
    .from("job_sources")
    .select("id,name,slug,source_type,enabled,priority,policy_reviewed_at,allow_description_display,canonical_link_required,adapter_config")
    .eq("id", sourceId)
    .eq("enabled", true)
    .not("policy_reviewed_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`job_source_not_enabled_or_reviewed:${sourceId}`);
  return data as JobSourceRow;
}

async function findExistingJob(
  db: SupabaseClient,
  sourceId: string,
  sourceJobId: string,
): Promise<ExistingJob | null> {
  const { data, error } = await db
    .from("jobs")
    .select("id,slug,status,payload_hash,input_hash,classifier_version,manual_overrides")
    .eq("source_id", sourceId)
    .eq("source_job_id", sourceJobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ExistingJob | null;
}

async function findCanonicalDuplicate(
  db: SupabaseClient,
  canonicalUrl: string,
  fingerprint: string,
  sourceId: string,
): Promise<CanonicalDuplicate | null> {
  const select = "id,slug,status,payload_hash,input_hash,classifier_version,manual_overrides,source_id,source_job_id,source_url,job_sources!inner(source_type,priority)";
  const { data: urlMatches, error: urlError } = await db
    .from("jobs")
    .select(select)
    .eq("canonical_url", canonicalUrl)
    .limit(20);
  if (urlError) throw new Error(urlError.message);
  const matches = [...(urlMatches ?? [])] as unknown as CanonicalDuplicate[];
  if (!matches.length) {
    const { data: fingerprintMatches, error: fingerprintError } = await db
      .from("jobs")
      .select(select)
      .eq("fingerprint", fingerprint)
      .neq("source_id", sourceId)
      .limit(20);
    if (fingerprintError) throw new Error(fingerprintError.message);
    matches.push(...(fingerprintMatches ?? []) as unknown as CanonicalDuplicate[]);
  }
  return matches.sort((left, right) => {
    if (!left.job_sources) return 1;
    if (!right.job_sources) return -1;
    const leftWins = shouldReplaceCanonical(right.job_sources, left.job_sources);
    const rightWins = shouldReplaceCanonical(left.job_sources, right.job_sources);
    return leftWins ? -1 : rightWins ? 1 : left.id.localeCompare(right.id);
  })[0] ?? null;
}

async function writeRawJob(
  db: SupabaseClient,
  source: JobSourceRow,
  company: JobCompanyRow,
  job: NormalizedSourceJob,
  payloadHash: string,
): Promise<{ id: string; isNew: boolean }> {
  const { data: existing, error: lookupError } = await db
    .from("raw_jobs")
    .select("id")
    .eq("source_id", source.id)
    .eq("source_job_id", job.sourceJobId)
    .eq("payload_hash", payloadHash)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const { data, error } = await db
    .from("raw_jobs")
    .upsert({
      source_id: source.id,
      company_id: company.id,
      source_job_id: job.sourceJobId,
      payload: job.raw,
      payload_hash: payloadHash,
      processing_status: "processing",
      processed_at: null,
      processing_error: null,
    }, { onConflict: "source_id,source_job_id,payload_hash" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String(data.id), isNew: !existing };
}

async function markRaw(
  db: SupabaseClient,
  rawId: string | null,
  status: "processed" | "unchanged" | "rejected" | "failed",
  jobId?: string | null,
  errorText?: string | null,
): Promise<void> {
  if (!rawId) return;
  const { error } = await db.from("raw_jobs").update({
    processing_status: status,
    processed_at: new Date().toISOString(),
    canonical_job_id: jobId ?? null,
    processing_error: errorText ?? null,
  }).eq("id", rawId);
  if (error) throw new Error(error.message);
}

async function processSourceJob(
  db: SupabaseClient,
  source: JobSourceRow,
  company: JobCompanyRow,
  job: NormalizedSourceJob,
  options: CrawlOptions,
  counters: CrawlCounters,
): Promise<void> {
  if (!job.sourceJobId) {
    counters.rejected_count += 1;
    return;
  }
  job.sourceUrl = normalizeUrl(job.sourceUrl);
  job.applyUrl = job.preserveApplyUrl
    ? validateExternalUrl(job.applyUrl || job.sourceUrl)
    : normalizeUrl(job.applyUrl || job.sourceUrl);
  normalizeSalary(job);
  const payloadHash = await sha256(stableStringify(job.raw));
  const inputHash = await sha256(stableStringify({
    title: job.title,
    company: job.companyName,
    description: job.descriptionPlain,
    location: job.locationText,
    employment: job.employmentType,
    salary: [job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod],
    tags: job.sourceTags,
  }));
  const fingerprint = await sha256(`${slugify(job.companyName)}|${slugify(job.title)}|${slugify(job.locationText)}`);
  const deterministicClassification = classifyJobDeterministically(job);
  const shouldUseAi = Boolean(options.openAiApiKey && deterministicClassification.isRelevant);
  const targetClassifierVersion = shouldUseAi ? CLASSIFIER_VERSION : DETERMINISTIC_VERSION;
  const existing = await findExistingJob(db, source.id, job.sourceJobId);
  if (hasUnchangedSourceInput(existing, payloadHash, inputHash, targetClassifierVersion)) {
    counters.unchanged_count += 1;
    const { error } = await db.from("jobs").update({
      last_seen_at: new Date().toISOString(),
      source_updated_at: job.sourceUpdatedAt,
      ranking_score: rankingScore(job, source, deterministicClassification),
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const raw = await writeRawJob(db, source, company, job, payloadHash);
  if (raw.isNew) counters.new_raw_count += 1;
  try {
    if (!job.title || !job.companyName || !job.sourceUrl || !job.applyUrl) {
      counters.rejected_count += 1;
      if (existing) {
        const { error } = await db.from("jobs").update({
          status: "rejected",
          review_reason: "missing_essential_data",
          payload_hash: payloadHash,
          last_seen_at: new Date().toISOString(),
        }).eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
      await markRaw(db, raw.id, "rejected", existing?.id ?? null, "missing_essential_data");
      return;
    }
    let duplicate: CanonicalDuplicate | null = null;
    if (!existing) {
      duplicate = await findCanonicalDuplicate(db, job.applyUrl, fingerprint, source.id);
      if (duplicate && (!duplicate.job_sources || !shouldReplaceCanonical(duplicate.job_sources, source))) {
        const { error: linkError } = await db.from("job_source_links").upsert({
          job_id: duplicate.id,
          source_id: source.id,
          source_job_id: job.sourceJobId,
          source_url: job.sourceUrl,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "source_id,source_job_id" });
        if (linkError) throw new Error(linkError.message);
        await markRaw(db, raw.id, "processed", duplicate.id);
        counters.duplicate_count += 1;
        return;
      }
    }

    let classification: JobClassification | null = null;
    if (existing) {
      const { data: cached, error: cachedError } = await db
        .from("job_classifications")
        .select("output")
        .eq("job_id", existing.id)
        .eq("input_hash", inputHash)
        .eq("classifier_version", targetClassifierVersion)
        .maybeSingle();
      if (cachedError) throw new Error(cachedError.message);
      if (cached?.output) classification = cached.output as JobClassification;
    }
    if (!classification) {
      if (shouldUseAi) {
        counters.ai_queued_count += 1;
        classification = await classifyJob(job, {
          apiKey: options.openAiApiKey,
          model: options.openAiModel,
        });
        if (classification.model === "deterministic") counters.ai_failed_count += 1;
      } else {
        classification = deterministicClassification;
      }
    }
    const canonicalExisting = existing ?? duplicate;
    const gate = qualityGate(classification, source, company, job, canonicalExisting);
    const slugSuffix = (await sha256(`${source.id}|${job.sourceJobId}`)).slice(0, 10);
    const payload = applyManualOverrides({
      slug: canonicalExisting?.slug ?? `${slugify(job.companyName)}-${slugify(job.title)}-${slugSuffix}`,
      title: job.title,
      company_id: company.id,
      company_name: job.companyName,
      company_logo_url: job.companyLogoUrl || company.logo_url,
      description_html: source.allow_description_display ? job.descriptionHtml : null,
      description_plain: source.allow_description_display ? job.descriptionPlain : null,
      summary: classification.summary,
      job_type: classification.jobType,
      primary_role: classification.primaryRole,
      roles: classification.roles,
      domains: unique([...(company.domains ?? []), ...classification.domains]),
      required_skills: classification.requiredSkills,
      preferred_skills: classification.preferredSkills,
      mentioned_skills: unique([...classification.requiredSkills, ...classification.preferredSkills]),
      seniority: classification.seniority,
      experience_min_years: classification.experienceMinYears,
      experience_max_years: classification.experienceMaxYears,
      employment_type: job.employmentType,
      remote_type: classification.remoteType,
      location_text: job.locationText,
      country_codes: classification.countryCodes,
      regions: classification.regions,
      remote_eligibility: classification.remoteEligibility,
      salary_min: job.salaryMin,
      salary_max: job.salaryMax,
      salary_currency: job.salaryCurrency,
      salary_period: job.salaryPeriod,
      source_id: source.id,
      source_job_id: job.sourceJobId,
      source_url: job.sourceUrl,
      canonical_url: job.applyUrl,
      apply_url: job.applyUrl,
      posted_at: job.postedAt,
      expires_at: job.expiresAt ?? null,
      source_updated_at: job.sourceUpdatedAt,
      last_seen_at: new Date().toISOString(),
      status: gate.status,
      review_reason: gate.reason,
      quality_score: classification.qualityScore,
      classification_confidence: classification.confidence,
      classifier_version: classification.classifierVersion,
      input_hash: inputHash,
      payload_hash: payloadHash,
      fingerprint,
      ranking_score: rankingScore(job, source, classification),
    }, canonicalExisting?.manual_overrides);
    if (!existing && duplicate) {
      const { error: oldLinkError } = await db.from("job_source_links").upsert({
        job_id: duplicate.id,
        source_id: duplicate.source_id,
        source_job_id: duplicate.source_job_id,
        source_url: duplicate.source_url,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "source_id,source_job_id" });
      if (oldLinkError) throw new Error(oldLinkError.message);
    }
    const saveQuery = !existing && duplicate
      ? db.from("jobs").update(payload).eq("id", duplicate.id)
      : db.from("jobs").upsert(payload, { onConflict: "source_id,source_job_id" });
    const { data: saved, error: saveError } = await saveQuery.select("id,status").single();
    if (saveError) throw new Error(saveError.message);
    const jobId = String(saved.id);
    if (!existing && duplicate) counters.duplicate_count += 1;
    const { error: linkError } = await db.from("job_source_links").upsert({
      job_id: jobId,
      source_id: source.id,
      source_job_id: job.sourceJobId,
      source_url: job.sourceUrl,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "source_id,source_job_id" });
    if (linkError) throw new Error(linkError.message);
    if (!existing || classification.classifierVersion === targetClassifierVersion) {
      const { error: classificationError } = await db.from("job_classifications").upsert({
        job_id: jobId,
        input_hash: inputHash,
        model: classification.model,
        classifier_version: classification.classifierVersion,
        output: classification,
        evidence: classification.evidence,
        quality_score: classification.qualityScore,
        confidence: classification.confidence,
      }, { onConflict: "job_id,input_hash,classifier_version", ignoreDuplicates: true });
      if (classificationError) throw new Error(classificationError.message);
    }
    await markRaw(db, raw.id, saved.status === "rejected" ? "rejected" : "processed", jobId);
    if (saved.status === "active") counters.published_count += 1;
    else if (saved.status === "review") counters.review_count += 1;
    else if (saved.status === "rejected") counters.rejected_count += 1;
  } catch (error) {
    await markRaw(db, raw.id, "failed", null, errorMessage(error));
    throw error;
  }
}

async function expireMissingJobs(
  db: SupabaseClient,
  source: JobSourceRow,
  company: JobCompanyRow,
  fetchedSourceIds: Set<string>,
): Promise<number> {
  if (fetchedSourceIds.size === 0) return 0;
  const rows = await collectPagedRows("expiry_candidates", (from, to) =>
    db.from("jobs")
      .select("id,source_job_id")
      .eq("source_id", source.id)
      .eq("company_id", company.id)
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, to)
  );
  const expiredIds = rows
    .filter((row) => !fetchedSourceIds.has(String(row.source_job_id)))
    .map((row) => String(row.id));
  if (!expiredIds.length) return 0;
  for (let offset = 0; offset < expiredIds.length; offset += 200) {
    const { error: updateError } = await db.from("jobs").update({
      status: "expired",
      review_reason: "missing_from_complete_source_feed",
    }).in("id", expiredIds.slice(offset, offset + 200));
    if (updateError) throw new Error(updateError.message);
  }
  return expiredIds.length;
}

async function activeJobCount(
  db: SupabaseClient,
  sourceId: string,
  companyId: string,
): Promise<number> {
  const { count, error } = await db.from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("company_id", companyId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function syncOperationalAlerts(
  db: SupabaseClient,
  sourceId: string,
  companyId: string,
  counters: CrawlCounters,
  activeJobsBeforeRun: number,
  errorText: string | null,
): Promise<void> {
  try {
    const { data, error } = await db.from("crawler_runs")
      .select("status")
      .eq("source_id", sourceId)
      .eq("company_id", companyId)
      .order("started_at", { ascending: false })
      .limit(3);
    if (error) throw new Error(error.message);
    await syncRunOperationalAlerts(db, {
      sourceId,
      companyId,
      fetchedCount: counters.fetched_count,
      failedCount: counters.failed_count,
      classificationFailedCount: counters.ai_failed_count,
      expiredCount: counters.expired_count,
      activeJobsBeforeRun,
      errorMessage: errorText,
      recentStatuses: (data ?? []).map((row) => String(row.status)),
    });
  } catch (error) {
    // Alert persistence must not rewrite a successful crawl as failed.
    console.error("[jobs.alerts] sync failed", sourceId, companyId, error);
  }
}

async function expireJobsPastSourceDate(
  db: SupabaseClient,
  sourceId: string,
  companyId: string,
): Promise<number> {
  const { data, error } = await db.from("jobs").update({
    status: "expired",
    review_reason: "source_expiry_reached",
  }).eq("source_id", sourceId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

async function writeCoverage(
  db: SupabaseClient,
  source: JobSourceRow,
  company: JobCompanyRow,
  success: boolean,
  newJobs: number,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error: countError } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("source_id", source.id)
    .eq("company_id", company.id)
    .eq("status", "active");
  if (countError) throw new Error(countError.message);
  const { error } = await db.from("source_coverage_daily").upsert({
    date: today,
    source_id: source.id,
    company_id: company.id,
    enabled: company.active && source.enabled,
    crawl_success: success,
    active_jobs: count ?? 0,
    new_jobs: newJobs,
  }, { onConflict: "date,source_id,company_id" });
  if (error) throw new Error(error.message);
}

export async function crawlCompany(
  db: SupabaseClient,
  company: JobCompanyRow,
  options: CrawlOptions,
): Promise<{ runId: string; counters: CrawlCounters; partial: boolean; error?: string }> {
  const source = await lookupSource(db, company.source_id);
  const counters = emptyCrawlCounters();
  const { data: run, error: runError } = await db.from("crawler_runs").insert({
    source_id: source.id,
    company_id: company.id,
    trigger_type: options.triggerType,
    target_type: "company",
    target_value: company.id,
    status: "running",
    created_by: options.createdBy ?? null,
  }).select("id").single();
  if (runError) throw new Error(runError.message);
  const runId = String(run.id);
  let activeJobsBeforeRun = 0;
  try {
    activeJobsBeforeRun = await activeJobCount(db, source.id, company.id);
    const sourceJobs = await fetchCompanyJobs(company, fetch, {
      adapterConfig: source.adapter_config,
      cryptoJobsListApiKey: Deno.env.get("CRYPTOJOBS_LIST_API_KEY")?.trim() ?? "",
      web3CareerApiToken: Deno.env.get("WEB3_CAREER_API_TOKEN")?.trim() ?? "",
    });
    counters.fetched_count = sourceJobs.length;
    const fetchedIds = new Set(sourceJobs.map((job) => job.sourceJobId).filter(Boolean));
    const jobFailures: string[] = [];
    for (const job of sourceJobs) {
      try {
        await processSourceJob(db, source, company, job, options, counters);
      } catch (error) {
        console.error("[jobs.pipeline] job failed", company.slug, job.sourceJobId, error);
        counters.failed_count += 1;
        if (jobFailures.length < 10) {
          jobFailures.push(`${job.sourceJobId || "missing-id"}:${errorMessage(error)}`);
        }
      }
    }
    // Rolling feeds do not prove that an absent job expired. Only complete
    // snapshots may expire jobs by absence; explicit expires_at is handled by
    // the public visibility and analytics filters.
    counters.expired_count = sourceHasCompleteSnapshot(company.source_type, source.adapter_config)
      ? await expireMissingJobs(db, source, company, fetchedIds)
      : 0;
    const now = new Date().toISOString();
    const partial = counters.failed_count > 0;
    const partialError = partial
      ? `job_processing_failures:${counters.failed_count}:${jobFailures.join(" | ")}`.slice(0, 2000)
      : null;
    const [{ error: companyError }, { error: sourceError }] = await Promise.all([
      db.from("job_companies").update(partial
        ? { last_crawled_at: now, last_error: partialError }
        : { last_crawled_at: now, last_success_at: now, last_error: null }).eq("id", company.id),
      db.from("job_sources").update(partial
        ? { last_error: partialError }
        : { last_success_at: now, last_error: null }).eq("id", source.id),
    ]);
    if (companyError) throw new Error(companyError.message);
    if (sourceError) throw new Error(sourceError.message);
    await writeCoverage(db, source, company, !partial, counters.published_count);
    const { error: completeError } = await db.from("crawler_runs").update({
      ...counters,
      status: partial ? "partial" : "succeeded",
      completed_at: now,
      error_message: partialError,
    }).eq("id", runId);
    if (completeError) throw new Error(completeError.message);
    await syncOperationalAlerts(db, source.id, company.id, counters, activeJobsBeforeRun, partialError);
    return {
      runId,
      counters,
      partial,
      ...(partialError ? { error: partialError } : {}),
    };
  } catch (error) {
    const message = errorMessage(error).slice(0, 2000);
    const now = new Date().toISOString();
    await Promise.all([
      db.from("crawler_runs").update({ ...counters, status: "failed", completed_at: now, error_message: message }).eq("id", runId),
      db.from("job_companies").update({ last_crawled_at: now, last_error: message }).eq("id", company.id),
      db.from("job_sources").update({ last_error: message }).eq("id", source.id),
      writeCoverage(db, source, company, false, 0).catch(() => undefined),
    ]);
    await syncOperationalAlerts(db, source.id, company.id, counters, activeJobsBeforeRun, message);
    throw error;
  }
}

export async function revalidateCompany(
  db: SupabaseClient,
  company: JobCompanyRow,
  options: Pick<CrawlOptions, "triggerType" | "createdBy">,
): Promise<{ runId: string; counters: CrawlCounters; partial: false }> {
  const source = await lookupSource(db, company.source_id);
  const counters = emptyCrawlCounters();
  const { data: run, error: runError } = await db.from("crawler_runs").insert({
    source_id: source.id,
    company_id: company.id,
    trigger_type: options.triggerType,
    target_type: "revalidation",
    target_value: company.id,
    status: "running",
    created_by: options.createdBy ?? null,
  }).select("id").single();
  if (runError) throw new Error(runError.message);
  const runId = String(run.id);
  let activeJobsBeforeRun = 0;
  try {
    activeJobsBeforeRun = await activeJobCount(db, source.id, company.id);
    const sourceJobs = await fetchCompanyJobs(company, fetch, {
      adapterConfig: source.adapter_config,
      cryptoJobsListApiKey: Deno.env.get("CRYPTOJOBS_LIST_API_KEY")?.trim() ?? "",
      web3CareerApiToken: Deno.env.get("WEB3_CAREER_API_TOKEN")?.trim() ?? "",
    });
    counters.fetched_count = sourceJobs.length;
    const fetchedIds = new Set(sourceJobs.map((job) => job.sourceJobId).filter(Boolean));
    if (fetchedIds.size) {
      const ids = Array.from(fetchedIds);
      const seenAt = new Date().toISOString();
      for (let offset = 0; offset < ids.length; offset += 200) {
        const { error: seenError } = await db.from("jobs").update({
          last_seen_at: seenAt,
        }).eq("source_id", source.id)
          .eq("company_id", company.id)
          .in("source_job_id", ids.slice(offset, offset + 200));
        if (seenError) throw new Error(seenError.message);
      }
    }
    const expiredByAbsence = sourceHasCompleteSnapshot(company.source_type, source.adapter_config)
      ? await expireMissingJobs(db, source, company, fetchedIds)
      : 0;
    const expiredByDate = await expireJobsPastSourceDate(db, source.id, company.id);
    counters.expired_count = expiredByAbsence + expiredByDate;
    const now = new Date().toISOString();
    const [{ error: companyError }, { error: sourceError }, { error: completeError }] = await Promise.all([
      db.from("job_companies").update({ last_revalidated_at: now, last_revalidation_error: null }).eq("id", company.id),
      db.from("job_sources").update({ last_revalidated_at: now, last_revalidation_error: null }).eq("id", source.id),
      db.from("crawler_runs").update({ ...counters, status: "succeeded", completed_at: now }).eq("id", runId),
    ]);
    if (companyError) throw new Error(companyError.message);
    if (sourceError) throw new Error(sourceError.message);
    if (completeError) throw new Error(completeError.message);
    await syncOperationalAlerts(db, source.id, company.id, counters, activeJobsBeforeRun, null);
    return { runId, counters, partial: false };
  } catch (error) {
    const message = errorMessage(error).slice(0, 2_000);
    const now = new Date().toISOString();
    await Promise.all([
      db.from("crawler_runs").update({ ...counters, status: "failed", completed_at: now, error_message: message }).eq("id", runId),
      db.from("job_companies").update({ last_revalidated_at: now, last_revalidation_error: message }).eq("id", company.id),
      db.from("job_sources").update({ last_revalidated_at: now, last_revalidation_error: message }).eq("id", source.id),
    ]);
    await syncOperationalAlerts(db, source.id, company.id, counters, activeJobsBeforeRun, message);
    throw error;
  }
}

type AnalyticsJob = {
  id: string;
  source_id: string;
  company_id: string | null;
  primary_role: string | null;
  domains: string[] | null;
  required_skills: string[] | null;
  preferred_skills: string[] | null;
  seniority: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
};

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

type PagedRowsResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function collectPagedRows<T>(
  label: string,
  fetchPage: (from: number, to: number) => PromiseLike<PagedRowsResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1_000;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`jobs_analytics_${label}_limit_exceeded`);
}

export async function refreshJobAnalytics(db: SupabaseClient): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const previous = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const start = `${today}T00:00:00.000Z`;
  const { error: expiryError } = await db.from("jobs").update({
    status: "expired",
    review_reason: "source_expiry_reached",
  }).eq("status", "active").lte("expires_at", new Date().toISOString());
  if (expiryError) throw new Error(expiryError.message);
  const [active, events, coverage, sources, companies] = await Promise.all([
    collectPagedRows("active_jobs", (from, to) =>
      db.from("jobs")
        .select("id,source_id,company_id,primary_role,domains,required_skills,preferred_skills,seniority,remote_type,salary_min,salary_max")
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    collectPagedRows("events", (from, to) =>
      db.from("job_events")
        .select("job_id,event_type,source_id,company_id,role,domains,required_skills,preferred_skills,seniority,remote_type")
        .gte("occurred_at", start)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    collectPagedRows("coverage", (from, to) =>
      db.from("source_coverage_daily")
        .select("date,source_id,company_id,crawl_success")
        .in("date", [today, previous])
        .eq("crawl_success", true)
        .order("date", { ascending: true })
        .order("source_id", { ascending: true })
        .order("company_id", { ascending: true })
        .range(from, to)
    ),
    collectPagedRows("sources", (from, to) =>
      db.from("job_sources")
        .select("id")
        .eq("enabled", true)
        .not("policy_reviewed_at", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    collectPagedRows("companies", (from, to) =>
      db.from("job_companies")
        .select("id")
        .eq("active", true)
        .eq("verified", true)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  const visibleSourceIds = new Set((sources ?? []).map((source) => String(source.id)));
  const visibleCompanyIds = new Set((companies ?? []).map((company) => String(company.id)));
  const isVisiblePair = (sourceId: unknown, companyId: unknown) =>
    visibleSourceIds.has(String(sourceId)) && visibleCompanyIds.has(String(companyId));
  const jobs = (active as AnalyticsJob[])
    .filter((job) => isVisiblePair(job.source_id, job.company_id));
  const currentKeys = new Set<string>();
  const previousKeys = new Set<string>();
  for (const row of coverage) {
    const key = `${row.source_id}:${row.company_id}`;
    if (row.date === today) currentKeys.add(key);
    if (row.date === previous) previousKeys.add(key);
  }
  const stableKeys = new Set(Array.from(currentKeys).filter((key) => previousKeys.has(key)));
  const visibleEvents = events.filter((event) => isVisiblePair(event.source_id, event.company_id));
  const publishedEvents = visibleEvents.filter((event) => ["job_published", "job_reactivated"].includes(String(event.event_type)));
  const expiredEvents = visibleEvents.filter((event) => event.event_type === "job_expired");
  const comparableNew = publishedEvents.filter((event) => stableKeys.has(`${event.source_id}:${event.company_id}`));
  const comparableActive = jobs.filter((job) => stableKeys.has(`${job.source_id}:${job.company_id}`));
  const overall = {
    date: today,
    active_jobs: jobs.length,
    new_jobs: publishedEvents.length,
    expired_jobs: expiredEvents.length,
    remote_jobs: jobs.filter((job) => job.remote_type === "remote").length,
    entry_level_jobs: jobs.filter((job) => ["intern", "fresher", "junior"].includes(job.seniority ?? "")).length,
    salary_jobs: jobs.filter((job) => job.salary_min != null || job.salary_max != null).length,
    comparable_new_jobs: comparableNew.length,
    comparable_total_jobs: comparableActive.length,
    updated_at: new Date().toISOString(),
  };

  const roleActive = new Map<string, number>();
  const roleRemote = new Map<string, number>();
  const roleComparable = new Map<string, number>();
  const skillActive = new Map<string, number>();
  const skillRequired = new Map<string, number>();
  const skillPreferred = new Map<string, number>();
  const skillComparable = new Map<string, number>();
  const domainActive = new Map<string, number>();
  const domainComparable = new Map<string, number>();
  const seniorityActive = new Map<string, number>();
  const seniorityComparable = new Map<string, number>();
  for (const job of jobs) {
    if (job.primary_role) {
      increment(roleActive, job.primary_role);
      if (job.remote_type === "remote") increment(roleRemote, job.primary_role);
      if (stableKeys.has(`${job.source_id}:${job.company_id}`)) increment(roleComparable, job.primary_role);
    }
    const jobSkills = unique([...(job.required_skills ?? []), ...(job.preferred_skills ?? [])]);
    for (const skill of jobSkills) increment(skillActive, skill);
    for (const skill of job.required_skills ?? []) increment(skillRequired, skill);
    for (const skill of job.preferred_skills ?? []) increment(skillPreferred, skill);
    for (const domain of job.domains ?? []) increment(domainActive, domain);
    if (job.seniority) increment(seniorityActive, job.seniority);
    if (stableKeys.has(`${job.source_id}:${job.company_id}`)) {
      for (const skill of jobSkills) increment(skillComparable, skill);
      for (const domain of job.domains ?? []) increment(domainComparable, domain);
      if (job.seniority) increment(seniorityComparable, job.seniority);
    }
  }
  const roleNew = new Map<string, number>();
  const roleExpired = new Map<string, number>();
  const roleComparableNew = new Map<string, number>();
  const skillNew = new Map<string, number>();
  const skillComparableNew = new Map<string, number>();
  const domainNew = new Map<string, number>();
  const domainComparableNew = new Map<string, number>();
  const seniorityNew = new Map<string, number>();
  const seniorityComparableNew = new Map<string, number>();
  for (const event of publishedEvents) {
    if (event.role) increment(roleNew, String(event.role));
    if (stableKeys.has(`${event.source_id}:${event.company_id}`) && event.role) increment(roleComparableNew, String(event.role));
    const eventSkills = unique([...(event.required_skills ?? []), ...(event.preferred_skills ?? [])]);
    for (const skill of eventSkills) increment(skillNew, skill);
    for (const domain of event.domains ?? []) increment(domainNew, domain);
    if (event.seniority) increment(seniorityNew, String(event.seniority));
    if (stableKeys.has(`${event.source_id}:${event.company_id}`)) {
      for (const skill of eventSkills) increment(skillComparableNew, skill);
      for (const domain of event.domains ?? []) increment(domainComparableNew, domain);
      if (event.seniority) increment(seniorityComparableNew, String(event.seniority));
    }
  }
  for (const event of expiredEvents) if (event.role) increment(roleExpired, String(event.role));

  const roles = unique([...roleActive.keys(), ...roleNew.keys(), ...roleExpired.keys()]).map((role) => ({
    date: today,
    role,
    new_jobs: roleNew.get(role) ?? 0,
    active_jobs: roleActive.get(role) ?? 0,
    expired_jobs: roleExpired.get(role) ?? 0,
    remote_jobs: roleRemote.get(role) ?? 0,
    comparable_new_jobs: roleComparableNew.get(role) ?? 0,
    comparable_total_jobs: roleComparable.get(role) ?? 0,
  }));
  const skills = unique([...skillActive.keys(), ...skillNew.keys()]).map((skill) => ({
    date: today,
    skill,
    role: "",
    domain: "",
    new_jobs: skillNew.get(skill) ?? 0,
    active_jobs: skillActive.get(skill) ?? 0,
    expired_jobs: 0,
    required_count: skillRequired.get(skill) ?? 0,
    preferred_count: skillPreferred.get(skill) ?? 0,
    comparable_new_jobs: skillComparableNew.get(skill) ?? 0,
    comparable_total_jobs: skillComparable.get(skill) ?? 0,
  }));
  const domains = unique([...domainActive.keys(), ...domainNew.keys()]).map((domain) => ({
    date: today,
    domain,
    new_jobs: domainNew.get(domain) ?? 0,
    active_jobs: domainActive.get(domain) ?? 0,
    comparable_new_jobs: domainComparableNew.get(domain) ?? 0,
    comparable_total_jobs: domainComparable.get(domain) ?? 0,
  }));
  const seniorities = unique([...seniorityActive.keys(), ...seniorityNew.keys()]).map((seniority) => ({
    date: today,
    seniority,
    new_jobs: seniorityNew.get(seniority) ?? 0,
    active_jobs: seniorityActive.get(seniority) ?? 0,
    comparable_new_jobs: seniorityComparableNew.get(seniority) ?? 0,
    comparable_total_jobs: seniorityComparable.get(seniority) ?? 0,
  }));

  const deletes = await Promise.all([
    db.from("market_role_daily_stats").delete().eq("date", today),
    db.from("market_skill_daily_stats").delete().eq("date", today),
    db.from("market_domain_daily_stats").delete().eq("date", today),
    db.from("market_seniority_daily_stats").delete().eq("date", today),
  ]);
  for (const result of deletes) if (result.error) throw new Error(result.error.message);
  const writes = await Promise.all([
    db.from("market_daily_stats").upsert(overall, { onConflict: "date" }),
    roles.length ? db.from("market_role_daily_stats").insert(roles) : Promise.resolve({ error: null }),
    skills.length ? db.from("market_skill_daily_stats").insert(skills) : Promise.resolve({ error: null }),
    domains.length ? db.from("market_domain_daily_stats").insert(domains) : Promise.resolve({ error: null }),
    seniorities.length ? db.from("market_seniority_daily_stats").insert(seniorities) : Promise.resolve({ error: null }),
  ]);
  for (const result of writes) if (result.error) throw new Error(result.error.message);
  return {
    activeJobs: jobs.length,
    newJobs: publishedEvents.length,
    roles: roles.length,
    skills: skills.length,
    domains: domains.length,
    seniorities: seniorities.length,
  };
}

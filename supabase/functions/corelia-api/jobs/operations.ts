import type { SupabaseClient } from "../lib/supabase.ts";

export type OperationalAlertType =
  | "consecutive_failures"
  | "unexpected_zero_jobs"
  | "api_schema_change"
  | "rate_limited"
  | "classification_failure_spike"
  | "dead_link_spike";

export type RunAlertContext = {
  sourceId: string;
  companyId: string;
  fetchedCount: number;
  failedCount: number;
  classificationFailedCount: number;
  expiredCount: number;
  activeJobsBeforeRun: number;
  errorMessage?: string | null;
  recentStatuses: string[];
};

const SCHEMA_ERROR = /(?:schema|unexpected[_ -]?(?:payload|response)|invalid[_ -].*response|parse[_ -]?error)/i;
const RATE_LIMIT_ERROR = /(?:\b429\b|rate[_ -]?limit|too many requests)/i;

export function alertTypesForRun(context: RunAlertContext): OperationalAlertType[] {
  const alerts: OperationalAlertType[] = [];
  const message = context.errorMessage ?? "";
  if (context.recentStatuses.length >= 3 && context.recentStatuses.slice(0, 3).every((status) => status === "failed")) {
    alerts.push("consecutive_failures");
  }
  if (!message && context.activeJobsBeforeRun > 0 && context.fetchedCount === 0) {
    alerts.push("unexpected_zero_jobs");
  }
  if (SCHEMA_ERROR.test(message)) alerts.push("api_schema_change");
  if (RATE_LIMIT_ERROR.test(message)) alerts.push("rate_limited");
  if (
    context.classificationFailedCount >= 3 &&
    context.fetchedCount > 0 &&
    context.classificationFailedCount / context.fetchedCount >= 0.25
  ) {
    alerts.push("classification_failure_spike");
  }
  if (
    context.activeJobsBeforeRun >= 10 &&
    context.expiredCount >= 3 &&
    context.expiredCount / context.activeJobsBeforeRun >= 0.25
  ) {
    alerts.push("dead_link_spike");
  }
  return alerts;
}

function alertMessage(type: OperationalAlertType, context: RunAlertContext): string {
  switch (type) {
    case "consecutive_failures":
      return "Jobs source target failed three consecutive runs.";
    case "unexpected_zero_jobs":
      return `Jobs source target returned zero jobs after previously tracking ${context.activeJobsBeforeRun} active jobs.`;
    case "api_schema_change":
      return `Jobs source response may have changed schema: ${context.errorMessage ?? "unknown response error"}`.slice(0, 2_000);
    case "rate_limited":
      return `Jobs source is being rate limited: ${context.errorMessage ?? "rate limit response"}`.slice(0, 2_000);
    case "classification_failure_spike":
      return `Job classification failures spiked (${context.classificationFailedCount}/${context.fetchedCount}).`;
    case "dead_link_spike":
      return `Jobs source removed or expired ${context.expiredCount}/${context.activeJobsBeforeRun} previously active listings.`;
  }
}

async function notifyOperationalWebhook(type: OperationalAlertType, message: string): Promise<void> {
  const webhookUrl = Deno.env.get("CORELIA_JOBS_ALERT_WEBHOOK_URL")?.trim() ?? "";
  if (!webhookUrl) return;
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "https:") return;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[Corelia Jobs] ${type}: ${message}`,
        content: `[Corelia Jobs] ${type}: ${message}`,
      }),
    });
    if (!response.ok) console.error("[jobs.alerts] webhook failed", response.status);
  } catch (error) {
    console.error("[jobs.alerts] webhook failed", error);
  }
}

async function findOpenAlert(
  db: SupabaseClient,
  type: OperationalAlertType,
  sourceId: string,
  companyId: string,
): Promise<{ id: string; occurrence_count: number } | null> {
  const { data, error } = await db
    .from("job_operational_alerts")
    .select("id,occurrence_count")
    .eq("alert_type", type)
    .eq("source_id", sourceId)
    .eq("company_id", companyId)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; occurrence_count: number } | null;
}

async function raiseOperationalAlert(
  db: SupabaseClient,
  type: OperationalAlertType,
  context: RunAlertContext,
): Promise<void> {
  const message = alertMessage(type, context);
  const metadata = {
    fetched_count: context.fetchedCount,
    failed_count: context.failedCount,
    ai_failed_count: context.classificationFailedCount,
    expired_count: context.expiredCount,
    active_jobs_before_run: context.activeJobsBeforeRun,
    error_message: context.errorMessage ?? null,
    recent_statuses: context.recentStatuses.slice(0, 3),
  };
  const existing = await findOpenAlert(db, type, context.sourceId, context.companyId);
  if (existing) {
    const { error } = await db.from("job_operational_alerts").update({
      message,
      metadata,
      occurrence_count: existing.occurrence_count + 1,
      last_seen_at: new Date().toISOString(),
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db.from("job_operational_alerts").insert({
    source_id: context.sourceId,
    company_id: context.companyId,
    alert_type: type,
    severity: type === "consecutive_failures" || type === "api_schema_change" ? "critical" : "warning",
    message,
    metadata,
  });
  if (error) {
    // A concurrent invocation may have inserted the same open alert after our
    // lookup. Retry as an update instead of creating duplicate notifications.
    const raced = await findOpenAlert(db, type, context.sourceId, context.companyId);
    if (!raced) throw new Error(error.message);
    const { error: updateError } = await db.from("job_operational_alerts").update({
      message,
      metadata,
      occurrence_count: raced.occurrence_count + 1,
      last_seen_at: new Date().toISOString(),
    }).eq("id", raced.id);
    if (updateError) throw new Error(updateError.message);
    return;
  }
  await notifyOperationalWebhook(type, message);
}

async function resolveOperationalAlert(
  db: SupabaseClient,
  type: OperationalAlertType,
  sourceId: string,
  companyId: string,
): Promise<void> {
  const { error } = await db.from("job_operational_alerts").update({
    resolved_at: new Date().toISOString(),
  }).eq("alert_type", type)
    .eq("source_id", sourceId)
    .eq("company_id", companyId)
    .is("resolved_at", null);
  if (error) throw new Error(error.message);
}

export async function syncRunOperationalAlerts(db: SupabaseClient, context: RunAlertContext): Promise<void> {
  const active = new Set(alertTypesForRun(context));
  const managedTypes: OperationalAlertType[] = [
    "consecutive_failures",
    "unexpected_zero_jobs",
    "api_schema_change",
    "rate_limited",
    "classification_failure_spike",
    "dead_link_spike",
  ];
  for (const type of managedTypes) {
    if (active.has(type)) await raiseOperationalAlert(db, type, context);
    else await resolveOperationalAlert(db, type, context.sourceId, context.companyId);
  }
}

import { contentLocale } from "./localization.ts";
import { isContentLocale } from "../lib/locale.ts";
import { json } from "../lib/http.ts";
import { consumeRateLimit } from "../lib/rate_limit.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { isUuid } from "./validation.ts";
import { ProjectAiError, translateProjectText } from "./openai.ts";

// Jobs claimed per worker run. Each translation can take up to 60s, so they
// run concurrently to stay inside the Edge wall-clock limit.
const WORKER_BATCH = 5;
// Spend ceilings for background translation (successful + billed attempts).
const PROJECT_DAILY_LIMIT = 30;
const OWNER_DAILY_LIMIT = 100;
// Owner-triggered "translate now" requests.
const REQUEST_LIMIT = { bucket: "project_translation_request", limit: 20, windowSeconds: 3600 };

type ClaimedJob = {
  project_id: string;
  target_locale: string;
  source_hash: string;
  attempts: number;
  owner_id: string;
  primary_locale: string;
  title: string;
  summary: string;
  description: string;
  progress: string;
};

export type TranslationJobOutcome = "translated" | "superseded" | "throttled" | "failed";

function errorMessage(error: unknown): string {
  if (error instanceof ProjectAiError) return error.code;
  return error instanceof Error ? error.message : "unknown";
}

async function release(db: SupabaseClient, job: ClaimedJob, error: string, retrySeconds: number, countAttempt: boolean): Promise<void> {
  const { error: failError } = await db.rpc("fail_project_translation_job", {
    p_project_id: job.project_id,
    p_locale: job.target_locale,
    p_error: error,
    p_retry_seconds: retrySeconds,
    p_count_attempt: countAttempt,
  });
  if (failError) console.warn("[projects.translations] release failed", job.project_id, job.target_locale, failError.message);
}

export async function runTranslationJob(db: SupabaseClient, job: ClaimedJob): Promise<TranslationJobOutcome> {
  if (!isContentLocale(job.primary_locale) || !isContentLocale(job.target_locale)) {
    await release(db, job, "invalid_input:project_locale", 0, true);
    return "failed";
  }
  try {
    await consumeRateLimit(db, "project_auto_translate", job.project_id, PROJECT_DAILY_LIMIT, 86_400);
    await consumeRateLimit(db, "project_auto_translate_owner", job.owner_id, OWNER_DAILY_LIMIT, 86_400);
  } catch (error) {
    const message = errorMessage(error);
    // Budget exhaustion is not the job's fault: retry later without an attempt.
    await release(db, job, message, 3600, !message.startsWith("rate_limited:"));
    return message.startsWith("rate_limited:") ? "throttled" : "failed";
  }
  try {
    const { content } = await translateProjectText({
      title: job.title,
      summary: job.summary,
      description: job.description,
      progress: job.progress,
    }, job.primary_locale, job.target_locale);
    const { data, error } = await db.rpc("complete_project_translation_job", {
      p_project_id: job.project_id,
      p_locale: job.target_locale,
      p_source_hash: job.source_hash,
      p_data: content,
    });
    if (error) throw new Error(error.message);
    return data === true ? "translated" : "superseded";
  } catch (error) {
    await release(db, job, errorMessage(error), 300 * job.attempts, true);
    return "failed";
  }
}

/** Cron worker: translate due jobs. Shares the Jobs scheduler secret. */
export async function handleProjectTranslationsRun(req: Request, db: SupabaseClient): Promise<Response> {
  const expected = Deno.env.get("CORELIA_JOBS_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-jobs-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) return json({ message: "unauthorized" }, 401);
  if (Deno.env.get("PROJECT_AUTO_TRANSLATE_ENABLED")?.trim() === "false") {
    return json({ ok: true, disabled: true });
  }
  const { data, error } = await db.rpc("claim_project_translation_jobs", { p_limit: WORKER_BATCH });
  if (error) {
    console.error("[projects.translations] claim failed", error.message);
    return json({ message: "project_operation_failed" }, 500);
  }
  const jobs = (data ?? []) as ClaimedJob[];
  const outcomes = await Promise.all(jobs.map(job => runTranslationJob(db, job)));
  const summary = outcomes.reduce<Record<string, number>>((acc, outcome) => ({ ...acc, [outcome]: (acc[outcome] ?? 0) + 1 }), {});
  console.info("[projects.translations] run", { claimed: jobs.length, ...summary });
  return json({ ok: true, claimed: jobs.length, ...summary });
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "internal_error";
  if (["Missing Authorization header", "Invalid Authorization header", "Invalid or expired session"].includes(message)) {
    return json({ message: "unauthenticated" }, 401);
  }
  if (message.startsWith("invalid_input:")) return json({ message }, 400);
  if (message.startsWith("rate_limited:")) return json({ message }, 429);
  if (message.startsWith("forbidden:")) return json({ message }, 403);
  if (message.startsWith("not_found:")) return json({ message }, 404);
  console.error("[corelia-api] projects.translations", error);
  return json({ message: "project_operation_failed" }, 500);
}

async function readProjectId(req: Request): Promise<{ projectId: string; body: Record<string, unknown> }> {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.project_id ?? "").trim();
  if (!isUuid(projectId)) throw new Error("invalid_input:project_id");
  return { projectId, body };
}

/** Owner asks for a locale to be translated from the primary content now. */
export async function handleProjectTranslationRequest(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const { projectId, body } = await readProjectId(req);
    const locale = contentLocale(body.locale);
    await consumeRateLimit(db, REQUEST_LIMIT.bucket, user.id, REQUEST_LIMIT.limit, REQUEST_LIMIT.windowSeconds);
    const { error } = await db.rpc("request_project_translation", {
      p_actor_id: user.id,
      p_project_id: projectId,
      p_locale: locale,
    });
    if (error) throw new Error(error.message);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleProjectTranslationStatus(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const { projectId } = await readProjectId(req);
    const { data, error } = await db.rpc("project_translation_status", { p_actor_id: user.id, p_project_id: projectId });
    if (error) throw new Error(error.message);
    return json({ locales: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// Catalog research jobs (A1): start endpoint and the part of the tick that advances running jobs.
// Decisions are pure (catalog.ts planCatalogJob); this file reads the database and calls the provider.
import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import {
  acceptCatalogResearch,
  assembleCatalogBase,
  buildCatalogInput,
  CATALOG_RESEARCH_SCHEMA,
  CATALOG_SPEC,
  catalogGap,
  catalogResearchGap,
  catalogStatus,
  CatalogInputError,
  planCatalogJob,
  APP_COURSES_MAX_ITEMS,
  boundAppCourses,
  type CatalogAction,
  type AppCourseCandidate,
  type CatalogBase,
  type CatalogGeneration,
  type CatalogRows,
} from "./catalog.ts";
import { agentKey, errorMessage, failGeneration, fallBackToDefaultTier, loadFailureKind, pollOrExpire } from "./generations.ts";
import { submitResponse } from "./openai.ts";
import { loadAgentPrompt } from "./agent_prompts.ts";
import { agentKeyEnv, SERVICE_TIER, utcDate } from "./steps.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Jobs advanced per tick; each job does one provider call, and an Edge request has a time limit. */
const CATALOG_JOBS_PER_TICK = 3;
const START_ERRORS: Record<string, number> = {
  course_not_found: 404,
  course_has_no_path: 409,
  scope_missing: 409,
  job_id_conflict: 409,
};

interface JobRow {
  id: string;
  course_id: string;
  started_at: string;
}

// Studio is admin only: support_staff is excluded, matching studio_can_write() in the schema.
export async function handleCatalogResearchStart(req: Request, db: SupabaseClient): Promise<Response> {
  let userId: string;
  try {
    userId = (await verifyBearerUser(req, db)).id;
  } catch {
    return json({ message: "unauthenticated" }, 401);
  }
  if ((await getUserRole(db, userId)) !== "admin") return json({ message: "forbidden" }, 403);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const courseId = String(body.course_id ?? "");
  const jobId = body.job_id === undefined ? crypto.randomUUID() : String(body.job_id);
  if (!UUID_RE.test(courseId) || !UUID_RE.test(jobId)) return json({ message: "invalid_input" }, 400);

  // A course without a path or a group scope has nothing to research: no job, no model call.
  try {
    await loadCatalogBase(db, courseId);
  } catch (e) {
    if (e instanceof CatalogInputError) return json({ message: e.code, detail: e.message }, START_ERRORS[e.code]);
    throw e;
  }

  const { data, error } = await db.rpc("studio_start_catalog_job", { p_course_id: courseId, p_job_id: jobId, p_trigger: "manual", p_started_by: userId });
  if (error) {
    const status = START_ERRORS[error.message] ?? (error.code === "23505" ? 409 : undefined);
    if (status) return json({ message: error.code === "23505" ? "course_has_running_job" : error.message }, status);
    throw new Error(error.message);
  }
  const result = data as { job_id: string; created: boolean };
  return json(result, result.created ? 201 : 200);
}

/** Advances the running jobs, least recently advanced first. An error in one job does not stop the others. */
export async function advanceCatalogJobs(db: SupabaseClient): Promise<Record<string, unknown>[]> {
  const { data: jobs, error } = await db
    .from("studio_catalog_jobs")
    .select("id,course_id,started_at")
    .eq("status", "running")
    .order("updated_at", { ascending: true })
    .limit(CATALOG_JOBS_PER_TICK);
  if (error) throw new Error(error.message);

  const results: Record<string, unknown>[] = [];
  for (const job of (jobs ?? []) as JobRow[]) {
    try {
      results.push({ job_id: job.id, action: await advanceCatalogJob(db, job) });
    } catch (e) {
      console.error("[corelia-api] studio catalog tick", { job_id: job.id, error: errorMessage(e) });
      results.push({ job_id: job.id, error: "advance_failed" });
    }
    // Bumps updated_at (touch trigger), so the next tick takes the job that waited longest.
    const touch = await db.from("studio_catalog_jobs").update({ status: "running" }).eq("id", job.id).eq("status", "running");
    if (touch.error) console.error("[corelia-api] studio catalog touch", { job_id: job.id, error: touch.error.message });
  }
  return results;
}

export async function advanceCatalogJob(db: SupabaseClient, job: JobRow): Promise<CatalogAction["kind"]> {
  const rows = await db
    .from("studio_generations")
    .select("id,attempt,status,provider_request_id,failure_kind,error,created_at,model_id,usage")
    .eq("catalog_job_id", job.id)
    .order("attempt");
  if (rows.error) throw new Error(rows.error.message);
  const generations = (rows.data ?? []) as CatalogGeneration[];

  // The output is only needed to decide what follows an accepted generation.
  let latestResult: { status: ReturnType<typeof catalogStatus>; missing: string[] } | null = null;
  const latest = generations.at(-1);
  if (latest?.status === "completed") {
    const out = await db.from("studio_generations").select("output").eq("id", latest.id).single();
    if (out.error) throw new Error(out.error.message);
    latestResult = { status: catalogStatus(out.data.output), missing: catalogGap(out.data.output) };
  }

  const action = planCatalogJob({ generations, startedAt: job.started_at, now: Date.now(), latestResult });
  if (action.kind === "submit" && latest?.status === "failed") {
    await logCatalogRunEvent(db, job.id, catalogRetryWarning(latest));
  }
  switch (action.kind) {
    case "finish":
      await finishCatalogJob(db, job.id, action.status, action.reason);
      break;
    case "submit":
      await submitCatalog(db, job, action.attempt, action.parentId, action.parentId ? latest?.error ?? null : null);
      break;
    case "poll":
      await pollCatalog(db, job, latest!, action.requestId);
      break;
    case "expire_submitting":
      await failGeneration(db, action.generationId, "submitting", "transport", "Gửi yêu cầu tới model bị gián đoạn.");
      break;
    case "wait":
      break;
  }
  return action.kind;
}

export function catalogSafeReason(reason: string, modelIds: (string | null | undefined)[] = []): string {
  return modelIds
    .filter((model): model is string => Boolean(model))
    .reduce((current, model) => current.replace(new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "model hiện tại"), reason);
}

export function catalogRetryWarning(generation: Pick<CatalogGeneration, "id" | "attempt" | "error" | "model_id">) {
  const reason = catalogSafeReason(generation.error ?? "Yêu cầu trước không thành công.", [CATALOG_SPEC.model, generation.model_id]);
  return {
    generationId: generation.id,
    attempt: generation.attempt,
    kind: "warning" as const,
    message: `Nghiên cứu Catalog: yêu cầu lần ${generation.attempt + 1} trả lỗi; đang gửi lại. (${reason})`,
    payload: { reason },
  };
}

/** Copies A1 request transitions into every still-running run pinned to the job. Log failures never stop A1. */
export async function logCatalogRunEvent(
  db: SupabaseClient,
  jobId: string,
  event: { generationId: string; attempt: number; kind: "progress" | "warning"; message: string; payload: Record<string, unknown> },
) {
  try {
    const runsResult = await db.from("studio_runs").select("id").eq("catalog_job_id", jobId).eq("status", "running");
    if (runsResult.error) throw new Error(runsResult.error.message);
    const runIds = (runsResult.data ?? []).map((run) => run.id as string);
    if (runIds.length === 0) return;

    const [stepsResult, eventsResult] = await Promise.all([
      db.from("studio_run_steps").select("run_id").in("run_id", runIds).eq("step_key", "catalog_research"),
      db.from("studio_run_events").select("run_id,kind,payload").in("run_id", runIds).eq("step_key", "catalog_research"),
    ]);
    if (stepsResult.error) throw new Error(stepsResult.error.message);
    if (eventsResult.error) throw new Error(eventsResult.error.message);

    const eligibleRunIds = new Set((stepsResult.data ?? []).map((row) => row.run_id as string));
    const existing = eventsResult.data ?? [];
    for (const runId of runIds) {
      if (!eligibleRunIds.has(runId)) continue;
      const alreadyLogged = existing.some((row) => {
        const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
        return row.run_id === runId && row.kind === event.kind && payload.generation_id === event.generationId;
      });
      if (alreadyLogged) continue;

      try {
        const { error } = await db.from("studio_run_events").insert({
          run_id: runId,
          step_key: "catalog_research",
          attempt: event.attempt,
          kind: event.kind,
          agent_role: "A1",
          message: event.message.slice(0, 500),
          payload: { ...event.payload, generation_id: event.generationId, attempt: event.attempt },
        });
        if (error) throw new Error(error.message);
      } catch (e) {
        console.error("[corelia-api] catalog run event insert", { job_id: jobId, run_id: runId, generation_id: event.generationId, error: errorMessage(e) });
      }
    }
  } catch (e) {
    console.error("[corelia-api] catalog run event lookup", { job_id: jobId, generation_id: event.generationId, error: errorMessage(e) });
  }
}

export async function loadCatalogBase(db: SupabaseClient, courseId: string): Promise<CatalogBase> {
  const [course, links] = await Promise.all([
    db.from("studio_courses").select("title,level,scope_note,audience,corelia_direction,content_locale,research_period_days").eq("id", courseId).maybeSingle(),
    db.from("studio_course_paths").select("studio_paths(group_kind,title)").eq("course_id", courseId),
  ]);
  if (course.error) throw new Error(course.error.message);
  if (links.error) throw new Error(links.error.message);
  if (!course.data) throw new CatalogInputError("course_not_found", "Không tìm thấy khóa.");

  const paths = (links.data ?? []).flatMap((l) => {
    const p = l.studio_paths as unknown as { group_kind: string; title: string } | null;
    return p ? [p] : [];
  });
  const kinds = [...new Set(paths.map((p) => p.group_kind))];
  if (kinds.length === 0) throw new CatalogInputError("course_has_no_path", "Khóa chưa thuộc path nào nên không có phạm vi để nghiên cứu.");

  const [neighbours, publicCourses, studioPublishedCourses] = await Promise.all([
    db.from("studio_course_paths").select("studio_paths!inner(group_kind),studio_courses!inner(id,title,level,status)").in("studio_paths.group_kind", kinds),
    db.from("courses")
      .select("id,slug,updated_at,data", { count: "exact" })
      .eq("published", true)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(APP_COURSES_MAX_ITEMS + 1),
    db.from("studio_courses")
      .select("id,title,level,updated_at", { count: "exact" })
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(APP_COURSES_MAX_ITEMS + 1),
  ]);
  if (neighbours.error) throw new Error(neighbours.error.message);
  if (publicCourses.error) throw new Error(publicCourses.error.message);
  if (studioPublishedCourses.error) throw new Error(studioPublishedCourses.error.message);

  const publicCourseRows = (publicCourses.data ?? []) as { id: string; slug: string; updated_at: string; data: unknown }[];
  const localeRows = publicCourseRows.length
    ? await db.from("course_locales").select("course_id,locale,data").in("course_id", publicCourseRows.map((c) => c.id)).in("locale", ["vi", "en"])
    : { data: [], error: null };
  if (localeRows.error) throw new Error(localeRows.error.message);
  const localeByCourse = new Map<string, { locale: string; data: unknown }[]>();
  for (const locale of (localeRows.data ?? []) as { course_id: string; locale: string; data: unknown }[]) {
    const rows = localeByCourse.get(locale.course_id) ?? [];
    rows.push({ locale: locale.locale, data: locale.data });
    localeByCourse.set(locale.course_id, rows);
  }
  const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const publicCandidates: AppCourseCandidate[] = publicCourseRows.map((row) => {
    const data = asObject(row.data);
    const i18n = asObject(data.i18n);
    const locales = localeByCourse.get(row.id) ?? [];
    const preferred = [i18n.primary_content_locale, "vi", "en"].filter((value): value is string => typeof value === "string");
    const localized = preferred.map((locale) => locales.find((candidate) => candidate.locale === locale)?.data).find(Boolean);
    const content = asObject(localized);
    return {
      id: row.id,
      slug: row.slug,
      updated_at: row.updated_at,
      level: data.level,
      title: content.title ?? data.title,
      short_description: content.short_description ?? data.short_description,
      course_type: data.course_type,
      learning_outcomes: content.learning_outcomes ?? data.learning_outcomes,
    } as AppCourseCandidate;
  });
  const studioCandidates: AppCourseCandidate[] = ((studioPublishedCourses.data ?? []) as { id: string; title: string; level: string | null; updated_at: string }[]).map((row) => ({
    id: row.id,
    title: row.title,
    level: row.level,
    updated_at: row.updated_at,
    course_type: "ai_generated",
    slug: "",
    short_description: "",
    learning_outcomes: [],
  }));
  const sourceTruncated = (publicCourses.count ?? publicCourseRows.length) > publicCourseRows.length
    || (studioPublishedCourses.count ?? studioCandidates.length) > studioCandidates.length;
  const bounded = boundAppCourses(
    [...publicCandidates, ...studioCandidates].filter((course) => course.id !== courseId),
    sourceTruncated,
  );

  const rows: CatalogRows = {
    courseId,
    course: course.data as CatalogRows["course"],
    paths,
    neighbours: (neighbours.data ?? []).map((n) => {
      const path = n.studio_paths as unknown as { group_kind: string };
      const c = n.studio_courses as unknown as { id: string; title: string; level: string | null; status: string };
      return { group_kind: path.group_kind, ...c };
    }),
    appCourses: { items: bounded.items, truncated: bounded.truncated },
  };
  return assembleCatalogBase(rows);
}

async function finishCatalogJob(db: SupabaseClient, jobId: string, status: "evidence_ok" | "needs_more_sources" | "failed", reason: string) {
  const { error } = await db.rpc("studio_finish_catalog_job", { p_job_id: jobId, p_status: status, p_reason: reason });
  if (error) throw new Error(error.message);
}

/** An input that can no longer be built (path removed after the job started) ends the job instead of retrying forever. */
async function loadBaseOrFinish(db: SupabaseClient, job: JobRow): Promise<CatalogBase | null> {
  try {
    return await loadCatalogBase(db, job.course_id);
  } catch (e) {
    if (!(e instanceof CatalogInputError)) throw e;
    await finishCatalogJob(db, job.id, "failed", e.message);
    return null;
  }
}

async function submitCatalog(db: SupabaseClient, job: JobRow, attempt: number, parentId: string | null, previousError: string | null) {
  const role = "A1" as const;
  const apiKey = agentKey(role);
  if (!apiKey) {
    await finishCatalogJob(db, job.id, "failed", `Chưa cấu hình ${agentKeyEnv(role)}.`);
    return;
  }
  const prompt = await loadAgentPrompt(db, CATALOG_SPEC.prompt);
  const base = await loadBaseOrFinish(db, job);
  if (!base) return;

  // After an infrastructure failure the retry is not a correction: the model is not told it was
  // rejected, and a provider failure (possibly no flex capacity) goes to the default tier.
  const parentKind = parentId ? await loadFailureKind(db, parentId) : null;
  const rejectedBecause = parentKind === "rejected" && previousError ? { attempt: attempt - 1, reason: previousError } : null;
  const serviceTier = parentKind === "provider" ? "default" : SERVICE_TIER;

  // A research round passes the newest accepted record and what it lacks.
  const accepted = await db
    .from("studio_generations")
    .select("output")
    .eq("catalog_job_id", job.id)
    .eq("status", "completed")
    .order("attempt", { ascending: false });
  if (accepted.error) throw new Error(accepted.error.message);
  const input = buildCatalogInput(base, utcDate(Date.now()), catalogResearchGap(accepted.data?.length ?? 0, accepted.data?.[0]?.output ?? null), rejectedBecause);

  // The insert is the claim: a concurrent tick hitting the same attempt gets 23505 and stops here.
  const { data: gen, error } = await db
    .from("studio_generations")
    .insert({
      catalog_job_id: job.id,
      attempt,
      agent_role: role,
      kind: "research",
      provider: "openai",
      requested_model_id: CATALOG_SPEC.model,
      prompt_version: prompt.promptVersion,
      params: {
        effort: CATALOG_SPEC.effort,
        max_output_tokens: CATALOG_SPEC.maxOutputTokens,
        max_tool_calls: CATALOG_SPEC.maxToolCalls,
        tools: CATALOG_SPEC.tools,
        service_tier: serviceTier,
      },
      input,
      parent_generation_id: parentId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);

  let requestId: string;
  try {
    requestId = await submitResponse(apiKey, {
      model: CATALOG_SPEC.model,
      instructions: prompt.system,
      input,
      effort: CATALOG_SPEC.effort,
      maxOutputTokens: CATALOG_SPEC.maxOutputTokens,
      maxToolCalls: CATALOG_SPEC.maxToolCalls,
      schemaName: "catalog_research",
      schema: CATALOG_RESEARCH_SCHEMA,
      tools: [...CATALOG_SPEC.tools],
      serviceTier,
      metadata: { generation_id: gen.id, catalog_job_id: job.id },
    });
  } catch (e) {
    await failGeneration(db, gen.id, "submitting", "transport", `Không gửi được yêu cầu: ${errorMessage(e)}`);
    return;
  }
  const submittedAt = new Date().toISOString();
  const { error: saveError } = await db
    .from("studio_generations")
    .update({ status: "submitted", provider_request_id: requestId, submitted_at: submittedAt })
    .eq("id", gen.id)
    .eq("status", "submitting");
  if (saveError) throw new Error(saveError.message);
  await logCatalogRunEvent(db, job.id, {
    generationId: gen.id,
    attempt,
    kind: "progress",
    message: `Đã gửi yêu cầu nghiên cứu (lần ${attempt + 1}).`,
    payload: { submitted_at: submittedAt },
  });
}

// A background response belongs to the project of the key that created it, so it is read with the key
// of the agent recorded on the generation.
async function pollCatalog(db: SupabaseClient, job: JobRow, latest: CatalogGeneration, requestId: string) {
  const apiKey = agentKey("A1");
  if (!apiKey) {
    await finishCatalogJob(db, job.id, "failed", `Chưa cấu hình ${agentKeyEnv("A1")}.`);
    return;
  }
  const result = await pollOrExpire(apiKey, requestId, latest.created_at);
  if (!result || result.state === "running") return;
  if (result.state === "failed") {
    if (result.cause === "provider") {
      // Flex has no capacity (or waited too long): the same attempt goes again on the default tier.
      const fallback = await fallBackToDefaultTier(db, latest.id, requestId, async ({ input, params }) => {
        const prompt = await loadAgentPrompt(db, CATALOG_SPEC.prompt);
        return submitResponse(apiKey, {
          model: CATALOG_SPEC.model,
          instructions: prompt.system,
          input,
          effort: CATALOG_SPEC.effort,
          maxOutputTokens: CATALOG_SPEC.maxOutputTokens,
          maxToolCalls: CATALOG_SPEC.maxToolCalls,
          schemaName: "catalog_research",
          schema: CATALOG_RESEARCH_SCHEMA,
          tools: (params.tools as Record<string, unknown>[] | undefined) ?? [...CATALOG_SPEC.tools],
          serviceTier: "default",
          metadata: { generation_id: latest.id, catalog_job_id: job.id },
        });
      });
      if (fallback.outcome === "resubmitted") {
        await logCatalogRunEvent(db, job.id, {
          generationId: latest.id,
          attempt: latest.attempt,
          kind: "progress",
          message: `Flex không còn chỗ, gửi lại yêu cầu nghiên cứu bằng tier mặc định (lần ${latest.attempt + 1}).`,
        });
        return;
      }
      if (fallback.outcome !== "not_flex") return;
    }
    await failGeneration(db, latest.id, "submitted", result.cause, result.error, { model_id: result.model, usage: result.usage });
    return;
  }

  let output: unknown;
  try {
    output = JSON.parse(result.text);
  } catch {
    output = null;
  }
  let acceptance: ReturnType<typeof acceptCatalogResearch>;
  if (output === null) {
    acceptance = { ok: false, reason: "Đầu ra không phải JSON hợp lệ." };
  } else {
    const base = await loadBaseOrFinish(db, job);
    if (!base) return;
    acceptance = acceptCatalogResearch(output, {
      today: utcDate(Date.now()),
      groupKinds: base.groups.map((g) => g.group_kind),
      hasAppCourses: base.app_courses.items.length > 0,
    });
  }

  const done = {
    output: output ?? { raw: result.text.slice(0, 20000) },
    model_id: result.model,
    usage: result.usage,
    completed_at: new Date().toISOString(),
  };
  const { error } = await db
    .from("studio_generations")
    .update(acceptance.ok ? { ...done, status: "completed" } : { ...done, status: "failed", failure_kind: "rejected", error: acceptance.reason })
    .eq("id", latest.id)
    .eq("status", "submitted");
  if (error) throw new Error(error.message);
}

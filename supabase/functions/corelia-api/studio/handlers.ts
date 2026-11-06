import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { journeyProblems, linkProblems, structureProblems, type CodeCheck, type LessonRecord } from "./checks.ts";
import { draftDir, draftPath, renderDiagramPng, FontLoadError, createStorageFontResolver, setFontResolver } from "./diagram_render.ts";
import type { LessonAction, LessonGeneration } from "./lesson_flow.ts";
import {
  lessonIds,
  lessonRefs,
  lessonRevision,
  hasUnseenBlocking,
  reviewBlocking,
  toLessonDraft,
  TransientError,
  type LessonContext,
  type LessonOutput,
} from "./lessons.ts";
import { advanceCatalogJobs } from "./catalog_run.ts";
import { queueAutoResearch } from "./auto_research.ts";
import { purgeExpiredDrafts } from "./drafts.ts";
import { rerankIfStale } from "./ranking_run.ts";
import { loadCatalogResearchForBrief } from "./catalog_research_brief.ts";
import { agentKey, errorMessage, failGeneration, fallBackToDefaultTier, loadFailureKind, pollOrExpire } from "./generations.ts";
import { submitResponse } from "./openai.ts";
import { publishRun, PublishRejected } from "./publish.ts";
import {
  TRANSLATION_LOCALES,
  type TranslationLocale,
  type CourseTranslationMap,
  type TranslatedLesson,
  TranslationIntegrityError,
  validateCourseTranslation,
  validateSectionTranslation,
  validateLessonTranslation,
  buildCourseTranslateInput,
  buildLessonTranslateInput,
  getTranslateSchemaForFormat,
  canonicalCourseDescription,
  canonicalCourseShortDescription,
} from "./translate.ts";
import type { StartResult } from "./resume.ts";
import { canRetry, roundFailures } from "./retry.ts";
import { loadAgentPrompt } from "./agent_prompts.ts";
import {
  agentKeyEnv,
  buildProgress,
  MAX_RUN_MS,
  RESPONSE_STALE_MS,
  SERVICE_TIER,
  SUBMIT_STALE_MS,
  curriculumRevision,
  researchGap,
  researchRequest,
  planRun,
  STEP_LABEL,
  STEP_ORDER,
  STEP_SPECS,
  stepAgent,
  utcDate,
  type Acceptance,
  type CodeStep,
  type GenerationState,
  type RunContext,
  type RunProgress,
  type StepKey,
  type StepState,
  type TickAction,
} from "./steps.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUNS_PER_TICK = 5;
const START_ERRORS: Record<string, number> = {
  course_not_found: 404,
  course_not_startable: 409,
  course_has_no_path: 409,
  scope_missing: 409,
  run_id_conflict: 409,
};

export interface RunRow {
  id: string;
  course_id: string;
  started_at: string;
  catalog_job_id?: string | null;
  paused_at?: string | null;
  execution_mode?: "server" | "claude_code";
  agent_models?: Record<string, string>;
}

/** Steps a failed run can be restarted from (studio_resume_run). */
const RESTART_STEPS = ["research", "curriculum"];

// Studio is admin only: support_staff is excluded, matching studio_can_write() in the schema.
export async function handleStudioStart(req: Request, db: SupabaseClient): Promise<Response> {
  let userId: string;
  try {
    userId = (await verifyBearerUser(req, db)).id;
  } catch {
    return json({ message: "unauthenticated" }, 401);
  }
  if ((await getUserRole(db, userId)) !== "admin") return json({ message: "forbidden" }, 403);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const courseId = String(body.course_id ?? "");
  const runId = body.run_id === undefined ? crypto.randomUUID() : String(body.run_id);
  // Optional: continue from the accepted work of the course's latest failed run instead of starting over.
  const resumeFrom = body.resume_from_run_id === undefined ? null : String(body.resume_from_run_id);
  // Optional, with resume_from_run_id: the first step to regenerate; the steps before it are copied, it and what follows are not.
  const restartFrom = body.restart_from === undefined ? null : String(body.restart_from);
  if (!UUID_RE.test(courseId) || !UUID_RE.test(runId) || (resumeFrom !== null && !UUID_RE.test(resumeFrom))) return json({ message: "invalid_input" }, 400);
  if (restartFrom !== null && (resumeFrom === null || !RESTART_STEPS.includes(restartFrom))) return json({ message: "invalid_input" }, 400);

  const { data, error } = await db.rpc("studio_start_run", { p_course_id: courseId, p_run_id: runId, p_started_by: userId, p_resume_from: resumeFrom, p_restart_from: restartFrom });
  if (error) {
    const status = START_ERRORS[error.message] ?? (error.code === "23505" ? 409 : undefined);
    if (status) {
      const message = error.code === "23505" ? "course_has_running_run" : error.message;
      return json({ message }, status);
    }
    throw new Error(error.message);
  }
  const result = data as StartResult;
  return json(result, result.created ? 201 : 200);
}

export async function handleStudioPause(req: Request, db: SupabaseClient): Promise<Response> {
  return handleStudioRunControl(req, db, "studio_pause_run");
}

export async function handleStudioContinue(req: Request, db: SupabaseClient): Promise<Response> {
  return handleStudioRunControl(req, db, "studio_continue_run");
}

async function handleStudioRunControl(req: Request, db: SupabaseClient, rpcName: "studio_pause_run" | "studio_continue_run"): Promise<Response> {
  let userId: string;
  try {
    userId = (await verifyBearerUser(req, db)).id;
  } catch {
    return json({ message: "unauthenticated" }, 401);
  }
  if ((await getUserRole(db, userId)) !== "admin") return json({ message: "forbidden" }, 403);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const runId = String(body.run_id ?? "");
  if (!UUID_RE.test(runId)) return json({ message: "invalid_input" }, 400);

  const { data, error } = await db.rpc(rpcName, { p_run_id: runId });
  if (error) {
    const status = error.message === "run_not_found" ? 404 : error.message === "run_not_running" ? 409 : undefined;
    if (status) return json({ message: error.message }, status);
    throw new Error(error.message);
  }
  return json(data);
}

export async function handleStudioTick(req: Request, db: SupabaseClient): Promise<Response> {
  const expected = Deno.env.get("CORELIA_STUDIO_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-studio-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) return json({ message: "unauthorized" }, 401);

  // Least recently advanced first, so every running run moves forward across ticks.
  const { data: runs, error } = await db
    .from("studio_runs")
    .select("id,course_id,started_at,catalog_job_id,paused_at,execution_mode,agent_models")
    .eq("status", "running")
    .eq("execution_mode", "server")
    .order("updated_at", { ascending: true })
    .limit(RUNS_PER_TICK);
  if (error) throw new Error(error.message);

  const results = [];
  for (const run of (runs ?? []) as RunRow[]) {
    try {
      const outcome = await advanceRun(db, run);
      results.push({ run_id: run.id, ...outcome });
    } catch (e) {
      console.error("[corelia-api] studio tick", { run_id: run.id, error: errorMessage(e) });
      results.push({ run_id: run.id, error: "advance_failed" });
    }
    const { error: touchError } = await db.from("studio_runs").update({ status: "running" }).eq("id", run.id).eq("status", "running");
    if (touchError) console.error("[corelia-api] studio tick touch", { run_id: run.id, error: touchError.message });
  }
  let autoResearch: Record<string, unknown>;
  try {
    autoResearch = await queueAutoResearch(db);
  } catch (e) {
    console.error("[corelia-api] studio auto-research tick failed", errorMessage(e));
    autoResearch = { action: "failed" };
  }
  const catalog = await advanceCatalogJobs(db);
  const ranking = await rerankIfStale(db);
  const drafts = await purgeExpiredDrafts(db);
  return json({ processed: results.length, results, auto_research: autoResearch, catalog, ranking, drafts });
}

export async function advanceRun(db: SupabaseClient, run: RunRow): Promise<{ step: StepKey | null; action: TickAction["kind"] }> {
  const { data: stepRows, error } = await db.from("studio_run_steps").select("step_key,state").eq("run_id", run.id);
  if (error) throw new Error(error.message);
  const steps: Partial<Record<StepKey, StepState>> = {};
  for (const row of stepRows ?? []) steps[row.step_key as StepKey] = row.state as StepState;

  const current = STEP_ORDER.find((k) => !(k === "catalog_research" && steps[k] === undefined) && steps[k] !== "done");
  let latest: GenerationState | null = null;
  let catalogResearch: { id: string; status: "running" | "evidence_ok" | "needs_more_sources" | "failed"; reason: string | null } | null | undefined;
  if (current === "catalog_research") {
    if (run.catalog_job_id) {
      const result = await db.from("studio_catalog_jobs").select("id,course_id,status,reason").eq("id", run.catalog_job_id).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (result.data && result.data.course_id === run.course_id) {
        catalogResearch = { id: result.data.id, status: result.data.status, reason: result.data.reason } as typeof catalogResearch;
      } else {
        catalogResearch = null;
      }
    } else {
      catalogResearch = null;
    }
  } else if (current) {
    const res = await db
      .from("studio_generations")
      .select("id,attempt,agent_role,status,provider_request_id,failure_kind,error,created_at")
      .eq("run_id", run.id)
      .eq("step_key", current)
      .is("lesson_id", null)
      .order("attempt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    latest = res.data as GenerationState | null;
  }

  const now = Date.now();
  let startedAt = run.started_at;
  if (now - Date.parse(run.started_at) > MAX_RUN_MS) {
    const pausedMs = await loadPausedDurationMs(db, run, now);
    startedAt = new Date(Date.parse(run.started_at) + pausedMs).toISOString();
  }
  const progress = current && current !== "catalog_research" ? await loadProgress(db, run, current, latest) : undefined;
  const lessons = current === "lessons" || current === "lesson_review" ? await loadLessons(db, run) : undefined;
  const planned = planRun({
    steps,
    latest,
    startedAt,
    now,
    catalogResearch,
    progress,
    lessons,
    submitStaleMs: run.execution_mode === "claude_code" ? 24 * 60 * 60 * 1000 : undefined,
  });
  const { step } = planned;
  const action = tickActionForRun(run.paused_at, planned.action);
  switch (action.kind) {
    case "lessons":
      await runLessonActions(db, run, action.actions);
      break;
    case "check":
      await runCheck(db, run, action.check);
      break;
    case "translate":
      await runTranslate(db, run);
      break;
    case "publish":
      await runPublish(db, run);
      break;
    case "finish":
      await finishRun(db, run, step, action.status, action.reason, latest?.attempt ?? 0);
      break;
    case "submit":
      await submitStep(db, run, step!, action.attempt, action.parentId, action.parentId ? latest?.error ?? null : null);
      break;
    case "poll":
      await pollStep(db, run, step!, latest!, action.requestId);
      break;
    case "expire_submitting":
      await failGeneration(db, action.generationId, "submitting", "transport", "Gửi yêu cầu tới model bị gián đoạn.");
      break;
    case "mark_done":
      if (step === "catalog_research") {
        const changed = await markCatalogResearchDone(db, run.id);
        if (changed) {
          const outcome = catalogResearch?.status === "evidence_ok" ? "đủ bằng chứng" : "cần thêm nguồn";
          const summary = catalogResearch?.id
            ? await loadCatalogResearchSummary(db, catalogResearch.id, catalogResearch.reason)
            : catalogResearch?.reason?.trim() || "Không tìm thấy tóm tắt A1 đã lưu.";
          await addEvent(db, {
            run_id: run.id,
            step_key: "catalog_research",
            attempt: 0,
            kind: "result",
            agent_role: "A1",
            message: `Nghiên cứu hoàn tất: ${outcome}; ${summary}`,
          });
        }
      } else {
        await markStepDone(db, run.id, step!);
      }
      break;
    case "reopen":
      await reopenCurriculum(db, run.id, latest!.attempt, action.round, action.blocking);
      break;
    case "reopen_research":
      await reopenResearch(db, run.id, latest!.attempt, action.round, action.missing);
      break;
    case "wait":
      break;
  }
  return { step, action: action.kind };
}

export function pausedTickAction(action: TickAction): TickAction {
  if (action.kind === "poll" || action.kind === "mark_done" || action.kind === "finish") return action;
  if (action.kind === "lessons") {
    const polls = action.actions.filter((lessonAction) => lessonAction.kind === "poll");
    return polls.length > 0 ? { kind: "lessons", actions: polls } : { kind: "wait" };
  }
  return { kind: "wait" };
}

export function tickActionForRun(pausedAt: string | null | undefined, action: TickAction): TickAction {
  return pausedAt ? pausedTickAction(action) : action;
}

async function loadPausedDurationMs(db: SupabaseClient, run: RunRow, now: number): Promise<number> {
  const { data, error } = await db
    .from("studio_run_events")
    .select("payload")
    .eq("run_id", run.id)
    .eq("kind", "progress")
    .not("payload->>paused_seconds", "is", null);
  if (error) throw new Error(error.message);

  const completedPauseMs = (data ?? []).reduce((total, event) => {
    const seconds = Number((event.payload as Record<string, unknown> | null)?.paused_seconds);
    return Number.isFinite(seconds) && seconds > 0 ? total + seconds * 1000 : total;
  }, 0);
  const currentPauseMs = activePauseDurationMs(run.paused_at, now);
  return completedPauseMs + currentPauseMs;
}

export function activePauseDurationMs(pausedAt: string | null | undefined, now: number): number {
  if (!pausedAt) return 0;
  const parsed = Date.parse(pausedAt);
  return Number.isFinite(parsed) ? Math.max(0, now - parsed) : 0;
}

async function loadProgress(db: SupabaseClient, run: RunRow, current: StepKey, latest: GenerationState | null): Promise<RunProgress> {
  // outcome: a curriculum is either a draft or a request for more research.
  const { data, error } = await db.from("studio_generations").select("step_key,attempt,status,provider_request_id,failure_kind,outcome:output->>status").eq("run_id", run.id).is("lesson_id", null);
  if (error) throw new Error(error.message);
  // The output is only needed to decide what follows an accepted review or an accepted curriculum.
  let review: unknown = null;
  let curriculum: unknown = null;
  if ((current === "curriculum_review" || current === "curriculum") && latest?.status === "completed") {
    const res = await db.from("studio_generations").select("output").eq("id", latest.id).single();
    if (res.error) throw new Error(res.error.message);
    if (current === "curriculum_review") review = res.data.output;
    else curriculum = res.data.output;
  }
  return buildProgress(data ?? [], current, review, curriculum);
}

async function loadCurriculum(db: SupabaseClient, run: RunRow): Promise<unknown> {
  const res = await db
    .from("studio_generations")
    .select("output")
    .eq("run_id", run.id)
    .eq("step_key", "curriculum")
    .eq("status", "completed")
    .is("lesson_id", null)
    .neq("output->>status", "needs_research") // a request for more research is not a curriculum
    .order("attempt", { ascending: false })
    .limit(1)
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data.output;
}

// The lessons of the accepted curriculum, their generations of both lesson steps, and the blocking
// items of the newest accepted review of each lesson.
async function loadLessons(db: SupabaseClient, run: RunRow) {
  const ids = lessonIds(await loadCurriculum(db, run));
  const rows = await db
    .from("studio_generations")
    .select("id,attempt,agent_role,status,provider_request_id,failure_kind,error,created_at,lesson_id,step_key")
    .eq("run_id", run.id)
    .in("step_key", ["lessons", "lesson_review"])
    .not("lesson_id", "is", null);
  if (rows.error) throw new Error(rows.error.message);
  const reviews = await db
    .from("studio_generations")
    .select("lesson_id,output")
    .eq("run_id", run.id)
    .eq("step_key", "lesson_review")
    .eq("status", "completed")
    .not("lesson_id", "is", null)
    .order("attempt");
  if (reviews.error) throw new Error(reviews.error.message);
  const blocking: Record<string, string[]> = {};
  const unseenBlocking: Record<string, boolean> = {};
  const previous: Record<string, unknown> = {};
  for (const r of reviews.data ?? []) {
    const id = r.lesson_id as string;
    blocking[id] = reviewBlocking(r.output); // ascending: newest wins
    unseenBlocking[id] = id in previous && hasUnseenBlocking(r.output, previous[id]);
    previous[id] = r.output;
  }
  return { ids, rows: (rows.data ?? []) as LessonGeneration[], blocking, unseenBlocking };
}

// Lessons are independent, so one failing action does not hold back the others; the first error is
// raised afterwards and the next tick retries from the recorded state.
async function runLessonActions(db: SupabaseClient, run: RunRow, actions: LessonAction[]) {
  let failure: unknown = null;
  for (const a of actions) {
    try {
      if (a.kind === "submit") await submitStep(db, run, a.step, a.attempt, a.parentId, a.previousError, a.lessonId);
      else if (a.kind === "poll") await pollStep(db, run, a.step, a.generation, a.generation.provider_request_id ?? "");
      else await failGeneration(db, a.generationId, "submitting", "transport", "Gửi yêu cầu tới model bị gián đoạn.");
    } catch (e) {
      console.error("[corelia-api] studio lesson", { run_id: run.id, lesson_id: a.lessonId, error: errorMessage(e) });
      failure ??= e;
    }
  }
  if (failure) throw failure;
}

// The newest accepted draft of every lesson, with who wrote and reviewed it.
async function loadRecords(db: SupabaseClient, run: RunRow, ctx: RunContext): Promise<Record<string, LessonRecord>> {
  const gens = await db
    .from("studio_generations")
    .select("lesson_id,step_key,model_id,prompt_version,output")
    .eq("run_id", run.id)
    .in("step_key", ["lessons", "lesson_review"])
    .eq("status", "completed")
    .not("lesson_id", "is", null)
    .order("attempt"); // ascending: the newest of each lesson and step wins
  if (gens.error) throw new Error(gens.error.message);
  const locale = (ctx.outputs.brief as { locale?: string }).locale;
  const refs = new Map(lessonRefs(ctx.outputs.curriculum).map((r) => [r.lesson.id, r]));
  const written: Record<string, (typeof gens.data)[number]> = {};
  const reviewed: Record<string, (typeof gens.data)[number]> = {};
  for (const g of gens.data ?? []) (g.step_key === "lessons" ? written : reviewed)[g.lesson_id as string] = g;
  const records: Record<string, LessonRecord> = {};
  for (const [id, g] of Object.entries(written)) {
    const ref = refs.get(id);
    if (!ref) continue;
    const prov = (x?: { model_id: string | null; prompt_version: string | null }) => (x ? { model_id: x.model_id, prompt_version: x.prompt_version } : null);
    records[id] = {
      draft: toLessonDraft(ref, g.output as LessonOutput, locale, ctx.outputs.research as Parameters<typeof toLessonDraft>[3]),
      written: prov(g),
      reviewed: prov(reviewed[id]),
    };
  }
  return records;
}

/** Diagrams rendered per tick: each takes about 0.1 s of CPU, and an Edge request is limited to 2 s. */
const DIAGRAMS_PER_TICK = 4;

// Renders the diagrams of the final lessons to PNG drafts. Done here, not when a lesson is accepted,
// because a lesson can still be rewritten after A5, and only final drafts are worth drawing. Returns
// how many diagrams are still missing (the rest are drawn on later ticks).
async function renderDrafts(db: SupabaseClient, run: RunRow, records: Record<string, LessonRecord>): Promise<number> {
  let budget = DIAGRAMS_PER_TICK;
  let missing = 0;
  for (const [lessonId, { draft }] of Object.entries(records)) {
    if (draft.diagrams.length === 0) continue;
    const listed = await db.storage.from("studio-drafts").list(draftDir(run.id, lessonId));
    if (listed.error) throw new Error(listed.error.message);
    const present = new Set((listed.data ?? []).map((o) => o.name));
    for (const d of draft.diagrams) {
      const path = draftPath(run.id, lessonId, d.id);
      if (present.has(path.slice(path.lastIndexOf("/") + 1))) continue;
      if (budget === 0) {
        missing++;
        continue;
      }
      budget--;
      const png = await renderDiagramPng(d);
      const put = await db.storage.from("studio-drafts").upload(path, png, { contentType: "image/png", upsert: true });
      if (put.error) throw new Error(put.error.message);
    }
  }
  return missing;
}

// structure_check and journey_test run in the tick itself. A failure ends the run as a draft with the
// list of problems; a check that could not be made (links unreachable for now) is retried next tick.

async function renderTranslatedDrafts(
  db: SupabaseClient,
  run: RunRow,
  records: Record<string, LessonRecord>,
  translations: CourseTranslationMap,
): Promise<void> {
  for (const loc of TRANSLATION_LOCALES) {
    const locTranslations = translations[loc];
    if (!locTranslations?.lessons) continue;
    for (const [lessonId, r] of Object.entries(records)) {
      const tLesson = locTranslations.lessons[lessonId];
      if (!tLesson?.article?.diagrams?.length) continue;
      const listed = await db.storage.from("studio-drafts").list(draftDir(run.id, lessonId));
      if (listed.error) throw new Error(listed.error.message);
      const present = new Set((listed.data ?? []).map((o) => o.name));
      for (const td of tLesson.article.diagrams) {
        const path = draftPath(run.id, lessonId, td.id, loc);
        const fileName = path.slice(path.lastIndexOf("/") + 1);
        if (present.has(fileName)) continue;

        const srcDiagram = r.draft.diagrams.find((d) => d.id === td.id);
        if (!srcDiagram) continue;
        const localeSpec = {
          ...srcDiagram,
          title: td.title || srcDiagram.title,
          alt: td.alt || srcDiagram.alt,
          nodes: srcDiagram.nodes.map((sn) => {
            const tn = td.nodes.find((n: any) => n.id === sn.id);
            return { ...sn, label: tn?.label || sn.label };
          }),
          edges: srcDiagram.edges.map((se) => {
            const te = td.edges?.find((e: any) => e.from === se.from && e.to === se.to);
            return { ...se, label: te?.label ?? se.label };
          }),
        };
        const png = await renderDiagramPng(localeSpec, loc);
        const put = await db.storage.from("studio-drafts").upload(path, png, { contentType: "image/png", upsert: true });
        if (put.error) throw new Error(put.error.message);
      }
    }
  }
}

const MAX_TRANSLATE_RENDER_RETRIES = 3;

async function handleTranslateRenderError(db: SupabaseClient, run: RunRow, error: unknown): Promise<boolean> {
  if (!(error instanceof FontLoadError)) return false;

  if (error.kind === "network") {
    const { data: events, error: eventsError } = await db
      .from("studio_run_events")
      .select("payload")
      .eq("run_id", run.id)
      .eq("step_key", "translate");
    if (eventsError) throw new Error(eventsError.message);

    const retries = (events ?? []).filter((event: any) => event.payload?.font_render_retry === true).length;
    const attempt = retries + 1;
    if (retries >= MAX_TRANSLATE_RENDER_RETRIES) {
      await finishRun(
        db,
        run,
        "translate",
        "draft_failed",
        `Lỗi mạng khi tải font CJK vượt quá giới hạn thử lại: ${error.message}`,
        attempt,
      );
      return true;
    }

    await addEvent(db, {
      run_id: run.id,
      step_key: "translate",
      attempt,
      kind: "warning",
      agent_role: "A7",
      message: `Lỗi kết nối Storage khi tải font CJK: ${error.message}. Sẽ thử lại ở tick tiếp theo.`,
      payload: { font_render_retry: true },
    });
    return true;
  }

  await finishRun(
    db,
    run,
    "translate",
    "draft_failed",
    `Lỗi nạp font CJK khi vẽ sơ đồ: ${error.message}`,
    0,
  );
  return true;
}

export async function runTranslate(db: SupabaseClient, run: RunRow): Promise<void> {
  const external = run.execution_mode === "claude_code";
  const submitStaleMs = external ? 24 * 60 * 60 * 1000 : SUBMIT_STALE_MS;
  setFontResolver(createStorageFontResolver(db.storage));
  const ctx = await loadContext(db, run, "translate");
  const curriculum = ctx.outputs.curriculum as any;
  const records = await loadRecords(db, run, ctx);
  const brief = ctx.outputs.brief as any;
  const refs = lessonRefs(curriculum);

  // 1. Kiểm tra generation tổng hợp đã hoàn thành chưa (idempotent / resume)
  const existingGen = await db
    .from("studio_generations")
    .select("output, status, attempt")
    .eq("run_id", run.id)
    .eq("step_key", "translate")
    .is("lesson_id", null)
    .is("locale", null)
    .eq("status", "completed")
    .maybeSingle();

  if (existingGen?.data?.output) {
    const existingTranslations = existingGen.data.output as CourseTranslationMap;
    const hasAll = TRANSLATION_LOCALES.every((loc) => Boolean(existingTranslations[loc]));
    if (hasAll) {
      try {
        await renderTranslatedDrafts(db, run, records, existingTranslations);
        await markStepDone(db, run.id, "translate");
      } catch (renderErr) {
        if (!await handleTranslateRenderError(db, run, renderErr)) throw renderErr;
        return;
      }
      return;
    }
  }

  // 2. Kiểm tra API key
  const apiKey = agentKey("A7");
  if (!external && !apiKey) {
    await finishRun(db, run, "translate", "draft_failed", `Chưa cấu hình ${agentKeyEnv("A7")}.`, 0);
    return;
  }

  const prompt = await loadAgentPrompt(db, "a7-translate");

  // 3. Danh sách các đơn vị dịch (Translation Units)
  interface TranslateUnit {
    unitKey: string;
    kind: "course" | "lesson";
    lessonId?: string;
    record?: LessonRecord;
    format?: string;
  }

  const canonicalCourseTitle = brief?.title?.trim();
  if (!canonicalCourseTitle) {
    await finishRun(db, run, "translate", "draft_failed", "Brief thiếu tiêu đề tiếng Anh chuẩn tắc (title).", 0);
    return;
  }

  const units: TranslateUnit[] = [
    { unitKey: "course", kind: "course" },
    ...refs.map((r) => {
      const rec = records[r.lesson.id];
      const actualFormat = rec?.draft?.lesson?.lesson_format || r.lesson.type;
      return {
        unitKey: r.lesson.id,
        kind: "lesson" as const,
        lessonId: r.lesson.id,
        record: rec,
        format: actualFormat,
      };
    }),
  ];

  // 4. Lấy tất cả các generation rows của step translate
  const { data: genRows, error: genErr } = await db
    .from("studio_generations")
    .select("*")
    .eq("run_id", run.id)
    .eq("step_key", "translate")
    .order("attempt", { ascending: true });
  if (genErr) throw new Error(genErr.message);

  const gensByUnit = new Map<string, any[]>();
  for (const r of genRows ?? []) {
    if (!r.locale) continue; // bỏ qua row tổng hợp
    const key = `${r.locale}:${r.lesson_id || "course"}`;
    const list = gensByUnit.get(key) ?? [];
    list.push(r);
    gensByUnit.set(key, list);
  }

  const TRANSLATE_LIMIT_PER_TICK = 6;
  let workDoneThisTick = 0;
  let allUnitsCompleted = true;

  for (const loc of TRANSLATION_LOCALES) {
    for (const u of units) {
      const key = `${loc}:${u.unitKey}`;
      const attempts = gensByUnit.get(key) ?? [];
      const latest = attempts[attempts.length - 1];

      if (latest?.status === "completed") {
        continue; // Đơn vị này đã hoàn tất
      }

      allUnitsCompleted = false;

      if (latest?.status === "submitting") {
        if (Date.now() - Date.parse(latest.created_at) > submitStaleMs) {
          await failGeneration(db, latest.id, "submitting", "transport", "Gửi yêu cầu dịch bị gián đoạn.");
        }
        continue;
      }

      if (latest?.status === "submitted") {
        const pollRes = await pollOrExpire(apiKey, latest.provider_request_id, latest.created_at, 0);
        if (!pollRes || pollRes.state === "running") continue;

        if (pollRes.state === "failed") {
          await failGeneration(db, latest.id, "submitted", "provider", pollRes.error || "Lỗi từ provider");
          workDoneThisTick++;
          continue;
        }

        // Đã hoàn thành từ OpenAI -> Validate toàn vẹn
        let rejectedOutput: unknown = pollRes.text;
        try {
          const rawOutput = pollRes.text ? JSON.parse(pollRes.text) : null;
          rejectedOutput = rawOutput ?? pollRes.text;
          if (!rawOutput) throw new TranslationIntegrityError("Model trả về kết quả rỗng");

          if (u.kind === "course") {
            validateCourseTranslation(
              {
                title: canonicalCourseTitle,
                short_description: canonicalCourseShortDescription(brief),
                description: canonicalCourseDescription(brief),
                learning_outcomes: curriculum.outcomes.map((o: any) => o.text),
              },
              rawOutput.course,
              loc
            );
            const sectionMap: Record<string, any> = {};
            for (const s of rawOutput.sections || []) {
              sectionMap[s.id] = s;
            }
            for (const m of curriculum.modules) {
              const tSec = sectionMap[m.id];
              if (!tSec) throw new TranslationIntegrityError(`[${loc}] Thiếu bản dịch cho module ${m.id}`);
              validateSectionTranslation({ id: m.id, title: m.title, description: m.description }, tSec, loc);
            }
            rawOutput.sections = sectionMap;
          } else {
            validateLessonTranslation(u.record!, rawOutput, loc);
          }

          // Validation thành công -> hoàn tất generation này
          await db
            .from("studio_generations")
            .update({
              status: "completed",
              output: rawOutput,
              model_id: pollRes.model || STEP_SPECS.translate!.model,
              usage: pollRes.usage,
              completed_at: new Date().toISOString(),
            })
            .eq("id", latest.id);

          await addEvent(db, {
            run_id: run.id,
            step_key: "translate",
            attempt: latest.attempt,
            kind: "progress",
            agent_role: "A7",
            message: `${STEP_LABEL.translate}: Đã dịch xong ${u.unitKey === "course" ? "thông tin khóa" : `bài ${u.unitKey}`} sang ${loc}.`,
          });
        } catch (valErr: any) {
          const msg = errorMessage(valErr);
          await failGeneration(db, latest.id, "submitted", "rejected", msg, {
            model_id: pollRes.model,
            usage: pollRes.usage,
            output: rejectedOutput,
          });
          await addEvent(db, {
            run_id: run.id,
            step_key: "translate",
            attempt: latest.attempt,
            kind: "warning",
            agent_role: "A7",
            message: `Bản dịch ${u.unitKey} sang ${loc} vi phạm toàn vẹn: ${msg}`,
          });
        }
        workDoneThisTick++;
        continue;
      }

      // Chưa có attempt hoặc attempt trước đó bị failed -> SUBMIT mới
      const nextAttempt = latest ? latest.attempt + 1 : 0;
      if (latest && !canRetry(roundFailures(attempts, 0), STEP_SPECS.translate!.maxAttempts ?? 3)) {
        await finishRun(
          db,
          run,
          "translate",
          "draft_failed",
          `Bản dịch ${u.unitKey} sang ${loc} thất bại sau ${attempts.length} lần thử: ${latest?.error || "Lỗi kiểm tra toàn vẹn"}`,
          nextAttempt
        );
        return;
      }

      if (workDoneThisTick >= TRANSLATE_LIMIT_PER_TICK) {
        continue;
      }

      const parentKind = latest ? await loadFailureKind(db, latest.id) : null;
      const rejectedBecause = parentKind === "rejected" ? (latest.error || "Bản dịch vi phạm toàn vẹn") : null;
      const serviceTier = parentKind === "provider" ? "default" : SERVICE_TIER;

      const baseInput = u.kind === "course"
        ? buildCourseTranslateInput(canonicalCourseTitle, brief, curriculum, loc)
        : buildLessonTranslateInput(u.record!, run.course_id, loc);

      const inputPayload = {
        ...baseInput,
        ...(rejectedBecause ? { previous_attempt: { attempt: nextAttempt - 1, rejected_because: rejectedBecause } } : {}),
      };

      const schema = getTranslateSchemaForFormat(u.kind === "course" ? undefined : u.format);

      const { data: insertedGen, error: insErr } = await db
        .from("studio_generations")
        .insert({
          run_id: run.id,
          step_key: "translate",
          attempt: nextAttempt,
          agent_role: "A7",
          kind: "text",
          origin: external ? "external" : "ai",
          provider: external ? "anthropic" : "openai",
          requested_model_id: external ? run.agent_models?.A7 ?? "sonnet" : STEP_SPECS.translate!.model,
          prompt_version: prompt.promptVersion,
          locale: loc,
          lesson_id: u.kind === "lesson" ? u.lessonId : null,
          status: "submitting",
          input: inputPayload,
          params: {
            effort: STEP_SPECS.translate!.effort,
            max_output_tokens: 16_000,
            service_tier: serviceTier,
            ...(external ? { external_schema: schema } : {}),
          },
          parent_generation_id: latest?.id || null,
        })
        .select("id")
        .single();
      if (insErr?.code === "23505") continue;
      if (insErr) throw new Error(insErr.message);

      if (external) {
        await addEvent(db, {
          run_id: run.id,
          step_key: "translate",
          attempt: nextAttempt,
          kind: "progress",
          agent_role: "A7",
          message: `Đã tạo tác vụ Claude Code dịch ${u.unitKey} sang ${loc}.`,
          payload: { generation_id: insertedGen.id, locale: loc, lesson_id: u.lessonId ?? null },
        });
        workDoneThisTick++;
        continue;
      }
      if (!apiKey) throw new Error(`Chưa cấu hình ${agentKeyEnv("A7")}.`);

      try {
        const requestId = await submitResponse(apiKey, {
          model: STEP_SPECS.translate!.model,
          instructions: prompt.system,
          input: inputPayload,
          effort: STEP_SPECS.translate!.effort,
          maxOutputTokens: 16_000,
          schemaName: `translate_${u.kind === "course" ? "course" : u.format}`,
          schema,
          serviceTier,
          metadata: { run_id: run.id, step: "translate", locale: loc, unit: u.unitKey },
        });

        await db
          .from("studio_generations")
          .update({
            status: "submitted",
            provider_request_id: requestId,
            submitted_at: new Date().toISOString(),
          })
          .eq("id", insertedGen.id);
      } catch (subErr: any) {
        await failGeneration(db, insertedGen.id, "submitting", "transport", errorMessage(subErr));
      }
      workDoneThisTick++;
    }
  }

  // 5. Nếu tất cả units của 6 ngôn ngữ đã hoàn tất
  if (allUnitsCompleted) {
    const fullTranslations: Record<string, any> = {};
    for (const loc of TRANSLATION_LOCALES) {
      fullTranslations[loc] = {
        course: null,
        sections: {},
        lessons: {},
      };
      for (const u of units) {
        const key = `${loc}:${u.unitKey}`;
        const attempts = gensByUnit.get(key) ?? [];
        const completed = attempts.find((a) => a.status === "completed");
        if (completed?.output) {
          if (u.kind === "course") {
            fullTranslations[loc].course = completed.output.course;
            fullTranslations[loc].sections = completed.output.sections;
          } else {
            fullTranslations[loc].lessons[u.lessonId!] = completed.output;
          }
        }
      }
    }

    const translationsMap = fullTranslations as CourseTranslationMap;

    // Render sơ đồ dịch
    try {
      await renderTranslatedDrafts(db, run, records, translationsMap);
    } catch (renderErr) {
      if (!await handleTranslateRenderError(db, run, renderErr)) throw renderErr;
      return;
    }

    // Lưu generation row tổng hợp
    const { error: insAggErr } = await db.from("studio_generations").insert({
      run_id: run.id,
      step_key: "translate",
      attempt: 0,
      agent_role: "A7",
      kind: "text",
      origin: external ? "external" : "ai",
      provider: external ? "anthropic" : "openai",
      requested_model_id: external ? run.agent_models?.A7 ?? "sonnet" : STEP_SPECS.translate!.model,
      model_id: external ? "claude-code" : STEP_SPECS.translate!.model,
      prompt_version: prompt.promptVersion,
      status: "completed",
      provider_request_id: `translate-aggregate:${run.id}`,
      input: { locales: TRANSLATION_LOCALES },
      output: translationsMap,
      completed_at: new Date().toISOString(),
    });
    if (insAggErr && insAggErr.code !== "23505") throw new Error(insAggErr.message);

    await addEvent(db, {
      run_id: run.id,
      step_key: "translate",
      attempt: 0,
      kind: "result",
      agent_role: "A7",
      message: `${STEP_LABEL.translate}: Đã hoàn tất bản dịch cho 6 ngôn ngữ đích (${TRANSLATION_LOCALES.join(", ")}).`,
      payload: { locales: TRANSLATION_LOCALES },
    });

    await markStepDone(db, run.id, "translate");
  }
}

/** Runs the same integrity checks for a Claude Code translation before accepting it. */
export async function acceptExternalTranslation(
  db: SupabaseClient,
  run: RunRow,
  generation: { locale: string | null; lesson_id: string | null },
  output: unknown,
): Promise<Acceptance> {
  try {
    if (!generation.locale || !TRANSLATION_LOCALES.includes(generation.locale as TranslationLocale)) {
      throw new TranslationIntegrityError("Ngôn ngữ dịch không hợp lệ.");
    }
    if (!output || typeof output !== "object" || Array.isArray(output)) {
      throw new TranslationIntegrityError("Đầu ra dịch phải là một object JSON.");
    }
    const locale = generation.locale as TranslationLocale;
    const raw = structuredClone(output) as Record<string, any>;
    const ctx = await loadContext(db, run, "translate");
    if (generation.lesson_id) {
      const records = await loadRecords(db, run, ctx);
      const record = records[generation.lesson_id];
      if (!record) throw new TranslationIntegrityError(`Không tìm thấy lesson ${generation.lesson_id}.`);
      validateLessonTranslation(record, raw as TranslatedLesson, locale);
    } else {
      const brief = ctx.outputs.brief as any;
      const curriculum = ctx.outputs.curriculum as any;
      const title = brief?.title?.trim();
      if (!title) throw new TranslationIntegrityError("Brief thiếu tiêu đề tiếng Anh chuẩn tắc (title).");
      validateCourseTranslation(
        {
          title,
          short_description: canonicalCourseShortDescription(brief),
          description: canonicalCourseDescription(brief),
          learning_outcomes: curriculum.outcomes.map((outcome: any) => outcome.text),
        },
        raw.course,
        locale,
      );
      const sections: Record<string, any> = Array.isArray(raw.sections)
        ? Object.fromEntries(raw.sections.filter((section: any) => typeof section?.id === "string").map((section: any) => [section.id, section]))
        : raw.sections && typeof raw.sections === "object" && !Array.isArray(raw.sections)
          ? raw.sections
          : {};
      for (const module of curriculum.modules) {
        const translated = sections[module.id];
        if (!translated) throw new TranslationIntegrityError(`[${locale}] Thiếu bản dịch cho module ${module.id}`);
        validateSectionTranslation({ id: module.id, title: module.title, description: module.description }, translated, locale);
      }
      raw.sections = sections;
    }
    return { ok: true, summary: "Bản dịch đạt kiểm tra toàn vẹn.", normalizedOutput: raw };
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }
}

async function runCheck(db: SupabaseClient, run: RunRow, check: CodeStep) {
  const ctx = await loadContext(db, run, check);
  const curriculum = ctx.outputs.curriculum;
  const records = await loadRecords(db, run, ctx);

  let problems: string[];
  const checks: CodeCheck[] = [];
  const restricted: string[] = [];
  try {
    if (check === "structure_check") {
      problems = structureProblems(curriculum, ctx.outputs.research, records, checks);
      if (problems.length === 0 && (await renderDrafts(db, run, records)) > 0) return;
      if (problems.length === 0) problems = await linkProblems(records, fetch, restricted, checks);
    } else {
      problems = journeyProblems(curriculum, records, checks);
    }
  } catch (e) {
    if (e instanceof TransientError) {
      console.error("[corelia-api] studio check deferred", { run_id: run.id, check, error: e.message });
      return;
    }
    throw e;
  }
  if (problems.length > 0) {
    const shown = problems.slice(0, 8).join("; ") + (problems.length > 8 ? ` (+${problems.length - 8})` : "");
    await finishRun(db, run, check, "draft_failed", `${problems.length} lỗi: ${shown}`, 0, { checks });
    return;
  }
  await markStepDone(db, run.id, check);
  if (restricted.length > 0) {
    // 401/403/429 means the page answers but refuses this check; it is kept, with a warning.
    await addEvent(db, { run_id: run.id, step_key: check, attempt: 0, kind: "warning", message: `${STEP_LABEL[check]}: ${restricted.length} link từ chối kiểm tra tự động (coi là còn truy cập): ${restricted.join(", ")}` });
  }
  const lessons = Object.keys(records).length;
  await addEvent(db, {
    run_id: run.id,
    step_key: check,
    attempt: 0,
    kind: "result",
    message: check === "structure_check" ? `${STEP_LABEL[check]}: ${lessons} lesson hợp lệ, link truy cập được.` : `${STEP_LABEL[check]}: hành trình qua ${lessons} lesson hợp lệ.`,
    payload: { checks },
  });
}

// Writes the course through the app's own tables. A refusal by the database becomes the run's reason;
// a failure to reach it is retried on the next tick (publishing is idempotent per run).
async function runPublish(db: SupabaseClient, run: RunRow) {
  const ctx = await loadContext(db, run, "publish");
  const records = await loadRecords(db, run, ctx);
  const course = await db.from("studio_courses").select("title").eq("id", run.course_id).single();
  if (course.error) throw new Error(course.error.message);
  let courseId: string;
  try {
    courseId = await publishRun(db, {
      runId: run.id,
      courseId: run.course_id,
      title: course.data.title,
      brief: ctx.outputs.brief,
      curriculum: ctx.outputs.curriculum,
      records,
      translations: ctx.outputs.translate as any,
    });
  } catch (e) {
    if (e instanceof PublishRejected) {
      await finishRun(db, run, "publish", "draft_failed", e.message, 0);
      return;
    }
    throw e;
  }
  await markStepDone(db, run.id, "publish");
  await addEvent(db, { run_id: run.id, step_key: "publish", attempt: 0, kind: "result", message: `${STEP_LABEL.publish}: đã tạo khóa học ${courseId} (${Object.keys(records).length} lesson).` });
}

// Draft/review state of one lesson, from its accepted generations.
async function loadLessonContext(db: SupabaseClient, run: RunRow, lessonId: string): Promise<LessonContext> {
  const res = await db
    .from("studio_generations")
    .select("step_key,output")
    .eq("run_id", run.id)
    .eq("lesson_id", lessonId)
    .eq("status", "completed")
    .order("attempt");
  if (res.error) throw new Error(res.error.message);
  const drafts = (res.data ?? []).filter((g) => g.step_key === "lessons");
  const reviews = (res.data ?? []).filter((g) => g.step_key === "lesson_review");
  return { drafts: drafts.length, reviews: reviews.length, draft: drafts.at(-1)?.output ?? null, review: reviews.at(-1)?.output ?? null };
}

// The curriculum asked for evidence it does not have: research runs again. Only the tick that moves the
// step out of `done` records the events, so overlapping ticks do not log the same round twice.
async function reopenResearch(db: SupabaseClient, runId: string, attempt: number, round: number, missing: string[]) {
  const { data, error } = await db
    .from("studio_run_steps")
    .update({ state: "active" })
    .eq("run_id", runId)
    .eq("step_key", "research")
    .eq("state", "done")
    .select("run_id");
  if (error) throw new Error(error.message);
  const pending = await db.from("studio_run_steps").update({ state: "pending" }).eq("run_id", runId).eq("step_key", "curriculum");
  if (pending.error) throw new Error(pending.error.message);
  if (!data?.length) return;
  await addEvent(db, { run_id: runId, step_key: "curriculum", attempt, kind: "warning", agent_role: "A3", message: `${STEP_LABEL.curriculum} cần thêm nghiên cứu (vòng ${round}): ${missing.join("; ")}` });
  await addEvent(db, { run_id: runId, step_key: "research", attempt, kind: "progress", agent_role: "A2", message: `Mở lại ${STEP_LABEL.research}.` });
}

// Sends an accepted curriculum back to A3. Only the tick that moves the step out of `done` records
// the event, so overlapping ticks do not log the same round twice.
async function reopenCurriculum(db: SupabaseClient, runId: string, attempt: number, round: number, blocking: number) {
  const { data, error } = await db
    .from("studio_run_steps")
    .update({ state: "active" })
    .eq("run_id", runId)
    .eq("step_key", "curriculum")
    .eq("state", "done")
    .select("run_id");
  if (error) throw new Error(error.message);
  const pending = await db.from("studio_run_steps").update({ state: "pending" }).eq("run_id", runId).eq("step_key", "curriculum_review");
  if (pending.error) throw new Error(pending.error.message);
  if (!data?.length) return;
  await addEvent(db, {
    run_id: runId,
    step_key: "curriculum",
    attempt,
    kind: "progress",
    agent_role: "A3",
    message: `${STEP_LABEL.curriculum_review}: ${blocking} lỗi blocking, mở lại Curriculum (vòng sửa ${round}).`,
  });
}

export async function loadContext(db: SupabaseClient, run: RunRow, step?: StepKey, lessonId?: string): Promise<RunContext> {
  const [course, links, generations] = await Promise.all([
    db.from("studio_courses").select("title,level,scope_note,audience,corelia_direction,content_locale").eq("id", run.course_id).single(),
    db.from("studio_course_paths").select("studio_paths(group_kind,title)").eq("course_id", run.course_id),
    db.from("studio_generations").select("step_key,attempt,output,locale,prompt_version").eq("run_id", run.id).eq("status", "completed").is("lesson_id", null).order("attempt"),
  ]);
  for (const res of [course, links, generations]) if (res.error) throw new Error(res.error.message);

  const paths = (links.data ?? []).flatMap((l) => {
    const p = l.studio_paths as unknown as { group_kind: string; title: string } | null;
    return p ? [{ track: p.group_kind, title: p.title }] : [];
  });
  const tracks = [...new Set(paths.map((p) => p.track))];
  const catalogResearch = step === "brief" && run.catalog_job_id
    ? await loadCatalogResearchForBrief(db, run.catalog_job_id, tracks)
    : null;
  const { audience, corelia_direction, content_locale, ...courseInput } = course.data as RunContext["course"]
    & { audience: string | null; corelia_direction: string | null; content_locale: string };

  // A curriculum that asked for more research is not a curriculum: it only feeds the research gap.
  const requests = (generations.data ?? []).filter((g) => g.step_key === "curriculum" && researchRequest(g.output) !== null);
  const used = (generations.data ?? []).filter((g) => {
    if (requests.includes(g)) return false;
    if (g.step_key === "translate") {
      return (g as any).locale === null || (g as any).locale === undefined;
    }
    return true;
  });
  const outputs: RunContext["outputs"] = {};
  for (const g of used) outputs[g.step_key as StepKey] = g.output; // ordered by attempt: latest wins
  const curriculumPromptVersion = used.filter((g) => g.step_key === "curriculum").at(-1)?.prompt_version ?? null;
  const accepted = (step: StepKey) => used.filter((g) => g.step_key === step).length;
  return {
    revision: curriculumRevision({ curricula: accepted("curriculum"), reviews: accepted("curriculum_review") }, outputs.curriculum_review),
    researchGap: researchGap({ researches: accepted("research"), requests: requests.length }, requests.at(-1)?.output),
    course: courseInput,
    paths,
    // The start gate guarantees both fields; a course edited to NULL afterwards sends no tracks, as an unconfigured group did.
    scopes: audience && corelia_direction ? tracks.map((track) => ({ track, audience, corelia_direction, locale: content_locale })) : [],
    catalogResearch,
    outputs,
    curriculumPromptVersion,
    today: utcDate(Date.now()),
    lesson: lessonId ? await loadLessonContext(db, run, lessonId) : null,
  };
}

async function submitStep(
  db: SupabaseClient,
  run: RunRow,
  step: StepKey,
  attempt: number,
  parentId: string | null,
  previousError: string | null,
  lessonId?: string,
) {
  const spec = STEP_SPECS[step]!;
  const agent = stepAgent(step)!;
  const external = run.execution_mode === "claude_code";
  const apiKey = agentKey(agent.role);
  if (!external && !apiKey) {
    await finishRun(db, run, step, "draft_failed", `Chưa cấu hình ${agentKeyEnv(agent.role)}.`, attempt);
    return;
  }
  const prompt = await loadAgentPrompt(db, agent.promptKey);
  const ctx = await loadContext(db, run, step, lessonId);
  const tools = lessonId && spec.lessonTools ? spec.lessonTools(lessonId, ctx) : spec.tools;
  // After an infrastructure failure the retry is not a correction: the model is not told it was
  // rejected, and a provider failure (possibly no flex capacity) goes to the default tier.
  const parentKind = parentId ? await loadFailureKind(db, parentId) : null;
  const rejectedBecause = parentKind === "rejected" ? previousError : null;
  const serviceTier = parentKind === "provider" ? "default" : SERVICE_TIER;
  // A retry tells the model why the previous attempt was rejected; resending the same input
  // would most likely reproduce the same failure.
  const input = {
    ...spec.buildInput(ctx, lessonId),
    ...(rejectedBecause ? { previous_attempt: { attempt: attempt - 1, rejected_because: rejectedBecause } } : {}),
  };

  // The insert is the claim: a concurrent tick hitting the same attempt gets 23505 and stops here.
  const { data: gen, error } = await db
    .from("studio_generations")
    .insert({
      run_id: run.id,
      step_key: step,
      lesson_id: lessonId ?? null,
      attempt,
      agent_role: agent.role,
      kind: spec.kind,
      origin: external ? "external" : "ai",
      provider: external ? "anthropic" : "openai",
      requested_model_id: external ? run.agent_models?.[agent.role] ?? "sonnet" : spec.model,
      prompt_version: prompt.promptVersion,
      params: { effort: spec.effort, max_output_tokens: spec.maxOutputTokens, tools: tools ?? [], service_tier: serviceTier },
      input,
      parent_generation_id: parentId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);

  // repair_count counts rounds of one step; per-lesson attempts do not belong to it.
  const stepUpdate = await db.from("studio_run_steps").update(lessonId ? { state: "active" } : { state: "active", repair_count: attempt }).eq("run_id", run.id).eq("step_key", step);
  if (stepUpdate.error) throw new Error(stepUpdate.error.message);
  const courseUpdate = await db.from("studio_courses").update({ status: "generating" }).eq("id", run.course_id).eq("status", "queued");
  if (courseUpdate.error) throw new Error(courseUpdate.error.message);

  if (external) {
    await addEvent(db, {
      run_id: run.id,
      step_key: step,
      attempt,
      kind: "progress",
      agent_role: agent.role,
      message: `${STEP_LABEL[step]}: đã tạo tác vụ Claude Code (${attempt + 1}).`,
      payload: { generation_id: gen.id, lesson_id: lessonId ?? null },
    });
    return;
  }
  if (!apiKey) throw new Error(`Chưa cấu hình ${agentKeyEnv(agent.role)}.`);

  const label = lessonId ? `${STEP_LABEL[step]} ${lessonId}` : STEP_LABEL[step];
  let requestId: string;
  try {
    requestId = await submitResponse(apiKey, {
      model: spec.model,
      instructions: prompt.system,
      input,
      sharedInputKeys: spec.sharedInputKeys,
      effort: spec.effort,
      maxOutputTokens: spec.maxOutputTokens,
      schemaName: step,
      schema: spec.schema,
      tools,
      serviceTier,
      metadata: { generation_id: gen.id, run_id: run.id, step, ...(lessonId ? { lesson_id: lessonId } : {}) },
    });
  } catch (e) {
    await failGeneration(db, gen.id, "submitting", "transport", `Không gửi được yêu cầu: ${errorMessage(e)}`);
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "error", agent_role: agent.role, message: stepRequestFailureMessage(label) });
    return;
  }

  const { error: saveError } = await db
    .from("studio_generations")
    .update({ status: "submitted", provider_request_id: requestId, submitted_at: new Date().toISOString() })
    .eq("id", gen.id)
    .eq("status", "submitting");
  if (saveError) throw new Error(saveError.message);
  await addEvent(db, {
    run_id: run.id,
    step_key: step,
    attempt,
    kind: "progress",
    agent_role: agent.role,
    message: stepRequestSentMessage(label, attempt, lessonNote(step, ctx)),
  });
}

// Which round of the lesson loop a request belongs to, for the event log.
function lessonNote(step: StepKey, ctx: RunContext): string {
  if (!ctx.lesson) return "";
  if (step === "lesson_review") return `, review lần ${ctx.lesson.reviews + 1}`;
  const revision = lessonRevision(ctx.lesson);
  return revision ? `, sửa theo review lần ${revision.round}` : "";
}

export function stepRequestFailureMessage(label: string): string {
  return `${label}: không gửi được yêu cầu.`;
}

export function stepRequestSentMessage(label: string, attempt: number, detail = ""): string {
  return `${label}: đã gửi yêu cầu (lượt ${attempt + 1}${detail}).`;
}

export function stepResponseFailureMessage(label: string, reason: string, modelIds: (string | null | undefined)[] = []): string {
  const safeReason = modelIds
    .filter((model): model is string => Boolean(model))
    .reduce((current, model) => current.replace(new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "model hiện tại"), reason);
  return `${label}: yêu cầu trả lỗi (${safeReason}).`;
}

// A background response belongs to the project of the key that created it, so it is read with
// the key of the agent recorded on the generation, not with the key of whichever step is current.
async function pollStep(db: SupabaseClient, run: RunRow, step: StepKey, latest: GenerationState, requestId: string) {
  const { id: generationId, attempt } = latest;
  const lessonId = latest.lesson_id ?? undefined;
  const apiKey = agentKey(latest.agent_role);
  if (!apiKey) {
    await finishRun(db, run, step, "draft_failed", `Chưa cấu hình ${agentKeyEnv(latest.agent_role)}.`, attempt);
    return;
  }
  const now = Date.now();
  const pausedMs = now - Date.parse(latest.created_at) > RESPONSE_STALE_MS
    ? await loadPausedDurationMs(db, run, now)
    : 0;
  const result = await pollOrExpire(apiKey, requestId, latest.created_at, pausedMs);
  if (!result || result.state === "running") return;

  const spec = STEP_SPECS[step]!;
  const agent = stepAgent(step)!;
  const label = lessonId ? `${STEP_LABEL[step]} ${lessonId}` : STEP_LABEL[step];
  if (result.state === "failed") {
    if (result.cause === "provider") {
      // Flex has no capacity (or waited too long): the same attempt goes again on the default tier.
      const fallback = await fallBackToDefaultTier(db, generationId, requestId, async ({ input, params }) => {
        const prompt = await loadAgentPrompt(db, agent.promptKey);
        return submitResponse(apiKey, {
          model: spec.model,
          instructions: prompt.system,
          input,
          sharedInputKeys: spec.sharedInputKeys,
          effort: spec.effort,
          maxOutputTokens: spec.maxOutputTokens,
          schemaName: step,
          schema: spec.schema,
          tools: (params.tools as Record<string, unknown>[] | undefined) ?? [],
          serviceTier: "default",
          metadata: { generation_id: generationId, run_id: run.id, step, ...(lessonId ? { lesson_id: lessonId } : {}) },
        });
      });
      if (fallback.outcome === "resubmitted") {
        await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "progress", agent_role: agent.role, message: `${label}: flex không còn chỗ, gửi lại bằng tier mặc định (lượt ${attempt + 1}).` });
        return;
      }
      if (fallback.outcome === "taken_by_other_tick") return;
      if (fallback.outcome === "submit_failed") {
        await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "error", agent_role: agent.role, message: stepRequestFailureMessage(label) });
        return;
      }
    }
    if (await failGeneration(db, generationId, "submitted", result.cause, result.error, { model_id: result.model, usage: result.usage })) {
      await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "warning", agent_role: agent.role, message: stepResponseFailureMessage(label, result.error, [spec.model, result.model]) });
    }
    return;
  }

  let output: unknown;
  try {
    output = JSON.parse(result.text);
  } catch {
    output = null;
  }
  let acceptance: Acceptance;
  try {
    acceptance = output === null
      ? { ok: false, reason: "Đầu ra không phải JSON hợp lệ." }
      : await spec.accept(output, await loadContext(db, run, step, lessonId), lessonId);
  } catch (e) {
    // A check that could not be made (e.g. YouTube unreachable) is not a verdict on the output:
    // leave the response unread so the next tick polls it again without spending an attempt.
    if (e instanceof TransientError) {
      console.error("[corelia-api] studio accept deferred", { run_id: run.id, lesson_id: lessonId, error: e.message });
      return;
    }
    throw e;
  }

  const done = {
    output: acceptance.ok ? acceptance.normalizedOutput ?? output ?? { raw: result.text.slice(0, 20000) } : output ?? { raw: result.text.slice(0, 20000) },
    model_id: result.model,
    usage: result.usage,
    completed_at: new Date().toISOString(),
  };
  const { data: updated, error } = await db
    .from("studio_generations")
    .update(acceptance.ok ? { ...done, status: "completed" } : { ...done, status: "failed", failure_kind: "rejected", error: acceptance.reason })
    .eq("id", generationId)
    .eq("status", "submitted")
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated?.length) return; // another tick already recorded this response

  if (acceptance.ok) {
    // The step is done once every lesson is accepted (planRun), and a review is done only when its
    // verdict leaves no blocking item (planRun decides between done and reopening the curriculum).
    // A curriculum that asks for more research is not done either: planRun reopens the research.
    const undecided = step === "curriculum_review" || (step === "curriculum" && researchRequest(output) !== null);
    if (!lessonId && !undecided) await markStepDone(db, run.id, step);
    const eventPayload = step === "lesson_review"
      ? lessonReviewEventPayload(acceptance.normalizedOutput, acceptance.codeChecks, lessonId)
      : step === "curriculum_review"
        ? {
          checks: (acceptance.normalizedOutput as Record<string, unknown> | undefined)?.checks ?? [],
          code_checks: acceptance.codeChecks ?? [],
          ...(lessonId ? { lesson_id: lessonId } : {}),
        }
        : undefined;
    await addEvent(db, {
      run_id: run.id,
      step_key: step,
      attempt,
      kind: "result",
      agent_role: agent.role,
      message: `${label}: ${acceptance.summary}`,
      ...(eventPayload ? { payload: eventPayload } : {}),
    });
  } else {
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "warning", agent_role: agent.role, message: `${label}: ${acceptance.reason}` });
  }
}

export function lessonReviewEventPayload(
  normalizedOutput: unknown,
  codeChecks: unknown[] = [],
  lessonId?: string,
) {
  const norm = normalizedOutput as Record<string, unknown> | undefined;
  const issues = Array.isArray(norm?.issues)
    ? (norm.issues as Array<{ severity?: string; category?: string }>)
    : [];
  const blockingIssues = issues.filter((i) => i.severity === "blocking");
  const blocking = blockingIssues.length;
  const minor = issues.length - blocking;
  const verdict = (norm?.verdict as string) || (blocking > 0 ? "needs_fix" : "pass");
  const blockingCategories = Array.from(
    new Set(blockingIssues.map((i) => i.category).filter((c): c is string => Boolean(c))),
  ).slice(0, 3);
  return {
    checks: norm?.checks ?? [],
    code_checks: codeChecks,
    ...(lessonId ? { lesson_id: lessonId } : {}),
    verdict,
    blocking,
    minor,
    blocking_categories: blockingCategories,
  };
}

async function markStepDone(db: SupabaseClient, runId: string, step: StepKey) {
  const { error } = await db.from("studio_run_steps").update({ state: "done" }).eq("run_id", runId).eq("step_key", step);
  if (error) throw new Error(error.message);
}

async function markCatalogResearchDone(db: SupabaseClient, runId: string): Promise<boolean> {
  const { data, error } = await db
    .from("studio_run_steps")
    .update({ state: "done" })
    .eq("run_id", runId)
    .eq("step_key", "catalog_research")
    .neq("state", "done")
    .select("step_key");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function loadCatalogResearchSummary(db: SupabaseClient, jobId: string, reason: string | null): Promise<string> {
  const { data, error } = await db
    .from("studio_generations")
    .select("output")
    .eq("catalog_job_id", jobId)
    .eq("status", "completed")
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[corelia-api] studio catalog result summary", { job_id: jobId, error: error.message });
    return reason?.trim() || "Không đọc được tóm tắt A1 đã lưu.";
  }
  const summary = catalogResearchSummary(data?.output);
  return summary ?? reason?.trim() ?? "Không tìm thấy tóm tắt A1 đã lưu.";
}

function catalogResearchSummary(output: unknown): string | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  const shared = Array.isArray(record.shared) ? record.shared : [];
  const byGroup = Array.isArray(record.by_group) ? record.by_group : [];
  const criteria = [
    ...shared,
    ...byGroup.flatMap((group) => group && typeof group === "object" && !Array.isArray(group)
      && Array.isArray((group as Record<string, unknown>).criteria)
      ? (group as Record<string, unknown>).criteria as unknown[]
      : []),
  ].filter((criterion) => criterion && typeof criterion === "object" && !Array.isArray(criterion)) as Record<string, unknown>[];
  if (criteria.length === 0) return null;
  const rated = criteria.filter((criterion) => typeof criterion.level === "number").length;
  const web = Array.isArray(record.web_evidence) ? record.web_evidence.length : 0;
  const input = Array.isArray(record.input_evidence) ? record.input_evidence.length : 0;
  return `${rated}/${criteria.length} tiêu chí có mức, ${web} bằng chứng web, ${input} bằng chứng input.`;
}

async function finishRun(
  db: SupabaseClient,
  run: RunRow,
  step: StepKey | null,
  status: "published" | "draft_failed",
  reason: string,
  attempt: number,
  payload?: unknown,
) {
  if (status === "draft_failed" && step) {
    const { error } = await db
      .from("studio_run_steps")
      .update({ state: "failed", failure_reason: reason.slice(0, 1000) })
      .eq("run_id", run.id)
      .eq("step_key", step)
      .neq("state", "done");
    if (error) throw new Error(error.message);
  }
  const { data: finished, error } = await db.rpc("studio_finish_run", { p_run_id: run.id, p_status: status, p_reason: reason });
  if (error) throw new Error(error.message);
  if (!finished) return;
  await addEvent(db, {
    run_id: run.id,
    step_key: step ?? "publish",
    attempt,
    kind: status === "published" ? "result" : "error",
    agent_role: step === "catalog_research" ? "A1" : step ? stepAgent(step)?.role ?? null : null,
    message: status === "published" ? "Lượt chạy hoàn tất." : `Dừng lượt chạy, giữ nháp: ${reason}`,
    ...(payload === undefined ? {} : { payload }),
  });
}

async function addEvent(
  db: SupabaseClient,
  event: { run_id: string; step_key: StepKey; attempt: number; kind: string; agent_role?: string | null; message: string; payload?: unknown },
) {
  const { error } = await db.from("studio_run_events").insert({ ...event, message: event.message.slice(0, 500) });
  if (error) throw new Error(error.message);
}

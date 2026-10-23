import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { journeyProblems, linkProblems, structureProblems, type LessonRecord } from "./checks.ts";
import { draftDir, draftPath, renderDiagramPng } from "./diagram_render.ts";
import type { LessonAction, LessonGeneration } from "./lesson_flow.ts";
import {
  lessonIds,
  lessonRefs,
  lessonRevision,
  reviewBlocking,
  toLessonDraft,
  TransientError,
  type LessonContext,
  type LessonOutput,
} from "./lessons.ts";
import { advanceCatalogJobs } from "./catalog_run.ts";
import { purgeExpiredDrafts } from "./drafts.ts";
import { rerankIfStale } from "./ranking_run.ts";
import { agentKey, errorMessage, failGeneration, loadFailureKind } from "./generations.ts";
import { pollResponse, submitResponse } from "./openai.ts";
import { publishRun, PublishRejected } from "./publish.ts";
import { resumeNote, type StartResult } from "./resume.ts";
import { PROMPTS } from "./prompts.ts";
import {
  agentKeyEnv,
  buildProgress,
  SERVICE_TIER,
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
  run_id_conflict: 409,
};

export interface RunRow {
  id: string;
  course_id: string;
  started_at: string;
}

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
  if (!UUID_RE.test(courseId) || !UUID_RE.test(runId) || (resumeFrom !== null && !UUID_RE.test(resumeFrom))) return json({ message: "invalid_input" }, 400);

  const { data, error } = await db.rpc("studio_start_run", { p_course_id: courseId, p_run_id: runId, p_started_by: userId, p_resume_from: resumeFrom });
  if (error) {
    const status = START_ERRORS[error.message] ?? (error.code === "23505" ? 409 : undefined);
    if (status) return json({ message: error.code === "23505" ? "course_has_running_run" : error.message }, status);
    throw new Error(error.message);
  }
  const result = data as StartResult;
  if (result.created) {
    await addEvent(db, { run_id: runId, step_key: "brief", attempt: 0, kind: "progress", message: "Đã xếp hàng lượt chạy." });
    const note = resumeNote(result, resumeFrom);
    if (note) await addEvent(db, { run_id: runId, step_key: "brief", attempt: 0, kind: "progress", message: note });
  }
  return json(result, result.created ? 201 : 200);
}

export async function handleStudioTick(req: Request, db: SupabaseClient): Promise<Response> {
  const expected = Deno.env.get("CORELIA_STUDIO_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-studio-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) return json({ message: "unauthorized" }, 401);

  // Least recently advanced first, so every running run moves forward across ticks.
  const { data: runs, error } = await db
    .from("studio_runs")
    .select("id,course_id,started_at")
    .eq("status", "running")
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
  const catalog = await advanceCatalogJobs(db);
  const ranking = await rerankIfStale(db);
  const drafts = await purgeExpiredDrafts(db);
  return json({ processed: results.length, results, catalog, ranking, drafts });
}

export async function advanceRun(db: SupabaseClient, run: RunRow): Promise<{ step: StepKey | null; action: TickAction["kind"] }> {
  const { data: stepRows, error } = await db.from("studio_run_steps").select("step_key,state").eq("run_id", run.id);
  if (error) throw new Error(error.message);
  const steps: Partial<Record<StepKey, StepState>> = {};
  for (const row of stepRows ?? []) steps[row.step_key as StepKey] = row.state as StepState;

  const current = STEP_ORDER.find((k) => steps[k] !== "done");
  let latest: GenerationState | null = null;
  if (current) {
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

  const progress = current ? await loadProgress(db, run, current, latest) : undefined;
  const lessons = current === "lessons" || current === "lesson_review" ? await loadLessons(db, run) : undefined;
  const { step, action } = planRun({ steps, latest, startedAt: run.started_at, now: Date.now(), progress, lessons });
  switch (action.kind) {
    case "lessons":
      await runLessonActions(db, run, action.actions);
      break;
    case "check":
      await runCheck(db, run, action.check);
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
      await markStepDone(db, run.id, step!);
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
  for (const r of reviews.data ?? []) blocking[r.lesson_id as string] = reviewBlocking(r.output); // ascending: newest wins
  return { ids, rows: (rows.data ?? []) as LessonGeneration[], blocking };
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
    records[id] = { draft: toLessonDraft(ref, g.output as LessonOutput, locale), written: prov(g), reviewed: prov(reviewed[id]) };
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
async function runCheck(db: SupabaseClient, run: RunRow, check: CodeStep) {
  const ctx = await loadContext(db, run);
  const curriculum = ctx.outputs.curriculum;
  const records = await loadRecords(db, run, ctx);

  let problems: string[];
  const restricted: string[] = [];
  try {
    if (check === "structure_check") {
      problems = structureProblems(curriculum, ctx.outputs.research, records);
      if (problems.length === 0 && (await renderDrafts(db, run, records)) > 0) return;
      if (problems.length === 0) problems = await linkProblems(records, fetch, restricted);
    } else {
      problems = journeyProblems(curriculum, records);
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
    await finishRun(db, run, check, "draft_failed", `${problems.length} lỗi: ${shown}`, 0);
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
  });
}

// Writes the course through the app's own tables. A refusal by the database becomes the run's reason;
// a failure to reach it is retried on the next tick (publishing is idempotent per run).
async function runPublish(db: SupabaseClient, run: RunRow) {
  const ctx = await loadContext(db, run);
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

async function loadContext(db: SupabaseClient, run: RunRow, lessonId?: string): Promise<RunContext> {
  const [course, links, generations] = await Promise.all([
    db.from("studio_courses").select("title,level").eq("id", run.course_id).single(),
    db.from("studio_course_paths").select("studio_paths(group_kind,title)").eq("course_id", run.course_id),
    db.from("studio_generations").select("step_key,attempt,output").eq("run_id", run.id).eq("status", "completed").is("lesson_id", null).order("attempt"),
  ]);
  for (const res of [course, links, generations]) if (res.error) throw new Error(res.error.message);

  const paths = (links.data ?? []).flatMap((l) => {
    const p = l.studio_paths as unknown as { group_kind: string; title: string } | null;
    return p ? [{ track: p.group_kind, title: p.title }] : [];
  });
  const tracks = [...new Set(paths.map((p) => p.track))];
  const scopes = await db.from("studio_catalog_scopes").select("group_kind,audience,corelia_direction,locale").in("group_kind", tracks);
  if (scopes.error) throw new Error(scopes.error.message);

  // A curriculum that asked for more research is not a curriculum: it only feeds the research gap.
  const requests = (generations.data ?? []).filter((g) => g.step_key === "curriculum" && researchRequest(g.output) !== null);
  const used = (generations.data ?? []).filter((g) => !requests.includes(g));
  const outputs: RunContext["outputs"] = {};
  for (const g of used) outputs[g.step_key as StepKey] = g.output; // ordered by attempt: latest wins
  const accepted = (step: StepKey) => used.filter((g) => g.step_key === step).length;
  return {
    revision: curriculumRevision({ curricula: accepted("curriculum"), reviews: accepted("curriculum_review") }, outputs.curriculum_review),
    researchGap: researchGap({ researches: accepted("research"), requests: requests.length }, requests.at(-1)?.output),
    course: course.data as RunContext["course"],
    paths,
    scopes: (scopes.data ?? []).map((s) => ({
      track: s.group_kind,
      audience: s.audience,
      corelia_direction: s.corelia_direction,
      locale: s.locale,
    })),
    outputs,
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
  const apiKey = agentKey(agent.role);
  if (!apiKey) {
    await finishRun(db, run, step, "draft_failed", `Chưa cấu hình ${agentKeyEnv(agent.role)}.`, attempt);
    return;
  }
  const ctx = await loadContext(db, run, lessonId);
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
      provider: "openai",
      requested_model_id: spec.model,
      prompt_version: agent.promptVersion,
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

  const label = lessonId ? `${STEP_LABEL[step]} ${lessonId}` : STEP_LABEL[step];
  let requestId: string;
  try {
    requestId = await submitResponse(apiKey, {
      model: spec.model,
      instructions: PROMPTS[spec.prompt].system,
      input: JSON.stringify(input),
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
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "error", agent_role: agent.role, message: `${label}: không gửi được yêu cầu tới ${spec.model}.` });
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
    message: `${label}: đã gửi yêu cầu tới ${spec.model} (lượt ${attempt + 1}${lessonNote(step, ctx)}).`,
  });
}

// Which round of the lesson loop a request belongs to, for the event log.
function lessonNote(step: StepKey, ctx: RunContext): string {
  if (!ctx.lesson) return "";
  if (step === "lesson_review") return `, review lần ${ctx.lesson.reviews + 1}`;
  const revision = lessonRevision(ctx.lesson);
  return revision ? `, sửa theo review lần ${revision.round}` : "";
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
  const result = await pollResponse(apiKey, requestId);
  if (!result || result.state === "running") return;

  const spec = STEP_SPECS[step]!;
  const agent = stepAgent(step)!;
  const label = lessonId ? `${STEP_LABEL[step]} ${lessonId}` : STEP_LABEL[step];
  if (result.state === "failed") {
    if (await failGeneration(db, generationId, "submitted", result.cause, result.error, { model_id: result.model, usage: result.usage })) {
      await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "warning", agent_role: agent.role, message: `${label}: model trả lỗi (${result.error}).` });
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
      : await spec.accept(output, await loadContext(db, run, lessonId), lessonId);
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
    output: output ?? { raw: result.text.slice(0, 20000) },
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
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "result", agent_role: agent.role, message: `${label}: ${acceptance.summary}` });
  } else {
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "warning", agent_role: agent.role, message: `${label}: ${acceptance.reason}` });
  }
}

async function markStepDone(db: SupabaseClient, runId: string, step: StepKey) {
  const { error } = await db.from("studio_run_steps").update({ state: "done" }).eq("run_id", runId).eq("step_key", step);
  if (error) throw new Error(error.message);
}

async function finishRun(
  db: SupabaseClient,
  run: RunRow,
  step: StepKey | null,
  status: "published" | "draft_failed",
  reason: string,
  attempt: number,
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
    agent_role: step ? stepAgent(step)?.role ?? null : null,
    message: status === "published" ? "Lượt chạy hoàn tất." : `Dừng lượt chạy, giữ nháp: ${reason}`,
  });
}

async function addEvent(
  db: SupabaseClient,
  event: { run_id: string; step_key: StepKey; attempt: number; kind: string; agent_role?: string | null; message: string },
) {
  const { error } = await db.from("studio_run_events").insert({ ...event, message: event.message.slice(0, 500) });
  if (error) throw new Error(error.message);
}

import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { pollResponse, submitResponse } from "./openai.ts";
import { PROMPTS } from "./prompts.ts";
import {
  planRun,
  STEP_LABEL,
  STEP_ORDER,
  STEP_SPECS,
  stepAgent,
  type GenerationState,
  type RunContext,
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

interface RunRow {
  id: string;
  course_id: string;
  started_at: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  if (!UUID_RE.test(courseId) || !UUID_RE.test(runId)) return json({ message: "invalid_input" }, 400);

  const { data, error } = await db.rpc("studio_start_run", { p_course_id: courseId, p_run_id: runId });
  if (error) {
    const status = START_ERRORS[error.message] ?? (error.code === "23505" ? 409 : undefined);
    if (status) return json({ message: error.code === "23505" ? "course_has_running_run" : error.message }, status);
    throw new Error(error.message);
  }
  const result = data as { run_id: string; created: boolean };
  if (result.created) {
    await addEvent(db, { run_id: runId, step_key: "brief", attempt: 0, kind: "progress", message: "Đã xếp hàng lượt chạy." });
  }
  return json(result, result.created ? 201 : 200);
}

export async function handleStudioTick(req: Request, db: SupabaseClient): Promise<Response> {
  const expected = Deno.env.get("CORELIA_STUDIO_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-studio-cron-secret")?.trim() ?? "";
  if (!expected || provided !== expected) return json({ message: "unauthorized" }, 401);
  const apiKey = Deno.env.get("CORELIA_STUDIO_OPENAI_API_KEY")?.trim() ?? "";
  if (!apiKey) return json({ message: "studio_openai_key_missing" }, 503);

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
      const outcome = await advanceRun(db, apiKey, run);
      results.push({ run_id: run.id, ...outcome });
    } catch (e) {
      console.error("[corelia-api] studio tick", { run_id: run.id, error: errorMessage(e) });
      results.push({ run_id: run.id, error: "advance_failed" });
    }
    const { error: touchError } = await db.from("studio_runs").update({ status: "running" }).eq("id", run.id).eq("status", "running");
    if (touchError) console.error("[corelia-api] studio tick touch", { run_id: run.id, error: touchError.message });
  }
  return json({ processed: results.length, results });
}

async function advanceRun(db: SupabaseClient, apiKey: string, run: RunRow): Promise<{ step: StepKey | null; action: TickAction["kind"] }> {
  const { data: stepRows, error } = await db.from("studio_run_steps").select("step_key,state").eq("run_id", run.id);
  if (error) throw new Error(error.message);
  const steps: Partial<Record<StepKey, StepState>> = {};
  for (const row of stepRows ?? []) steps[row.step_key as StepKey] = row.state as StepState;

  const current = STEP_ORDER.find((k) => steps[k] !== "done");
  let latest: GenerationState | null = null;
  if (current) {
    const res = await db
      .from("studio_generations")
      .select("id,attempt,status,provider_request_id,error,created_at")
      .eq("run_id", run.id)
      .eq("step_key", current)
      .order("attempt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    latest = res.data as GenerationState | null;
  }

  const { step, action } = planRun({ steps, latest, startedAt: run.started_at, now: Date.now() });
  switch (action.kind) {
    case "finish":
      await finishRun(db, run, step, action.status, action.reason, latest?.attempt ?? 0);
      break;
    case "submit":
      await submitStep(db, apiKey, run, step!, action.attempt, action.parentId);
      break;
    case "poll":
      await pollStep(db, apiKey, run, step!, action.generationId, action.requestId, latest!.attempt);
      break;
    case "expire_submitting":
      await failGeneration(db, action.generationId, "submitting", "Gửi yêu cầu tới model bị gián đoạn.");
      break;
    case "mark_done":
      await markStepDone(db, run.id, step!);
      break;
    case "wait":
      break;
  }
  return { step, action: action.kind };
}

async function loadContext(db: SupabaseClient, run: RunRow): Promise<RunContext> {
  const [course, links, generations] = await Promise.all([
    db.from("studio_courses").select("title,level").eq("id", run.course_id).single(),
    db.from("studio_course_paths").select("studio_paths(group_kind,title)").eq("course_id", run.course_id),
    db.from("studio_generations").select("step_key,attempt,output").eq("run_id", run.id).eq("status", "completed").order("attempt"),
  ]);
  for (const res of [course, links, generations]) if (res.error) throw new Error(res.error.message);

  const paths = (links.data ?? []).flatMap((l) => {
    const p = l.studio_paths as unknown as { group_kind: string; title: string } | null;
    return p ? [{ track: p.group_kind, title: p.title }] : [];
  });
  const tracks = [...new Set(paths.map((p) => p.track))];
  const scopes = await db.from("studio_catalog_scopes").select("group_kind,audience,corelia_direction,locale").in("group_kind", tracks);
  if (scopes.error) throw new Error(scopes.error.message);

  const outputs: RunContext["outputs"] = {};
  for (const g of generations.data ?? []) outputs[g.step_key as StepKey] = g.output; // ordered by attempt: latest wins
  return {
    course: course.data as RunContext["course"],
    paths,
    scopes: (scopes.data ?? []).map((s) => ({
      track: s.group_kind,
      audience: s.audience,
      corelia_direction: s.corelia_direction,
      locale: s.locale,
    })),
    outputs,
  };
}

async function submitStep(db: SupabaseClient, apiKey: string, run: RunRow, step: StepKey, attempt: number, parentId: string | null) {
  const spec = STEP_SPECS[step]!;
  const agent = stepAgent(step)!;
  const input = spec.buildInput(await loadContext(db, run));

  // The insert is the claim: a concurrent tick hitting the same attempt gets 23505 and stops here.
  const { data: gen, error } = await db
    .from("studio_generations")
    .insert({
      run_id: run.id,
      step_key: step,
      attempt,
      agent_role: agent.role,
      kind: spec.kind,
      provider: "openai",
      requested_model_id: spec.model,
      prompt_version: agent.promptVersion,
      params: { effort: spec.effort, tools: spec.tools ?? [] },
      input,
      parent_generation_id: parentId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);

  const stepUpdate = await db.from("studio_run_steps").update({ state: "active", repair_count: attempt }).eq("run_id", run.id).eq("step_key", step);
  if (stepUpdate.error) throw new Error(stepUpdate.error.message);
  const courseUpdate = await db.from("studio_courses").update({ status: "generating" }).eq("id", run.course_id).eq("status", "queued");
  if (courseUpdate.error) throw new Error(courseUpdate.error.message);

  const label = STEP_LABEL[step];
  let requestId: string;
  try {
    requestId = await submitResponse(apiKey, {
      model: spec.model,
      instructions: PROMPTS[spec.prompt].system,
      input: JSON.stringify(input),
      effort: spec.effort,
      schemaName: step,
      schema: spec.schema,
      tools: spec.tools,
      metadata: { generation_id: gen.id, run_id: run.id, step },
    });
  } catch (e) {
    await failGeneration(db, gen.id, "submitting", `Không gửi được yêu cầu: ${errorMessage(e)}`);
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
    message: `${label}: đã gửi yêu cầu tới ${spec.model} (lượt ${attempt + 1}).`,
  });
}

async function pollStep(db: SupabaseClient, apiKey: string, run: RunRow, step: StepKey, generationId: string, requestId: string, attempt: number) {
  const result = await pollResponse(apiKey, requestId);
  if (!result || result.state === "running") return;

  const spec = STEP_SPECS[step]!;
  const agent = stepAgent(step)!;
  const label = STEP_LABEL[step];
  if (result.state === "failed") {
    if (await failGeneration(db, generationId, "submitted", result.error)) {
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
  const acceptance = output === null
    ? { ok: false as const, reason: "Đầu ra không phải JSON hợp lệ." }
    : spec.accept(output, await loadContext(db, run));

  const done = {
    output: output ?? { raw: result.text.slice(0, 20000) },
    model_id: result.model,
    usage: result.usage,
    completed_at: new Date().toISOString(),
  };
  const { data: updated, error } = await db
    .from("studio_generations")
    .update(acceptance.ok ? { ...done, status: "completed" } : { ...done, status: "failed", error: acceptance.reason })
    .eq("id", generationId)
    .eq("status", "submitted")
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated?.length) return; // another tick already recorded this response

  if (acceptance.ok) {
    await markStepDone(db, run.id, step);
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "result", agent_role: agent.role, message: `${label}: ${acceptance.summary}` });
  } else {
    await addEvent(db, { run_id: run.id, step_key: step, attempt, kind: "warning", agent_role: agent.role, message: `${label}: ${acceptance.reason}` });
  }
}

async function markStepDone(db: SupabaseClient, runId: string, step: StepKey) {
  const { error } = await db.from("studio_run_steps").update({ state: "done" }).eq("run_id", runId).eq("step_key", step);
  if (error) throw new Error(error.message);
}

/** Returns false when the row had already left `from` (handled by another tick). */
async function failGeneration(db: SupabaseClient, id: string, from: "submitting" | "submitted", reason: string): Promise<boolean> {
  const { data, error } = await db
    .from("studio_generations")
    .update({ status: "failed", error: reason.slice(0, 2000), completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
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

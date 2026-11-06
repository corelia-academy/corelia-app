import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource } from "npm:@supabase/server@1";
import { z } from "npm:zod@^4.3.6";
import { getUserRole } from "../corelia-api/lib/authz.ts";
import { createServiceClient, verifyBearerUser, type SupabaseClient } from "../corelia-api/lib/supabase.ts";
import { acceptExternalTranslation, advanceRun, loadContext, type RunRow } from "../corelia-api/studio/handlers.ts";
import {
  advanceCatalogJob,
  loadCatalogBase,
  logCatalogRunEvent,
} from "../corelia-api/studio/catalog_run.ts";
import {
  acceptCatalogResearch,
  CATALOG_RESEARCH_SCHEMA,
  CATALOG_SPEC,
} from "../corelia-api/studio/catalog.ts";
import { loadAgentPrompt } from "../corelia-api/studio/agent_prompts.ts";
import {
  DEFAULT_AGENT_EFFORTS,
  DEFAULT_AGENT_MODELS,
  AGENT_ROLES,
  EFFORT_LEVELS,
  MODEL_ALIASES,
  resolveAgentEfforts,
  resolveAgentModels,
  type AgentEffortOverrides,
  type AgentModelOverrides,
} from "../corelia-api/studio/agent_preferences.ts";
import { stepAgent, STEP_ORDER, STEP_SPECS, utcDate, type Acceptance, type StepKey } from "../corelia-api/studio/steps.ts";

const MODEL_ALIAS = z.enum(MODEL_ALIASES);
const MODEL_MAP_SCHEMA = z.object({
  A1: MODEL_ALIAS.optional(),
  A2: MODEL_ALIAS.optional(),
  A3: MODEL_ALIAS.optional(),
  A4: MODEL_ALIAS.optional(),
  A5: MODEL_ALIAS.optional(),
  A6: MODEL_ALIAS.optional(),
  A7: MODEL_ALIAS.optional(),
}).strict();
const MODEL_MAP = MODEL_MAP_SCHEMA.optional();
const EFFORT_LEVEL = z.enum(EFFORT_LEVELS);
const EFFORT_MAP_SCHEMA = z.object({
  A1: EFFORT_LEVEL.optional(),
  A2: EFFORT_LEVEL.optional(),
  A3: EFFORT_LEVEL.optional(),
  A4: EFFORT_LEVEL.optional(),
  A5: EFFORT_LEVEL.optional(),
  A6: EFFORT_LEVEL.optional(),
  A7: EFFORT_LEVEL.optional(),
}).strict();
const LOCALES = ["en", "zh-CN", "ko", "es", "zh-TW", "vi", "ja"] as const;
const INCIDENT_CATEGORIES = ["mcp", "runtime", "configuration", "dependency", "database", "contract", "external_service", "unknown"] as const;
const INCIDENT_ENVIRONMENTS = ["local", "staging", "production", "unknown"] as const;
const INCIDENT_PRIORITIES = ["P0", "P1", "P2", "P3", "P4", "P5"] as const;
const INCIDENT_STATUSES = ["open", "triaged", "in_progress", "blocked", "resolved", "duplicate", "wont_fix"] as const;
const TASK_FAILURE_COMMON = {
  generation_id: z.string().uuid(),
  retryable: z.boolean(),
  error_code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
  summary: z.string().trim().min(1).max(2000),
};
const INCIDENT_DETAILS_SCHEMA = z.object({
  category: z.enum(INCIDENT_CATEGORIES),
  component: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/),
  environment: z.enum(INCIDENT_ENVIRONMENTS).default("unknown"),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  impact: z.string().trim().max(2000).default(""),
  priority: z.enum(INCIDENT_PRIORITIES).nullable().optional(),
}).strict();
const TASK_FAILURE_REPORT_SCHEMA = z.discriminatedUnion("needs_fix", [
  z.object({ ...TASK_FAILURE_COMMON, needs_fix: z.literal(false) }).strict(),
  z.object({ ...TASK_FAILURE_COMMON, needs_fix: z.literal(true), incident: INCIDENT_DETAILS_SCHEMA }).strict(),
]);

const PATH_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NEW_PATH_SCHEMA = z.object({
  group_kind: z.enum(["skill", "role", "ecosystem"]),
  title: z.string().trim().min(1).max(200),
  slug: z.string().regex(PATH_SLUG).max(100).optional(),
});

// Cùng quy tắc với slugify của Studio (src/lib/catalog.ts): chữ thường, không dấu, nối bằng "-".
function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function sanitizeOperationalText(value: string): string {
  return value
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{16,})\b/gi, "[REDACTED]")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function requireRun(db: SupabaseClient, runId: string): Promise<RunRow & { status: string; execution_mode: "claude_code" }> {
  const { data, error } = await db
    .from("studio_runs")
    .select("id,course_id,started_at,catalog_job_id,paused_at,status,execution_mode,agent_models,agent_efforts")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("run_not_found");
  if (data.execution_mode !== "claude_code") throw new Error("run_not_claude_code_managed");
  return data as RunRow & { status: string; execution_mode: "claude_code" };
}

async function currentStep(db: SupabaseClient, runId: string): Promise<StepKey | null> {
  const { data, error } = await db.from("studio_run_steps").select("step_key,state").eq("run_id", runId);
  if (error) throw new Error(error.message);
  const states = new Map((data ?? []).map((row) => [row.step_key, row.state]));
  return STEP_ORDER.find((step) => !(step === "catalog_research" && !states.has(step)) && states.get(step) !== "done") ?? null;
}

async function pendingTask(db: SupabaseClient, run: RunRow & { status: string; execution_mode: "claude_code" }) {
  const { data: runGeneration, error: runError } = await db
    .from("studio_generations")
    .select("*")
    .eq("run_id", run.id)
    .is("catalog_job_id", null)
    .eq("origin", "external")
    .eq("status", "submitting")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (runError) throw new Error(runError.message);
  if (runGeneration) {
    const step = runGeneration.step_key as StepKey;
    const agent = stepAgent(step);
    if (!agent) throw new Error(`missing_agent_for_step:${step}`);
    const prompt = await loadAgentPrompt(db, agent.promptKey);
    const outputSchema = step === "translate"
      ? object(runGeneration.params).external_schema
      : STEP_SPECS[step]?.schema;
    if (!outputSchema) throw new Error(`missing_output_schema:${step}`);
    const modelAlias = resolveAgentModels(run.agent_models)[agent.role];
    const effort = resolveAgentEfforts(run.agent_efforts)[agent.role];
    return {
      generation_id: runGeneration.id,
      run_id: run.id,
      step_key: step,
      lesson_id: runGeneration.lesson_id,
      locale: runGeneration.locale,
      agent_role: agent.role,
      prompt_version: prompt.promptVersion,
      system_prompt: prompt.system,
      input: runGeneration.input,
      output_schema: outputSchema,
      model_alias: modelAlias,
      effort,
      attempt: runGeneration.attempt,
      parent_generation_id: runGeneration.parent_generation_id,
      instructions: step === "lessons"
        ? "Spawn one Claude Code child session using model_alias and effort. Give it system_prompt, input, and output_schema. Tell it to return either one JSON result or a concise, redacted execution-failure report to the parent coordinator; do not give the child MCP task-management responsibility. Submit valid results with studio_submit_task, including model_id and effort for audit. If the child fails, the parent calls studio_report_task_failure for this generation_id; do not submit partial output. For a video lesson, that same A5 child may run scripts/studio/youtube-captions.ts from the repository root for caption-based timestamp candidates; do not create another session. If rejected, fetch the next task for the correction context."
        : "Spawn a Claude Code child session using model_alias and effort. Give it system_prompt, input, and output_schema. Tell it to return either one JSON result or a concise, redacted execution-failure report to the parent coordinator; do not give the child MCP task-management responsibility. Submit valid results with studio_submit_task, including model_id and effort for audit. If the child fails, the parent calls studio_report_task_failure for this generation_id; do not submit partial output. If rejected, fetch the next task for the correction context.",
    };
  }

  if (await currentStep(db, run.id) !== "catalog_research" || !run.catalog_job_id) return null;
  const { data: catalogGeneration, error: catalogError } = await db
    .from("studio_generations")
    .select("*")
    .eq("catalog_job_id", run.catalog_job_id)
    .eq("origin", "external")
    .eq("status", "submitting")
    .order("attempt", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (catalogError) throw new Error(catalogError.message);
  if (!catalogGeneration) return null;
  const prompt = await loadAgentPrompt(db, CATALOG_SPEC.prompt);
  const modelAlias = resolveAgentModels(run.agent_models).A1;
  const effort = resolveAgentEfforts(run.agent_efforts).A1;
  return {
    generation_id: catalogGeneration.id,
    run_id: run.id,
    step_key: "catalog_research",
    agent_role: "A1",
    prompt_version: prompt.promptVersion,
    system_prompt: prompt.system,
    input: catalogGeneration.input,
    output_schema: CATALOG_RESEARCH_SCHEMA,
    model_alias: modelAlias,
    effort,
    attempt: catalogGeneration.attempt,
    parent_generation_id: catalogGeneration.parent_generation_id,
    instructions: "Spawn a Claude Code child session using model_alias and effort. Give it system_prompt, input, and output_schema. Tell it to return either one JSON result or a concise, redacted execution-failure report to the parent coordinator; do not give the child MCP task-management responsibility. Submit valid results with studio_submit_task, including model_id and effort for audit. If the child fails, the parent calls studio_report_task_failure for this generation_id; do not submit partial output.",
  };
}

async function runStatus(db: SupabaseClient, runId: string) {
  const run = await requireRun(db, runId);
  const [course, steps, latest] = await Promise.all([
    db.from("studio_courses").select("title,status,research_status").eq("id", run.course_id).maybeSingle(),
    db.from("studio_run_steps").select("step_key,state,repair_count").eq("run_id", runId),
    db.from("studio_generations").select("step_key,lesson_id,attempt,status,failure_kind,error,operational_incident_id,created_at").eq("run_id", runId).order("created_at", { ascending: false }).limit(10),
  ]);
  for (const item of [course, steps, latest]) if (item.error) throw new Error(item.error.message);
  let catalogJob: Record<string, unknown> | null = null;
  let catalogGenerations: Record<string, unknown>[] = [];
  if (run.catalog_job_id) {
    const [jobResult, generationResult] = await Promise.all([
      db.from("studio_catalog_jobs").select("id,status,reason,started_at,finished_at").eq("id", run.catalog_job_id).maybeSingle(),
      db.from("studio_generations").select("id,attempt,status,failure_kind,error,operational_incident_id,created_at,completed_at,requested_model_id,model_id")
        .eq("catalog_job_id", run.catalog_job_id).order("created_at", { ascending: false }).limit(5),
    ]);
    if (jobResult.error) throw new Error(jobResult.error.message);
    if (generationResult.error) throw new Error(generationResult.error.message);
    catalogJob = jobResult.data;
    catalogGenerations = generationResult.data ?? [];
  }
  return {
    run_id: run.id,
    course_id: run.course_id,
    course: course.data,
    run_status: run.status,
    paused: Boolean(run.paused_at),
    execution_mode: run.execution_mode,
    agent_models: resolveAgentModels(run.agent_models),
    agent_efforts: resolveAgentEfforts(run.agent_efforts),
    steps: steps.data ?? [],
    latest_generations: latest.data ?? [],
    catalog_job: catalogJob,
    catalog_generations: catalogGenerations,
  };
}

async function persistStartProfile(
  db: SupabaseClient,
  userId: string,
  runId: string,
  agentModels: Record<string, string>,
  agentEfforts: Record<string, string>,
  created: boolean,
) {
  if (!created) {
    const { data: run, error } = await db.from("studio_runs")
      .select("status,agent_models,agent_efforts")
      .eq("id", runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (run && run.status !== "running") {
      return {
        run_id: runId,
        agent_models: resolveAgentModels(run.agent_models as AgentModelOverrides),
        agent_efforts: resolveAgentEfforts(run.agent_efforts as AgentEffortOverrides),
      };
    }
  }
  const { data, error } = await db.rpc("studio_set_claude_agent_preferences", {
    p_run_id: runId,
    p_started_by: userId,
    p_agent_models: agentModels,
    p_agent_efforts: agentEfforts,
  });
  if (error) throw new Error(error.message);
  return object(data);
}

function createServer(db: SupabaseClient, userId: string) {
  const server = new McpServer({ name: "corelia-studio", version: "0.1.0" });

  server.registerTool("studio_coordinator_guide", {
    title: "Course creation coordinator guide",
    description: "Read the required orchestration loop before creating a course. Claude Code is the coordinator and model runtime; Studio stores, validates, and publishes the work.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, () => result({
    coordinator: "By default, scope each Claude Code parent coordinator to one course and keep it responsible for that course's runs and resumes. Only that parent calls Studio MCP for the course; do not have multiple parent coordinators operate the same course concurrently. Each child returns either its assigned result or a concise, redacted execution-failure report to the parent; children do not call MCP or fetch tasks. The parent reports child failures through Studio MCP. Do not ask Studio to run a model.",
    child_session_defaults: {
      model_alias_by_role: DEFAULT_AGENT_MODELS,
      effort_by_role: DEFAULT_AGENT_EFFORTS,
    },
    workflow: [
      "In one pre-start turn, ask the user which course they want and how to configure it (level, audience, Corelia direction, content language, scope), and whether to use the default child profile or customize it. Offer concrete suggestions; do not silently infer values the user has not confirmed.",
      "A path belongs to a course. Call studio_list_paths to reuse existing paths via path_ids, and pass new_paths ({group_kind, title, slug?}) to studio_begin_course for paths the course needs that do not exist yet (for example Solana under ecosystem). An existing (group_kind, slug) is reused, not duplicated.",
      "For a course that already exists, find it with studio_list_courses and start it with studio_run_existing_course (same run_id rules, optional resume_from_run_id / restart_from) instead of studio_begin_course. studio_list_courses also returns the latest run_id of each course.",
      "Use that one-time answer before the start tool call. The default profile is Haiku 5.5 (alias haiku) for A1-A7; A1=max, A2-A4=xhigh, A5=high, A6-A7=xhigh. Pass the user's choice in agent_models and agent_efforts, and set child_profile_resolved=true. Do not ask again during that run.",
      "When resuming from a Claude Code run, reuse that run's saved profile and do not ask again unless the user requests a change; set child_profile_resolved=true to confirm the profile is resolved. The start tool accepts optional per-role model and effort overrides; omitted roles inherit the saved profile or defaults.",
      "Use studio_configure_child_models later only when the user asks to change the active run profile. It accepts partial model and/or effort maps; changes apply to tasks fetched after the update, while already spawned child sessions continue with their original settings.",
      "Process one generation_id at a time: keep exactly one child session for each generation_id, wait for its JSON result, and submit it before calling studio_get_next_task again. If the same pending generation_id is returned again while its child is active, resume that child instead of spawning a duplicate. Never launch competing child sessions for one generation_id.",
      "If a child cannot produce a usable JSON result because it crashed, timed out, or hit an execution error, call studio_report_task_failure with that generation_id. Use retryable=true only for transient failures; use needs_fix=true and include a concise, redacted incident for a system, configuration, dependency, database, MCP, or contract defect. Give repeated failures the same stable uppercase error_code and lowercase component slug so Studio can deduplicate them. Never include secrets, full prompts, or raw environment dumps. Set P0/P1 only when the reported evidence shows critical security, data-loss, or core-workflow impact; otherwise use P2-P5 or leave priority unset. For an ordinary rejected output, call studio_submit_task so Studio can provide correction feedback; do not create an operations incident for validation rejection alone.",
      "After reporting a task failure, call studio_get_next_task and let Studio's retry budget decide whether another attempt is available. If the failure is non-retryable or the budget is exhausted, stop spawning children and report the failure and any incident_id to the user.",
      "Handoff ownership: A2 supplies the research candidates; A5 authors one lesson and alone selects its video candidate and optional playback range; A6 reviews the accepted A5 draft and returns field-level issues without rewriting it or replacing its video; a later A5 generation applies accepted review feedback. A7 translates text while Studio preserves the original video URL and playback timestamps.",
      "For an A5 video lesson, keep video selection and timestamp selection in that same A5 child session. From the repository root run `deno run -A --no-config scripts/studio/youtube-captions.ts --url \"<candidate URL>\" --query \"<lesson title and outcome>\"`; the helper returns up to three short, time-coded caption matches as JSON and removes downloaded VTT files from its OS temp directory. Copy the selected match's exact times, cue_count, and cue_text_sha256 into caption_evidence; copy video_id, language, and track from the result's top-level fields. If Deno, yt-dlp, English captions, or a clear match is unavailable, use start_seconds=0, end_seconds=0, caption_evidence=null. Do not install tools or create another child session for this lookup.",
      "A rejected result creates a new repair task. Continue the loop until studio_get_next_task reports no pending model task and studio_get_run_status reports published or a concrete failure.",
      "The MCP server only persists and validates outputs. It never performs model inference; deterministic checks, draft rendering, and publish are run by Studio code.",
    ],
  }));

  server.registerTool("studio_list_paths", {
    title: "List Studio paths",
    description: "List the current Studio paths and IDs so the coordinator can attach the new course to one or more paths.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => {
    const { data, error } = await db.from("studio_paths").select("id,group_kind,slug,title,display_order").order("group_kind").order("display_order").order("title");
    if (error) throw new Error(error.message);
    return result(data ?? []);
  });

  server.registerTool("studio_begin_course", {
    title: "Start a Claude Code course run",
    description: "Create a course idea and start it in the Studio dashboard under Claude Code orchestration. Before calling, ask the user once to accept or customize the child profile and set child_profile_resolved=true. Defaults are Haiku 5.5 (alias haiku) for every role and the current Studio effort profile (A1=max, A2-A4=xhigh, A5=high, A6-A7=xhigh). No model runs here. The course needs at least one path: pass existing path_ids and/or new_paths to create paths with the course in the same transaction. Supply a stable UUID run_id for safe retries.",
    inputSchema: z.object({
      run_id: z.string().uuid(),
      child_profile_resolved: z.literal(true),
      title: z.string().trim().min(1).max(300),
      level: z.enum(["beginner", "intermediate", "advanced"]).nullable().optional(),
      scope_note: z.string().trim().max(2000).nullable().optional(),
      audience: z.string().trim().min(1).max(1000),
      corelia_direction: z.string().trim().min(1).max(1000),
      content_locale: z.enum(LOCALES).default("vi"),
      research_period_days: z.number().int().min(1).max(3650).default(90),
      path_ids: z.array(z.string().uuid()).max(20).default([]),
      new_paths: z.array(NEW_PATH_SCHEMA).max(20).default([]),
      agent_models: MODEL_MAP,
      agent_efforts: EFFORT_MAP_SCHEMA.optional(),
    }),
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async (input) => {
    if (input.path_ids.length + input.new_paths.length === 0) throw new Error("course_has_no_path");
    const newPaths = input.new_paths.map((path) => {
      const slug = path.slug ?? slugify(path.title);
      if (!PATH_SLUG.test(slug)) throw new Error(`path_slug_required:${path.title}`);
      return { group_kind: path.group_kind, title: path.title, slug };
    });
    const agentModels = resolveAgentModels(input.agent_models);
    const agentEfforts = resolveAgentEfforts(input.agent_efforts);
    const { data, error } = await db.rpc("studio_start_claude_course", {
      p_run_id: input.run_id,
      p_started_by: userId,
      p_course: {
        title: input.title,
        level: input.level ?? null,
        scope_note: input.scope_note ?? null,
        audience: input.audience,
        corelia_direction: input.corelia_direction,
        content_locale: input.content_locale,
        research_period_days: input.research_period_days,
      },
      p_path_ids: input.path_ids,
      p_new_paths: newPaths,
      p_agent_models: agentModels,
    });
    if (error) throw new Error(error.message);
    const preferences = await persistStartProfile(db, userId, input.run_id, agentModels, agentEfforts, object(data).created !== false);
    return result({ ...object(data), ...preferences });
  });

  server.registerTool("studio_list_courses", {
    title: "List Studio courses and their latest run",
    description: "List courses in the Studio catalog with their paths and latest run (run_id, status, execution mode, paused). Use it to find a run_id for studio_get_run_status, or a course_id to start with studio_run_existing_course.",
    inputSchema: z.object({
      query: z.string().trim().min(1).max(200).optional(),
      status: z.enum(["idea", "queued", "generating", "published", "needs_update", "not_passed"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    annotations: { readOnlyHint: true },
  }, async ({ query, status, limit }) => {
    let request = db.from("studio_courses")
      .select("id,title,level,status,research_status,audience,corelia_direction,content_locale,updated_at,studio_course_paths(studio_paths(id,group_kind,slug,title))")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) request = request.eq("status", status);
    // Escape LIKE wildcards so the query is a plain substring match.
    if (query) request = request.ilike("title", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
    const { data: courses, error } = await request;
    if (error) throw new Error(error.message);

    const ids = (courses ?? []).map((course) => course.id);
    const latestRun = new Map<string, Record<string, unknown>>();
    if (ids.length > 0) {
      const { data: runs, error: runError } = await db.from("studio_runs")
        .select("id,course_id,status,execution_mode,paused_at,started_at,finished_at")
        .in("course_id", ids)
        .order("started_at", { ascending: false });
      if (runError) throw new Error(runError.message);
      for (const run of runs ?? []) if (!latestRun.has(run.course_id)) latestRun.set(run.course_id, run);
    }
    return result((courses ?? []).map(({ studio_course_paths, ...course }) => ({
      ...course,
      paths: (studio_course_paths ?? []).flatMap((link: { studio_paths: unknown }) => link.studio_paths ? [link.studio_paths] : []),
      latest_run: latestRun.get(course.id) ?? null,
    })));
  });

  server.registerTool("studio_run_existing_course", {
    title: "Start a Claude Code run for an existing course",
    description: "Start a Claude Code run for a course that already exists in the Studio catalog (status idea, needs_update or not_passed; it needs a path, audience and Corelia direction). Before a fresh run, ask the user once to accept the defaults or customize child model and effort by role. When resuming from a Claude Code run, reuse its saved profile unless the user requests a change. Set child_profile_resolved=true after asking or reusing the saved profile. Defaults are Haiku 5.5 (alias haiku) for every role and the current Studio effort profile (A1=max, A2-A4=xhigh, A5=high, A6-A7=xhigh). Optionally resume from the accepted work of its latest failed run with resume_from_run_id, and restart_from (research or curriculum) to regenerate from that step. Supply a stable UUID run_id for safe retries.",
    inputSchema: z.object({
      run_id: z.string().uuid(),
      child_profile_resolved: z.literal(true),
      course_id: z.string().uuid(),
      resume_from_run_id: z.string().uuid().optional(),
      restart_from: z.enum(["research", "curriculum"]).optional(),
      agent_models: MODEL_MAP,
      agent_efforts: EFFORT_MAP_SCHEMA.optional(),
    }),
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async (input) => {
    if (input.restart_from && !input.resume_from_run_id) throw new Error("restart_requires_resume");
    let savedModels: AgentModelOverrides = {};
    let savedEfforts: AgentEffortOverrides = {};
    if (input.resume_from_run_id) {
      const { data: sourceRun, error: sourceError } = await db.from("studio_runs")
        .select("course_id,execution_mode,agent_models,agent_efforts")
        .eq("id", input.resume_from_run_id)
        .maybeSingle();
      if (sourceError) throw new Error(sourceError.message);
      if (sourceRun?.course_id === input.course_id && sourceRun.execution_mode === "claude_code") {
        savedModels = (sourceRun.agent_models ?? {}) as AgentModelOverrides;
        savedEfforts = (sourceRun.agent_efforts ?? {}) as AgentEffortOverrides;
      }
    }
    const agentModels = resolveAgentModels({ ...savedModels, ...input.agent_models });
    const agentEfforts = resolveAgentEfforts({ ...savedEfforts, ...input.agent_efforts });
    const { data, error } = await db.rpc("studio_start_claude_run", {
      p_run_id: input.run_id,
      p_started_by: userId,
      p_course_id: input.course_id,
      p_agent_models: agentModels,
      p_resume_from: input.resume_from_run_id ?? null,
      p_restart_from: input.restart_from ?? null,
    });
    // 23505: the course already has a running run (unique index), same mapping as studio.start.
    if (error) throw new Error(error.code === "23505" ? "course_has_running_run" : error.message);
    const preferences = await persistStartProfile(db, userId, input.run_id, agentModels, agentEfforts, object(data).created !== false);
    return result({ ...object(data), ...preferences });
  });

  server.registerTool("studio_configure_child_models", {
    title: "Configure Claude Code child models and effort",
    description: "Override child model aliases and/or effort levels for selected A1-A7 roles on an active run. Partial maps preserve other roles. Changes apply to tasks fetched after this update; already spawned child sessions keep their original settings. Use this tool whenever the user asks to change the profile.",
    inputSchema: z.object({
      run_id: z.string().uuid(),
      agent_models: MODEL_MAP_SCHEMA.optional(),
      agent_efforts: EFFORT_MAP_SCHEMA.optional(),
    }),
    annotations: { idempotentHint: true },
  }, async ({ run_id, agent_models, agent_efforts }) => {
    if ((!agent_models || Object.keys(agent_models).length === 0)
        && (!agent_efforts || Object.keys(agent_efforts).length === 0)) {
      throw new Error("at_least_one_agent_preference_required");
    }
    const { data, error } = await db.rpc("studio_set_claude_agent_preferences", {
      p_run_id: run_id,
      p_started_by: userId,
      p_agent_models: agent_models ?? {},
      p_agent_efforts: agent_efforts ?? {},
    });
    if (error) throw new Error(error.message);
    return result({
      ...object(data),
      agent_models: resolveAgentModels(object(data).agent_models as AgentModelOverrides),
      agent_efforts: resolveAgentEfforts(object(data).agent_efforts as AgentEffortOverrides),
    });
  });

  server.registerTool("studio_get_next_task", {
    title: "Advance the Studio course and get the next child task",
    description: "Advance the pinned Studio workflow through deterministic steps and return the next pending agent task with its version-pinned prompt, input, JSON schema, configured Claude Code model alias, and effort. The coordinator must use both model_alias and effort, then submit a usable child result or report its execution failure.",
    inputSchema: z.object({ run_id: z.string().uuid() }),
    annotations: { idempotentHint: true },
  }, async ({ run_id }) => {
    let run = await requireRun(db, run_id);
    if (run.paused_at) return result({ state: "paused", status: run.status, run_id });
    if (run.status !== "running") return result({ state: run.status, run_id, status: await runStatus(db, run_id) });

    for (let count = 0; count < 12; count++) {
      const existing = await pendingTask(db, run);
      if (existing) return result({ state: "task_ready", task: existing });

      const step = await currentStep(db, run.id);
      if (!step) {
        await advanceRun(db, run);
      } else if (step === "catalog_research" && run.catalog_job_id) {
        const { data: job, error } = await db.from("studio_catalog_jobs")
          .select("id,course_id,started_at,execution_mode,agent_models,agent_efforts,status")
          .eq("id", run.catalog_job_id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!job) throw new Error("catalog_job_not_found");
        await advanceCatalogJob(db, job as Parameters<typeof advanceCatalogJob>[1]);
      } else {
        await advanceRun(db, run);
      }

      run = await requireRun(db, run_id);
      if (run.paused_at) return result({ state: "paused", status: run.status, run_id });
      if (run.status !== "running") return result({ state: run.status, run_id, status: await runStatus(db, run_id) });
    }
    return result({ state: "processing", run_id, status: await runStatus(db, run_id), message: "Call studio_get_next_task again to continue deterministic processing." });
  });

  server.registerTool("studio_submit_task", {
    title: "Submit a child session result to Studio",
    description: "Persist one usable child session JSON result and the selected model and effort for audit. Studio runs its existing acceptance checks; rejected output is retained with repair feedback and produces a new task. For a child execution failure without usable output, call studio_report_task_failure instead.",
    inputSchema: z.object({
      generation_id: z.string().uuid(),
      output: z.record(z.string(), z.unknown()),
      model_id: z.string().trim().min(1).max(200).optional(),
      effort: EFFORT_LEVEL.optional(),
    }),
    annotations: { idempotentHint: true },
  }, async ({ generation_id, output, model_id, effort }) => {
    const { data: row, error: loadError } = await db.from("studio_generations").select("*").eq("id", generation_id).maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!row || row.origin !== "external") throw new Error("external_generation_not_found");
    if (row.status === "completed") return result({ accepted: true, already_submitted: true, generation_id });
    if (row.status === "failed") return result({ accepted: false, already_submitted: true, generation_id, reason: row.error });
    if (row.status !== "submitting") throw new Error("generation_not_waiting_for_output");

    let normalizedOutput: unknown = output;
    let acceptance: Acceptance;
    let courseRun: (RunRow & { status: string; execution_mode: "claude_code" }) | null = null;
    let selectedModelAlias = String(row.requested_model_id ?? DEFAULT_AGENT_MODELS.A2);
    let selectedEffort = object(row.params).effort;
    if (row.catalog_job_id) {
      const { data: job, error: jobError } = await db.from("studio_catalog_jobs")
        .select("id,course_id,started_at,status,agent_models,agent_efforts")
        .eq("id", row.catalog_job_id).maybeSingle();
      if (jobError) throw new Error(jobError.message);
      if (!job) throw new Error("catalog_job_not_found");
      if (job.status !== "running") throw new Error("catalog_job_not_running");
      selectedModelAlias = resolveAgentModels(job.agent_models).A1;
      selectedEffort = resolveAgentEfforts(job.agent_efforts).A1;
      const base = await loadCatalogBase(db, job.course_id);
      acceptance = acceptCatalogResearch(output, {
        today: utcDate(Date.now()),
        groupKinds: base.groups.map((group) => group.group_kind),
        hasAppCourses: base.app_courses.items.length > 0,
      });
    } else {
      if (!row.run_id) throw new Error("run_not_found");
      courseRun = await requireRun(db, row.run_id);
      if (courseRun.status !== "running") throw new Error("run_not_running");
      const agentRole = row.agent_role as typeof AGENT_ROLES[number];
      if (!AGENT_ROLES.includes(agentRole)) throw new Error("invalid_agent_role");
      selectedModelAlias = resolveAgentModels(courseRun.agent_models)[agentRole];
      selectedEffort = resolveAgentEfforts(courseRun.agent_efforts)[agentRole];
      const step = row.step_key as StepKey;
      if (step === "translate") {
        acceptance = await acceptExternalTranslation(db, courseRun, row, output);
      } else {
        const agent = stepAgent(step);
        const spec = STEP_SPECS[step];
        if (!agent || !spec) throw new Error(`unsupported_agent_step:${step}`);
        const ctx = await loadContext(db, courseRun, step, row.lesson_id ?? undefined);
        acceptance = await spec.accept(output, ctx, row.lesson_id ?? undefined);
      }
    }

    if (acceptance.ok) normalizedOutput = acceptance.normalizedOutput ?? output;
    const completedAt = new Date().toISOString();
    const auditParams = { ...object(row.params), effort: effort ?? selectedEffort };
    const auditedModelId = model_id ?? `claude-code/${selectedModelAlias}`;
    const update = await db.from("studio_generations").update(acceptance.ok
      ? { status: "completed", output: normalizedOutput, model_id: auditedModelId, params: auditParams, completed_at: completedAt }
      : { status: "failed", output, model_id: auditedModelId, params: auditParams, failure_kind: "rejected", error: acceptance.reason ?? "Output rejected by Studio validation." })
      .eq("id", generation_id)
      .eq("status", "submitting")
      .select("id,status")
      .maybeSingle();
    if (update.error) throw new Error(update.error.message);
    if (!update.data) {
      const { data: latest, error } = await db.from("studio_generations").select("status,error").eq("id", generation_id).maybeSingle();
      if (error) throw new Error(error.message);
      return result({ accepted: latest?.status === "completed", already_submitted: true, generation_id, reason: latest?.error });
    }

    if (row.catalog_job_id) {
      await logCatalogRunEvent(db, row.catalog_job_id, {
        generationId: generation_id,
        attempt: row.attempt,
        kind: acceptance.ok ? "progress" : "warning",
        message: acceptance.ok ? "Claude Code đã nộp kết quả nghiên cứu Catalog." : `Nghiên cứu Catalog không đạt kiểm tra: ${acceptance.reason}`,
        payload: { accepted: acceptance.ok },
      });
    } else if (courseRun) {
      await db.from("studio_run_events").insert({
        run_id: courseRun.id,
        step_key: row.step_key,
        attempt: row.attempt,
        kind: acceptance.ok ? "progress" : "warning",
        agent_role: row.agent_role,
        message: (acceptance.ok ? acceptance.summary : acceptance.reason).slice(0, 500),
        payload: { generation_id, lesson_id: row.lesson_id ?? null, accepted: acceptance.ok },
      });
    }
    return result({ accepted: acceptance.ok, generation_id, reason: acceptance.ok ? undefined : acceptance.reason, summary: acceptance.ok ? acceptance.summary : undefined });
  });

  server.registerTool("studio_report_task_failure", {
    title: "Report a failed Studio child task",
    description: "Record why an external Claude Code child could not produce a usable result. Set retryable only for transient failures. Include needs_fix=true and the incident details for a system/configuration/dependency/MCP/database/contract issue that needs repair. Then call studio_get_next_task so Studio applies its bounded retry policy.",
    inputSchema: TASK_FAILURE_REPORT_SCHEMA,
    annotations: { idempotentHint: true },
  }, async (input) => {
    const incident = input.needs_fix ? input.incident : null;
    const failureKind = input.retryable ? "transport" : "system";
    const summary = sanitizeOperationalText(input.summary);
    const safeIncident = incident ? {
      ...incident,
      title: sanitizeOperationalText(incident.title),
      description: sanitizeOperationalText(incident.description),
      impact: sanitizeOperationalText(incident.impact),
    } : null;
    const { data, error } = await db.rpc("studio_report_external_task_failure", {
      p_generation_id: input.generation_id,
      p_failure_kind: failureKind,
      p_error: summary,
      p_incident: safeIncident,
    });
    if (error) throw new Error(error.message);

    const report = object(data);
    let eventLogged = false;
    if (report.recorded === true) {
      const eventKind: "warning" | "error" = input.retryable ? "warning" : "error";
      const incidentId = typeof report.incident_id === "string" ? report.incident_id : null;
      const payload = {
        generation_id: input.generation_id,
        failure_kind: failureKind,
        retryable: input.retryable,
        error_code: input.error_code,
        ...(incidentId ? { incident_id: incidentId } : {}),
        ...(safeIncident ? { category: safeIncident.category } : {}),
      };
      const event = {
        generationId: input.generation_id,
        attempt: Number(report.attempt ?? 0),
        kind: eventKind,
        message: summary.slice(0, 500),
        payload,
      };

      if (typeof report.catalog_job_id === "string") {
        eventLogged = await logCatalogRunEvent(db, report.catalog_job_id, event);
      } else if (typeof report.run_id === "string" && typeof report.step_key === "string") {
        const { error: eventError } = await db.from("studio_run_events").insert({
          run_id: report.run_id,
          step_key: report.step_key,
          attempt: event.attempt,
          kind: event.kind,
          agent_role: typeof report.agent_role === "string" ? report.agent_role : null,
          message: event.message,
          payload: event.payload,
        });
        if (eventError) {
          console.error("[studio-mcp] task failure event insert", { generation_id: input.generation_id, error: eventError.message });
        } else eventLogged = true;
      }
    }

    return result({
      ...report,
      error_code: input.error_code,
      summary,
      needs_fix: input.needs_fix,
      incident_recorded: typeof report.incident_id === "string",
      event_logged: eventLogged,
      next_action: "Call studio_get_next_task to apply Studio's retry budget and continue or finish the run.",
    });
  });

  server.registerTool("studio_list_operational_incidents", {
    title: "List Studio operational incidents",
    description: "List deduplicated operational issues reported by Studio coordinators. Filter by status, priority, or category to find incidents that need follow-up.",
    inputSchema: z.object({
      status: z.enum(INCIDENT_STATUSES).optional(),
      priority: z.enum(INCIDENT_PRIORITIES).optional(),
      category: z.enum(INCIDENT_CATEGORIES).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }).strict(),
    annotations: { readOnlyHint: true },
  }, async ({ status, priority, category, limit }) => {
    let query = db.from("studio_operational_incidents")
      .select("id,fingerprint,error_code,category,component,environment,title,description,impact,priority,priority_source,status,reported_by,occurrence_count,first_seen_at,last_seen_at,last_run_id,last_catalog_job_id,last_generation_id,last_step_key,last_agent_role,assigned_to,operator_notes,resolution_summary,duplicate_of,created_at,updated_at,resolved_at")
      .order("priority", { ascending: true, nullsFirst: false })
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return result(data ?? []);
  });

  server.registerTool("studio_update_operational_incident", {
    title: "Update a Studio operational incident",
    description: "Update incident triage fields. operator_notes replaces the current note text. A resolved or wont_fix incident requires a resolution_summary; a duplicate requires duplicate_of.",
    inputSchema: z.object({
      incident_id: z.string().uuid(),
      status: z.enum(INCIDENT_STATUSES).optional(),
      priority: z.enum(INCIDENT_PRIORITIES).nullable().optional(),
      assigned_to: z.string().trim().max(200).nullable().optional(),
      operator_notes: z.string().max(8000).optional(),
      resolution_summary: z.string().trim().min(1).max(4000).nullable().optional(),
      duplicate_of: z.string().uuid().nullable().optional(),
    }).strict().superRefine((input, ctx) => {
      if (Object.keys(input).every((key) => key === "incident_id")) {
        ctx.addIssue({ code: "custom", message: "At least one incident field must be supplied." });
      }
    }),
    annotations: { idempotentHint: true },
  }, async (input) => {
    const { data: current, error: loadError } = await db.from("studio_operational_incidents")
      .select("id,status,duplicate_of,resolution_summary")
      .eq("id", input.incident_id)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!current) throw new Error("operational_incident_not_found");

    const nextStatus = input.status ?? current.status;
    const duplicateOf = input.duplicate_of === undefined
      ? input.status === undefined ? current.duplicate_of : input.status === "duplicate" ? current.duplicate_of : null
      : input.duplicate_of;
    const resolutionSummary = input.resolution_summary === undefined ? current.resolution_summary : input.resolution_summary;
    if (nextStatus === "duplicate" && !duplicateOf) throw new Error("duplicate_incident_requires_duplicate_of");
    if (nextStatus !== "duplicate" && duplicateOf) throw new Error("duplicate_of_requires_duplicate_status");
    if (duplicateOf === input.incident_id) throw new Error("incident_cannot_duplicate_itself");
    if (["resolved", "wont_fix"].includes(nextStatus) && !resolutionSummary?.trim()) {
      throw new Error("resolution_summary_required");
    }

    const updates: Record<string, unknown> = {};
    if (input.status !== undefined) {
      updates.status = input.status;
      updates.resolved_at = ["resolved", "duplicate", "wont_fix"].includes(input.status) ? new Date().toISOString() : null;
      if (input.status !== "duplicate" && input.duplicate_of === undefined) updates.duplicate_of = null;
    }
    if (input.priority !== undefined) {
      updates.priority = input.priority;
      updates.priority_source = "operator";
    }
    if (input.assigned_to !== undefined) updates.assigned_to = input.assigned_to?.trim() || null;
    if (input.operator_notes !== undefined) updates.operator_notes = input.operator_notes.trim();
    if (input.resolution_summary !== undefined) updates.resolution_summary = input.resolution_summary;
    if (input.duplicate_of !== undefined) updates.duplicate_of = input.duplicate_of;
    if (nextStatus === "duplicate" && input.status !== undefined) updates.resolved_at = new Date().toISOString();

    const { data, error } = await db.from("studio_operational_incidents")
      .update(updates)
      .eq("id", input.incident_id)
      .select("id,status,priority,priority_source,assigned_to,operator_notes,resolution_summary,duplicate_of,updated_at,resolved_at")
      .single();
    if (error) throw new Error(error.message);
    return result(data);
  });

  server.registerTool("studio_get_run_status", {
    title: "Get Studio course run status",
    description: "Read the course, step states, and recent child generation results in the existing Studio dashboard run.",
    inputSchema: z.object({ run_id: z.string().uuid() }),
    annotations: { readOnlyHint: true },
  }, async ({ run_id }) => result(await runStatus(db, run_id)));

  return server;
}

const handler = pipeline(
  [withOAuthProtectedResource()],
  async (req) => {
    const db = createServiceClient();
    let userId: string;
    try {
      userId = (await verifyBearerUser(req, db)).id;
    } catch {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    if (await getUserRole(db, userId) !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return createMcpHandler(() => createServer(db, userId)).fetch(req);
  },
);

Deno.serve(handler);

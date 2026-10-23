// Catalog ranking pass: reads the inputs, runs ranking.ts and saves the pass in one RPC. Also the part
// of the tick that recomputes a stale ranking and the admin endpoint that recomputes on demand.
import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import type { CatalogResearch, GroupKind } from "./catalog.ts";
import { errorMessage } from "./generations.ts";
import { fetchAllPages, type PageResult } from "./paging.ts";
import {
  computeRankings,
  isRankingStale,
  laterMark,
  RANKING_ALGORITHM_VERSION,
  rankingPayload,
  type CourseResearch,
  type ManualOrder,
  type RankingCourse,
  type RankingInput,
  type Weights,
} from "./ranking.ts";

const RESEARCH_DONE = ["evidence_ok", "needs_more_sources"];
/** Job ids per request when reading outputs; keeps the URL of the request short. */
const JOB_CHUNK = 40;

interface PathLink {
  course_id: string;
  path_id: string;
  learning_order: number;
  studio_paths: { group_kind: string } | null;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const isResearch = (o: unknown): o is CatalogResearch =>
  typeof o === "object" && o !== null && Array.isArray((o as CatalogResearch).shared) && Array.isArray((o as CatalogResearch).by_group);

/** The accepted record of the latest finished job of each course; a course without one is absent. */
async function loadResearch(db: SupabaseClient): Promise<Record<string, CourseResearch>> {
  const jobs = await fetchAllPages<{ id: string; course_id: string }>((from, to) =>
    db
      .from("studio_catalog_jobs")
      .select("id,course_id")
      .in("status", RESEARCH_DONE)
      .order("finished_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
  const latestJob = new Map<string, string>();
  for (const j of jobs) if (!latestJob.has(j.course_id)) latestJob.set(j.course_id, j.id);

  const byJob = new Map<string, { attempt: number; output: unknown }>();
  for (const ids of chunks([...latestJob.values()], JOB_CHUNK)) {
    const gens = await fetchAllPages<{ catalog_job_id: string | null; attempt: number; output: unknown }>((from, to) =>
      db
        .from("studio_generations")
        .select("catalog_job_id,attempt,output")
        .eq("status", "completed")
        .in("catalog_job_id", ids)
        .order("id", { ascending: true })
        .range(from, to)
    );
    for (const g of gens) {
      if (g.catalog_job_id && g.attempt > (byJob.get(g.catalog_job_id)?.attempt ?? -1)) byJob.set(g.catalog_job_id, { attempt: g.attempt, output: g.output });
    }
  }

  const research: Record<string, CourseResearch> = {};
  for (const [courseId, jobId] of latestJob) {
    const output = byJob.get(jobId)?.output;
    if (isResearch(output)) research[courseId] = { job_id: jobId, research: output };
    else console.error("[corelia-api] studio ranking: job without an accepted record", { job_id: jobId });
  }
  return research;
}

export async function loadRankingInput(db: SupabaseClient): Promise<{ input: RankingInput; weightsVersion: number }> {
  const [courses, links, weights, manual, research] = await Promise.all([
    fetchAllPages<{ id: string; status: string; policy_tier: string; created_at: string }>((from, to) =>
      db.from("studio_courses").select("id,status,policy_tier,created_at").order("id", { ascending: true }).range(from, to)
    ),
    fetchAllPages<PathLink>((from, to) =>
      db
        .from("studio_course_paths")
        .select("course_id,path_id,learning_order,studio_paths(group_kind)")
        .order("course_id", { ascending: true })
        .order("path_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<PathLink>>
    ),
    db.from("studio_scoring_weights").select("version,weights").order("version", { ascending: false }).limit(1).maybeSingle(),
    fetchAllPages<ManualOrder>((from, to) =>
      db.from("studio_catalog_manual_orders").select("course_id,position,created_at").eq("status", "active").order("id", { ascending: true }).range(from, to)
    ),
    loadResearch(db),
  ]);
  if (weights.error) throw new Error(weights.error.message);
  if (!weights.data) throw new Error("scoring weights are missing");

  const pathsOf = new Map<string, RankingCourse["paths"]>();
  for (const l of links) {
    if (!l.studio_paths) continue;
    const list = pathsOf.get(l.course_id) ?? [];
    list.push({ path_id: l.path_id, group_kind: l.studio_paths.group_kind as GroupKind, learning_order: l.learning_order });
    pathsOf.set(l.course_id, list);
  }
  return {
    weightsVersion: weights.data.version,
    input: {
      courses: courses.map((c) => ({ ...c, paths: pathsOf.get(c.id) ?? [] })),
      research,
      weights: weights.data.weights as Weights,
      manualOrders: manual,
    },
  };
}

/**
 * Newest finished research or manual order, as the database prints it; null when no research has
 * finished. Read before the inputs of a pass, so a result that lands later is newer than the mark.
 */
async function sourceMark(db: SupabaseClient): Promise<string | null> {
  const [job, manual] = await Promise.all([
    db.from("studio_catalog_jobs").select("finished_at").in("status", RESEARCH_DONE).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("studio_catalog_manual_orders").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const r of [job, manual]) if (r.error) throw new Error(r.error.message);
  const finished: string | null = job.data?.finished_at ?? null;
  return finished === null ? null : laterMark(finished, manual.data?.created_at ?? null);
}

/** Computes and saves one pass: the three group rankings and the production order. */
export async function runRanking(db: SupabaseClient): Promise<{ computed_at: string; ranking_ids: string[]; rows: number }> {
  const mark = await sourceMark(db);
  const { input, weightsVersion } = await loadRankingInput(db);
  const passes = computeRankings(input);
  const { data, error } = await db.rpc("studio_save_ranking", {
    p_weights_version: weightsVersion,
    p_algorithm_version: RANKING_ALGORITHM_VERSION,
    p_source_as_of: mark,
    p_rankings: rankingPayload(passes),
  });
  if (error) throw new Error(error.message);
  const saved = data as { computed_at: string; ranking_ids: string[] };
  return { ...saved, rows: passes.reduce((n, p) => n + p.rows.length, 0) };
}

/**
 * Tick: recompute when there is research to rank and the newest production ranking was computed from
 * an older mark (or there is none). A failure is logged and leaves the jobs alone; the same
 * comparison tries again on the next tick.
 */
export async function rerankIfStale(db: SupabaseClient): Promise<Record<string, unknown>> {
  try {
    const [mark, ranking] = await Promise.all([
      sourceMark(db),
      db.from("studio_catalog_rankings").select("source_as_of").is("group_kind", null).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (ranking.error) throw new Error(ranking.error.message);
    if (!isRankingStale(mark, ranking.data)) return { action: "none" };
    const saved = await runRanking(db);
    return { action: "ranked", computed_at: saved.computed_at, rows: saved.rows };
  } catch (e) {
    console.error("[corelia-api] studio ranking tick", { error: errorMessage(e) });
    return { action: "failed" };
  }
}

// Studio is admin only: support_staff is excluded, matching studio_can_write() in the schema.
export async function handleCatalogRerank(req: Request, db: SupabaseClient): Promise<Response> {
  let userId: string;
  try {
    userId = (await verifyBearerUser(req, db)).id;
  } catch {
    return json({ message: "unauthenticated" }, 401);
  }
  if ((await getUserRole(db, userId)) !== "admin") return json({ message: "forbidden" }, 403);
  return json(await runRanking(db), 200);
}

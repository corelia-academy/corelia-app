// Periodic A1 catalog refresh scheduling. Decisions are pure; this module reads the catalog and
// starts at most one scheduled job per tick.
import type { SupabaseClient } from "../lib/supabase.ts";
import { fetchAllPages, type PageResult } from "./paging.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AutoResearchCourse {
  id: string;
  status: string;
  research_status: string;
  research_period_days: number;
}

export interface AutoResearchPath {
  course_id: string;
  group_kind: string;
}

export interface AutoResearchJob {
  id: string;
  course_id: string;
  trigger?: string;
  status: string;
  finished_at: string | null;
  created_at?: string;
}

export interface DueCourseSelection {
  courseId: string | null;
  skippedMissingRequirements: Array<{ courseId: string; reason: "course_has_no_path" }>;
}

/** Selects the most overdue eligible course, without reading or mutating external state. */
export function selectDueCourses(input: {
  courses: AutoResearchCourse[];
  paths: AutoResearchPath[];
  jobs: AutoResearchJob[];
}, now: number): DueCourseSelection {
  const pathsByCourse = new Map<string, Set<string>>();
  for (const path of input.paths) {
    const groupKinds = pathsByCourse.get(path.course_id) ?? new Set<string>();
    groupKinds.add(path.group_kind);
    pathsByCourse.set(path.course_id, groupKinds);
  }
  const jobsByCourse = new Map<string, AutoResearchJob[]>();
  for (const job of input.jobs) {
    const rows = jobsByCourse.get(job.course_id) ?? [];
    rows.push(job);
    jobsByCourse.set(job.course_id, rows);
  }

  const skippedMissingRequirements: DueCourseSelection["skippedMissingRequirements"] = [];
  const due: Array<{ courseId: string; dueAt: number }> = [];
  for (const course of input.courses) {
    if (!(["idea", "not_passed", "needs_update"] as string[]).includes(course.status)) continue;
    if (!(["evidence_ok", "needs_more_sources"] as string[]).includes(course.research_status)) continue;

    const groupKinds = [...(pathsByCourse.get(course.id) ?? [])];
    if (groupKinds.length === 0) {
      skippedMissingRequirements.push({ courseId: course.id, reason: "course_has_no_path" });
      continue;
    }

    const courseJobs = jobsByCourse.get(course.id) ?? [];
    if (courseJobs.some((job) => job.status === "running")) continue;
    if (courseJobs.some((job) => {
      if (job.status !== "failed" || !job.finished_at) return false;
      const finishedAt = Date.parse(job.finished_at);
      return Number.isFinite(finishedAt) && finishedAt >= now - DAY_MS && finishedAt <= now;
    })) continue;

    const latestSuccessful = courseJobs
      .filter((job) => job.status === "evidence_ok" || job.status === "needs_more_sources")
      .map((job) => Date.parse(job.finished_at ?? ""))
      .filter(Number.isFinite)
      .reduce((latest, finishedAt) => Math.max(latest, finishedAt), Number.NEGATIVE_INFINITY);
    if (!Number.isFinite(latestSuccessful)) continue;

    const dueAt = latestSuccessful + course.research_period_days * DAY_MS;
    if (now >= dueAt) due.push({ courseId: course.id, dueAt });
  }

  due.sort((a, b) => a.dueAt - b.dueAt || a.courseId.localeCompare(b.courseId));
  return { courseId: due[0]?.courseId ?? null, skippedMissingRequirements };
}

type AutoResearchResult =
  | { action: "disabled" }
  | { action: "no_due_course" }
  | { action: "queued" | "already_started"; course_id: string; job_id: string }
  | { action: "start_failed"; course_id: string; error: string }
  | { action: "read_failed"; phase: "catalog" };

/** Default-off scheduler. A catalog read or start error is contained so the Studio tick can keep advancing jobs. */
export async function queueAutoResearch(db: SupabaseClient, now = Date.now()): Promise<AutoResearchResult> {
  if (Deno.env.get("CORELIA_STUDIO_AUTO_RESEARCH") !== "on") return { action: "disabled" };

  let selection: DueCourseSelection;
  try {
    selection = await loadDueCourseSelection(db, now);
  } catch (error) {
    console.error("[corelia-api] studio auto-research catalog read failed", errorMessage(error));
    return { action: "read_failed", phase: "catalog" };
  }
  for (const skipped of selection.skippedMissingRequirements) {
    console.error("[corelia-api] studio auto-research skipped course", skipped);
  }
  if (!selection.courseId) {
    return { action: "no_due_course" };
  }

  const jobId = crypto.randomUUID();
  try {
    const { data, error } = await db.rpc("studio_start_catalog_job", {
      p_course_id: selection.courseId,
      p_job_id: jobId,
      p_trigger: "scheduled",
      p_started_by: null,
    });
    if (error) {
      console.error("[corelia-api] studio auto-research start failed", { course_id: selection.courseId, code: error.code ?? "unknown" });
      return { action: "start_failed", course_id: selection.courseId, error: error.code ?? "rpc_error" };
    }
    const created = (data as { created?: boolean } | null)?.created;
    return {
      action: created === false ? "already_started" : "queued",
      course_id: selection.courseId,
      job_id: jobId,
    };
  } catch (error) {
    console.error("[corelia-api] studio auto-research start failed", { course_id: selection.courseId, error: errorMessage(error) });
    return { action: "start_failed", course_id: selection.courseId, error: "rpc_error" };
  }
}

async function loadDueCourseSelection(db: SupabaseClient, now: number): Promise<DueCourseSelection> {
  const [courses, pathLinks, jobs] = await Promise.all([
    fetchAllPages<AutoResearchCourse>((from, to) => db.from("studio_courses")
      .select("id,status,research_status,research_period_days")
      .order("id", { ascending: true })
      .range(from, to) as PromiseLike<PageResult<AutoResearchCourse>>),
    fetchAllPages<{ course_id: string; studio_paths: { group_kind: string } | { group_kind: string }[] | null }>((from, to) => db.from("studio_course_paths")
      .select("course_id,studio_paths!inner(group_kind)")
      .order("course_id", { ascending: true })
      .order("path_id", { ascending: true })
      .range(from, to) as PromiseLike<PageResult<{ course_id: string; studio_paths: { group_kind: string } | { group_kind: string }[] | null }>>),
    fetchAllPages<AutoResearchJob>((from, to) => db.from("studio_catalog_jobs")
      .select("id,course_id,trigger,status,finished_at,created_at")
      .order("course_id", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as PromiseLike<PageResult<AutoResearchJob>>),
  ]);

  const paths: AutoResearchPath[] = pathLinks.flatMap((link) => {
    const related = Array.isArray(link.studio_paths) ? link.studio_paths : link.studio_paths ? [link.studio_paths] : [];
    return related.map((path) => ({ course_id: link.course_id, group_kind: path.group_kind }));
  });
  return selectDueCourses({ courses, paths, jobs }, now);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

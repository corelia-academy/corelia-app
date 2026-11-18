import fs from "node:fs";
import path from "node:path";
import { findExecutable, runCmd } from "./exec.ts";
import { runCourse, runCourseStep } from "./orchestrator.ts";
import { inspectCourse } from "./state.ts";
import type {
  CourseQueueFile,
  CourseStepKind,
  PlanReport,
  QueueCourseResult,
  QueueRunSummary,
  RankedProposal,
  RunOptions,
} from "./types.ts";

function queueFilePath(repoRoot: string): string {
  return path.join(repoRoot, ".course-runs", ".cm-queue.json");
}

export function extractQueueSlugs(val: Record<string, unknown>): string[] {
  const arr = Array.isArray(val.queue) ? val.queue : [];
  return arr
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null && "slug" in item) {
        const s = (item as { slug?: unknown }).slug;
        return typeof s === "string" ? s.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function latestDecisionInfo(repoRoot: string): {
  decision_file: string | null;
  decision_pick: string | null;
  decision_queue: string[];
} {
  const dir = path.join(repoRoot, ".course-plan", "decisions");
  if (!fs.existsSync(dir)) {
    return { decision_file: null, decision_pick: null, decision_queue: [] };
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("."))
    .sort();
  const latest = files.pop();
  if (!latest) return { decision_file: null, decision_pick: null, decision_queue: [] };

  try {
    const val = JSON.parse(fs.readFileSync(path.join(dir, latest), "utf8")) as Record<
      string,
      unknown
    >;
    const pickRaw = val.pick as { slug?: unknown } | string | undefined;
    const pick =
      typeof pickRaw === "string"
        ? pickRaw
        : typeof pickRaw?.slug === "string"
          ? pickRaw.slug
          : null;
    return {
      decision_file: latest,
      decision_pick: pick,
      decision_queue: extractQueueSlugs(val),
    };
  } catch {
    return { decision_file: latest, decision_pick: null, decision_queue: [] };
  }
}

export function loadPlanReport(repoRoot: string): PlanReport {
  const planDir = path.join(repoRoot, ".course-plan");
  const backlog = path.join(planDir, "backlog.json");
  if (!fs.existsSync(backlog)) {
    throw new Error(`Không tìm thấy ${backlog} — repo chưa có backlog course-planner.`);
  }
  const script = path.join(
    repoRoot,
    ".claude",
    "skills",
    "course-planner",
    "scripts",
    "rank.mjs",
  );
  if (!fs.existsSync(script)) {
    throw new Error(`Không tìm thấy script xếp hạng: ${script}`);
  }
  const node = findExecutable(["node.exe", "node.cmd", "node"]);
  if (!node) throw new Error("Không tìm thấy `node` trong PATH.");

  const args = [script, backlog];
  const catalog = path.join(planDir, "catalog.json");
  if (fs.existsSync(catalog)) {
    args.push("--catalog", catalog);
  }
  const out = runCmd(node, args, repoRoot, undefined, 25_000);
  if (!out.exitOk) {
    throw new Error(`rank.mjs thất bại: ${(out.stderr || out.stdout).trim()}`);
  }

  const parsed = JSON.parse(out.stdout.trim()) as {
    total?: number;
    eligible_count?: number;
    envWarnings?: string[];
    rows?: Array<Record<string, unknown>>;
  };

  const rows: RankedProposal[] = (parsed.rows ?? []).map((item, idx) => {
    const slug = String(item.slug ?? "");
    const courseDir = path.join(repoRoot, ".course-runs", slug);
    let courseRunStatus: string | null = null;
    if (fs.existsSync(courseDir)) {
      try {
        const rep = inspectCourse(repoRoot, courseDir, false);
        courseRunStatus = `${rep.overall_status} (${rep.summary.đạt}/${rep.summary.total})`;
      } catch {
        courseRunStatus = "đã có thư mục";
      }
    }

    const pn = item.path_nodes as { nodes?: unknown[] } | undefined;
    const modules = Array.isArray(pn?.nodes)
      ? pn.nodes.filter((n): n is string => typeof n === "string")
      : [];
    const dirObj = item.direction as { axis?: string; entry?: string } | undefined;
    const direction = [dirObj?.axis, dirObj?.entry].filter(Boolean).join(": ");

    return {
      rank: typeof item.rank === "number" ? item.rank : idx + 1,
      slug,
      title: String(item.title ?? ""),
      map_slug: String(item.mapSlug ?? ""),
      direction,
      level: String(item.level ?? ""),
      status: String(item.status ?? ""),
      layer_branch: String(item.layerBranch ?? ""),
      modules,
      promise: String(item.promise ?? ""),
      final_product: String(item.final_product ?? ""),
      eligible: Boolean(item.eligible),
      met_count: typeof item.metCount === "number" ? item.metCount : 0,
      missing_tools: Array.isArray(item.missingTools)
        ? item.missingTools.map(String)
        : [],
      warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
      missing_evidence: Array.isArray(item.missing_evidence)
        ? item.missing_evidence.map(String)
        : [],
      course_run_status: courseRunStatus,
    };
  });

  const dec = latestDecisionInfo(repoRoot);
  return {
    total: parsed.total ?? rows.length,
    eligible_count: parsed.eligible_count ?? 0,
    env_warnings: parsed.envWarnings ?? [],
    rows,
    decision_file: dec.decision_file,
    decision_pick: dec.decision_pick,
    decision_queue: dec.decision_queue,
  };
}

export function loadQueue(repoRoot: string, report?: PlanReport): CourseQueueFile {
  const qPath = queueFilePath(repoRoot);
  if (fs.existsSync(qPath)) {
    try {
      return JSON.parse(fs.readFileSync(qPath, "utf8")) as CourseQueueFile;
    } catch {
      // fall through
    }
  }
  const items = (report?.decision_queue ?? []).map((slug) => ({
    slug,
    title: report?.rows.find((r) => r.slug === slug)?.title ?? slug,
    source: "decision",
    enabled: true,
  }));
  return { items };
}

export function saveQueue(repoRoot: string, queue: CourseQueueFile): void {
  const qPath = queueFilePath(repoRoot);
  fs.mkdirSync(path.dirname(qPath), { recursive: true });
  fs.writeFileSync(qPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

export function proposalToHandoff(prop: Record<string, unknown>): Record<string, unknown> {
  const modules = Array.isArray(prop.modules)
    ? (prop.modules as Array<Record<string, unknown>>)
    : [];
  const sp = prop.starting_point as { knowledge?: unknown; requires?: unknown[] } | undefined;
  const requires = Array.isArray(sp?.requires) ? sp.requires : [];
  const audience = typeof sp?.knowledge === "string" ? sp.knowledge : "";
  const criteria = prop.criteria as
    | { differentiated?: { basis?: unknown } }
    | undefined;
  const diff =
    typeof criteria?.differentiated?.basis === "string" ? criteria.differentiated.basis : "";
  const pn = prop.path_nodes as { path?: unknown } | undefined;
  const promise = typeof prop.promise === "string" ? prop.promise : "";

  return {
    slug: String(prop.slug ?? ""),
    title: String(prop.title ?? ""),
    topic: promise,
    audience,
    level: String(prop.level ?? ""),
    promise,
    final_product: String(prop.final_product ?? ""),
    differentiation: diff,
    corelia_hook: String(prop.corelia_hook ?? ""),
    scope_note: audience,
    path: typeof pn?.path === "string" ? pn.path : "",
    modules,
    mental_models: modules
      .map((m) => m.mechanism)
      .filter((v): v is string => typeof v === "string"),
    misconceptions: modules.flatMap((m) =>
      Array.isArray(m.pitfalls)
        ? m.pitfalls.filter((v): v is string => typeof v === "string")
        : [],
    ),
    reasoning_outcomes: modules
      .map((m) => m.outcome)
      .filter((v): v is string => typeof v === "string"),
    prerequisite_courses: requires,
    is_foundation: requires.length === 0,
    coordinator_model: "claude-sonnet-5-5",
  };
}

export function initCourseRunFromBacklog(repoRoot: string, slug: string): string {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const handoffPath = path.join(courseDir, "handoff.json");
  if (fs.existsSync(handoffPath)) return handoffPath;

  const backlogPath = path.join(repoRoot, ".course-plan", "backlog.json");
  const backlog = JSON.parse(fs.readFileSync(backlogPath, "utf8")) as {
    proposals?: Array<Record<string, unknown>>;
    shortlist?: Array<Record<string, unknown>>;
  };
  const list = backlog.proposals ?? backlog.shortlist ?? [];
  const prop = list.find((p) => p.slug === slug);
  if (!prop) {
    throw new Error(`Không tìm thấy proposal '${slug}' trong backlog.json`);
  }

  fs.mkdirSync(courseDir, { recursive: true });
  fs.writeFileSync(handoffPath, `${JSON.stringify(proposalToHandoff(prop), null, 2)}\n`, "utf8");
  return handoffPath;
}

export async function runQueuedCourses(
  repoRoot: string,
  slugs: readonly string[],
  lessonLimit: number | undefined,
  opts: RunOptions,
): Promise<QueueRunSummary> {
  const results: QueueCourseResult[] = [];
  let haltedReason: string | null = null;

  for (const slug of slugs) {
    const courseDir = path.join(repoRoot, ".course-runs", slug);
    if (
      !fs.existsSync(path.join(courseDir, "handoff.json")) &&
      !fs.existsSync(path.join(courseDir, "metadata.json"))
    ) {
      try {
        initCourseRunFromBacklog(repoRoot, slug);
      } catch (err) {
        const reason = `Không khởi tạo được '${slug}': ${err instanceof Error ? err.message : String(err)}`;
        results.push({ slug, outcome: "error", detail: reason });
        haltedReason = reason;
        break;
      }
    }

    const report = inspectCourse(repoRoot, courseDir, false);
    const prepSteps: Array<[boolean, CourseStepKind]> = [
      [!report.gates.has_brief, "brief"],
      [!report.gates.has_research, "research"],
      [!report.gates.has_curriculum, "curriculum"],
      [report.gates.curriculum_review !== "đạt", "curriculum-review"],
    ];

    let stepHalted = false;
    for (const [needed, step] of prepSteps) {
      if (!needed) continue;
      try {
        const out = await runCourseStep(repoRoot, slug, step, opts);
        if (opts.dry_run) {
          results.push({
            slug,
            outcome: "dry_run_step",
            detail: `Planned step ${out.step} (${out.provider}:${out.model})`,
          });
          stepHalted = true;
          break;
        }
        if (out.result === "cần_sửa" && step === "curriculum-review") {
          const reason = `'${slug}' curriculum-review trả về cần_sửa`;
          results.push({ slug, outcome: "needs_attention", detail: reason });
          haltedReason = reason;
          stepHalted = true;
          break;
        }
      } catch (err) {
        const reason = `'${slug}' bước ${step} lỗi: ${err instanceof Error ? err.message : String(err)}`;
        results.push({ slug, outcome: "error", detail: reason });
        haltedReason = reason;
        stepHalted = true;
        break;
      }
    }

    if (stepHalted) {
      if (haltedReason) break;
      continue;
    }

    const out = await runCourse(repoRoot, slug, lessonLimit, opts);
    if (out.halted_reason) {
      results.push({
        slug,
        outcome: "halted",
        detail: `Đã chạy ${out.processed.length} bài, dừng: ${out.halted_reason}`,
      });
      haltedReason = `'${slug}': ${out.halted_reason}`;
      break;
    }

    const updated = inspectCourse(repoRoot, courseDir, false);
    const readyFinal =
      updated.summary.total > 0 &&
      updated.summary.đạt === updated.summary.total &&
      updated.gates.course_review !== "đạt";
    if (readyFinal && !opts.dry_run) {
      const rev = await runCourseStep(repoRoot, slug, "course-review", opts);
      results.push({
        slug,
        outcome: rev.result,
        detail: `Hoàn tất ${out.processed.length} bài + course-review (${rev.result})`,
      });
    } else {
      results.push({
        slug,
        outcome: opts.dry_run ? "dry_run" : "ok",
        detail: `Đã xử lý ${out.processed.length} bài`,
      });
    }
  }

  return { results, halted_reason: haltedReason };
}

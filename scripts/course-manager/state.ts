import fs from "node:fs";
import path from "node:path";
import { findExecutable, runCmd } from "./exec.ts";
import type {
  CostRow,
  CostTotals,
  CourseStatusReport,
  GateSummary,
  LessonSummary,
  OpenCall,
  StatusCounts,
} from "./types.ts";

interface RawRunLogEntry {
  timestamp?: string;
  step?: unknown;
  lesson_id?: string | null;
  role?: string;
  model?: string;
  action?: string;
  event?: string;
  result?: string | null;
  tokens?: number | null;
  tool_uses?: number | null;
  duration_ms?: number | null;
}

export function listCourseDirs(repoRoot: string): string[] {
  const runsDir = path.join(repoRoot, ".course-runs");
  if (!fs.existsSync(runsDir)) return [];
  const entries = fs.readdirSync(runsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => path.join(runsDir, e.name))
    .sort();
}

export function normalizeRole(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === "brief" || lower === "01-brief") return "brief";
  if (lower === "research" || lower === "02-research") return "research";
  if (lower === "curriculum" || lower === "03-curriculum") return "curriculum";
  if (lower === "curriculum-review" || lower === "04-curriculum-review") {
    return "curriculum-review";
  }
  if (lower === "lesson" || lower === "05-lesson" || lower === "lesson-patch") return "lesson";
  if (lower === "lesson-review" || lower === "06-lesson-review") return "lesson-review";
  if (lower === "course-review" || lower === "07-course-review") return "course-review";
  return lower || "unknown";
}

function stepLabel(step: unknown): string {
  if (typeof step === "number") return String(step);
  if (typeof step === "string" && step.trim()) return step.trim();
  return "-";
}

function analyzeRunLog(courseDir: string, nowMs: number) {
  const cyclesByLesson = new Map<string, number>();
  const costRowsMap = new Map<string, CostRow>();
  const openMap = new Map<string, OpenCall>();
  const costTotals: CostTotals = {
    calls: 0,
    measured_calls: 0,
    tokens: 0,
    tool_uses: 0,
    duration_ms: 0,
    retries: 0,
  };

  const logPath = path.join(courseDir, "run-log.jsonl");
  if (!fs.existsSync(logPath)) {
    return { cyclesByLesson, costRows: [], costTotals, openCalls: [] };
  }

  const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: RawRunLogEntry;
    try {
      entry = JSON.parse(trimmed) as RawRunLogEntry;
    } catch {
      continue;
    }

    const kind = (entry.action || entry.event || "").trim().toLowerCase();
    const lid =
      entry.lesson_id && entry.lesson_id !== "-" && entry.lesson_id.trim()
        ? entry.lesson_id.trim()
        : null;
    const step = stepLabel(entry.step);
    const rawRole = entry.role?.trim() || "unknown";
    const normRole = normalizeRole(rawRole);
    const model = entry.model?.trim() || "-";
    const callKey = `${step}|${lid ?? "-"}|${rawRole}`;

    if (kind === "start") {
      const startedMs = entry.timestamp ? Date.parse(entry.timestamp) : nowMs;
      const elapsed_ms = Number.isFinite(startedMs) ? Math.max(0, nowMs - startedMs) : 0;
      openMap.set(callKey, {
        step,
        lesson_id: lid,
        raw_role: rawRole,
        normalized_role: normRole,
        model,
        started_at: entry.timestamp ?? "",
        elapsed_ms,
        likely_orphan: elapsed_ms > 30 * 60 * 1000,
      });
      continue;
    }

    if (kind === "end") {
      openMap.delete(callKey);
      const result = entry.result ?? "";

      if (step === "6" && lid && result !== "rerun") {
        cyclesByLesson.set(lid, (cyclesByLesson.get(lid) ?? 0) + 1);
      }

      const rowKey = `${step}|${normRole}|${model}`;
      const existing = costRowsMap.get(rowKey) ?? {
        step,
        normalized_role: normRole,
        raw_role: rawRole,
        model,
        calls: 0,
        measured_calls: 0,
        tokens: 0,
        tool_uses: 0,
        duration_ms: 0,
        retries: 0,
      };
      existing.calls += 1;
      costTotals.calls += 1;
      if (typeof entry.tokens === "number") {
        existing.measured_calls += 1;
        existing.tokens += entry.tokens;
        costTotals.measured_calls += 1;
        costTotals.tokens += entry.tokens;
      }
      if (typeof entry.tool_uses === "number") {
        existing.tool_uses += entry.tool_uses;
        costTotals.tool_uses += entry.tool_uses;
      }
      if (typeof entry.duration_ms === "number" && entry.duration_ms > 0) {
        existing.duration_ms += entry.duration_ms;
        costTotals.duration_ms += entry.duration_ms;
      }
      if (result === "needs_fix" || result === "rerun" || result === "fail") {
        existing.retries += 1;
        costTotals.retries += 1;
      }
      costRowsMap.set(rowKey, existing);
    }
  }

  return {
    cyclesByLesson,
    costRows: Array.from(costRowsMap.values()).sort(
      (a, b) => a.step.localeCompare(b.step) || a.normalized_role.localeCompare(b.normalized_role),
    ),
    costTotals,
    openCalls: Array.from(openMap.values()),
  };
}

function parseLintScriptOutput(
  repoRoot: string,
  courseDir: string,
  scriptName: string,
): { map: Map<string, string[]>; error: string | null } {
  const scriptPath = path.join(
    repoRoot,
    ".claude",
    "skills",
    "course-author",
    "scripts",
    scriptName,
  );
  const map = new Map<string, string[]>();
  if (!fs.existsSync(scriptPath)) {
    return { map, error: null };
  }
  const node = findExecutable(["node.exe", "node.cmd", "node"]);
  if (!node) {
    return { map, error: "Không tìm thấy `node` để chạy lint." };
  }
  const out = runCmd(node, [scriptPath, courseDir], repoRoot, undefined, 25_000);
  const combined = `${out.stdout}\n${out.stderr}`;
  for (const line of combined.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:[-*]\s*)?([A-Za-z0-9_-]+):\s*(.+)$/);
    if (match) {
      const list = map.get(match[1]) ?? [];
      list.push(match[2].trim());
      map.set(match[1], list);
    }
  }
  return { map, error: out.timedOut ? `${scriptName} timeout` : null };
}

function readJsonOptional(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function inspectCourse(
  repoRoot: string,
  courseDir: string,
  runLint: boolean,
): CourseStatusReport {
  const slug = path.basename(courseDir);
  const handoff = readJsonOptional(path.join(courseDir, "handoff.json"));
  const meta = readJsonOptional(path.join(courseDir, "metadata.json"));
  const curr = readJsonOptional(path.join(courseDir, "curriculum.json"));
  const currRev = readJsonOptional(path.join(courseDir, "reviews", "curriculum.json"));
  const courseRev = readJsonOptional(path.join(courseDir, "reviews", "course.json"));

  const title =
    (typeof meta?.title === "string" ? meta.title : null) ??
    (typeof handoff?.title === "string" ? handoff.title : null);

  const gates: GateSummary = {
    has_handoff: handoff !== null,
    has_metadata: meta !== null,
    has_brief: fs.existsSync(path.join(courseDir, "brief.json")),
    has_research: fs.existsSync(path.join(courseDir, "research.json")),
    has_curriculum: curr !== null,
    has_frame: fs.existsSync(path.join(courseDir, "frame.md")),
    has_labels: fs.existsSync(path.join(courseDir, "labels.json")),
    has_final_assignment: fs.existsSync(path.join(courseDir, "final_assignment.json")),
    curriculum_review:
      currRev?.verdict === "pass"
        ? "đạt"
        : currRev !== null
          ? "cần_sửa"
          : "chưa_chạy",
    course_review:
      courseRev?.verdict === "pass"
        ? "đạt"
        : courseRev !== null
          ? "cần_sửa"
          : "chưa_chạy",
  };

  const logData = analyzeRunLog(courseDir, Date.now());
  let lintMap = new Map<string, string[]>();
  let revLintMap = new Map<string, string[]>();
  let lintError: string | null = null;

  if (runLint && gates.has_curriculum) {
    const l1 = parseLintScriptOutput(repoRoot, courseDir, "lesson-lint.mjs");
    const l2 = parseLintScriptOutput(repoRoot, courseDir, "review-lint.mjs");
    lintMap = l1.map;
    revLintMap = l2.map;
    lintError = l1.error ?? l2.error;
  }

  const lessons: LessonSummary[] = [];
  const summary: StatusCounts = {
    total: 0,
    chưa_viết: 0,
    chờ_kiểm_chứng: 0,
    chờ_review: 0,
    cần_sửa: 0,
    đạt: 0,
    quá_trần: 0,
  };

  const modules = Array.isArray(curr?.modules) ? curr.modules : [];
  for (const mod of modules) {
    const modObj = mod as { module_id?: string; lessons?: Array<Record<string, unknown>> };
    const moduleId = modObj.module_id ?? "-";
    for (const l of modObj.lessons ?? []) {
      const lessonId = typeof l.lesson_id === "string" ? l.lesson_id : "";
      if (!lessonId) continue;
      summary.total += 1;

      const lessonType =
        typeof l.type === "string"
          ? l.type
          : typeof l.lesson_type === "string"
            ? l.lesson_type
            : "article";
      const lessonTitle = typeof l.title === "string" ? l.title : lessonId;
      const lessonFile = path.join(courseDir, "lessons", `${lessonId}.json`);
      const verFile = path.join(courseDir, "verification", `${lessonId}.md`);
      const revFile = path.join(courseDir, "reviews", `${lessonId}.json`);

      const hasLesson = fs.existsSync(lessonFile);
      const hasVerification = fs.existsSync(verFile);
      const revJson = readJsonOptional(revFile);
      const cycles = logData.cyclesByLesson.get(lessonId) ?? 0;
      const lintProblems = lintMap.get(lessonId) ?? [];
      const reviewProblems = revLintMap.get(lessonId) ?? [];

      const blocking = Array.isArray(revJson?.blocking_issues)
        ? revJson.blocking_issues.length
        : 0;
      const minor = Array.isArray(revJson?.minor_issues) ? revJson.minor_issues.length : 0;

      const needsRun = (() => {
        if (!hasLesson) return false;
        const raw = fs.readFileSync(lessonFile, "utf8");
        if (raw.includes("```")) return true;
        const lj = readJsonOptional(lessonFile);
        if (!lj) return false;
        const hasCode = lj.code_exercise !== undefined && lj.code_exercise !== null;
        const hasPractice = lj.practice !== undefined && lj.practice !== null;
        const hasPlan =
          Array.isArray(lj.verification_plan) && lj.verification_plan.length > 0;
        return hasCode || hasPractice || hasPlan;
      })();

      let status = "chưa_viết";
      let nextStep = "Viết bài (Bước 5)";
      let capped = false;

      if (!hasLesson) {
        status = "chưa_viết";
        summary.chưa_viết += 1;
      } else if ((needsRun && !hasVerification) || lintProblems.length > 0) {
        status = "chờ_kiểm_chứng";
        nextStep = "Chạy verify & lint";
        summary.chờ_kiểm_chứng += 1;
      } else if (!revJson || reviewProblems.length > 0) {
        status = "chờ_review";
        nextStep = "Review bài học (Bước 6)";
        summary.chờ_review += 1;
      } else if (revJson.verdict === "pass" && blocking === 0) {
        status = "đạt";
        nextStep = "Hoàn tất";
        summary.đạt += 1;
      } else if (cycles >= 3) {
        status = "quá_trần";
        capped = true;
        nextStep = "Coordinator xử lý (quá trần 3 vòng)";
        summary.quá_trần += 1;
      } else {
        status = "cần_sửa";
        nextStep = "Patch lỗi review & verify lại";
        summary.cần_sửa += 1;
      }

      lessons.push({
        lesson_id: lessonId,
        module_id: moduleId,
        title: lessonTitle,
        lesson_type: lessonType,
        status,
        cycles,
        capped,
        blocking_issues: blocking,
        minor_issues: minor,
        lint_problems: lintProblems,
        review_problems: reviewProblems,
        next_step: nextStep,
      });
    }
  }

  let overallStatus = "đang_chạy";
  if (!gates.has_curriculum) {
    overallStatus = gates.has_brief ? "chưa_có_curriculum" : "chưa_có_brief";
  } else if (summary.quá_trần > 0) {
    overallStatus = "có_bài_quá_trần";
  } else if (summary.total > 0 && summary.đạt === summary.total) {
    overallStatus = gates.course_review === "đạt" ? "đạt" : "chờ_course_review";
  } else if (summary.cần_sửa > 0) {
    overallStatus = "cần_sửa";
  }

  return {
    slug,
    title,
    course_dir: courseDir,
    overall_status: overallStatus,
    gates,
    summary,
    lessons,
    cost_rows: logData.costRows,
    cost_totals: logData.costTotals,
    open_calls: logData.openCalls,
    lint_checked: runLint,
    lint_error: lintError,
  };
}

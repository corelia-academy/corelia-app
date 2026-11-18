import fs from "node:fs";
import path from "node:path";
import { appendRunLog, executeWithProfile, mergeJsonPatch } from "./adapter.ts";
import { buildCourseStepBundle, buildPromptBundle, stepNumber } from "./context.ts";
import { findExecutable, runCmd } from "./exec.ts";
import { loadProfile, resolveStepTarget } from "./profile.ts";
import { inspectCourse } from "./state.ts";
import type {
  CourseRunOutcome,
  CourseStepKind,
  CourseStepOutcome,
  LessonRunOutcome,
  RunOptions,
  StepTrace,
} from "./types.ts";
import { verifyLesson } from "./verify.ts";

function runScriptAndCollect(
  repoRoot: string,
  scriptName: string,
  args: readonly string[],
): string[] {
  const script = path.join(repoRoot, ".claude", "skills", "course-author", "scripts", scriptName);
  if (!fs.existsSync(script)) return [];
  const node = findExecutable(["node.exe", "node.cmd", "node"]);
  if (!node) return [];
  const out = runCmd(node, [script, ...args], repoRoot, undefined, 25_000);
  if (out.exitOk) return [];
  const combined = `${out.stdout}\n${out.stderr}`;
  return combined
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function detectCoordinatorException(revJson: Record<string, unknown>): string | null {
  const verdict = typeof revJson.verdict === "string" ? revJson.verdict : "";
  const summary = typeof revJson.summary === "string" ? revJson.summary : "";
  const hay = `${verdict} ${summary}`.toLowerCase();
  if (
    hay.includes("frame.md") ||
    hay.includes("thiếu nguồn") ||
    hay.includes("lệch curriculum") ||
    hay.includes("needs_coordinator")
  ) {
    return summary || "Reviewer báo lỗi cần Coordinator xử lý (frame/research/curriculum).";
  }
  return null;
}

export async function runCourseStep(
  repoRoot: string,
  slug: string,
  step: CourseStepKind,
  opts: RunOptions,
): Promise<CourseStepOutcome> {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const { profile } = loadProfile(repoRoot, slug);
  const bundle = buildCourseStepBundle(repoRoot, slug, step);
  const target = resolveStepTarget(profile, step);

  if (opts.dry_run) {
    return {
      slug,
      step,
      dry_run: true,
      provider: target.provider,
      model: target.model,
      result: "planned",
      written_files: [bundle.bundle_path],
      lint_problems: [],
    };
  }

  const sNum = stepNumber(step);
  appendRunLog(
    courseDir,
    sNum,
    null,
    step,
    `${target.provider}:${target.model}`,
    "start",
  );

  let res;
  try {
    res = await executeWithProfile(
      profile,
      step,
      repoRoot,
      bundle.prompt,
      opts.timeout_secs * 1000,
    );
  } catch (err) {
    appendRunLog(
      courseDir,
      sNum,
      null,
      step,
      `${target.provider}:${target.model}`,
      "end",
      "error",
    );
    const msg =
      typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    throw new Error(msg);
  }

  const writeJson = (filePath: string, val: unknown): string => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(val, null, 2)}\n`, "utf8");
    return filePath;
  };

  const parsed = res.parsed_json as Record<string, unknown>;
  const writtenFiles: string[] = [];
  let lintProblems: string[] = [];
  let logResult = "ok";

  if (step === "brief") {
    if (!parsed.metadata || !parsed.brief) {
      throw new Error("Output bước 1 thiếu trường `metadata` hoặc `brief`.");
    }
    writtenFiles.push(writeJson(path.join(courseDir, "metadata.json"), parsed.metadata));
    writtenFiles.push(writeJson(path.join(courseDir, "brief.json"), parsed.brief));
  } else if (step === "research") {
    writtenFiles.push(writeJson(path.join(courseDir, "research.json"), parsed));
  } else if (step === "curriculum") {
    const curr = parsed.curriculum ?? parsed;
    writtenFiles.push(writeJson(path.join(courseDir, "curriculum.json"), curr));
    if (parsed.final_assignment !== undefined && parsed.final_assignment !== null) {
      writtenFiles.push(
        writeJson(path.join(courseDir, "final_assignment.json"), parsed.final_assignment),
      );
    }
    if (typeof parsed.frame_md === "string" && parsed.frame_md.trim()) {
      const fp = path.join(courseDir, "frame.md");
      fs.writeFileSync(fp, parsed.frame_md, "utf8");
      writtenFiles.push(fp);
    }
    if (
      parsed.provided_prerequisites !== undefined &&
      parsed.provided_prerequisites !== null
    ) {
      writtenFiles.push(
        writeJson(
          path.join(courseDir, "provided_prerequisites.json"),
          parsed.provided_prerequisites,
        ),
      );
    }
    runScriptAndCollect(repoRoot, "labels.mjs", [courseDir]);
    lintProblems = runScriptAndCollect(repoRoot, "curriculum-lint.mjs", [courseDir]);
    if (lintProblems.length > 0) logResult = "cần_sửa";
  } else if (step === "curriculum-review") {
    writtenFiles.push(writeJson(path.join(courseDir, "reviews", "curriculum.json"), parsed));
    lintProblems = runScriptAndCollect(repoRoot, "review-lint.mjs", [courseDir, "curriculum"]);
    const verdict = typeof parsed.verdict === "string" ? parsed.verdict : "needs_fix";
    logResult = verdict === "pass" && lintProblems.length === 0 ? "đạt" : "cần_sửa";
  } else {
    writtenFiles.push(writeJson(path.join(courseDir, "reviews", "course.json"), parsed));
    lintProblems = runScriptAndCollect(repoRoot, "review-lint.mjs", [courseDir, "course"]);
    const verdict = typeof parsed.verdict === "string" ? parsed.verdict : "needs_fix";
    logResult = verdict === "pass" && lintProblems.length === 0 ? "đạt" : "cần_sửa";
  }

  appendRunLog(
    courseDir,
    sNum,
    null,
    step,
    `${res.provider}:${res.model}`,
    "end",
    logResult,
    res.tokens,
    res.duration_ms,
  );

  return {
    slug,
    step,
    dry_run: false,
    provider: res.provider,
    model: res.model,
    result: logResult,
    written_files: writtenFiles,
    lint_problems: lintProblems,
  };
}

export async function runLesson(
  repoRoot: string,
  slug: string,
  lessonId: string,
  opts: RunOptions,
): Promise<LessonRunOutcome> {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const { profile } = loadProfile(repoRoot, slug);
  const report = inspectCourse(repoRoot, courseDir, false);
  const current = report.lessons.find((l) => l.lesson_id === lessonId);
  if (!current) {
    throw new Error(`Không tìm thấy bài ${lessonId} trong curriculum của ${slug}`);
  }

  if (!opts.force && (current.status === "đạt" || current.status === "quá_trần")) {
    return {
      lesson_id: lessonId,
      final_status: current.status,
      dry_run: opts.dry_run,
      cycles_used: current.cycles,
      needs_coordinator: false,
      coordinator_reason: null,
      traces: [
        {
          phase: "skip",
          provider: "-",
          model: "-",
          result: "skipped",
          detail: `Bài đã ở trạng thái ${current.status}`,
        },
      ],
    };
  }

  const lessonPath = path.join(courseDir, "lessons", `${lessonId}.json`);
  const reviewPath = path.join(courseDir, "reviews", `${lessonId}.json`);
  const traces: StepTrace[] = [];

  if (opts.dry_run) {
    const mode = fs.existsSync(lessonPath) ? "patch" : "write";
    const bundle = buildPromptBundle(repoRoot, slug, lessonId, mode, []);
    const wt = resolveStepTarget(profile, "lesson");
    const rt = resolveStepTarget(profile, "lesson-review");
    traces.push(
      {
        phase: `dry_run_${mode}`,
        provider: wt.provider,
        model: wt.model,
        result: "planned",
        detail: `Bundle ${bundle.bundle_path} (${bundle.chars} chars)`,
      },
      {
        phase: "dry_run_verify",
        provider: "local_ts",
        model: "0-token",
        result: "planned",
        detail: "Chạy kiểm chứng Tầng 1 + lesson-lint.mjs",
      },
      {
        phase: "dry_run_review",
        provider: rt.provider,
        model: rt.model,
        result: "planned",
        detail: "Review bài học & chạy review-lint.mjs",
      },
    );
    return {
      lesson_id: lessonId,
      final_status: current.status,
      dry_run: true,
      cycles_used: current.cycles,
      needs_coordinator: false,
      coordinator_reason: null,
      traces,
    };
  }

  const timeoutMs = opts.timeout_secs * 1000;
  if (!fs.existsSync(lessonPath)) {
    const bundle = buildPromptBundle(repoRoot, slug, lessonId, "write", []);
    const wt = resolveStepTarget(profile, "lesson");
    appendRunLog(courseDir, 5, lessonId, "lesson", `${wt.provider}:${wt.model}`, "start");
    try {
      const res = await executeWithProfile(profile, "lesson", repoRoot, bundle.prompt, timeoutMs);
      fs.mkdirSync(path.dirname(lessonPath), { recursive: true });
      fs.writeFileSync(lessonPath, `${JSON.stringify(res.parsed_json, null, 2)}\n`, "utf8");
      appendRunLog(
        courseDir,
        5,
        lessonId,
        "lesson",
        `${res.provider}:${res.model}`,
        "end",
        "ok",
        res.tokens,
        res.duration_ms,
      );
      traces.push({
        phase: "write",
        provider: res.provider,
        model: res.model,
        result: "ok",
        detail: `Đã viết ${lessonPath}`,
      });
    } catch (err) {
      appendRunLog(courseDir, 5, lessonId, "lesson", `${wt.provider}:${wt.model}`, "end", "error");
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      throw new Error(msg);
    }
  }

  let cycles = current.cycles;
  let finalStatus = current.status;
  let needsCoordinator = false;
  let coordinatorReason: string | null = null;

  while (cycles < opts.max_cycles) {
    const vRep = verifyLesson(repoRoot, slug, lessonId, true);
    const machineErrors = [
      ...vRep.lint_problems,
      ...vRep.diagram_problems,
      ...vRep.checks.filter((c) => c.status === "fail").map((c) => `${c.id}: ${c.detail}`),
    ];
    traces.push({
      phase: "verify",
      provider: "local_ts",
      model: "0-token",
      result: vRep.passed ? "pass" : "fail",
      detail: vRep.passed ? "Tầng 1 & lint đạt" : machineErrors.join(" | "),
    });

    if (!vRep.passed) {
      const bundle = buildPromptBundle(repoRoot, slug, lessonId, "patch", machineErrors);
      const wt = resolveStepTarget(profile, "lesson");
      appendRunLog(courseDir, 5, lessonId, "lesson-patch", `${wt.provider}:${wt.model}`, "start");
      const res = await executeWithProfile(profile, "lesson", repoRoot, bundle.prompt, timeoutMs);
      const existing = JSON.parse(fs.readFileSync(lessonPath, "utf8")) as unknown;
      const merged = mergeJsonPatch(existing, res.parsed_json);
      fs.writeFileSync(lessonPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
      appendRunLog(
        courseDir,
        5,
        lessonId,
        "lesson-patch",
        `${res.provider}:${res.model}`,
        "end",
        "ok",
        res.tokens,
        res.duration_ms,
      );
      traces.push({
        phase: "patch_lint",
        provider: res.provider,
        model: res.model,
        result: "ok",
        detail: "Đã merge patch sửa lỗi lint/verify",
      });
      const v2 = verifyLesson(repoRoot, slug, lessonId, true);
      if (!v2.passed) {
        finalStatus = "cần_sửa";
        break;
      }
    }

    const revBundle = buildPromptBundle(repoRoot, slug, lessonId, "review", []);
    const rt = resolveStepTarget(profile, "lesson-review");
    appendRunLog(courseDir, 6, lessonId, "lesson-review", `${rt.provider}:${rt.model}`, "start");
    const revRes = await executeWithProfile(
      profile,
      "lesson-review",
      repoRoot,
      revBundle.prompt,
      timeoutMs,
    );
    fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
    fs.writeFileSync(reviewPath, `${JSON.stringify(revRes.parsed_json, null, 2)}\n`, "utf8");

    const revObj = revRes.parsed_json as Record<string, unknown>;
    const verdict = typeof revObj.verdict === "string" ? revObj.verdict : "needs_fix";
    const revLint = runScriptAndCollect(repoRoot, "review-lint.mjs", [courseDir, lessonId]);
    const effectiveOk = verdict === "pass" && revLint.length === 0;
    appendRunLog(
      courseDir,
      6,
      lessonId,
      "lesson-review",
      `${revRes.provider}:${revRes.model}`,
      "end",
      effectiveOk ? "ok" : "needs_fix",
      revRes.tokens,
      revRes.duration_ms,
    );
    cycles += 1;
    traces.push({
      phase: `review_cycle_${cycles}`,
      provider: revRes.provider,
      model: revRes.model,
      result: effectiveOk ? "pass" : "needs_fix",
      detail:
        revLint.length === 0
          ? `verdict=${verdict}`
          : `verdict=${verdict}; review-lint: ${revLint.join(" | ")}`,
    });

    if (effectiveOk) {
      finalStatus = "đạt";
      break;
    }

    const coord = detectCoordinatorException(revObj);
    if (coord) {
      needsCoordinator = true;
      coordinatorReason = coord;
      finalStatus = "cần_sửa";
      break;
    }

    if (cycles >= opts.max_cycles) {
      finalStatus = "quá_trần";
      break;
    }

    const patchBundle = buildPromptBundle(repoRoot, slug, lessonId, "patch", revLint);
    const wt = resolveStepTarget(profile, "lesson");
    appendRunLog(courseDir, 5, lessonId, "lesson-patch", `${wt.provider}:${wt.model}`, "start");
    const patchRes = await executeWithProfile(
      profile,
      "lesson",
      repoRoot,
      patchBundle.prompt,
      timeoutMs,
    );
    const existing = JSON.parse(fs.readFileSync(lessonPath, "utf8")) as unknown;
    const merged = mergeJsonPatch(existing, patchRes.parsed_json);
    fs.writeFileSync(lessonPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    appendRunLog(
      courseDir,
      5,
      lessonId,
      "lesson-patch",
      `${patchRes.provider}:${patchRes.model}`,
      "end",
      "ok",
      patchRes.tokens,
      patchRes.duration_ms,
    );
    traces.push({
      phase: `patch_cycle_${cycles}`,
      provider: patchRes.provider,
      model: patchRes.model,
      result: "ok",
      detail: "Đã merge patch sửa theo review",
    });
  }

  return {
    lesson_id: lessonId,
    final_status: finalStatus,
    dry_run: false,
    cycles_used: cycles,
    needs_coordinator: needsCoordinator,
    coordinator_reason: coordinatorReason,
    traces,
  };
}

export async function runCourse(
  repoRoot: string,
  slug: string,
  limit: number | undefined,
  opts: RunOptions,
): Promise<CourseRunOutcome> {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const report = inspectCourse(repoRoot, courseDir, false);
  const pendingIds = report.lessons
    .filter((l) => opts.force || (l.status !== "đạt" && l.status !== "quá_trần"))
    .map((l) => l.lesson_id)
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

  const processed: LessonRunOutcome[] = [];
  let haltedReason: string | null = null;

  for (const id of pendingIds) {
    try {
      const outcome = await runLesson(repoRoot, slug, id, opts);
      processed.push(outcome);
      if (outcome.needs_coordinator) {
        haltedReason = outcome.coordinator_reason;
        break;
      }
    } catch (err) {
      haltedReason = `Dừng tại ${id}: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }
  }

  return {
    slug,
    dry_run: opts.dry_run,
    processed,
    halted_reason: haltedReason,
  };
}

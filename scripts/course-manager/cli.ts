import fs from "node:fs";
import path from "node:path";
import { buildPromptBundle, parseCourseStepKind } from "./context.ts";
import { runCourse, runCourseStep, runLesson } from "./orchestrator.ts";
import {
  initCourseRunFromBacklog,
  loadPlanReport,
  loadQueue,
  runQueuedCourses,
  saveQueue,
} from "./planner.ts";
import {
  loadProfile,
  normalizeStepKey,
  parseAgentTarget,
  saveProfile,
} from "./profile.ts";
import { scanAllProviders } from "./providers.ts";
import { inspectCourse, listCourseDirs } from "./state.ts";
import type { ContextMode, RunOptions } from "./types.ts";
import { verifyLesson } from "./verify.ts";

function findRepoRoot(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  let cur = path.resolve(process.cwd());
  while (true) {
    if (
      fs.existsSync(path.join(cur, ".course-runs")) ||
      fs.existsSync(path.join(cur, ".course-plan")) ||
      fs.existsSync(path.join(cur, ".claude", "skills", "course-author"))
    ) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) return path.resolve(process.cwd());
    cur = parent;
  }
}

function parseGlobalFlags(argv: readonly string[]): {
  repo?: string;
  json: boolean;
  rest: string[];
} {
  let repo: string | undefined;
  let json = false;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--repo" && argv[i + 1]) {
      repo = argv[++i];
    } else if (arg.startsWith("--repo=")) {
      repo = arg.slice("--repo=".length);
    } else if (arg === "--json") {
      json = true;
    } else {
      rest.push(arg);
    }
  }
  return { repo, json, rest };
}

function parseRunOpts(args: readonly string[]): {
  opts: RunOptions;
  limit?: number;
  lint: boolean;
  write: boolean;
  mode: ContextMode;
  positionals: string[];
} {
  const opts: RunOptions = {
    dry_run: false,
    max_cycles: 3,
    timeout_secs: 600,
    force: false,
  };
  let limit: number | undefined;
  let lint = false;
  let write = false;
  let mode: ContextMode = "write";
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") opts.dry_run = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--lint") lint = true;
    else if (a === "--write") write = true;
    else if (a === "--max-cycles" && args[i + 1]) {
      opts.max_cycles = Number(args[++i]) || 3;
    } else if (a === "--timeout" && args[i + 1]) {
      opts.timeout_secs = Number(args[++i]) || 600;
    } else if (a === "--limit" && args[i + 1]) {
      limit = Number(args[++i]) || undefined;
    } else if (a === "--mode" && args[i + 1]) {
      const m = args[++i].toLowerCase();
      if (m === "write" || m === "review" || m === "patch") mode = m;
      else throw new Error(`Mode không hợp lệ '${m}'. Dùng: write | review | patch`);
    } else {
      positionals.push(a);
    }
  }

  return { opts, limit, lint, write, mode, positionals };
}

function printUsage(): void {
  console.log(
    `Corelia Course Manager (TypeScript CLI)
Cách dùng: pnpm cm [--repo <path>] [--json] <command> ...

Lệnh:
  providers                              Kiểm tra CLI (claude, codex, agy) & LiteLLM
  status [slug] [--lint]                 Xem trạng thái các khóa trong .course-runs/
  profile show|init|set [slug] ...       Xem / tạo / đổi routing model & effort
  verify <slug> <lesson_id> [--write]    Kiểm chứng Tầng 1 + lesson-lint (0 token)
  context <slug> <lesson_id> [--mode ..] Đóng gói prompt bundle (write|review|patch)
  run-step <slug> <step> [--dry-run]     Chạy Bước 1(brief), 2(research), 3(curriculum), 4(curriculum-review), 7(course-review)
  run-lesson <slug> <id> [--dry-run]     Chạy vòng Write -> Verify -> Review -> Patch
  run-course <slug> [--limit N]          Chạy lần lượt các bài chưa đạt trong khóa
  rank                                   Chạy rank.mjs đối chiếu .course-plan & .course-runs
  queue list|add|remove|clear|init|run   Quản lý và chạy hàng đợi đa khóa`,
  );
}

async function main(): Promise<void> {
  const { repo, json, rest } = parseGlobalFlags(process.argv.slice(2));
  const cmd = rest[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printUsage();
    return;
  }

  const repoRoot = findRepoRoot(repo);
  const subArgs = rest.slice(1);

  if (cmd === "providers") {
    const { profile } = loadProfile(repoRoot);
    const rep = await scanAllProviders(profile.litellm_url);
    if (json) {
      console.log(JSON.stringify(rep, null, 2));
      return;
    }
    console.log("=== CLI PROVIDERS ===");
    for (const c of rep.cli_providers) {
      console.log(
        `${c.id.padEnd(9)} installed=${c.installed} ver=${c.version ?? "-"} auth=${c.auth_status}`,
      );
      if (c.models.length > 0) console.log(`  models: ${c.models.join(", ")}`);
    }
    console.log(
      `LiteLLM: binary=${rep.litellm.binary_installed} server=${rep.litellm.server_url} reachable=${rep.litellm.server_reachable}`,
    );
    return;
  }

  if (cmd === "status") {
    const parsed = parseRunOpts(subArgs);
    const slug = parsed.positionals[0];
    if (slug) {
      const courseDir = path.join(repoRoot, ".course-runs", slug);
      const rep = inspectCourse(repoRoot, courseDir, parsed.lint);
      if (json) {
        console.log(JSON.stringify(rep, null, 2));
        return;
      }
      console.log(
        `${rep.slug} | status=${rep.overall_status} | đạt=${rep.summary.đạt}/${rep.summary.total} | cần_sửa=${rep.summary.cần_sửa} | quá_trần=${rep.summary.quá_trần}`,
      );
      for (const l of rep.lessons) {
        console.log(
          `  ${l.lesson_id.padEnd(8)} [${l.lesson_type.padEnd(13)}] ${l.status.padEnd(15)} cycles=${l.cycles} | ${l.next_step}`,
        );
      }
      return;
    }
    const dirs = listCourseDirs(repoRoot);
    const reports = dirs.map((d) => inspectCourse(repoRoot, d, parsed.lint));
    if (json) {
      console.log(JSON.stringify(reports, null, 2));
      return;
    }
    for (const r of reports) {
      console.log(
        `${r.slug.padEnd(36)} ${r.overall_status.padEnd(17)} ${r.summary.đạt}/${r.summary.total} (cần_sửa=${r.summary.cần_sửa}, quá_trần=${r.summary.quá_trần})`,
      );
    }
    return;
  }

  if (cmd === "profile") {
    const action = subArgs[0] ?? "show";
    const tail = subArgs.slice(1);
    if (action === "show") {
      const slug = tail[0];
      const loaded = loadProfile(repoRoot, slug);
      console.log(JSON.stringify(loaded, null, 2));
      return;
    }
    if (action === "init") {
      const slug = tail[0];
      const { profile } = loadProfile(repoRoot, slug);
      const saved = saveProfile(repoRoot, slug, profile);
      console.log(json ? JSON.stringify({ path: saved, profile }, null, 2) : `Đã ghi ${saved}`);
      return;
    }
    if (action === "set") {
      let slug: string | undefined;
      let coordinator: string | undefined;
      let child: string | undefined;
      let fallback: string | undefined;
      let litellmUrl: string | undefined;
      const steps: Array<[string, string]> = [];

      for (let i = 0; i < tail.length; i++) {
        const t = tail[i];
        if (t === "--coordinator" && tail[i + 1]) coordinator = tail[++i];
        else if (t === "--child" && tail[i + 1]) child = tail[++i];
        else if (t === "--fallback" && tail[i + 1]) fallback = tail[++i];
        else if (t === "--litellm-url" && tail[i + 1]) litellmUrl = tail[++i];
        else if (t === "--step" && tail[i + 1]) {
          const kv = tail[++i];
          const eq = kv.indexOf("=");
          if (eq < 1) throw new Error(`--step phải có dạng <step>=<provider>:<model>[:<effort>]`);
          steps.push([kv.slice(0, eq), kv.slice(eq + 1)]);
        } else if (!t.startsWith("-") && !slug) {
          slug = t;
        }
      }

      const { profile } = loadProfile(repoRoot, slug);
      if (coordinator) profile.coordinator = parseAgentTarget(coordinator);
      if (child) profile.default_child = parseAgentTarget(child);
      if (litellmUrl) profile.litellm_url = litellmUrl;
      if (fallback) {
        if (fallback === "off") {
          if (profile.fallback) profile.fallback.enabled = false;
        } else {
          const ft = parseAgentTarget(fallback);
          profile.fallback = {
            enabled: true,
            provider: ft.provider,
            model: ft.model,
            effort: ft.effort,
            on_rate_limit: true,
          };
        }
      }
      for (const [k, v] of steps) {
        const key = normalizeStepKey(k);
        if (!key) throw new Error(`Step không hợp lệ: ${k}`);
        profile.steps[key] = parseAgentTarget(v);
      }

      const saved = saveProfile(repoRoot, slug, profile);
      console.log(json ? JSON.stringify({ path: saved, profile }, null, 2) : `Đã cập nhật ${saved}`);
      return;
    }
    throw new Error(`Action profile không hợp lệ: ${action}`);
  }

  if (cmd === "verify") {
    const parsed = parseRunOpts(subArgs);
    const [slug, lessonId] = parsed.positionals;
    if (!slug || !lessonId) throw new Error("Dùng: verify <slug> <lesson_id> [--write]");
    const rep = verifyLesson(repoRoot, slug, lessonId, parsed.write);
    if (json) {
      console.log(JSON.stringify(rep, null, 2));
      return;
    }
    console.log(
      `=== VERIFY ${rep.lesson_id} (${rep.lesson_type}) -> ${rep.passed ? "PASS" : "FAIL"} ===`,
    );
    for (const c of rep.checks) console.log(`[${c.status}] ${c.id} — ${c.detail}`);
    for (const p of rep.lint_problems) console.log(`[lint] ${p}`);
    return;
  }

  if (cmd === "context") {
    const parsed = parseRunOpts(subArgs);
    const [slug, lessonId] = parsed.positionals;
    if (!slug || !lessonId) throw new Error("Dùng: context <slug> <lesson_id> [--mode write|review|patch]");
    const bundle = buildPromptBundle(repoRoot, slug, lessonId, parsed.mode, []);
    if (json) {
      console.log(JSON.stringify(bundle, null, 2));
    } else {
      console.log(`Bundle: ${bundle.bundle_path} (${bundle.chars} chars, mode=${bundle.mode})`);
    }
    return;
  }

  if (cmd === "run-step") {
    const parsed = parseRunOpts(subArgs);
    const [slug, stepRaw] = parsed.positionals;
    if (!slug || !stepRaw) throw new Error("Dùng: run-step <slug> <step> [--dry-run]");
    const step = parseCourseStepKind(stepRaw);
    const out = await runCourseStep(repoRoot, slug, step, parsed.opts);
    if (json) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(
        `=== RUN STEP ${out.step} (${out.slug}) -> ${out.result} (${out.provider}:${out.model}) ===`,
      );
      for (const f of out.written_files) console.log(`  file: ${f}`);
      for (const p of out.lint_problems) console.log(`  [lint] ${p}`);
    }
    return;
  }

  if (cmd === "run-lesson") {
    const parsed = parseRunOpts(subArgs);
    const [slug, lessonId] = parsed.positionals;
    if (!slug || !lessonId) throw new Error("Dùng: run-lesson <slug> <lesson_id> [--dry-run]");
    const out = await runLesson(repoRoot, slug, lessonId, parsed.opts);
    if (json) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(
        `=== RUN ${out.lesson_id} -> ${out.final_status} (cycles=${out.cycles_used}) ===`,
      );
      for (const t of out.traces) {
        console.log(`[${t.phase}] ${t.provider}:${t.model} -> ${t.result} | ${t.detail}`);
      }
      if (out.coordinator_reason) console.log(`[COORDINATOR] ${out.coordinator_reason}`);
    }
    return;
  }

  if (cmd === "run-course") {
    const parsed = parseRunOpts(subArgs);
    const [slug] = parsed.positionals;
    if (!slug) throw new Error("Dùng: run-course <slug> [--limit N] [--dry-run]");
    const out = await runCourse(repoRoot, slug, parsed.limit, parsed.opts);
    if (json) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`=== RUN COURSE ${out.slug} processed=${out.processed.length} ===`);
      for (const l of out.processed) {
        console.log(`  ${l.lesson_id}: ${l.final_status} (cycles=${l.cycles_used})`);
      }
      if (out.halted_reason) console.log(`[HALTED] ${out.halted_reason}`);
    }
    return;
  }

  if (cmd === "rank") {
    const rep = loadPlanReport(repoRoot);
    if (json) {
      console.log(JSON.stringify(rep, null, 2));
      return;
    }
    console.log(
      `Rank: total=${rep.total} eligible=${rep.eligible_count} env_warnings=${rep.env_warnings.length}`,
    );
    for (const w of rep.env_warnings) console.log(`  [WARN] ${w}`);
    for (const r of rep.rows) {
      const runState = r.course_run_status ?? "chưa khởi tạo";
      console.log(
        `#${r.rank} [${r.map_slug}] ${r.slug} | ${runState} | ${r.title}`,
      );
    }
    return;
  }

  if (cmd === "queue") {
    const action = subArgs[0] ?? "list";
    const tail = subArgs.slice(1);
    const rep = fs.existsSync(path.join(repoRoot, ".course-plan", "backlog.json"))
      ? loadPlanReport(repoRoot)
      : undefined;
    const queue = loadQueue(repoRoot, rep);

    if (action === "list") {
      if (json) {
        console.log(JSON.stringify(queue, null, 2));
        return;
      }
      if (queue.items.length === 0) {
        console.log("Queue đang trống.");
        return;
      }
      queue.items.forEach((item, idx) => {
        console.log(
          `${idx + 1}. [${item.enabled ? "ON" : "OFF"}] ${item.slug} (${item.source}) — ${item.title}`,
        );
      });
      return;
    }
    if (action === "add") {
      const slug = tail[0];
      if (!slug) throw new Error("Dùng: queue add <slug>");
      if (!queue.items.some((i) => i.slug === slug)) {
        const title = rep?.rows.find((r) => r.slug === slug)?.title ?? slug;
        queue.items.push({ slug, title, source: "cli", enabled: true });
        saveQueue(repoRoot, queue);
      }
      console.log(json ? JSON.stringify(queue, null, 2) : `Đã thêm ${slug} vào queue.`);
      return;
    }
    if (action === "remove") {
      const slug = tail[0];
      if (!slug) throw new Error("Dùng: queue remove <slug>");
      queue.items = queue.items.filter((i) => i.slug !== slug);
      saveQueue(repoRoot, queue);
      console.log(json ? JSON.stringify(queue, null, 2) : `Đã xóa ${slug} khỏi queue.`);
      return;
    }
    if (action === "clear") {
      queue.items = [];
      saveQueue(repoRoot, queue);
      console.log(json ? JSON.stringify(queue, null, 2) : "Đã xóa toàn bộ queue.");
      return;
    }
    if (action === "init") {
      const slug = tail[0];
      if (!slug) throw new Error("Dùng: queue init <slug>");
      const p = initCourseRunFromBacklog(repoRoot, slug);
      console.log(json ? JSON.stringify({ handoff: p }, null, 2) : `Đã tạo ${p}`);
      return;
    }
    if (action === "run") {
      const parsed = parseRunOpts(tail);
      const slugs = queue.items.filter((i) => i.enabled).map((i) => i.slug);
      const summary = await runQueuedCourses(repoRoot, slugs, parsed.limit, parsed.opts);
      if (json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        for (const r of summary.results) {
          console.log(`[${r.outcome}] ${r.slug}: ${r.detail}`);
        }
        if (summary.halted_reason) console.log(`[HALTED] ${summary.halted_reason}`);
      }
      return;
    }
    throw new Error(`Action queue không hợp lệ: ${action}`);
  }

  throw new Error(`Lệnh không hợp lệ: ${cmd}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

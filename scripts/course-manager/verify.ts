import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findExecutable, runCmd } from "./exec.ts";
import type { VerifyCheck, VerifyReport } from "./types.ts";

export function generateBoundedCombos(
  blanks: Array<{ id: string; choices: string[] }>,
  maxCombos = 144,
): Array<Record<string, string>> {
  let combos: Array<Record<string, string>> = [{}];
  for (const blank of blanks) {
    if (blank.choices.length === 0) continue;
    const next: Array<Record<string, string>> = [];
    for (const existing of combos) {
      for (const ch of blank.choices) {
        next.push({ ...existing, [blank.id]: ch });
        if (next.length >= maxCombos) break;
      }
      if (next.length >= maxCombos) break;
    }
    combos = next;
  }
  return combos;
}

function compileSource(
  repoRoot: string,
  lang: string,
  code: string,
  label: string,
): VerifyCheck {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cm-verify-"));
  try {
    const l = lang.toLowerCase();
    if (l === "ts" || l === "typescript" || l === "tsx") {
      const file = path.join(tmpDir, l === "tsx" ? "check.tsx" : "check.ts");
      fs.writeFileSync(file, code, "utf8");
      const tscLocal = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
      const exe = fs.existsSync(tscLocal) ? tscLocal : findExecutable(["tsc.cmd", "tsc"]);
      if (!exe) {
        return { id: label, status: "skipped", detail: "Không tìm thấy `tsc`." };
      }
      const out = runCmd(
        exe,
        ["--noEmit", "--strict", "--target", "ES2022", "--moduleResolution", "bundler", file],
        repoRoot,
        undefined,
        20_000,
      );
      return {
        id: label,
        status: out.exitOk ? "pass" : "fail",
        detail: out.exitOk
          ? "tsc --noEmit --strict: exit 0"
          : `tsc lỗi: ${(out.stderr || out.stdout).trim().slice(0, 400)}`,
      };
    }
    if (l === "js" || l === "javascript") {
      const file = path.join(tmpDir, "check.mjs");
      fs.writeFileSync(file, code, "utf8");
      const node = findExecutable(["node.exe", "node.cmd", "node"]);
      if (!node) return { id: label, status: "skipped", detail: "Không tìm thấy `node`." };
      const out = runCmd(node, ["--check", file], tmpDir, undefined, 10_000);
      return {
        id: label,
        status: out.exitOk ? "pass" : "fail",
        detail: out.exitOk ? "node --check: exit 0" : out.stderr.trim().slice(0, 400),
      };
    }
    if (l === "py" || l === "python") {
      const file = path.join(tmpDir, "check.py");
      fs.writeFileSync(file, code, "utf8");
      const py = findExecutable(["python.exe", "python.cmd", "python", "python3"]);
      if (!py) return { id: label, status: "skipped", detail: "Không tìm thấy `python`." };
      const out = runCmd(py, ["-m", "py_compile", file], tmpDir, undefined, 10_000);
      return {
        id: label,
        status: out.exitOk ? "pass" : "fail",
        detail: out.exitOk ? "py_compile: exit 0" : out.stderr.trim().slice(0, 400),
      };
    }
    if (l === "rs" || l === "rust") {
      const file = path.join(tmpDir, "check.rs");
      fs.writeFileSync(file, code, "utf8");
      const rustc = findExecutable(["rustc.exe", "rustc.cmd", "rustc"]);
      if (!rustc) return { id: label, status: "skipped", detail: "Không tìm thấy `rustc`." };
      const out = runCmd(rustc, ["--crate-type", "lib", "--emit=metadata", file, "-o", path.join(tmpDir, "libcheck.rmeta")], tmpDir, undefined, 20_000);
      return {
        id: label,
        status: out.exitOk ? "pass" : "fail",
        detail: out.exitOk ? "rustc metadata check: exit 0" : out.stderr.trim().slice(0, 400),
      };
    }
    return { id: label, status: "skipped", detail: `Chưa hỗ trợ kiểm chứng tĩnh cho ngôn ngữ '${lang}'.` };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function evaluateEditTests(lesson: Record<string, unknown>): VerifyCheck | null {
  const editTests = lesson.edit_tests;
  if (!Array.isArray(editTests) || editTests.length === 0) return null;
  const refCode = typeof lesson.reference_solution === "string" ? lesson.reference_solution : "";
  if (!refCode) {
    return {
      id: "edit_tests",
      status: "fail",
      detail: "Có edit_tests nhưng thiếu reference_solution.",
    };
  }
  const missing: string[] = [];
  for (const t of editTests) {
    const tc = t as { expected_substring?: string; pattern?: string; name?: string };
    const needle = tc.expected_substring ?? tc.pattern ?? "";
    if (needle && !refCode.includes(needle)) {
      missing.push(tc.name ?? needle);
    }
  }
  return {
    id: "edit_tests",
    status: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? `Đạt ${editTests.length}/${editTests.length} edit_tests`
        : `Thiếu trong reference_solution: ${missing.join(", ")}`,
  };
}

export function formatVerificationMarkdown(
  lessonId: string,
  lessonType: string,
  checks: readonly VerifyCheck[],
  lintProblems: readonly string[],
): string {
  const lines = [
    `# Verification Report: ${lessonId}`,
    "",
    `- Type: \`${lessonType}\``,
    `- Checked at: \`${new Date().toISOString()}\``,
    "",
    "## Tier-1 Checks",
    "",
  ];
  if (checks.length === 0) {
    lines.push("- Không có check biên dịch tự động cho loại bài này.");
  } else {
    for (const c of checks) {
      lines.push(`- [${c.status}] \`${c.id}\` — ${c.detail}`);
    }
  }

  lines.push("", "## Lesson Lint", "");
  if (lintProblems.length === 0) {
    lines.push("- Không phát hiện lỗi `lesson-lint.mjs`.");
  } else {
    for (const p of lintProblems) lines.push(`- [fail] ${p}`);
  }

  const verifyStatus =
    checks.some((c) => c.status === "fail") || lintProblems.length > 0
      ? "cần_sửa"
      : checks.some((c) => c.status === "pass")
        ? "ok (Tầng 1)"
        : "chưa_kiểm_chứng_tự_động (chờ Reviewer đối chiếu)";

  lines.push(
    "",
    "## Tự review",
    "",
    `- factual_accuracy: chưa_kiểm_chứng (Reviewer đối chiếu nguồn & thực tế)`,
    `- tool_versions: chưa_kiểm_chứng (Reviewer kiểm chứng phiên bản công cụ/API)`,
    `- outcome_and_level: chưa_kiểm_chứng (Reviewer đối chiếu mục tiêu bài học)`,
    `- frame_consistency: chưa_kiểm_chứng (Reviewer đối chiếu frame.md)`,
    `- verification: ${verifyStatus}`,
    `- language: ${lintProblems.length === 0 ? "ok (lesson-lint)" : "cần_sửa (xem Lesson Lint)"}`,
    `- tone_and_flow: chưa_kiểm_chứng (Reviewer đánh giá giọng văn & mạch bài)`,
    "",
  );
  return lines.join("\n");
}

export function verifyLesson(
  repoRoot: string,
  slug: string,
  lessonId: string,
  write: boolean,
): VerifyReport {
  const courseDir = path.join(repoRoot, ".course-runs", slug);
  const lessonPath = path.join(courseDir, "lessons", `${lessonId}.json`);
  if (!fs.existsSync(lessonPath)) {
    throw new Error(`Không tìm thấy bài học: ${lessonPath}`);
  }
  const lesson = JSON.parse(fs.readFileSync(lessonPath, "utf8")) as Record<string, unknown>;
  const lessonType =
    typeof lesson.lesson_type === "string"
      ? lesson.lesson_type
      : typeof lesson.type === "string"
        ? lesson.type
        : "article";

  const checks: VerifyCheck[] = [];
  if (lessonType === "code_exercise") {
    const lang = typeof lesson.language === "string" ? lesson.language : "ts";
    const refCode = typeof lesson.reference_solution === "string" ? lesson.reference_solution : "";
    if (refCode) {
      checks.push(compileSource(repoRoot, lang, refCode, "tier1_reference_compile"));
    }

    const template = typeof lesson.code_template === "string" ? lesson.code_template : "";
    const blanksRaw = Array.isArray(lesson.blanks) ? lesson.blanks : [];
    const blanks = blanksRaw
      .map((b) => {
        const obj = b as { id?: string; choices?: unknown[]; answer?: string };
        return {
          id: obj.id ?? "",
          choices: Array.isArray(obj.choices)
            ? obj.choices.filter((c): c is string => typeof c === "string")
            : [],
          answer: typeof obj.answer === "string" ? obj.answer : "",
        };
      })
      .filter((b) => b.id && b.choices.length > 0);

    if (template && blanks.length > 0 && refCode) {
      let filled = template;
      for (const b of blanks) {
        filled = filled.replaceAll(`{{${b.id}}}`, b.answer);
      }
      const norm = (s: string) => s.replace(/\r\n/g, "\n").trim();
      checks.push({
        id: "fill_reference_match",
        status: norm(filled) === norm(refCode) ? "pass" : "fail",
        detail:
          norm(filled) === norm(refCode)
            ? "Trùng khớp nội dung"
            : "code_template điền answer không khớp reference_solution",
      });

      const combos = generateBoundedCombos(blanks, 144);
      let okCount = 0;
      for (const combo of combos) {
        let code = template;
        for (const [k, v] of Object.entries(combo)) {
          code = code.replaceAll(`{{${k}}}`, v);
        }
        const res = compileSource(repoRoot, lang, code, "combo");
        if (res.status === "pass" || res.status === "skipped") okCount += 1;
      }
      checks.push({
        id: "fill_combinations_compile",
        status: okCount === combos.length ? "pass" : "fail",
        detail: `${okCount}/${combos.length} tổ hợp thoát mã 0`,
      });
    }

    const editCheck = evaluateEditTests(lesson);
    if (editCheck) checks.push(editCheck);
  }

  const lintScript = path.join(
    repoRoot,
    ".claude",
    "skills",
    "course-author",
    "scripts",
    "lesson-lint.mjs",
  );
  const lintProblems: string[] = [];
  if (fs.existsSync(lintScript)) {
    const node = findExecutable(["node.exe", "node.cmd", "node"]);
    if (node) {
      const out = runCmd(node, [lintScript, courseDir, lessonId], repoRoot, undefined, 20_000);
      const combined = `${out.stdout}\n${out.stderr}`;
      for (const line of combined.split(/\r?\n/)) {
        const m = line.trim().match(new RegExp(`^(?:[-*]\\s*)?${lessonId}:\\s*(.+)$`));
        if (m) lintProblems.push(m[1].trim());
      }
    }
  }

  const passed = !checks.some((c) => c.status === "fail") && lintProblems.length === 0;
  const verification_markdown = formatVerificationMarkdown(
    lessonId,
    lessonType,
    checks,
    lintProblems,
  );

  let written_path: string | null = null;
  if (write) {
    const verDir = path.join(courseDir, "verification");
    fs.mkdirSync(verDir, { recursive: true });
    written_path = path.join(verDir, `${lessonId}.md`);
    fs.writeFileSync(written_path, verification_markdown, "utf8");
  }

  return {
    slug,
    lesson_id: lessonId,
    lesson_type: lessonType,
    passed,
    checks,
    lint_problems: lintProblems,
    diagram_problems: [],
    verification_markdown,
    written_path,
  };
}

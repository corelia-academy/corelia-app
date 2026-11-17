import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const rootDir = path.resolve(".");
const scriptsDir = path.join(rootDir, ".claude/skills/course-author/scripts");

function run(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

test("AC1.1: review-lint trên fixture course-a báo L3-4 (unverified) và L4-5 (issue answers)", () => {
  const res = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-a")} L3-4 L4-5`);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /L3-4: unverified:/);
  assert.match(res.stdout, /L4-5: issue-cốt-lõi:.*answers/);
});

test("AC1.1 (course-b): review-lint trên fixture course-b báo L2-2 và L1-4", () => {
  const res = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-b")} L2-2 L1-4`);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /L2-2:.*answers/);
  assert.match(res.stdout, /L1-4:.*factual_accuracy/);
});

test("AC1.2: test với fixture cho review-lint", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-lint-fixture-"));
  const revDir = path.join(tmpDir, "reviews");
  const verDir = path.join(tmpDir, "verification");
  fs.mkdirSync(revDir, { recursive: true });
  fs.mkdirSync(verDir, { recursive: true });

  const allCriteria = [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "verification",
    "language",
    "tone_and_flow",
  ];

  // 1. Review pass sạch -> ok
  const cleanChecks = allCriteria.map((c) => ({
    criterion: c,
    result: "ok",
    basis: "hợp lệ",
    refs: [],
    verified_by: "reasoning",
  }));
  fs.writeFileSync(
    path.join(revDir, "clean.json"),
    JSON.stringify({ verdict: "pass", checks: cleanChecks, issues: [] }, null, 2)
  );

  const resClean = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} clean`);
  assert.equal(resClean.status, 0);
  assert.match(resClean.stdout, /ok: 1 review/);

  // 2. Pass có unverified ở factual_accuracy -> lỗi
  const unverChecks = cleanChecks.map((c) =>
    c.criterion === "factual_accuracy" ? { ...c, result: "unverified" } : c
  );
  fs.writeFileSync(
    path.join(revDir, "unver_fact.json"),
    JSON.stringify({ verdict: "pass", checks: unverChecks, issues: [] }, null, 2)
  );
  const resUnver = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} unver_fact`);
  assert.equal(resUnver.status, 1);
  assert.match(resUnver.stdout, /unver_fact: unverified: check "factual_accuracy" ghi unverified/);

  // 3. Pass có unverified ở verification kèm not_run hợp lệ -> ok
  const unverVerChecks = cleanChecks.map((c) =>
    c.criterion === "verification" ? { ...c, result: "unverified" } : c
  );
  fs.writeFileSync(
    path.join(revDir, "not_run_ok.json"),
    JSON.stringify({ verdict: "pass", checks: unverVerChecks, issues: [] }, null, 2)
  );
  fs.writeFileSync(
    path.join(verDir, "not_run_ok.md"),
    `# Verification\n\n| v1 | test | not_run: cần private key thật |`
  );
  const resNotRunOk = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} not_run_ok`);
  assert.equal(resNotRunOk.status, 0);
  assert.match(resNotRunOk.stdout, /ok: 1 review/);

  // 4. Thiếu một tiêu chí -> lỗi
  const missingChecks = cleanChecks.filter((c) => c.criterion !== "factual_accuracy");
  fs.writeFileSync(
    path.join(revDir, "missing_crit.json"),
    JSON.stringify({ verdict: "pass", checks: missingChecks, issues: [] }, null, 2)
  );
  const resMissing = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} missing_crit`);
  assert.equal(resMissing.status, 1);
  assert.match(resMissing.stdout, /missing_crit: checks: thiếu tiêu chí "factual_accuracy"/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AC1.3: lesson-lint trên fixture invalid-labels không crash; in lỗi dạng labels.json", () => {
  const res = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${path.join(rootDir, ".claude/skills/course-author/test/fixtures/invalid-labels")}`);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /labels\.json sai định dạng/);
  assert.doesNotMatch(res.stderr, /TypeError/);
});

test("AC1.4: labels.mjs trên bản sao curriculum.json của fixture course-a cho nhãn trùng labels.json hiện có", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "labels-verify-"));
  fs.copyFileSync(
    path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-a/curriculum.json"),
    path.join(tmpDir, "curriculum.json")
  );

  const resGen = run(`node ${path.join(scriptsDir, "labels.mjs")} ${tmpDir}`);
  assert.equal(resGen.status, 0);

  const gen = JSON.parse(fs.readFileSync(path.join(tmpDir, "labels.json"), "utf8"));
  const orig = JSON.parse(
    fs.readFileSync(path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-a/labels.json"), "utf8")
  );

  assert.deepEqual(gen.lessons, orig.lessons);
  assert.deepEqual(gen.modules, orig.modules);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AC1.5: lesson-lint trên fixture course-a ra đúng 14 dòng lỗi", () => {
  const res = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-a")}`);
  assert.equal(res.status, 1);
  const lines = res.stdout.trim().split("\n");
  assert.equal(lines.length, 14);
});

test("W-03: review-lint nhận loại bài code_exercise và đòi frame_consistency khi có frame.md", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-lint-w03-"));
  const revDir = path.join(tmpDir, "reviews");
  fs.mkdirSync(revDir, { recursive: true });

  // 1. Tạo curriculum có 1 bài code_exercise
  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [
        {
          module_id: "M1",
          lessons: [{ lesson_id: "L1-1", type: "code_exercise" }],
        },
      ],
    })
  );

  // Review cho L1-1 thiếu check 'answers'
  const checksWithoutAnswers = [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "verification",
    "language",
    "tone_and_flow",
  ].map((c) => ({ criterion: c, result: "ok" }));

  fs.writeFileSync(
    path.join(revDir, "L1-1.json"),
    JSON.stringify({ verdict: "pass", checks: checksWithoutAnswers, issues: [] })
  );

  const resCode = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(resCode.status, 1);
  assert.match(resCode.stdout, /thiếu tiêu chí "answers" cho loại bài code/);

  // 2. Thêm frame.md -> đòi frame_consistency cho mọi bài
  fs.writeFileSync(path.join(tmpDir, "frame.md"), "# Code frame\n");
  const checksWithAnswers = [...checksWithoutAnswers, { criterion: "answers", result: "ok" }];
  fs.writeFileSync(
    path.join(revDir, "L1-1.json"),
    JSON.stringify({ verdict: "pass", checks: checksWithAnswers, issues: [] })
  );

  const resFrame = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(resFrame.status, 1);
  assert.match(resFrame.stdout, /thiếu tiêu chí "frame_consistency" cho loại bài code/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("W-04: review-lint siết chặt not_run có lý do tách bạch và kiểm tra giá trị verdict", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-lint-w04-"));
  const revDir = path.join(tmpDir, "reviews");
  const verDir = path.join(tmpDir, "verification");
  fs.mkdirSync(revDir, { recursive: true });
  fs.mkdirSync(verDir, { recursive: true });

  const validChecks = [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "verification",
    "language",
    "tone_and_flow",
  ].map((c) => ({ criterion: c, result: c === "verification" ? "unverified" : "ok" }));

  // 1. not_run không có lý do tách bạch (chỉ chứa từ 'do' trong câu bình thường) -> báo lỗi unverified
  fs.writeFileSync(
    path.join(revDir, "loose_not_run.json"),
    JSON.stringify({ verdict: "pass", checks: validChecks, issues: [] })
  );
  fs.writeFileSync(
    path.join(verDir, "loose_not_run.md"),
    "# Verification\n\nbước 1 not_run do nothing\n"
  );
  const resLoose = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} loose_not_run`);
  assert.equal(resLoose.status, 1);
  assert.match(resLoose.stdout, /unverified: check "verification" ghi unverified/);

  // 2. not_run có lý do tách bạch sau dấu hai chấm -> ok
  fs.writeFileSync(
    path.join(verDir, "loose_not_run.md"),
    "# Verification\n\nnot_run: cần private key thật của tài khoản mainnet\n"
  );
  const resColon = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} loose_not_run`);
  assert.equal(resColon.status, 0);

  // 3. not_run có lý do trong ngoặc -> ok
  fs.writeFileSync(
    path.join(verDir, "loose_not_run.md"),
    "# Verification\n\nnot_run (chưa có tài khoản staging)\n"
  );
  const resParen = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} loose_not_run`);
  assert.equal(resParen.status, 0);

  // 4. verdict không hợp lệ -> báo lỗi verdict
  fs.writeFileSync(
    path.join(revDir, "invalid_verdict.json"),
    JSON.stringify({ verdict: "approved", checks: validChecks, issues: [] })
  );
  const resVerdict = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} invalid_verdict`);
  assert.equal(resVerdict.status, 1);
  assert.match(resVerdict.stdout, /verdict không hợp lệ: "approved"/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});


test("W-14: lesson-lint báo lỗi tham chiếu bài ngoài dạng chuẩn", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-lint-w14-"));
  const lessonsDir = path.join(tmpDir, "lessons");
  fs.mkdirSync(lessonsDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [
        {
          module_id: "M1",
          title: "Chuyên đề nâng cao",
          lessons: [
            { lesson_id: "L1", title: "Khái niệm mở đầu", type: "article" },
          ],
        },
      ],
    })
  );

  const makeLesson = (md) => ({
    lesson_id: "L1",
    title: "Khái niệm mở đầu",
    short_description: "Mô tả bài học mở đầu",
    article: { description_markdown: md },
  });

  // Case 1: "Part B, Bài 3 và Bài 4" -> "Bài 4" bị báo
  fs.writeFileSync(path.join(lessonsDir, "L1.json"), JSON.stringify(makeLesson("Nội dung: Part B, Bài 3 và Bài 4.")));
  const res1 = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir}`);
  assert.equal(res1.status, 1);
  assert.match(res1.stdout, /L1: nhãn-bài:.*"Bài 4" tham chiếu bài ngoài dạng chuẩn/);

  // Case 2: "Bài 4" đứng một mình -> bị báo
  fs.writeFileSync(path.join(lessonsDir, "L1.json"), JSON.stringify(makeLesson("Như đã học ở Bài 4.")));
  const res2 = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir}`);
  assert.equal(res2.status, 1);
  assert.match(res2.stdout, /L1: nhãn-bài:.*"Bài 4" tham chiếu bài ngoài dạng chuẩn/);

  // Case 3: "Part B (Bài 3, Bài 4)" -> không bị báo lỗi nhãn-bài
  fs.writeFileSync(path.join(lessonsDir, "L1.json"), JSON.stringify(makeLesson("Ôn lại tại Part B (Bài 3, Bài 4).")));
  const res3 = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir}`);
  assert.doesNotMatch(res3.stdout, /nhãn-bài/);

  // Case 4: "Part B, Bài 3" -> không bị báo lỗi nhãn-bài
  fs.writeFileSync(path.join(lessonsDir, "L1.json"), JSON.stringify(makeLesson("Xem thêm tại Part B, Bài 3.")));
  const res4 = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir}`);
  assert.doesNotMatch(res4.stdout, /nhãn-bài/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});


test("review-lint: cấm code_exercise dùng not_run và cấm pass khi verification có bước fail", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-lint-two-tier-"));
  const revDir = path.join(tmpDir, "reviews");
  const verDir = path.join(tmpDir, "verification");
  fs.mkdirSync(revDir, { recursive: true });
  fs.mkdirSync(verDir, { recursive: true });

  const baseChecks = [
    "factual_accuracy",
    "tool_versions",
    "outcome_and_level",
    "lesson_flow",
    "verification",
    "language",
    "tone_and_flow",
  ].map((c) => ({ criterion: c, result: c === "verification" ? "unverified" : "ok" }));

  // 1. verification có status: fail cùng not_run -> lỗi
  fs.writeFileSync(
    path.join(revDir, "failed_plus_not_run.json"),
    JSON.stringify({ verdict: "pass", checks: baseChecks, issues: [] })
  );
  fs.writeFileSync(
    path.join(verDir, "failed_plus_not_run.md"),
    "# Verification\n\n| v1 | compile | fail | lỗi cú pháp |\n| v2 | api | not_run: thiếu key |\n"
  );
  const resMixedFail = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} failed_plus_not_run`);
  assert.equal(resMixedFail.status, 1);
  assert.match(resMixedFail.stdout, /unverified: check "verification"/);

  // 2. code_exercise để verification unverified dù có not_run -> lỗi
  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({ modules: [{ module_id: "M1", lessons: [{ lesson_id: "code_not_run", type: "code_exercise" }] }] })
  );
  const codeChecks = [...baseChecks, { criterion: "answers", result: "ok" }];
  fs.writeFileSync(
    path.join(revDir, "code_not_run.json"),
    JSON.stringify({ verdict: "pass", checks: codeChecks, issues: [] })
  );
  fs.writeFileSync(
    path.join(verDir, "code_not_run.md"),
    "# Verification\n\nnot_run: thiếu DB ngoài\n"
  );
  const resCodeNotRun = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} code_not_run`);
  assert.equal(resCodeNotRun.status, 1);
  assert.match(resCodeNotRun.stdout, /code_not_run: unverified: check "verification"/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

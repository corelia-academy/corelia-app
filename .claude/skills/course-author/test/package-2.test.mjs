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

test("AC2.1: course-digest trên hai fixtures: JSON hợp lệ, đủ số bài, kích thước < 30% thư mục lessons/", () => {
  const runs = [
    ".claude/skills/course-author/test/fixtures/course-a",
    ".claude/skills/course-author/test/fixtures/course-b",
  ];

  for (const dir of runs) {
    const res = run(`node ${path.join(scriptsDir, "course-digest.mjs")} ${dir}`);
    assert.equal(res.status, 0);

    const digest = JSON.parse(res.stdout);
    const curr = JSON.parse(fs.readFileSync(path.join(rootDir, dir, "curriculum.json"), "utf8"));
    let expectedLessons = 0;
    curr.modules.forEach((m) => (expectedLessons += m.lessons.length));

    assert.equal(digest.length, expectedLessons);

    let lessonDirSize = 0;
    const lessonFiles = fs.readdirSync(path.join(rootDir, dir, "lessons"));
    lessonFiles.forEach((f) => {
      lessonDirSize += fs.statSync(path.join(rootDir, dir, "lessons", f)).size;
    });

    const digestSize = Buffer.byteLength(res.stdout, "utf8");
    assert.ok(
      digestSize < lessonDirSize * 0.3,
      `Digest size ${digestSize} không nhỏ hơn 30% của ${lessonDirSize}`
    );
  }
});

test("AC2.2: test lint độ dài: 3.000 từ với target_minutes 10 -> lỗi, 1.800 từ -> ok, không target_minutes -> bỏ qua", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "length-lint-fixture-"));
  const lesDir = path.join(tmpDir, "lessons");
  fs.mkdirSync(lesDir, { recursive: true });

  const makeArticle = (wordsCount) => {
    const words = Array.from({ length: wordsCount }, (_, i) => `từ${i}`).join(" ");
    return {
      lesson_id: "L1-1",
      title: "Bài kiểm tra độ dài",
      short_description: "Mô tả ngắn",
      summary: "Tóm tắt",
      article: {
        description_markdown: `## Mở đầu\n\nBạn sẽ học bài này.\n\n${words}\n`,
      },
    };
  };

  // Case 1: 3000 từ với target_minutes: 10 -> lỗi
  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [{ module_id: "M1", lessons: [{ lesson_id: "L1-1", target_minutes: 10 }] }],
    })
  );
  fs.writeFileSync(path.join(lesDir, "L1-1.json"), JSON.stringify(makeArticle(3000)));

  const res3000 = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.equal(res3000.status, 1);
  assert.match(res3000.stdout, /L1-1: độ-dài: ước tính \d+ phút/);

  // Case 2: 1800 từ với target_minutes: 10 -> ok
  fs.writeFileSync(path.join(lesDir, "L1-1.json"), JSON.stringify(makeArticle(1800)));
  const res1800 = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.doesNotMatch(res1800.stdout, /độ-dài/);

  // Case 3: Không có target_minutes -> bỏ qua luật độ dài (kể cả 3000 từ)
  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [{ module_id: "M1", lessons: [{ lesson_id: "L1-1" }] }],
    })
  );
  fs.writeFileSync(path.join(lesDir, "L1-1.json"), JSON.stringify(makeArticle(3000)));
  const resNoTarget = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
  assert.doesNotMatch(resNoTarget.stdout, /độ-dài/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AC2.3: lesson-lint trên 2 fixtures không phát sinh dòng độ-dài", () => {
  const resA = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-a")}`);
  assert.doesNotMatch(resA.stdout, /(?<!quiz-)độ-dài:/);

  const resB = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${path.join(rootDir, ".claude/skills/course-author/test/fixtures/course-b")}`);
  assert.doesNotMatch(resB.stdout, /(?<!quiz-)độ-dài:/);
});

test("AC2.4: bảng Các bước và bảng Model trong SKILL.md nhất quán với các file role", () => {
  const skillContent = fs.readFileSync(path.join(rootDir, ".claude/skills/course-author/SKILL.md"), "utf8");

  // Kiểm tra bảng Các bước
  assert.match(skillContent, /\| 7 \| `roles\/07-course-review\.md`/);

  // Kiểm tra bảng Model: bước 3, 4, 6, 7 là sonnet; viết lesson là haiku effort xhigh
  assert.match(skillContent, /\| Bước 3: curriculum \| `sonnet` \|/);
  assert.match(skillContent, /\| Bước 4: review curriculum \| `sonnet` \|/);
  assert.match(skillContent, /\| Bước 5: viết lesson \| `haiku` \| `luna` \| `xhigh` \|/);
  assert.match(skillContent, /\| Bước 6: review lesson \| `sonnet` \|/);
  assert.match(skillContent, /\| Bước 7: review cấp khóa \| `sonnet` \|/);

  // File role 07 tồn tại
  assert.ok(fs.existsSync(path.join(rootDir, ".claude/skills/course-author/roles/07-course-review.md")));

  // Kiểm tra chế độ 1 model hydrogen với hai mức effort medium / high
  assert.match(skillContent, /Chế độ 1 model \(`hydrogen`\)/);
  assert.match(skillContent, /\| Bước 2: research \| `hydrogen` \| `medium` \|/);
  assert.match(skillContent, /\| Bước 3: curriculum \| `hydrogen` \| `high` \|/);
  assert.match(skillContent, /\| Bước 5: viết lesson \| `hydrogen` \| `high` \|/);
  assert.match(skillContent, /\| Bước 5: chạy kiểm chứng \(`verification\/<id>\.md`\) \| `hydrogen` \| `medium` \|/);
  assert.match(skillContent, /\| Bước 6: review lesson \| `hydrogen` \| `medium` \|/);
  assert.match(skillContent, /\| Bước 7: review cấp khóa \| `hydrogen` \| `high` \|/);
});

test("Edge case 2.3: course-digest thoát mã 1 khi curriculum có lesson thiếu", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "digest-missing-"));
  fs.writeFileSync(
    path.join(tmpDir, "curriculum.json"),
    JSON.stringify({
      modules: [{ module_id: "M1", lessons: [{ lesson_id: "L1-1" }, { lesson_id: "L1-2" }] }],
    })
  );
  fs.mkdirSync(path.join(tmpDir, "lessons"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "lessons", "L1-1.json"),
    JSON.stringify({ lesson_id: "L1-1", title: "Tồn tại" })
  );
  // Thiếu L1-2.json

  const res = run(`node ${path.join(scriptsDir, "course-digest.mjs")} ${tmpDir}`);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Curriculum có lesson chưa viết: L1-2/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("review-lint kiểm tra reviews/course.json", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "course-review-lint-"));
  const revDir = path.join(tmpDir, "reviews");
  fs.mkdirSync(revDir, { recursive: true });

  const courseChecks = [
    "terminology_consistency",
    "cross_lesson_contradiction",
    "recall_validity",
    "no_duplicate_teaching",
    "concept_order",
  ].map((c) => ({
    criterion: c,
    result: "ok",
    basis: "đạt",
    refs: ["L1-1"],
    verified_by: "reasoning",
  }));

  // Clean course review -> pass
  fs.writeFileSync(
    path.join(revDir, "course.json"),
    JSON.stringify({ verdict: "pass", checks: courseChecks, issues: [] }, null, 2)
  );

  const resOk = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} course`);
  assert.equal(resOk.status, 0);

  // Missing a check in course review -> fail
  const missingChecks = courseChecks.filter((c) => c.criterion !== "concept_order");
  fs.writeFileSync(
    path.join(revDir, "course.json"),
    JSON.stringify({ verdict: "pass", checks: missingChecks, issues: [] }, null, 2)
  );
  const resFail = run(`node ${path.join(scriptsDir, "review-lint.mjs")} ${tmpDir} course`);
  assert.equal(resFail.status, 1);
  assert.match(resFail.stdout, /course: checks: thiếu tiêu chí "concept_order"/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// .claude/skills/course-author/test/import-local-and-report.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { generateRunReport, sanitizeReport } from "../scripts/run-report.mjs";
import { getCourseStatus } from "../scripts/course-status-lib.mjs";

const IMPORT_SCRIPT = path.resolve(".claude/skills/course-author/scripts/import-local.ts");

const STANDARD_CHECKS = [
  { criterion: "factual_accuracy", result: "pass", basis: "đạt chuẩn" },
  { criterion: "tool_versions", result: "pass", basis: "đạt chuẩn" },
  { criterion: "outcome_and_level", result: "pass", basis: "đạt chuẩn" },
  { criterion: "lesson_flow", result: "pass", basis: "đạt chuẩn" },
  { criterion: "learnability", result: "pass", basis: "đạt chuẩn" },
  { criterion: "verification", result: "pass", basis: "đạt chuẩn" },
  { criterion: "diagrams", result: "pass", basis: "đạt chuẩn" },
  { criterion: "language", result: "pass", basis: "đạt chuẩn" },
  { criterion: "tone_and_flow", result: "pass", basis: "đạt chuẩn" },
];

function createFixture(targetDir, { l2Verdict = "pass", l2Cycles = 1 } = {}) {
  fs.mkdirSync(path.join(targetDir, "lessons"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "reviews"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "verification"), { recursive: true });

  fs.writeFileSync(
    path.join(targetDir, "brief.json"),
    JSON.stringify({
      slug: "fixture-course",
      title: "Khóa Thử Nghiệm",
      topic: "Kiến trúc hệ thống",
      audience: "Kỹ sư",
      level: "beginner",
    })
  );

  fs.writeFileSync(
    path.join(targetDir, "curriculum.json"),
    JSON.stringify({
      modules: [
        {
          module_id: "M1",
          title: "Module 1",
          description: "Mô tả module 1",
          lessons: [
            { lesson_id: "L1", title: "Bài 1 Đạt", type: "article" },
            { lesson_id: "L2", title: "Bài 2 Đánh Giá", type: "article" },
          ],
        },
      ],
    })
  );

  fs.writeFileSync(
    path.join(targetDir, "final_assignment.json"),
    JSON.stringify({
      title: "Bài tập cuối khóa",
      description: "Mô tả bài tập",
      instructions: "Hướng dẫn nộp bài",
      fields: ["github_url"],
    })
  );

  // L1: Luôn pass
  fs.writeFileSync(
    path.join(targetDir, "lessons", "L1.json"),
    JSON.stringify({
      lesson_id: "L1",
      title: "Bài 1 Đạt",
      short_description: "Mô tả bài 1",
      article: { description_markdown: "Nội dung bài học số 1 không chứa code." },
    })
  );
  fs.writeFileSync(path.join(targetDir, "verification", "L1.md"), "# Verification L1\nĐầy đủ tiêu chí.");
  fs.writeFileSync(
    path.join(targetDir, "reviews", "L1.json"),
    JSON.stringify({ verdict: "pass", checks: STANDARD_CHECKS, issues: [] })
  );

  // L2: Có thể pass hoặc revise ở vòng 3
  fs.writeFileSync(
    path.join(targetDir, "lessons", "L2.json"),
    JSON.stringify({
      lesson_id: "L2",
      title: "Bài 2 Đánh Giá",
      short_description: "Mô tả bài 2",
      article: { description_markdown: "Nội dung bài học số 2 cần kiểm duyệt." },
    })
  );
  fs.writeFileSync(path.join(targetDir, "verification", "L2.md"), "# Verification L2\nĐầy đủ tiêu chí.");

  if (l2Verdict === "pass") {
    fs.writeFileSync(
      path.join(targetDir, "reviews", "L2.json"),
      JSON.stringify({ verdict: "pass", checks: STANDARD_CHECKS, issues: [] })
    );
  } else {
    fs.writeFileSync(
      path.join(targetDir, "reviews", "L2.json"),
      JSON.stringify({
        verdict: l2Verdict,
        checks: STANDARD_CHECKS,
        issues: [{ category: "factual_accuracy", severity: "blocking", description: "Sai kiến thức kỹ thuật" }],
      })
    );
  }

  if (l2Cycles > 1) {
    const logs = [];
    for (let i = 0; i < l2Cycles; i++) {
      logs.push(JSON.stringify({ step: 6, lesson_id: "L2", event: "end" }));
    }
    fs.writeFileSync(path.join(targetDir, "run-log.jsonl"), logs.join("\n"));
  }
}

test("import-local: V-09 - tự nhận diện bài kẹt khi KHÔNG truyền cờ --stuck-lessons và giữ nguyên khi mọi bài pass", () => {
  // Case A: Fixture có 1 bài pass (L1) và 1 bài revise ở vòng 3 (L2) -> KHÔNG truyền --stuck-lessons
  const tmpStuck = fs.mkdtempSync(path.join(os.tmpdir(), "v09-stuck-"));
  try {
    createFixture(tmpStuck, { l2Verdict: "revise", l2Cycles: 3 });

    const outStuck = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpStuck, "--dry-run"],
      { encoding: "utf8" }
    );

    // Bài L2 kẹt: published = false
    assert.match(
      outStuck,
      /'L2','M1',\d+,'\{.*?\}'::jsonb,false\)/,
      "Bài L2 bị kẹt quá trần phải tự động có published = false"
    );

    // Bài L1 đạt: published = true
    assert.match(
      outStuck,
      /'L1','M1',\d+,'\{.*?\}'::jsonb,true\)/,
      "Bài L1 đạt phải có published = true"
    );

    // Khóa có is_updating: true trong data
    assert.match(
      outStuck,
      /"is_updating":\s*true/,
      "Khóa có bài kẹt phải có is_updating = true trong data"
    );

    // Khóa vẫn published = true do còn bài L1
    assert.match(
      outStuck,
      /INSERT INTO public\.courses \(.*?\) VALUES \('.*?','.*?',true,/,
      "Khóa còn bài không kẹt vẫn có published = true"
    );
  } finally {
    fs.rmSync(tmpStuck, { recursive: true, force: true });
  }

  // Case B: Fixture mọi bài pass -> SQL như cũ (không is_updating, mọi bài published = true)
  const tmpPass = fs.mkdtempSync(path.join(os.tmpdir(), "v09-pass-"));
  try {
    createFixture(tmpPass, { l2Verdict: "pass", l2Cycles: 1 });

    const outPass = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpPass, "--dry-run"],
      { encoding: "utf8" }
    );

    assert.match(
      outPass,
      /'L1','M1',\d+,'\{.*?\}'::jsonb,true\)/,
      "Khi mọi bài pass, L1 có published = true"
    );
    assert.match(
      outPass,
      /'L2','M1',\d+,'\{.*?\}'::jsonb,true\)/,
      "Khi mọi bài pass, L2 có published = true"
    );
    assert.doesNotMatch(
      outPass,
      /"is_updating":\s*true/,
      "Khi mọi bài pass, khóa không có is_updating"
    );
    assert.match(
      outPass,
      /INSERT INTO public\.courses \(.*?\) VALUES \('.*?','.*?',true,/,
      "Khóa mọi bài pass có published = true"
    );
  } finally {
    fs.rmSync(tmpPass, { recursive: true, force: true });
  }

  // Case C: Cờ --stuck-lessons nếu truyền thì cộng thêm vào danh sách bài kẹt
  const tmpUnion = fs.mkdtempSync(path.join(os.tmpdir(), "v09-union-"));
  try {
    createFixture(tmpUnion, { l2Verdict: "revise", l2Cycles: 3 });

    // L2 đã tự động kẹt; truyền thêm --stuck-lessons=L1 -> cả 2 bài đều kẹt -> courses.published = false
    const outUnion = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpUnion, "--dry-run", "--stuck-lessons=L1"],
      { encoding: "utf8" }
    );

    assert.match(
      outUnion,
      /'L1','M1',\d+,'\{.*?\}'::jsonb,false\)/,
      "L1 được cộng thêm qua cờ CLI nên có published = false"
    );
    assert.match(
      outUnion,
      /'L2','M1',\d+,'\{.*?\}'::jsonb,false\)/,
      "L2 tự động kẹt nên vẫn có published = false"
    );
    assert.match(
      outUnion,
      /INSERT INTO public\.courses \(.*?\) VALUES \('.*?','.*?',false,/,
      "Mọi bài đều kẹt thì courses.published phải là false"
    );
  } finally {
    fs.rmSync(tmpUnion, { recursive: true, force: true });
  }
});

test("import-local: V-12 - reviews/ có file JSON hỏng -> import thoát mã khác 0, không in SQL", () => {
  const tmpBadJson = fs.mkdtempSync(path.join(os.tmpdir(), "v12-bad-json-"));
  try {
    createFixture(tmpBadJson, { l2Verdict: "pass" });

    // Ghi đè file reviews/L2.json với JSON hỏng cú pháp
    fs.writeFileSync(path.join(tmpBadJson, "reviews", "L2.json"), '{"verdict": "pass", INVALID_SYNTAX');

    assert.throws(
      () => {
        execFileSync(
          "deno",
          ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpBadJson, "--dry-run"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        );
      },
      (err) => {
        assert.notEqual(err.status, 0);
        const stderr = (err.stderr ?? "").toString();
        const stdout = (err.stdout ?? "").toString();
        // Không in SQL
        assert.ok(!stdout.includes("INSERT INTO public.courses"));
        assert.ok(!stdout.includes("BEGIN;"));
        // Thông báo nêu nguyên nhân
        assert.ok(
          stderr.includes("lỗi cú pháp JSON") ||
            stderr.includes("không hợp lệ") ||
            stdout.includes("lỗi cú pháp JSON") ||
            stdout.includes("không hợp lệ")
        );
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpBadJson, { recursive: true, force: true });
  }
});

test("course-status: V-12 - lint script giả crash -> getCourseStatus ném lỗi kèm tên script", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v12-crash-course-"));
  const tmpFakeScripts = fs.mkdtempSync(path.join(os.tmpdir(), "v12-fake-scripts-"));
  try {
    createFixture(tmpDir, { l2Verdict: "pass" });

    // Tạo script lesson-lint.mjs giả lập crash (ném lỗi trước khi in bất kỳ dòng <id>: ...)
    fs.writeFileSync(
      path.join(tmpFakeScripts, "lesson-lint.mjs"),
      'console.error("SyntaxError: Unexpected token in runtime"); process.exit(2);'
    );
    // review-lint.mjs bình thường
    fs.writeFileSync(path.join(tmpFakeScripts, "review-lint.mjs"), "process.exit(0);");

    assert.throws(
      () => {
        getCourseStatus(tmpDir, { scriptsDir: tmpFakeScripts });
      },
      (err) => {
        assert.match(err.message, /lesson-lint\.mjs/);
        assert.match(err.message, /thất bại/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpFakeScripts, { recursive: true, force: true });
  }
});

test("import-local: V-12 - thư mục chưa có curriculum.json -> import dừng với thông báo rõ ràng", () => {
  const tmpNoCurr = fs.mkdtempSync(path.join(os.tmpdir(), "v12-no-curr-"));
  try {
    fs.writeFileSync(
      path.join(tmpNoCurr, "brief.json"),
      JSON.stringify({ slug: "no-curr", title: "Khóa thiếu curriculum" })
    );

    assert.throws(
      () => {
        execFileSync(
          "deno",
          ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpNoCurr, "--dry-run"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        );
      },
      (err) => {
        assert.notEqual(err.status, 0);
        const stderr = (err.stderr ?? "").toString();
        const stdout = (err.stdout ?? "").toString();
        assert.ok(!stdout.includes("INSERT INTO public.courses"));
        assert.ok(stderr.includes("curriculum.json") || stdout.includes("curriculum.json"));
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpNoCurr, { recursive: true, force: true });
  }
});

test("run-report: AC7 - mẫu run-report.md có đủ mục A6 và không chứa service key", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "report-test-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "reviews"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "verification"), { recursive: true });

    // Mock handoff
    fs.writeFileSync(
      path.join(tmpDir, "handoff.json"),
      JSON.stringify(
        {
          slug: "c-report-test",
          title: "Khóa Báo Cáo",
          path: "path-report-test",
          level: "beginner",
        },
        null,
        2
      )
    );

    // Mock curriculum
    fs.writeFileSync(
      path.join(tmpDir, "curriculum.json"),
      JSON.stringify(
        {
          modules: [
            {
              module_id: "M1",
              title: "Module 1",
              lessons: [
                { lesson_id: "L1-1", title: "Bài 1", type: "article" },
                { lesson_id: "L1-2", title: "Bài 2", type: "quiz" },
              ],
            },
          ],
        },
        null,
        2
      )
    );

    // Mock review (L1-2 bị kẹt)
    fs.writeFileSync(
      path.join(tmpDir, "reviews", "L1-2.json"),
      JSON.stringify(
        {
          verdict: "needs_fix",
          issues: [{ severity: "blocking", summary: "Câu hỏi quiz sai đáp án" }],
        },
        null,
        2
      )
    );

    // Mock verification (L1-1 có not_run)
    fs.writeFileSync(
      path.join(tmpDir, "verification", "L1-1.md"),
      `
# Verification L1-1
- not_run: Cần ví testnet có số dư thật
`
    );

    // Mock research có open_questions
    fs.writeFileSync(
      path.join(tmpDir, "research.json"),
      JSON.stringify(
        {
          open_questions: ["Cần kiểm chứng phí gas trung bình trên Sepolia"],
        },
        null,
        2
      )
    );

    // Sinh báo cáo
    const { reportPath, content } = generateRunReport(tmpDir, {
      rank: 1,
      gateResult: "ĐẠT (Qua cả 6 Gate)",
      importResult: {
        course_id: "test-uuid-1234",
        published: true,
        lessons_published: 1,
        lessons_stuck: 1,
        is_updating: true,
      },
    });

    assert.ok(fs.existsSync(reportPath), "Phải ghi file run-report.md");

    // Kiểm tra đầy đủ các mục A6:
    assert.ok(content.includes("Khóa đã chọn & Rank") && content.includes("Rank 1"));
    assert.ok(content.includes("path-report-test"));
    assert.ok(content.includes("ĐẠT (Qua cả 6 Gate)"));
    assert.ok(content.includes("M1: Module 1"));
    assert.ok(content.includes("L1-1"));
    assert.ok(content.includes("L1-2"));
    assert.ok(content.includes("L1-2") && content.includes("Câu hỏi quiz sai đáp án"));
    assert.ok(content.includes("not_run") && content.includes("Cần ví testnet"));
    assert.ok(content.includes("open_questions") && content.includes("Cần kiểm chứng phí gas"));
    assert.ok(content.includes("Course ID") && content.includes("test-uuid-1234"));
    assert.ok(content.includes("Số bài publish") && content.includes("1"));
    assert.ok(content.includes("Số bài không publish") && content.includes("1"));
    assert.ok(content.includes("is_updating") && content.includes("true"));

    // Tuyệt đối không chứa service key hoặc chuỗi giống key JWT
    assert.doesNotMatch(content, /eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/);
    assert.doesNotMatch(content, /service_role\s*key\s*[:=]/i);

    // Kiểm tra sanitizeReport ném lỗi khi cố ý nhét service key JWT
    const fakeKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuvwxyz1234567890";
    assert.throws(() => sanitizeReport(`Báo cáo có key: ${fakeKey}`), /Báo cáo vi phạm bảo mật/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

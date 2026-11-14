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
      short_description: "Mô tả bài học đầu tiên",
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
      short_description: "Mô tả bài học cần đánh giá",
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
      coordinatorModel: "claude-3-7-sonnet",
      defaultChildModelNotice: true,
      importResult: {
        course_id: "test-uuid-1234",
        published: true,
        lessons_published: 1,
        lessons_stuck: 1,
        is_updating: true,
      },
    });

    assert.ok(fs.existsSync(reportPath), "Phải ghi file run-report.md");

    // Kiểm tra đầy đủ các mục A6 & W1:
    assert.ok(content.includes("Khóa đã chọn & Rank") && content.includes("Rank 1"));
    assert.ok(content.includes("path-report-test"));
    assert.ok(content.includes("ĐẠT (Qua cả 6 Gate)"));
    assert.ok(content.includes("Model Coordinator") && content.includes("claude-3-7-sonnet"));
    assert.ok(content.includes("Ghi chú Model Child") && content.includes("toàn bộ child chạy bằng model mặc định"));
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

function createMultiModuleFixture(
  targetDir,
  {
    stuckLessonIds = [],
    l24Markdown = "Nội dung bài học tổng kết chuyên đề",
    l21Markdown = "Nội dung thực hành Part B",
  } = {}
) {
  fs.mkdirSync(path.join(targetDir, "lessons"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "reviews"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "verification"), { recursive: true });

  fs.writeFileSync(
    path.join(targetDir, "brief.json"),
    JSON.stringify({
      slug: "w2-fixture-course",
      title: "Khóa Kiểm Thử W2",
      topic: "Đồng bộ nhãn Part và Bài",
      audience: "Kỹ sư",
      level: "intermediate",
    })
  );

  fs.writeFileSync(
    path.join(targetDir, "curriculum.json"),
    JSON.stringify({
      outcomes: [
        { outcome_id: "O1", text: "Nắm vững Part B bài 2", check_lesson_ids: ["L2-2"] },
        { outcome_id: "O2", text: "Nắm vững Part B bài 1", check_lesson_ids: ["L2-1"] },
      ],
      modules: [
        {
          module_id: "M1",
          title: "Part A: Nhập môn",
          description: "Mô tả Part A",
          lessons: [
            { lesson_id: "L1-1", title: "Khái niệm mở đầu", type: "article" },
            { lesson_id: "L1-2", title: "Cơ sở thực thi", type: "article" },
          ],
        },
        {
          module_id: "M2",
          title: "Part B: Nâng cao",
          description: "Mô tả Part B",
          lessons: [
            { lesson_id: "L2-1", title: "Thực hành nền tảng", type: "article" },
            { lesson_id: "L2-2", title: "Kỹ thuật nâng cao", type: "article" },
            { lesson_id: "L2-3", title: "Tối ưu hóa hệ thống", type: "article" },
            { lesson_id: "L2-4", title: "Tổng kết chuyên đề", type: "article" },
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

  const lessons = [
    { id: "L1-1", title: "Khái niệm mở đầu", md: "Nội dung khái niệm mở đầu không có code." },
    { id: "L1-2", title: "Cơ sở thực thi", md: "Nội dung cơ sở thực thi không có code." },
    { id: "L2-1", title: "Thực hành nền tảng", md: l21Markdown },
    { id: "L2-2", title: "Kỹ thuật nâng cao", md: "Nội dung kỹ thuật nâng cao không có code." },
    { id: "L2-3", title: "Tối ưu hóa hệ thống", md: "Nội dung tối ưu hóa không có code." },
    { id: "L2-4", title: "Tổng kết chuyên đề", md: l24Markdown },
  ];

  for (const les of lessons) {
    fs.writeFileSync(
      path.join(targetDir, "lessons", `${les.id}.json`),
      JSON.stringify({
        lesson_id: les.id,
        title: les.title,
        short_description: `Mô tả bài học về ${les.title}`,
        article: { description_markdown: les.md },
      })
    );
    fs.writeFileSync(path.join(targetDir, "verification", `${les.id}.md`), `# Verification ${les.id}\nĐạt.`);

    const isStuck = stuckLessonIds.includes(les.id);
    if (isStuck) {
      fs.writeFileSync(
        path.join(targetDir, "reviews", `${les.id}.json`),
        JSON.stringify({
          verdict: "needs_fix",
          checks: STANDARD_CHECKS,
          issues: [
            {
              category: "factual_accuracy",
              severity: "blocking",
              summary: "Lỗi nghiêm trọng",
              location: "Đoạn 1",
              problem: "Sai kiến thức kỹ thuật",
              fix: "Sửa lại kiến thức",
            },
          ],
        })
      );
      const logs = [
        JSON.stringify({ step: 6, lesson_id: les.id, event: "end" }),
        JSON.stringify({ step: 6, lesson_id: les.id, event: "end" }),
        JSON.stringify({ step: 6, lesson_id: les.id, event: "end" }),
      ];
      fs.appendFileSync(path.join(targetDir, "run-log.jsonl"), logs.join("\n") + "\n");
    } else {
      fs.writeFileSync(
        path.join(targetDir, "reviews", `${les.id}.json`),
        JSON.stringify({ verdict: "pass", checks: STANDARD_CHECKS, issues: [] })
      );
    }
  }
}

test("import-local: W2 - Bài 2 Part B kẹt -> bài khác có 'Part B, Bài 3' đổi thành 'Part B, Bài 2'", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2-single-"));
  try {
    createMultiModuleFixture(tmpDir, {
      stuckLessonIds: ["L2-2"],
      l24Markdown: "Xem thêm tại Part B, Bài 3 để hiểu rõ chi tiết.",
    });

    const out = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpDir, "--dry-run"],
      { encoding: "utf8" }
    );

    // Bài L2-2 bị kẹt: published = false
    assert.match(out, /'L2-2','M2',\d+,'\{.*?\}'::jsonb,false\)/);
    // Bài L2-4 được publish và tham chiếu đã đổi thành "Part B, Bài 2"
    assert.ok(out.includes("Xem thêm tại Part B, Bài 2 để hiểu rõ chi tiết."));
    assert.ok(!out.includes("Part B, Bài 3"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("import-local: W2 - Dạng gộp 'Part B (Bài 1, Bài 3)' đổi thành 'Part B (Bài 1, Bài 2)'", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2-group-"));
  try {
    createMultiModuleFixture(tmpDir, {
      stuckLessonIds: ["L2-2"],
      l24Markdown: "Ôn lại kiến thức tại Part B (Bài 1, Bài 3) trước khi làm bài tập.",
    });

    const out = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpDir, "--dry-run"],
      { encoding: "utf8" }
    );

    assert.ok(out.includes("Part B (Bài 1, Bài 2)"));
    assert.ok(!out.includes("Part B (Bài 1, Bài 3)"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("import-local: W2 - Bài có 'Part B, Bài 2' (trỏ bài kẹt) -> bài đó cũng thành kẹt (published = false)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2-cascade-"));
  try {
    createMultiModuleFixture(tmpDir, {
      stuckLessonIds: ["L2-2"],
      l24Markdown: "Như đã chứng minh ở Part B, Bài 2, kết quả là hoàn toàn chính xác.",
    });

    const out = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpDir, "--dry-run"],
      { encoding: "utf8" }
    );

    // L2-2 kẹt do review
    assert.match(out, /'L2-2','M2',\d+,'\{.*?\}'::jsonb,false\)/);
    // L2-4 kẹt do lan truyền (tham chiếu tới L2-2)
    assert.match(out, /'L2-4','M2',\d+,'\{.*?\}'::jsonb,false\)/);
    // L2-1 và L2-3 không tham chiếu bài kẹt -> published = true
    assert.match(out, /'L2-1','M2',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.match(out, /'L2-3','M2',\d+,'\{.*?\}'::jsonb,true\)/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("import-local: W2 - Toàn bộ Part A kẹt -> nhãn 'Part B' trong bài publish đổi thành 'Part A'", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2-part-shift-"));
  try {
    createMultiModuleFixture(tmpDir, {
      stuckLessonIds: ["L1-1", "L1-2"],
      l21Markdown: "Chào mừng các bạn đến với Part B của khóa học.",
    });

    const out = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpDir, "--dry-run"],
      { encoding: "utf8" }
    );

    // Part A đều kẹt (published = false)
    assert.match(out, /'L1-1','M1',\d+,'\{.*?\}'::jsonb,false\)/);
    assert.match(out, /'L1-2','M1',\d+,'\{.*?\}'::jsonb,false\)/);

    // L2-1 được publish và Part B được đổi thành Part A
    assert.match(out, /'L2-1','M2',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.ok(out.includes("Chào mừng các bạn đến với Part A của khóa học."));

    // Tiêu đề module M2 trong course_sections cũng đổi thành "Part A: Nâng cao"
    assert.ok(out.includes("Part A: Nâng cao"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("import-local: W2 - Không bài kẹt -> SQL giống hệt trước, giữ nguyên nhãn gốc", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2-all-pass-"));
  try {
    createMultiModuleFixture(tmpDir, {
      stuckLessonIds: [],
      l24Markdown: "Tham khảo Part B (Bài 1, Bài 3) và Part B, Bài 3 trong Part B.",
    });

    const out = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpDir, "--dry-run"],
      { encoding: "utf8" }
    );

    // Mọi bài published = true
    assert.match(out, /'L1-1','M1',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.match(out, /'L1-2','M1',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.match(out, /'L2-1','M2',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.match(out, /'L2-2','M2',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.match(out, /'L2-3','M2',\d+,'\{.*?\}'::jsonb,true\)/);
    assert.match(out, /'L2-4','M2',\d+,'\{.*?\}'::jsonb,true\)/);

    // Không có cờ is_updating
    assert.doesNotMatch(out, /"is_updating":\s*true/);

    // SQL giữ nguyên vẹn nội dung
    assert.ok(out.includes("Tham khảo Part B (Bài 1, Bài 3) và Part B, Bài 3 trong Part B."));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("import-local & run-report: W2 - Outcome có check_lesson_ids toàn bài kẹt ghi nhận vào unverified_outcomes và report", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2-unverified-outcome-"));
  try {
    createMultiModuleFixture(tmpDir, {
      stuckLessonIds: ["L2-2"],
    });

    const out = execFileSync(
      "deno",
      ["run", "-A", "--no-config", IMPORT_SCRIPT, tmpDir, "--dry-run"],
      { encoding: "utf8" }
    );

    // Summary JSON có unverified_outcomes chứa O1
    const summaryMatch = out.match(/\{[\s\S]*?"dry_run":\s*true[\s\S]*?\n\}/);
    assert.ok(summaryMatch, "Phải xuất JSON summary");
    const summary = JSON.parse(summaryMatch[0]);
    assert.ok(Array.isArray(summary.unverified_outcomes));
    assert.equal(summary.unverified_outcomes.length, 1);
    assert.equal(summary.unverified_outcomes[0], "O1");

    // Sinh báo cáo run-report.md
    const { reportPath, content } = generateRunReport(tmpDir, {
      importResult: summary,
    });
    assert.ok(fs.existsSync(reportPath));
    assert.ok(content.includes("Mục tiêu học tập mất bài kiểm chứng (Unverified Outcomes)"));
    assert.ok(content.includes("O1"));
    assert.ok(content.includes("Nắm vững Part B bài 2"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Test suite cho E-05, E-06, E-07, E-08
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.resolve(__dirname, "../scripts");

function run(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
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

test("E-05: course-status chạy trên bản sao fixture course-a phân loại đúng các bài đạt và cần sửa", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-status-fixture-a-"));
  try {
    fs.cpSync(path.join(__dirname, "fixtures", "course-a"), tmpDir, { recursive: true });
    // Chỉnh L2-2 không còn lỗi mã-nội-bộ để trở thành bài đạt
    const l22Path = path.join(tmpDir, "lessons", "L2-2.json");
    const l22 = JSON.parse(fs.readFileSync(l22Path, "utf8"));
    l22.short_description = "Mô tả ngắn thực hành hợp lệ";
    l22.summary = "Tóm tắt thực hành hợp lệ";
    fs.writeFileSync(l22Path, JSON.stringify(l22));

    const res = run(`node ${path.join(scriptsDir, "course-status.mjs")} ${tmpDir} --json`);
    assert.equal(res.status, 0);

    const data = JSON.parse(res.stdout);
    assert.equal(data.summary.total, 6);
    assert.equal(data.summary.chưa_viết, 0);
    assert.equal(data.summary.đạt, 1);
    assert.equal(data.summary.cần_sửa, 5);

    const l22Result = data.lessons.find((l) => l.lesson_id === "L2-2");
    assert.ok(l22Result);
    assert.equal(l22Result.status, "đạt");
    assert.equal(l22Result.next_step, "Hoàn thành");

    const l11 = data.lessons.find((l) => l.lesson_id === "L1-1");
    assert.ok(l11);
    assert.equal(l11.status, "cần_sửa");
    assert.ok(l11.next_step.includes("Sửa lỗi"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("E-05: course-status trên fixture dở dang nhận diện đủ 5 trạng thái và trần vòng 3", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-status-fixture-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "lessons"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "reviews"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "verification"), { recursive: true });

    // curriculum với 5 bài
    const curriculum = {
      modules: [
        {
          module_id: "M1",
          title: "Module 1",
          lessons: [
            { lesson_id: "L1-1", title: "Bài chưa viết", type: "article" },
            { lesson_id: "L1-2", title: "Bài chờ kiểm chứng", type: "code_exercise" },
            { lesson_id: "L1-3", title: "Bài chờ review", type: "article" },
            { lesson_id: "L1-4", title: "Bài cần sửa", type: "article" },
            { lesson_id: "L1-5", title: "Bài đạt", type: "article" },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, "curriculum.json"), JSON.stringify(curriculum));

    // L1-1: không có file -> chưa_viết

    // L1-2: có lesson có code nhưng thiếu verification -> chờ_kiểm_chứng
    fs.writeFileSync(
      path.join(tmpDir, "lessons", "L1-2.json"),
      JSON.stringify({ lesson_id: "L1-2", title: "Bài chờ kiểm chứng", code: { starter_source: "fn main() {}" } })
    );

    // L1-3: có lesson, verification, không có lỗi lint, chưa có review -> chờ_review
    fs.writeFileSync(
      path.join(tmpDir, "lessons", "L1-3.json"),
      JSON.stringify({
        lesson_id: "L1-3",
        title: "Bài chờ review",
        article: { description_markdown: "Bạn hãy học bài này." },
      })
    );
    fs.writeFileSync(path.join(tmpDir, "verification", "L1-3.md"), "# Tự review\nĐầy đủ tiêu chí.");

    // L1-4: có review verdict needs_fix, và run-log ghi 3 chu kỳ -> cần_sửa và capped = true
    fs.writeFileSync(
      path.join(tmpDir, "lessons", "L1-4.json"),
      JSON.stringify({
        lesson_id: "L1-4",
        title: "Bài cần sửa",
        article: { description_markdown: "Bạn hãy làm bài này." },
      })
    );
    fs.writeFileSync(path.join(tmpDir, "verification", "L1-4.md"), "# Tự review\nĐầy đủ tiêu chí.");
    fs.writeFileSync(
      path.join(tmpDir, "reviews", "L1-4.json"),
      JSON.stringify({ verdict: "needs_fix", issues: [{ category: "factual_accuracy", severity: "blocking", description: "Sai thông tin" }] })
    );
    const runLogs = [
      JSON.stringify({ step: 6, lesson_id: "L1-4", event: "end" }),
      JSON.stringify({ step: 6, lesson_id: "L1-4", event: "end" }),
      JSON.stringify({ step: 6, lesson_id: "L1-4", event: "end" }),
    ].join("\n");
    fs.writeFileSync(path.join(tmpDir, "run-log.jsonl"), runLogs);

    // L1-5: có review verdict pass, không lỗi lint -> đạt
    fs.writeFileSync(
      path.join(tmpDir, "lessons", "L1-5.json"),
      JSON.stringify({
        lesson_id: "L1-5",
        title: "Bài đạt",
        article: { description_markdown: "Bạn hãy hoàn thành bài này." },
      })
    );
    fs.writeFileSync(path.join(tmpDir, "verification", "L1-5.md"), "# Tự review\nĐầy đủ tiêu chí.");
    fs.writeFileSync(
      path.join(tmpDir, "reviews", "L1-5.json"),
      JSON.stringify({
        verdict: "pass",
        checks: [
          { criterion: "factual_accuracy", result: "pass", basis: "đối chiếu nguồn" },
          { criterion: "tool_versions", result: "pass", basis: "khớp tool" },
          { criterion: "outcome_and_level", result: "pass", basis: "khớp outcome" },
          { criterion: "lesson_flow", result: "pass", basis: "luồng hợp lý" },
          { criterion: "learnability", result: "pass", basis: "dễ tiếp thu" },
          { criterion: "verification", result: "pass", basis: "đã chạy test" },
          { criterion: "diagrams", result: "pass", basis: "không có sơ đồ" },
          { criterion: "language", result: "pass", basis: "tiếng Việt chuẩn" },
          { criterion: "tone_and_flow", result: "pass", basis: "giọng điệu phù hợp" },
        ],
        issues: [],
      })
    );

    const res = run(`node ${path.join(scriptsDir, "course-status.mjs")} ${tmpDir} --json`);
    assert.equal(res.status, 0);

    const data = JSON.parse(res.stdout);
    assert.equal(data.summary.total, 5);
    assert.equal(data.summary.chưa_viết, 1);
    assert.equal(data.summary.chờ_kiểm_chứng, 1);
    assert.equal(data.summary.chờ_review, 1);
    assert.equal(data.summary.cần_sửa, 1);
    assert.equal(data.summary.đạt, 1);
    assert.equal(data.summary.quá_trần, 1);

    const l11 = data.lessons.find((l) => l.lesson_id === "L1-1");
    assert.equal(l11.status, "chưa_viết");

    const l12 = data.lessons.find((l) => l.lesson_id === "L1-2");
    assert.equal(l12.status, "chờ_kiểm_chứng");

    const l13 = data.lessons.find((l) => l.lesson_id === "L1-3");
    assert.equal(l13.status, "chờ_review");

    const l14 = data.lessons.find((l) => l.lesson_id === "L1-4");
    assert.equal(l14.status, "cần_sửa");
    assert.equal(l14.capped, true);
    assert.ok(l14.next_step.includes("quá trần 3 vòng"));

    const l15 = data.lessons.find((l) => l.lesson_id === "L1-5");
    assert.equal(l15.status, "đạt");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("E-06: lesson-lint kiểm tra chuỗi frame.md (bài trích sai một ký tự -> lỗi)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-frame-lint-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "lessons"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "frame.md"),
      'Display: "dòng {line}: thiếu dấu ="; "không phải số nguyên"'
    );

    // Bài 1: trích sai 1 ký tự ("==" thay vì "=")
    const badLesson = {
      lesson_id: "L1-1",
      title: "Bài sai khung",
      article: {
        description_markdown: 'Đoạn code in: ```rust\nprintln!("dòng {line}: thiếu dấu ==");\n```',
      },
    };
    fs.writeFileSync(path.join(tmpDir, "lessons", "L1-1.json"), JSON.stringify(badLesson));

    const resBad = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
    assert.equal(resBad.status, 1);
    assert.ok(resBad.stdout.includes("frame-chuỗi"));
    assert.ok(resBad.stdout.includes("dòng {line}: thiếu dấu =="));

    // Bài 2: sửa lại đúng nguyên văn
    const goodLesson = {
      lesson_id: "L1-1",
      title: "Bài đúng khung",
      article: {
        description_markdown: 'Đoạn code in: ```rust\nprintln!("dòng {line}: thiếu dấu =");\n```',
      },
    };
    fs.writeFileSync(path.join(tmpDir, "lessons", "L1-1.json"), JSON.stringify(goodLesson));
    fs.mkdirSync(path.join(tmpDir, "verification"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "verification", "L1-1.md"), "# Tự review");

    const resGood = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir} L1-1`);
    assert.equal(resGood.status, 0);
    assert.ok(resGood.stdout.includes("ok: 1 lesson"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("F-01: import-local.ts chạy --dry-run trên bản sao hai khóa không kết nối DB, khớp chính xác counts và SQL hợp lệ", () => {
  const expected = {
    "course-a": { sections: 2, lessons: 6, questions: 2, images: 0, course_id: "254c524c-ceaf-4bde-abd4-85799e248e7b" },
    "course-b": { sections: 1, lessons: 3, questions: 1, images: 0, course_id: "8861a7bf-8642-4874-bc72-9542f1a24cda" },
  };

  for (const slug of ["course-a", "course-b"]) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-import-"));
    try {
      fs.cpSync(path.join(__dirname, "fixtures", slug), tmpDir, { recursive: true });
      const res = run(`deno run -A --no-config ${path.join(scriptsDir, "import-local.ts")} ${tmpDir} --dry-run`);
      assert.equal(res.status, 0, `import-local.ts thất bại trên ${slug}: ${res.stderr}`);

      // Phải có JSON summary
      const match = res.stdout.match(/\{[\s\S]*?"dry_run":\s*true[\s\S]*?\}/);
      assert.ok(match, "Phải in ra JSON summary chứa dry_run: true");
      const summary = JSON.parse(match[0]);
      const exp = expected[slug];
      assert.equal(summary.sections, exp.sections, `${slug}: sections`);
      assert.equal(summary.lessons, exp.lessons, `${slug}: lessons`);
      assert.equal(summary.questions, exp.questions, `${slug}: questions`);
      assert.equal(summary.images, exp.images, `${slug}: images`);
      assert.equal(summary.course_id, exp.course_id, `${slug}: course_id`);

      // Kiểm tra SQL cấu trúc không có DELETE
      assert.ok(res.stdout.includes("BEGIN;"));
      assert.ok(res.stdout.includes("INSERT INTO public.courses"));
      assert.ok(res.stdout.includes("INSERT INTO public.course_sections"));
      assert.ok(res.stdout.includes("INSERT INTO public.course_lessons"));
      assert.ok(res.stdout.includes("COMMIT;"));
      assert.ok(!res.stdout.includes("DELETE FROM public.courses"), "Mặc định không được DELETE dữ liệu cũ");
      assert.ok(!res.stdout.includes("DELETE FROM public.enrollments"), "Mặc định không được DELETE ghi danh");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
});

test("F-01: bài cố ý sai dạng trong fixture bị import-local chặn với thông báo nêu lesson_id", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-import-invalid-"));
  try {
    fs.cpSync(path.join(__dirname, "fixtures", "course-a"), tmpDir, { recursive: true });
    // Cố ý sửa bài L1-1 thành định dạng sai (invalid lesson_format)
    const l11Path = path.join(tmpDir, "lessons", "L1-1.json");
    const l11 = JSON.parse(fs.readFileSync(l11Path, "utf8"));
    // Trong curriculum L1-1 là article, ta đổi dữ liệu bên trong để validateLesson phát hiện lỗi
    delete l11.title; // Thiếu trường title bắt buộc
    fs.writeFileSync(l11Path, JSON.stringify(l11));

    const res = run(`deno run -A --no-config ${path.join(scriptsDir, "import-local.ts")} ${tmpDir} --dry-run`);
    assert.equal(res.status, 1);
    const combined = res.stdout + "\n" + res.stderr;
    assert.ok(combined.includes("L1-1"), "Thông báo lỗi phải nêu rõ lesson_id: " + combined);
    assert.ok(combined.includes("validateLesson"), "Thông báo lỗi phải nêu validateLesson: " + combined);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("E-07: lesson-context bổ sung prev_lesson_path khi file bài trước tồn tại", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-context-prev-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "lessons"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "curriculum.json"),
      JSON.stringify({
        modules: [
          {
            module_id: "M1",
            title: "Mod 1",
            lessons: [
              { lesson_id: "L1-1", title: "Bài 1", type: "article" },
              { lesson_id: "L1-2", title: "Bài 2", type: "article" },
            ],
          },
        ],
      })
    );

    // Khi L1-1.json chưa tồn tại -> không có prev_lesson_path
    let res = run(`node ${path.join(scriptsDir, "lesson-context.mjs")} ${tmpDir} L1-2`);
    assert.equal(res.status, 0);
    let data = JSON.parse(res.stdout);
    assert.equal(data.prev_lesson?.lesson_id, "L1-1");
    assert.equal(data.prev_lesson_path, undefined);

    // Khi L1-1.json tồn tại -> có prev_lesson_path
    fs.writeFileSync(path.join(tmpDir, "lessons", "L1-1.json"), JSON.stringify({ title: "Bài 1" }));
    res = run(`node ${path.join(scriptsDir, "lesson-context.mjs")} ${tmpDir} L1-2`);
    assert.equal(res.status, 0);
    data = JSON.parse(res.stdout);
    assert.equal(data.prev_lesson_path, "lessons/L1-1.json");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("E-08: lesson-lint báo lỗi rõ ràng và thoát 1 khi thư mục lessons/ không tồn tại", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-missing-lessons-"));
  try {
    const res = run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${tmpDir}`);
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes("không tìm thấy thư mục lessons tại"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

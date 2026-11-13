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

test("AC3.3 / W-01: lesson-context chạy cho mọi lesson, JSON hợp lệ; L2-1 có đúng 8 key points; mọi bài có sources đều có key points; open_questions có mặt", () => {
  const runs = [
    { dir: ".course-runs/rust-error-handling", isRust: true },
    { dir: ".course-runs/smart-contract-reading-before-interacting", isRust: false },
  ];

  for (const { dir, isRust } of runs) {
    const curr = JSON.parse(fs.readFileSync(path.join(rootDir, dir, "curriculum.json"), "utf8"));
    const resSize = fs.statSync(path.join(rootDir, dir, "research.json")).size;
    const currSize = fs.statSync(path.join(rootDir, dir, "curriculum.json")).size;
    const totalBase = resSize + currSize;

    let totalCtxSize = 0;
    let count = 0;

    for (const m of curr.modules) {
      for (const l of m.lessons) {
        const res = run(`node ${path.join(scriptsDir, "lesson-context.mjs")} ${dir} ${l.lesson_id}`);
        assert.equal(res.status, 0, `Lỗi khi chạy lesson-context cho ${l.lesson_id} tại ${dir}`);

        const ctx = JSON.parse(res.stdout);
        assert.ok(ctx.lesson, `Lesson ${l.lesson_id} thiếu trường lesson`);
        assert.ok(ctx.module, `Lesson ${l.lesson_id} thiếu trường module`);
        assert.ok(Array.isArray(ctx.outcomes), `Lesson ${l.lesson_id} outcomes không phải mảng`);
        assert.ok(ctx.research, `Lesson ${l.lesson_id} thiếu research`);
        assert.ok(Array.isArray(ctx.research.open_questions), `Lesson ${l.lesson_id} thiếu open_questions`);
        assert.ok(Array.isArray(ctx.research.prerequisites), `Lesson ${l.lesson_id} thiếu prerequisites`);

        let kpCount = 0;
        for (const t of ctx.research.topics ?? []) {
          kpCount += (t.key_points ?? []).length;
        }

        if (l.source_ids?.length > 0) {
          assert.ok(
            kpCount >= 1,
            `Lesson ${l.lesson_id} tại ${dir} có source_ids nhưng không có key point nào`
          );
        }

        if (isRust && l.lesson_id === "L2-1") {
          assert.equal(kpCount, 8, `L2-1 trên khóa rust phải có đúng 8 key points, thực tế: ${kpCount}`);
        }

        const sz = Buffer.byteLength(res.stdout, "utf8");
        totalCtxSize += sz;
        count++;
      }
    }

    const avgSize = Math.round(totalCtxSize / count);
    const ratio = (avgSize / totalBase) * 100;
    // Ghi lại kích thước trung bình mới so với curriculum.json + research.json
    assert.ok(
      ratio < 30,
      `Kích thước trung bình ${avgSize} (${ratio.toFixed(2)}%) vượt quá 30% của ${totalBase}`
    );
  }
});

test("AC3.4: test run-log.mjs: hai lần gọi start/end tạo hai dòng JSON hợp lệ có timestamp tăng dần", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-log-test-"));

  // Lần 1: start
  const res1 = run(`node ${path.join(scriptsDir, "run-log.mjs")} ${tmpDir} 5 L1-1 lesson sonnet start`);
  assert.equal(res1.status, 0);

  // Đợi 20ms để timestamp tăng
  await new Promise((r) => setTimeout(r, 20));

  // Lần 2: end
  const res2 = run(`node ${path.join(scriptsDir, "run-log.mjs")} ${tmpDir} 5 L1-1 lesson sonnet end ok`);
  assert.equal(res2.status, 0);

  const logFile = path.join(tmpDir, "run-log.jsonl");
  assert.ok(fs.existsSync(logFile), "run-log.jsonl không tồn tại");

  const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);

  const entry1 = JSON.parse(lines[0]);
  const entry2 = JSON.parse(lines[1]);

  assert.equal(entry1.step, 5);
  assert.equal(entry1.lesson_id, "L1-1");
  assert.equal(entry1.action, "start");
  assert.equal(entry1.result, null);

  assert.equal(entry2.step, 5);
  assert.equal(entry2.lesson_id, "L1-1");
  assert.equal(entry2.action, "end");
  assert.equal(entry2.result, "ok");

  const time1 = new Date(entry1.timestamp).getTime();
  const time2 = new Date(entry2.timestamp).getTime();
  assert.ok(time2 >= time1, `Timestamp không tăng dần: ${entry1.timestamp} -> ${entry2.timestamp}`);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("AC3.5 / W-05: grep trong course-author/** không còn tham chiếu roles/05-lesson.md hay roles/06-lesson-review.md đơn", () => {
  function walk(d) {
    let files = [];
    for (const f of fs.readdirSync(d)) {
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
      else files.push(full);
    }
    return files;
  }

  const allFiles = walk(path.join(rootDir, ".claude/skills/course-author")).filter(
    (f) => !f.includes(path.sep + "test" + path.sep)
  );
  const occurrences = [];

  for (const f of allFiles) {
    const content = fs.readFileSync(f, "utf8");
    const lines = content.split("\n");
    lines.forEach((l, idx) => {
      if (l.includes("roles/05-lesson.md") || l.includes("roles/06-lesson-review.md")) {
        occurrences.push({ file: path.relative(rootDir, f), line: idx + 1, text: l.trim() });
      }
    });
  }

  // W-05: Dòng 89 của SKILL.md đã được cập nhật sang roles/05-lesson/video.md; không còn bất kỳ tham chiếu đơn nào
  assert.equal(
    occurrences.length,
    0,
    `Vẫn còn các tham chiếu cũ: ${JSON.stringify(occurrences, null, 2)}`
  );
});

test("W-02: mỗi dòng > 25 ký tự của 2 file gốc xuất hiện nguyên văn trong ít nhất một file mới (trừ các ngoại lệ hợp lệ)", () => {
  const orig05Path = path.join(rootDir, ".claude/skills/course-author/test/orig_05.md");
  const orig06Path = path.join(rootDir, ".claude/skills/course-author/test/orig_06.md");
  assert.ok(fs.existsSync(orig05Path), "Thiếu orig_05.md");
  assert.ok(fs.existsSync(orig06Path), "Thiếu orig_06.md");

  const orig05 = fs.readFileSync(orig05Path, "utf8").split("\n");
  const orig06 = fs.readFileSync(orig06Path, "utf8").split("\n");

  const newFiles = [
    ...fs.readdirSync(path.join(rootDir, ".claude/skills/course-author/roles/05-lesson")).map(f => path.join(rootDir, ".claude/skills/course-author/roles/05-lesson", f)),
    ...fs.readdirSync(path.join(rootDir, ".claude/skills/course-author/roles/06-lesson-review")).map(f => path.join(rootDir, ".claude/skills/course-author/roles/06-lesson-review", f)),
  ];

  const newContents = newFiles.map(f => fs.readFileSync(f, "utf8")).join("\n");

  const allowedExceptions05 = new Set([
    // L91 & L95: Đổi đường dẫn roles/06-lesson-review.md sang thư mục mới
    "Trước khi báo hoàn tất, tự review bài như một reviewer độc lập, theo đúng bảng tiêu chí và danh sách luôn-`blocking` trong `roles/06-lesson-review.md`. Không giao bài chưa qua bước này.",
    "3. Duyệt từng tiêu chí trong bảng của `roles/06-lesson-review.md` và từng mục luôn-`blocking`. Chỗ nào vi phạm thì sửa bài, không ghi chú để reviewer bắt.",
  ]);

  const allowedExceptions06 = new Set([
    // L31: Đổi đường dẫn sang roles/05-lesson/ và quy tắc phân loại minor của Gói 1
    "**Phân loại.** Mọi vi phạm một quy tắc viết bằng chữ trong `principles.md`, `platform.md`, `roles/05-lesson.md` hoặc `frame.md` là `blocking`, bất kể category (chọn category đúng nhất, kể cả `style_or_wording`, `insufficient_description`, `other`). `minor` chỉ dành cho gợi ý không vi phạm quy tắc nào và không làm người học hiểu sai, làm sai hay đọc sai (ví dụ chọn từ hay hơn). Nghi ngờ giữa hai mức thì chọn `blocking`.",
    // L51: Gói 1 sửa quy tắc unverified ở pass cho phát biểu phụ
    "- Phát biểu cốt lõi chưa đủ nguồn để xác minh: ghi `unverified` trong `checks`, tạo issue `wrong_source`, `blocking`, nêu phát biểu, bằng chứng còn thiếu và yêu cầu bổ sung research; không khẳng định phát biểu sai chỉ vì thiếu nguồn. Phát biểu phụ thiếu nguồn: ghi `unverified`, yêu cầu bỏ hoặc bổ sung nguồn, không tự nâng thành lỗi thực tế. Khi nguồn đã đọc chứng minh sai, dùng `factual_inaccuracy`, `blocking`.",
    // L67: Gói 1 sửa định nghĩa verdict pass không có unverified và không có issue 5 criteria cốt lõi
    "`verdict` là `pass` khi không có issue blocking hợp lệ.",
  ]);

  const missing05 = [];
  for (let i = 0; i < orig05.length; i++) {
    const line = orig05[i].trim();
    if (line.length <= 25) continue;
    if (allowedExceptions05.has(line)) continue;
    if (!newContents.includes(line)) {
      missing05.push({ line: i + 1, text: line });
    }
  }

  const missing06 = [];
  for (let i = 0; i < orig06.length; i++) {
    const line = orig06[i].trim();
    if (line.length <= 25) continue;
    if (allowedExceptions06.has(line)) continue;
    if (!newContents.includes(line)) {
      missing06.push({ line: i + 1, text: line });
    }
  }

  assert.equal(missing05.length, 0, `Các dòng thiếu trong 05: ${JSON.stringify(missing05, null, 2)}`);
  assert.equal(missing06.length, 0, `Các dòng thiếu trong 06: ${JSON.stringify(missing06, null, 2)}`);
});

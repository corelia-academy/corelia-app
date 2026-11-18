// Bước practice: action ngắn + snippet {language, code} dựng thành code fence khi import.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.resolve(__dirname, "../scripts");

function run(cmd) {
  try {
    return { status: 0, stdout: execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }), stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

// Bản sao course-a với bước p1 của L2-2 được sửa bởi `mutate`.
function withStep(mutate, fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "author-practice-snippet-"));
  try {
    fs.cpSync(path.join(__dirname, "fixtures", "course-a"), tmpDir, { recursive: true });
    const p = path.join(tmpDir, "lessons", "L2-2.json");
    const lesson = JSON.parse(fs.readFileSync(p, "utf8"));
    mutate(lesson.practice.checklist_items[0]);
    fs.writeFileSync(p, JSON.stringify(lesson));
    return fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const lint = (dir) => run(`node ${path.join(scriptsDir, "lesson-lint.mjs")} ${dir} L2-2`);
// Dry-run in markdown trong chuỗi JSON nên mỗi xuống dòng hiện là ký tự "\" rồi "n".
const sqlNl = (s) => s.replaceAll("\n", "\\n");
const practiceLines = (res) => (res.stdout + res.stderr).split("\n").filter((l) => l.includes(": practice:"));

test("practice-snippet: action dài hơn 300 ký tự bị lint báo", () => {
  withStep((s) => { s.action = "Chạy lệnh kiểm tra môi trường " + "x".repeat(300); }, (dir) => {
    assert.ok(practiceLines(lint(dir)).some((l) => l.includes("p1: action") && l.includes("> 300")));
  });
});

test("practice-snippet: action đúng 300 ký tự không bị báo độ dài", () => {
  withStep((s) => { s.action = "a".repeat(300); }, (dir) => {
    assert.ok(!practiceLines(lint(dir)).some((l) => l.includes("p1: action")));
  });
});

test("practice-snippet: action chứa code fence bị lint báo", () => {
  withStep((s) => { s.action = "Chạy ```select 1```"; }, (dir) => {
    assert.ok(practiceLines(lint(dir)).some((l) => l.includes("action chứa code fence")));
  });
});

test("practice-snippet: snippet thiếu language hoặc code rỗng bị lint báo; snippet hợp lệ thì không", () => {
  for (const bad of [{ code: "select 1;" }, { language: "sql", code: "  " }, { language: "", code: "x" }, "select 1;"]) {
    withStep((s) => { s.snippet = bad; }, (dir) => {
      assert.ok(practiceLines(lint(dir)).some((l) => l.includes("snippet phải có")), JSON.stringify(bad));
    });
  }
  withStep((s) => { s.snippet = { language: "sql", code: "select 1;\nselect 2;" }; }, (dir) => {
    assert.deepEqual(practiceLines(lint(dir)), []);
  });
});

test("practice-snippet: import-local dựng snippet thành code fence ngay sau Làm, trước Bạn sẽ thấy", () => {
  withStep((s) => { s.snippet = { language: "sql", code: "select 1;\nselect 2;\n" }; }, (dir) => {
    const res = run(`deno run -A --no-config ${path.join(scriptsDir, "import-local.ts")} ${dir} --dry-run`);
    assert.equal(res.status, 0, res.stderr);
    const out = res.stdout;
    const i = out.indexOf(sqlNl("```sql\nselect 1;\nselect 2;\n```"));
    assert.ok(i > -1, "thiếu code fence sql");
    assert.ok(out.indexOf("**Làm:**") < i && i < out.indexOf("**Bạn sẽ thấy:**"));
  });
});

test("practice-snippet: code chứa ``` thì fence ngoài dài hơn", () => {
  withStep((s) => { s.snippet = { language: "markdown", code: "```js\nx\n```" }; }, (dir) => {
    const res = run(`deno run -A --no-config ${path.join(scriptsDir, "import-local.ts")} ${dir} --dry-run`);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes(sqlNl("````markdown\n```js\nx\n```\n````")));
  });
});

test("practice-snippet: import-local chặn snippet sai dạng và nêu lesson_id", () => {
  withStep((s) => { s.snippet = { language: "sql" }; }, (dir) => {
    const res = run(`deno run -A --no-config ${path.join(scriptsDir, "import-local.ts")} ${dir} --dry-run`);
    assert.notEqual(res.status, 0);
    assert.ok((res.stdout + res.stderr).includes("L2-2: bước 1: snippet"));
  });
});

test("practice-snippet: bước không có snippet cho markdown như cũ", () => {
  withStep(() => {}, (dir) => {
    const res = run(`deno run -A --no-config ${path.join(scriptsDir, "import-local.ts")} ${dir} --dry-run`);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(res.stdout.includes("**Làm:** Chạy lệnh kiểm tra môi trường"));
    assert.ok(!res.stdout.includes("```sql"));
  });
});

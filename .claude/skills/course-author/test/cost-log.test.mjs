import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { summarizeRunLog, renderCostSection } from "../scripts/cost-lib.mjs";

const scriptsDir = path.resolve(".claude/skills/course-author/scripts");
const runLog = (dir, ...args) => spawnSync("node", [path.join(scriptsDir, "run-log.mjs"), dir, ...args], { encoding: "utf8" });

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cost-log-"));
}

test("run-log: end ghi số đo thật; thiếu cờ thì không có trường đó", () => {
  const dir = tmp();
  assert.equal(runLog(dir, "5", "L1-1", "lesson", "haiku", "start").status, 0);
  assert.equal(runLog(dir, "5", "L1-1", "lesson", "haiku", "end", "ok", "--tokens", "1200", "--tool-uses", "7", "--duration-ms", "4500").status, 0);
  assert.equal(runLog(dir, "6", "L1-1", "review", "sonnet", "start").status, 0);
  assert.equal(runLog(dir, "6", "L1-1", "review", "sonnet", "end", "ok").status, 0);
  const lines = fs.readFileSync(path.join(dir, "run-log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[1].tokens, 1200);
  assert.equal(lines[1].tool_uses, 7);
  assert.equal(lines[1].duration_ms, 4500);
  assert.ok(!("tokens" in lines[3]), "end không có cờ thì không ghi tokens");
});

test("run-log: cờ đo chỉ hợp lệ với end, giá trị phải là số nguyên không âm", () => {
  const dir = tmp();
  assert.notEqual(runLog(dir, "5", "L1-1", "lesson", "haiku", "start", "--tokens", "10").status, 0);
  assert.notEqual(runLog(dir, "5", "L1-1", "lesson", "haiku", "end", "ok", "--tokens", "abc").status, 0);
  assert.notEqual(runLog(dir, "5", "L1-1", "lesson", "haiku", "end", "ok", "--tokens", "-3").status, 0);
  assert.ok(!fs.existsSync(path.join(dir, "run-log.jsonl")), "lệnh lỗi không được ghi dòng log");
});

test("cost-lib: cộng theo bước và model, đếm lượt thiếu số, chạy lại và start chưa end", () => {
  const dir = tmp();
  const base = Date.parse("2026-11-17T00:00:00Z");
  const e = (offsetMs, step, lesson, role, model, action, extra = {}) =>
    JSON.stringify({ timestamp: new Date(base + offsetMs).toISOString(), step, lesson_id: lesson, role, model, action, result: action === "end" ? "ok" : null, ...extra });
  const rows = [
    e(0, 5, "L1", "lesson", "haiku", "start"),
    e(2000, 5, "L1", "lesson", "haiku", "end", { tokens: 1000, tool_uses: 4, duration_ms: 1800 }),
    e(3000, 5, "L2", "lesson", "haiku", "start"),
    e(8000, 5, "L2", "lesson", "haiku", "end", { result: "needs_fix" }),
    e(9000, 7, null, "course", "sonnet", "start"),
  ];
  fs.writeFileSync(path.join(dir, "run-log.jsonl"), rows.join("\n") + "\nkhông-phải-json\n");
  const s = summarizeRunLog(dir);
  assert.equal(s.rows.length, 1);
  const r = s.rows[0];
  assert.equal(r.calls, 2);
  assert.equal(r.measured_calls, 1);
  assert.equal(r.tokens, 1000);
  assert.equal(r.tool_uses, 4);
  assert.equal(r.duration_ms, 1800 + 5000, "lượt thiếu cờ dùng thời gian start-end làm thời gian đo");
  assert.equal(r.retries, 1);
  assert.equal(s.open_calls, 1);
  const text = renderCostSection(s).join("\n");
  assert.ok(text.includes("1/2"), "hiển thị độ phủ số token");
  assert.ok(text.includes("chưa có `end`"));
});

test("cost-lib: không có run-log thì báo chưa có dữ liệu", () => {
  const dir = tmp();
  assert.deepEqual(summarizeRunLog(dir).rows, []);
  assert.ok(renderCostSection(summarizeRunLog(dir))[0].includes("Chưa có"));
});

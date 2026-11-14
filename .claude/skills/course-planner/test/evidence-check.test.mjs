// .claude/skills/course-planner/test/evidence-check.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { checkUrls } from "../scripts/evidence-check.mjs";

test("evidence-check: AC5 - kiểm tra 200 pass, redirect tới 200 pass, 404 và 403 bị báo kèm file và trường", async () => {
  const items = [
    { url: "https://example.com/ok", file: "shortlists/sl.json", field: "shortlist[0].why_now.urls[0]" },
    { url: "https://example.com/redirect-to-200", file: "shortlists/sl.json", field: "shortlist[0].alternatives[0].url" },
    { url: "https://example.com/not-found", file: "shortlists/sl.json", field: "shortlist[1].alternatives[0].url" },
    { url: "https://example.com/forbidden", file: "evaluations/ev.json", field: "sources[0].url" }
  ];

  // Mock fetchFn
  const mockFetch = async (url) => {
    if (url === "https://example.com/ok") {
      return { status: 200, ok: true };
    }
    if (url === "https://example.com/redirect-to-200") {
      // Khi follow redirect và đích đến là 200
      return { status: 200, ok: true };
    }
    if (url === "https://example.com/not-found") {
      return { status: 404, ok: false };
    }
    if (url === "https://example.com/forbidden") {
      return { status: 403, ok: false };
    }
    return { status: 500, ok: false };
  };

  const { results, errors } = await checkUrls(items, { fetchFn: mockFetch });

  assert.strictEqual(results.length, 4);
  assert.strictEqual(errors.length, 2, "Phải bắt đúng 2 lỗi 404 và 403");

  const err404 = errors.find((e) => e.status === 404);
  assert.ok(err404);
  assert.strictEqual(err404.url, "https://example.com/not-found");
  assert.strictEqual(err404.file, "shortlists/sl.json");
  assert.strictEqual(err404.field, "shortlist[1].alternatives[0].url");

  const err403 = errors.find((e) => e.status === 403);
  assert.ok(err403);
  assert.strictEqual(err403.url, "https://example.com/forbidden");
  assert.strictEqual(err403.file, "evaluations/ev.json");
  assert.strictEqual(err403.field, "sources[0].url");

  // Kiểm tra trường hợp tất cả URL đều 200
  const allOkItems = [
    { url: "https://example.com/ok", file: "f1", field: "fld1" },
    { url: "https://example.com/redirect-to-200", file: "f2", field: "fld2" }
  ];
  const allOkRes = await checkUrls(allOkItems, { fetchFn: mockFetch });
  assert.strictEqual(allOkRes.errors.length, 0, "Toàn bộ 200 phải không có lỗi");
});

test("evidence-check: P-09 - request quá thời gian timeout bị báo lỗi", async () => {
  const hangingFetch = (_url, { signal } = {}) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ status: 200, ok: true });
      }, 500);

      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason || new Error("Aborted"));
        });
      }
    });

  const items = [
    { url: "https://example.com/hanging", file: "f.json", field: "field1" }
  ];

  const res = await checkUrls(items, { fetchFn: hangingFetch, timeoutMs: 50 });
  assert.strictEqual(res.errors.length, 1, "Request quá thời gian phải bị báo lỗi");
  assert.match(res.errors[0].error, /Timeout/);
});

test("evidence-check: P-09 - file JSON hỏng báo lỗi và thoát mã khác 0", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ev-check-corrupt-"));
  try {
    const corruptFile = path.join(tmpDir, "corrupt.json");
    fs.writeFileSync(corruptFile, "{ malformed json: true, ");

    const scriptPath = path.resolve(".claude/skills/course-planner/scripts/evidence-check.mjs");
    const run = spawnSync(process.execPath, [scriptPath, corruptFile], { encoding: "utf8" });

    assert.notStrictEqual(run.status, 0, "File JSON hỏng phải thoát với mã khác 0");
    assert.match(run.stderr || run.stdout, /File JSON hỏng/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// .claude/skills/course-planner/test/parallel.test.mjs
// Kiểm chứng chạy song song nhiều app: khóa liên tiến trình, cập nhật backlog không mất ghi,
// đánh số decision không trùng, gate khóa tiên quyết phải produced, cấp tài nguyên không trùng.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acquireLock, lockDir, withLock } from "../scripts/lock.mjs";
import { decideNext } from "../scripts/next.mjs";
import { setProposalStatus, coverProposalNodes } from "../scripts/plan-update.mjs";
import { allocate, release } from "../../course-author/scripts/resources.mjs";

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts");
const authorScriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../course-author/scripts");
const url = (p) => pathToFileURL(p).href;

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parallel-test-"));
  fs.mkdirSync(path.join(dir, ".course-plan", "paths"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".course-plan", "evaluations"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".course-plan", "catalog.json"), JSON.stringify({ courses: [] }));
  return dir;
}

// Chạy n tiến trình node cùng lúc, mỗi tiến trình chạy đoạn code `body` (ESM); chờ tất cả xong.
function runParallel(n, body) {
  return Promise.all(
    Array.from({ length: n }, (_, k) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["--input-type=module", "-e", body.replaceAll("__K__", String(k))], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let err = "";
        child.stderr.on("data", (d) => (err += d));
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tiến trình ${k} lỗi ${code}: ${err}`))));
      }),
    ),
  );
}

test("lock: 4 tiến trình cùng tăng một bộ đếm 25 lần, không mất lần nào", async () => {
  const dir = tmpRepo();
  try {
    const counter = path.join(dir, "counter.txt");
    fs.writeFileSync(counter, "0");
    await runParallel(4, `
      import fs from "node:fs";
      import { lockDir, withLock } from "${url(path.join(scriptsDir, "lock.mjs"))}";
      for (let i = 0; i < 25; i++) {
        withLock(lockDir(${JSON.stringify(dir)}, "plan"), () => {
          const v = Number(fs.readFileSync(${JSON.stringify(counter)}, "utf8"));
          fs.writeFileSync(${JSON.stringify(counter)}, String(v + 1));
        });
      }
    `);
    assert.equal(fs.readFileSync(counter, "utf8"), "100");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("lock: khóa quá hạn được gỡ, khóa còn hạn làm bên sau hết thời gian chờ", () => {
  const dir = tmpRepo();
  try {
    const ld = lockDir(dir, "plan");
    const releaseHeld = acquireLock(ld);
    assert.throws(() => acquireLock(ld, { timeoutMs: 200, pollMs: 20 }), /Hết thời gian chờ khóa/);
    // giả lập tiến trình giữ khóa đã chết từ lâu
    const old = new Date(Date.now() - 10 * 60_000);
    fs.utimesSync(ld, old, old);
    const releaseNew = acquireLock(ld, { timeoutMs: 1000, staleMs: 60_000 });
    releaseNew();
    assert.equal(fs.existsSync(ld), false);
    releaseHeld(); // gỡ lần hai không lỗi
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-update: 4 app đổi status 4 đề xuất khác nhau cùng lúc, không mất cập nhật", async () => {
  const dir = tmpRepo();
  try {
    const proposals = Array.from({ length: 4 }, (_, k) => ({ slug: `c${k}`, title: `C${k}`, status: "open" }));
    fs.writeFileSync(path.join(dir, ".course-plan", "backlog.json"), JSON.stringify({ focus: null, proposals }));
    await runParallel(4, `
      import { setProposalStatus } from "${url(path.join(scriptsDir, "plan-update.mjs"))}";
      for (let i = 0; i < 10; i++) setProposalStatus(${JSON.stringify(dir)}, "c__K__", i % 2 ? "chosen" : "open");
      setProposalStatus(${JSON.stringify(dir)}, "c__K__", "produced");
    `);
    const after = JSON.parse(fs.readFileSync(path.join(dir, ".course-plan", "backlog.json"), "utf8"));
    assert.deepEqual(after.proposals.map((p) => p.status), ["produced", "produced", "produced", "produced"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("plan-update: rejected cần lý do; cover đặt course_slug và covered cho đúng các ô", () => {
  const dir = tmpRepo();
  try {
    fs.writeFileSync(
      path.join(dir, ".course-plan", "backlog.json"),
      JSON.stringify({ proposals: [{ slug: "a", status: "chosen", path_nodes: { path: "m", nodes: ["n1", "n2"] } }] }),
    );
    fs.writeFileSync(
      path.join(dir, ".course-plan", "paths", "m.json"),
      JSON.stringify({ slug: "m", status: "approved", nodes: [{ id: "n1" }, { id: "n2" }, { id: "n3" }] }),
    );
    assert.throws(() => setProposalStatus(dir, "a", "rejected"), /cần --reason/);
    assert.throws(() => setProposalStatus(dir, "khong-co", "produced"), /không có đề xuất/);
    coverProposalNodes(dir, "a");
    const map = JSON.parse(fs.readFileSync(path.join(dir, ".course-plan", "paths", "m.json"), "utf8"));
    assert.deepEqual(
      map.nodes.map((n) => [n.id, n.course_slug ?? null, n.coverage ?? null]),
      [["n1", "a", "covered"], ["n2", "a", "covered"], ["n3", null, null]],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("next --write: 4 app ghi decision cùng lúc, số file không trùng", async () => {
  const dir = tmpRepo();
  try {
    fs.writeFileSync(path.join(dir, ".course-plan", "backlog.json"), JSON.stringify({ proposals: [] }));
    await runParallel(4, `
      import { saveDecision } from "${url(path.join(scriptsDir, "next.mjs"))}";
      for (let i = 0; i < 5; i++) saveDecision({ app: __K__, i }, ${JSON.stringify(dir)}, "2026-11-18T00:00:00Z");
    `);
    const files = fs.readdirSync(path.join(dir, ".course-plan", "decisions")).sort();
    assert.equal(files.length, 20);
    assert.equal(new Set(files).size, 20);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("next: khóa tiên quyết còn chosen thì khóa kế thừa bị chặn; produced thì qua gate requires", () => {
  const dir = tmpRepo();
  try {
    fs.writeFileSync(
      path.join(dir, ".course-plan", "paths", "m.json"),
      JSON.stringify({
        slug: "m",
        status: "approved",
        nodes: [
          { id: "base", requires: [], coverage: "empty" },
          { id: "next", requires: ["base"], coverage: "empty" },
        ],
      }),
    );
    const writeBacklog = (baseStatus) =>
      fs.writeFileSync(
        path.join(dir, ".course-plan", "backlog.json"),
        JSON.stringify({
          proposals: [
            { slug: "pre", title: "Pre", status: baseStatus, path_nodes: { path: "m", nodes: ["base"] } },
            { slug: "post", title: "Post", status: "chosen", path_nodes: { path: "m", nodes: ["next"] } },
          ],
        }),
      );

    writeBacklog("chosen");
    const blocked = decideNext({ repoRoot: dir, onlySlug: "post" });
    const entry = blocked.blocked.find((b) => b.slug === "post");
    assert.ok(entry, "khóa kế thừa phải nằm trong blocked khi khóa tiên quyết chỉ mới chosen");
    assert.deepEqual(entry.blocked_by, ["base"]);
    assert.deepEqual(entry.in_production, ["base"]);

    writeBacklog("produced");
    const passed = decideNext({ repoRoot: dir, onlySlug: "post" });
    assert.equal(passed.blocked.some((b) => b.slug === "post"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resources: 4 app xin tài nguyên cho 4 khóa cùng lúc, dải cổng và DB tạm không trùng", async () => {
  const dir = tmpRepo();
  try {
    await runParallel(4, `
      import { allocate } from "${url(path.join(authorScriptsDir, "resources.mjs"))}";
      allocate(${JSON.stringify(dir)}, "khoa-__K__");
    `);
    const all = [0, 1, 2, 3].map((k) => allocate(dir, `khoa-${k}`)); // gọi lại: trả đúng cấp phát cũ
    assert.equal(new Set(all.map((r) => r.block)).size, 4);
    assert.equal(new Set(all.map((r) => r.rpc_port)).size, 4);
    assert.equal(new Set(all.map((r) => r.temp_db)).size, 4);
    for (const r of all) assert.ok(r.rpc_port >= 20000 && r.rpc_port < 65535);

    assert.equal(release(dir, "khoa-1"), true);
    assert.equal(release(dir, "khoa-1"), false);
    const reused = allocate(dir, "khoa-moi");
    assert.equal(reused.block, all.find((r) => r.slug === "khoa-1").block);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("withLock: lỗi trong hàm vẫn gỡ khóa", () => {
  const dir = tmpRepo();
  try {
    const ld = lockDir(dir, "plan");
    assert.throws(() => withLock(ld, () => { throw new Error("boom"); }), /boom/);
    assert.equal(fs.existsSync(ld), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

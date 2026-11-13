// .claude/skills/course-planner/test/next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { decideNext } from "../scripts/next.mjs";
import { takeCatalogSnapshot } from "../scripts/catalog-snapshot.mjs";

function setupFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "next-test-"));
  const pathsDir = path.join(tmpDir, ".course-plan", "paths");
  const evalsDir = path.join(tmpDir, ".course-plan", "evaluations");
  const catFile = path.join(tmpDir, ".course-plan", "catalog.json");

  fs.mkdirSync(pathsDir, { recursive: true });
  fs.mkdirSync(evalsDir, { recursive: true });

  fs.writeFileSync(catFile, JSON.stringify({ courses: [] }, null, 2));

  return { tmpDir, pathsDir, evalsDir, catFile };
}

test("next: AC1 - chạy hai lần trên cùng fixture cho JSON giống hệt", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const pathA = {
      slug: "p1",
      title: "Path 1",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "Hot", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c1", title: "Khóa 1", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "c2", title: "Khóa 2", level: "intermediate", suggested_order: 2, requires: [{ slug: "c1", reason: "cần c1" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p1.json"), JSON.stringify(pathA, null, 2));

    const evalC1 = {
      slug: "c1",
      catalog: { verdict: "new", basis: "Mới hoàn toàn", refs: [] },
      feasibility: { verdict: "feasible", basis: "Khả thi" },
      evidence: [{ claim: "Cần", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      foundation_basis: null,
      handoff: { title: "Khóa 1", topic: "Nhiệm vụ 1", audience: "Người mới", level: "beginner", path: "p1", scope_note: "Phạm vi khóa kề" }
    };
    fs.writeFileSync(path.join(evalsDir, "c1.json"), JSON.stringify(evalC1, null, 2));

    const run1 = decideNext({ repoRoot: tmpDir });
    const run2 = decideNext({ repoRoot: tmpDir });

    assert.deepStrictEqual(run1, run2, "Hai lần chạy phải trả về kết quả giống hệt");
    assert.strictEqual(JSON.stringify(run1), JSON.stringify(run2), "Chuỗi JSON phải hoàn toàn đồng nhất");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC2 - fixture 2 khóa cùng path, khác suggested_order, không có requires -> cả 2 sẵn sàng", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const pathA = {
      slug: "p-two-ready",
      title: "Path 2 Khóa Sẵn Sàng",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "Tuyển", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "course-order-1", title: "Khóa Order 1", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "course-order-2", title: "Khóa Order 2", level: "beginner", suggested_order: 2, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-two-ready.json"), JSON.stringify(pathA, null, 2));

    for (const slug of ["course-order-1", "course-order-2"]) {
      fs.writeFileSync(path.join(evalsDir, `${slug}.json`), JSON.stringify({
        slug,
        catalog: { verdict: "new", basis: "Mới", refs: [] },
        feasibility: { verdict: "feasible", basis: "Khả thi" },
        evidence: [{ claim: "Direct", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
        handoff: { title: slug, topic: "Task", audience: "All", level: "beginner", path: "p-two-ready", scope_note: "Phạm vi khóa kề" }
      }, null, 2));
    }

    const res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick);
    assert.strictEqual(res.pick.slug, "course-order-1", "Khóa có suggested_order: 1 phải được chọn trước");
    assert.strictEqual(res.blocked.length, 0, "Không khóa nào bị blocked vì requires đều rỗng");
    assert.strictEqual(res.queue.length, 1);
    assert.strictEqual(res.queue[0].slug, "course-order-2", "Khóa order 2 nằm trong queue");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC4 - fixture khóa đã có brief.json (in_production) -> không nằm trong pick hay queue", () => {
  const { tmpDir, pathsDir, evalsDir, catFile } = setupFixture();
  try {
    // Catalog có khóa c-prod ở state in_production
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [{ slug: "c-prod", title: "Đang sản xuất", state: "in_production" }]
    }, null, 2));

    const pathA = {
      slug: "p-in-prod",
      title: "Path",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-prod", title: "Đang sản xuất", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "c-next", title: "Kế tiếp", level: "intermediate", suggested_order: 2, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(pathA, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-next.json"), JSON.stringify({
      slug: "c-next",
      catalog: { verdict: "new", basis: "Mới", refs: [] },
      feasibility: { verdict: "feasible", basis: "Khả thi" },
      handoff: { title: "Kế tiếp", topic: "T", audience: "A", level: "intermediate", path: "p-in-prod", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick?.slug, "c-next");
    assert.ok(!res.queue.some((q) => q.slug === "c-prod"), "c-prod không được nằm trong queue");
    assert.ok(!res.blocked.some((b) => b.slug === "c-prod"), "c-prod không phải là candidate");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC5 - foundation_basis hợp lệ -> qua gate; trỏ tới path không có direct evidence -> needs_research", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    // Path 1 (nền tảng): KHÔNG có direct evidence (chỉ có inferred)
    const pFoundation = {
      slug: "path-foundation",
      title: "Path Nền tảng",
      status: "approved",
      priority: 2,
      evidence: [{ claim: "Nhiều star", kind: "inferred", urls: ["https://gh.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-found", title: "Khóa Nền", level: "beginner", suggested_order: 1, is_foundation: true, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-found.json"), JSON.stringify(pFoundation, null, 2));

    // Path 2 (đích A): CÓ direct evidence, c-target-direct PHỤ THUỘC vào c-found
    const pTargetDirect = {
      slug: "path-target-direct",
      title: "Path Đích Có Direct",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "JD yêu cầu", kind: "direct", urls: ["https://jd.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-target-direct", title: "Khóa Đích Direct", level: "advanced", suggested_order: 1, requires: [{ slug: "c-found", reason: "Cần c-found" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-target-direct.json"), JSON.stringify(pTargetDirect, null, 2));

    // Path 3 (đích B): KHÔNG có direct evidence
    const pTargetNoDirect = {
      slug: "path-target-no-direct",
      title: "Path Đích Không Direct",
      status: "approved",
      priority: 3,
      evidence: [{ claim: "Chỉ inferred", kind: "inferred", urls: ["https://forum.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-target-no-direct", title: "Khóa Đích No Direct", level: "advanced", suggested_order: 1, requires: [{ slug: "c-found", reason: "Cần c-found" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-target-no-direct.json"), JSON.stringify(pTargetNoDirect, null, 2));

    // Trường hợp 1: c-found trỏ tới c-target-direct -> qua gate!
    fs.writeFileSync(path.join(evalsDir, "c-found.json"), JSON.stringify({
      slug: "c-found",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      foundation_basis: { target_slug: "c-target-direct", reason: "Nền tảng cho khóa c-target-direct" },
      handoff: { title: "Khóa Nền", topic: "T", audience: "A", level: "beginner", path: "path-foundation", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    // Đánh giá cho c-target-direct
    fs.writeFileSync(path.join(evalsDir, "c-target-direct.json"), JSON.stringify({
      slug: "c-target-direct",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "Target", topic: "T", audience: "A", level: "advanced", path: "path-target-direct", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res1 = decideNext({ repoRoot: tmpDir });
    // c-found qua gate (không nằm trong needs_research)
    assert.ok(!res1.needs_research.some((n) => n.slug === "c-found"), "c-found phải qua gate khi trỏ tới path có direct evidence");

    // Trường hợp 2: c-found trỏ tới c-target-no-direct (path không có direct) -> needs_research!
    fs.writeFileSync(path.join(evalsDir, "c-found.json"), JSON.stringify({
      slug: "c-found",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      foundation_basis: { target_slug: "c-target-no-direct", reason: "Nền tảng cho khóa không có direct" },
      handoff: { title: "Khóa Nền", topic: "T", audience: "A", level: "beginner", path: "path-foundation", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res2 = decideNext({ repoRoot: tmpDir });
    const inResearch = res2.needs_research.find((n) => n.slug === "c-found");
    assert.ok(inResearch, "c-found phải bị chuyển vào needs_research");
    assert.ok(inResearch.reason.includes("foundation_basis trỏ tới path không có evidence direct"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC6 - khóa dùng chung hai path -> vị trí theo path có priority nhỏ hơn", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    // Path A: priority 3
    const pA = {
      slug: "path-a",
      title: "Path A",
      status: "approved",
      priority: 3,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "shared-course", title: "Khóa Dùng Chung", level: "intermediate", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "pa.json"), JSON.stringify(pA, null, 2));

    // Path B: priority 1 (cao hơn)
    const pB = {
      slug: "path-b",
      title: "Path B",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "shared-course", title: "Khóa Dùng Chung", level: "intermediate", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "pb.json"), JSON.stringify(pB, null, 2));

    // Path C: priority 2 có khóa c-p2
    const pC = {
      slug: "path-c",
      title: "Path C",
      status: "approved",
      priority: 2,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "course-p2", title: "Khóa P2", level: "intermediate", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "pc.json"), JSON.stringify(pC, null, 2));

    for (const slug of ["shared-course", "course-p2"]) {
      fs.writeFileSync(path.join(evalsDir, `${slug}.json`), JSON.stringify({
        slug,
        catalog: { verdict: "new", basis: "New", refs: [] },
        feasibility: { verdict: "feasible", basis: "Ok" },
        handoff: { title: slug, topic: "T", audience: "A", level: "intermediate", path: "path-b", scope_note: "Phạm vi khóa kề" }
      }, null, 2));
    }

    const res = decideNext({ repoRoot: tmpDir });
    // shared-course có minPriority = 1, nên phải thắng course-p2 (priority 2)
    assert.strictEqual(res.pick?.slug, "shared-course");
    assert.strictEqual(res.pick?.priority, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC7 - hai path cùng priority có khóa sẵn sàng đứng đầu khác nhau -> pick: null và tie chứa cả hai", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const p1 = {
      slug: "p-alpha",
      title: "Path Alpha",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "course-alpha", title: "Khóa Alpha", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p1.json"), JSON.stringify(p1, null, 2));

    const p2 = {
      slug: "p-beta",
      title: "Path Beta",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "course-beta", title: "Khóa Beta", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p2.json"), JSON.stringify(p2, null, 2));

    for (const slug of ["course-alpha", "course-beta"]) {
      fs.writeFileSync(path.join(evalsDir, `${slug}.json`), JSON.stringify({
        slug,
        catalog: { verdict: "new", basis: "New", refs: [] },
        feasibility: { verdict: "feasible", basis: "Ok" },
        handoff: { title: slug, topic: "T", audience: "A", level: "beginner", path: "p1", scope_note: "Phạm vi khóa kề" }
      }, null, 2));
    }

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null, "Khi có hòa giữa 2 path cùng priority, pick phải là null");
    assert.ok(Array.isArray(res.tie), "tie phải là một mảng");
    assert.strictEqual(res.tie.length, 2);
    assert.ok(res.tie.some((t) => t.slug === "course-alpha"));
    assert.ok(res.tie.some((t) => t.slug === "course-beta"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC8 - catalog.verdict = update_existing -> nằm trong updates, không nằm trong pick", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const p1 = {
      slug: "p-update",
      title: "Path",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "course-to-update", title: "Khóa Cần Update", level: "intermediate", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p1.json"), JSON.stringify(p1, null, 2));

    fs.writeFileSync(path.join(evalsDir, "course-to-update.json"), JSON.stringify({
      slug: "course-to-update",
      catalog: { verdict: "update_existing", basis: "Bổ sung vào rust-error-handling", refs: ["rust-error-handling"] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "intermediate", path: "p-update", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null, "Không được pick khóa cần update");
    assert.strictEqual(res.updates.length, 1);
    assert.strictEqual(res.updates[0].slug, "course-to-update");
    assert.strictEqual(res.updates[0].basis, "Bổ sung vào rust-error-handling");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC9 - path draft không sinh candidate", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const pDraft = {
      slug: "p-draft",
      title: "Path Draft",
      status: "draft", // DRAFT
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-draft-only", title: "Khóa Chỉ Trong Draft", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-draft.json"), JSON.stringify(pDraft, null, 2));

    // Dù có evaluation hợp lệ thì cũng không sinh candidate
    fs.writeFileSync(path.join(evalsDir, "c-draft-only.json"), JSON.stringify({
      slug: "c-draft-only",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "beginner", path: "p-draft", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.queue.length, 0);
    assert.strictEqual(res.blocked.length, 0);
    assert.strictEqual(res.needs_research.length, 0);
    assert.strictEqual(res.rejected.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: candidate bị chặn bởi khóa chưa produced -> vào blocked kèm blocked_by", () => {
  const { tmpDir, pathsDir, evalsDir, catFile } = setupFixture();
  try {
    const p = {
      slug: "p-blocked",
      title: "Path",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-blocked", title: "Khóa Bị Chặn", level: "intermediate", suggested_order: 2, requires: [{ slug: "unmet-prereq", reason: "cần kiến thức" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-blocked.json"), JSON.stringify({
      slug: "c-blocked",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "intermediate", path: "p-blocked", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.blocked.length, 1);
    assert.strictEqual(res.blocked[0].slug, "c-blocked");
    assert.deepStrictEqual(res.blocked[0].blocked_by, ["unmet-prereq"]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: V-01 - khóa dùng chung được xếp theo suggested_order trong path đang xét (z-path vs a-path)", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    // z-path (priority 1) có shared order 1 và z-own order 2
    const zPath = {
      slug: "z-path",
      title: "Path Z",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "shared", title: "Khóa Shared", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "z-own", title: "Khóa Z Own", level: "beginner", suggested_order: 2, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "z-path.json"), JSON.stringify(zPath, null, 2));

    // a-path (priority 2) có shared order 9
    const aPath = {
      slug: "a-path",
      title: "Path A",
      status: "approved",
      priority: 2,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "shared", title: "Khóa Shared", level: "beginner", suggested_order: 9, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "a-path.json"), JSON.stringify(aPath, null, 2));

    for (const slug of ["shared", "z-own"]) {
      fs.writeFileSync(path.join(evalsDir, `${slug}.json`), JSON.stringify({
        slug,
        catalog: { verdict: "new", basis: "New", refs: [] },
        feasibility: { verdict: "feasible", basis: "Ok" },
        handoff: { title: slug, topic: "T", audience: "A", level: "beginner", path: "z-path", scope_note: "Phạm vi khóa kề" }
      }, null, 2));
    }

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick?.slug, "shared", "shared có order 1 trong z-path (priority 1), phải được chọn trước z-own (order 2)");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: V-02 - candidate bị chặn mà chưa có evaluation bị xếp vào blocked thay vì needs_research", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const p = {
      slug: "p-dep",
      title: "Path Dep",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "base", title: "Base", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "dep", title: "Dep", level: "intermediate", suggested_order: 2, requires: [{ slug: "base", reason: "cần base" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    // CHỈ có base có evaluation, dep KHÔNG có evaluation
    fs.writeFileSync(path.join(evalsDir, "base.json"), JSON.stringify({
      slug: "base",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "Base", topic: "T", audience: "A", level: "beginner", path: "p-dep", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick?.slug, "base");
    assert.strictEqual(res.blocked.length, 1);
    assert.strictEqual(res.blocked[0].slug, "dep");
    assert.deepStrictEqual(res.blocked[0].blocked_by, ["base"]);
    assert.ok(!res.needs_research.some((n) => n.slug === "dep"), "dep bị chặn thì phải vào blocked, KHÔNG vào needs_research");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: V-06 - khóa đã có handoff.json được catalog-snapshot nhận là in_production và không bị chọn lại", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v06-test-"));
  try {
    const runsDir = path.join(tmpDir, ".course-runs");
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    const evalsDir = path.join(tmpDir, ".course-plan", "evaluations");
    fs.mkdirSync(pathsDir, { recursive: true });
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.mkdirSync(runsDir, { recursive: true });

    const p = {
      slug: "p-handoff",
      title: "Path",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-first", title: "Khóa 1", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "c-second", title: "Khóa 2", level: "beginner", suggested_order: 2, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    for (const slug of ["c-first", "c-second"]) {
      fs.writeFileSync(path.join(evalsDir, `${slug}.json`), JSON.stringify({
        slug,
        catalog: { verdict: "new", basis: "New", refs: [] },
        feasibility: { verdict: "feasible", basis: "Ok" },
        handoff: { title: slug, topic: "T", audience: "A", level: "beginner", path: "p-handoff", scope_note: "Phạm vi khóa kề" }
      }, null, 2));
    }

    // Lần 1: c-first được chọn
    const res1 = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res1.pick?.slug, "c-first");

    // Giả lập ghi handoff.json vào .course-runs/c-first/
    const firstRunDir = path.join(runsDir, "c-first");
    fs.mkdirSync(firstRunDir, { recursive: true });
    fs.writeFileSync(path.join(firstRunDir, "handoff.json"), JSON.stringify(res1.pick, null, 2));

    // Chạy lại catalog-snapshot
    takeCatalogSnapshot(tmpDir);

    // Lần 2: c-first đã in_production, không được chọn lại, pick phải là c-second
    const res2 = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res2.pick?.slug, "c-second");
    assert.ok(!res2.queue.some((q) => q.slug === "c-first"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: V-07 - foundation_basis có reason rỗng hoặc target không phụ thuộc vào khóa nền bị đẩy vào needs_research", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const p = {
      slug: "p-fb",
      title: "Path",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "Direct", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-found", title: "Nền", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "c-target", title: "Đích", level: "advanced", suggested_order: 2, requires: [] } // c-target KHÔNG require c-found
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    // Case 1: reason rỗng
    fs.writeFileSync(path.join(evalsDir, "c-found.json"), JSON.stringify({
      slug: "c-found",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      foundation_basis: { target_slug: "c-target", reason: "   " }, // reason rỗng
      handoff: { title: "Nền", topic: "T", audience: "A", level: "beginner", path: "p-fb", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    // Path foundation riêng không có direct evidence để test foundation_basis
    const pFoundNoDirect = {
      slug: "p-found-no-direct",
      title: "Path No Direct",
      status: "approved",
      priority: 2,
      evidence: [{ claim: "Inferred", kind: "inferred", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-found-2", title: "Nền 2", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-found-no-direct.json"), JSON.stringify(pFoundNoDirect, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-found-2.json"), JSON.stringify({
      slug: "c-found-2",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      foundation_basis: { target_slug: "c-target", reason: "Nền tảng hợp lý" }, // c-target không require c-found-2
      handoff: { title: "Nền 2", topic: "T", audience: "A", level: "beginner", path: "p-found-no-direct", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    // Đánh giá cho c-target
    fs.writeFileSync(path.join(evalsDir, "c-target.json"), JSON.stringify({
      slug: "c-target",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "Đích", topic: "T", audience: "A", level: "advanced", path: "p-fb", scope_note: "Phạm vi khóa kề" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.needs_research.some((n) => n.slug === "c-found-2"), "target không require c-found-2 phải vào needs_research");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


test("next: E-03 - handoff thiếu scope_note -> needs_research", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const pathA = {
      slug: "p-e03",
      title: "Path E03",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "Hot", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-e03", title: "Khóa E03", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-e03.json"), JSON.stringify(pathA, null, 2));

    const evalC = {
      slug: "c-e03",
      catalog: { verdict: "new", basis: "Mới", refs: [] },
      feasibility: { verdict: "feasible", basis: "Khả thi" },
      evidence: [{ claim: "Cần", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      foundation_basis: null,
      handoff: { title: "Khóa", topic: "T", audience: "A", level: "beginner", path: "p-e03" } // thiếu scope_note
    };
    fs.writeFileSync(path.join(evalsDir, "c-e03.json"), JSON.stringify(evalC, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-e03");
    assert.ok(nr, "Khóa thiếu scope_note phải vào needs_research");
    assert.match(nr.reason, /scope_note/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: E-04 - evaluation đối chiếu {A}; catalog có thêm B -> candidate vào needs_research nêu B", () => {
  const { tmpDir, pathsDir, evalsDir, catFile } = setupFixture();
  try {
    // Catalog có sẵn khóa 'course-a' và mới thêm 'course-b'
    fs.writeFileSync(
      catFile,
      JSON.stringify(
        {
          courses: [
            { slug: "course-a", title: "Khóa A", state: "produced" },
            { slug: "course-b", title: "Khóa B", state: "produced" },
          ],
        },
        null,
        2
      )
    );

    const pathA = {
      slug: "p-e04",
      title: "Path E04",
      status: "approved",
      priority: 1,
      evidence: [{ claim: "Hot", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-e04", title: "Khóa E04", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-e04.json"), JSON.stringify(pathA, null, 2));

    // Evaluation chỉ mới đối chiếu course-a
    const evalC = {
      slug: "c-e04",
      catalog: { verdict: "new", basis: "Mới", refs: [] },
      feasibility: { verdict: "feasible", basis: "Khả thi" },
      evidence: [{ claim: "Cần", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      foundation_basis: null,
      catalog_courses: ["course-a"], // chưa có course-b!
      handoff: { title: "Khóa", topic: "T", audience: "A", level: "beginner", path: "p-e04", scope_note: "Phạm vi" }
    };
    fs.writeFileSync(path.join(evalsDir, "c-e04.json"), JSON.stringify(evalC, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-e04");
    assert.ok(nr, "Candidate phải vào needs_research khi catalog có khóa mới chưa đối chiếu");
    assert.match(nr.reason, /course-b/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// .claude/skills/course-planner/test/next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { decideNext } from "../scripts/next.mjs";
import { takeCatalogSnapshot } from "../scripts/catalog-snapshot.mjs";

function makeOrigin(tmpDir, pitchSlug) {
  const shortlistsDir = path.join(tmpDir, ".course-plan", "shortlists");
  fs.mkdirSync(shortlistsDir, { recursive: true });
  const fileRel = `.course-plan/shortlists/${pitchSlug}.json`;
  const fileAbs = path.join(shortlistsDir, `${pitchSlug}.json`);
  fs.writeFileSync(fileAbs, JSON.stringify({
    date: "2026-11-13",
    chosen_slug: pitchSlug,
    shortlist: [{ slug: pitchSlug, title: `Khóa ${pitchSlug}` }],
    rejected: []
  }, null, 2));
  return { shortlist: fileRel, pitch_slug: pitchSlug };
}

function setupFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "next-test-"));
  const pathsDir = path.join(tmpDir, ".course-plan", "paths");
  const evalsDir = path.join(tmpDir, ".course-plan", "evaluations");
  const shortlistsDir = path.join(tmpDir, ".course-plan", "shortlists");
  const catFile = path.join(tmpDir, ".course-plan", "catalog.json");

  fs.mkdirSync(pathsDir, { recursive: true });
  fs.mkdirSync(evalsDir, { recursive: true });
  fs.mkdirSync(shortlistsDir, { recursive: true });

  fs.writeFileSync(catFile, JSON.stringify({ courses: [] }, null, 2));

  return { tmpDir, pathsDir, evalsDir, shortlistsDir, catFile };
}

test("next: AC1 - chạy hai lần trên cùng fixture cho JSON giống hệt", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const pathA = {
      slug: "p1",
      title: "Path 1",
      status: "approved",
      priority: 1,
      origin: makeOrigin(tmpDir, "c1"),
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
      origin: makeOrigin(tmpDir, "course-order-1"),
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
      origin: makeOrigin(tmpDir, "c-prod"),
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
      origin: makeOrigin(tmpDir, "c-found"),
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
      origin: makeOrigin(tmpDir, "c-target-direct"),
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
      origin: makeOrigin(tmpDir, "c-target-no-direct"),
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
      origin: makeOrigin(tmpDir, "shared-course"),
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
      origin: makeOrigin(tmpDir, "shared-course"),
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
      origin: makeOrigin(tmpDir, "course-p2"),
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
      origin: makeOrigin(tmpDir, "course-alpha"),
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
      origin: makeOrigin(tmpDir, "course-beta"),
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
      origin: makeOrigin(tmpDir, "course-to-update"),
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
      origin: makeOrigin(tmpDir, "c-blocked"),
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
      origin: makeOrigin(tmpDir, "shared"),
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
      origin: makeOrigin(tmpDir, "shared"),
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
      origin: makeOrigin(tmpDir, "base"),
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
    const shortlistsDir = path.join(tmpDir, ".course-plan", "shortlists");
    fs.mkdirSync(pathsDir, { recursive: true });
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.mkdirSync(runsDir, { recursive: true });
    fs.mkdirSync(shortlistsDir, { recursive: true });
    fs.writeFileSync(path.join(shortlistsDir, "approved.json"), JSON.stringify({
      date: "2026-11-13",
      chosen_slug: "approved-pitch",
      rejected: []
    }, null, 2));

    const p = {
      slug: "p-handoff",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: makeOrigin(tmpDir, "c-first"),
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
      origin: makeOrigin(tmpDir, "c-found"),
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
      origin: makeOrigin(tmpDir, "c-found-2"),
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
      origin: makeOrigin(tmpDir, "c-e03"),
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
      origin: makeOrigin(tmpDir, "c-e04"),
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


test("next: AC7 - path không có origin -> needs_research", () => {
  const { tmpDir, pathsDir, evalsDir } = setupFixture();
  try {
    const p = {
      slug: "p-no-origin",
      title: "Path No Origin",
      status: "approved",
      priority: 1,
      // KHÔNG CÓ origin
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-no-origin", title: "Khóa No Origin", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-no-origin.json"), JSON.stringify({
      slug: "c-no-origin",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "beginner", path: "p-no-origin", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-no-origin");
    assert.ok(nr, "Path không có origin phải vào needs_research");
    assert.match(nr.reason, /origin/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC7 - origin trỏ shortlist chưa có chosen_slug -> needs_research", () => {
  const { tmpDir, pathsDir, evalsDir, shortlistsDir } = setupFixture();
  try {
    // Shortlist chưa chốt chosen_slug
    fs.writeFileSync(path.join(shortlistsDir, "unapproved.json"), JSON.stringify({
      date: "2026-11-13",
      chosen_slug: null,
      rejected: []
    }, null, 2));

    const p = {
      slug: "p-unapproved",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: { shortlist: ".course-plan/shortlists/unapproved.json", pitch_slug: "c-unapproved" },
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-unapproved", title: "Khóa", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-unapproved.json"), JSON.stringify({
      slug: "c-unapproved",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "beginner", path: "p-unapproved", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-unapproved");
    assert.ok(nr, "Shortlist chưa có chosen_slug phải vào needs_research");
    assert.match(nr.reason, /chosen_slug/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC7 - tiên quyết mang content_state: empty -> blocked", () => {
  const { tmpDir, pathsDir, evalsDir, catFile } = setupFixture();
  try {
    // Catalog có khóa tiên quyết ở state in_catalog nhưng content_state là empty
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "prereq-empty", title: "Tiên quyết rỗng", state: "in_catalog", content_state: "empty" }
      ]
    }, null, 2));

    const p = {
      slug: "p-prereq-empty",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: makeOrigin(tmpDir, "c-needs-prereq"),
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-needs-prereq", title: "Khóa Cần Tiên Quyết", level: "intermediate", suggested_order: 1, requires: [{ slug: "prereq-empty", reason: "cần kiến thức" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-needs-prereq.json"), JSON.stringify({
      slug: "c-needs-prereq",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "intermediate", path: "p-prereq-empty", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.blocked.length, 1);
    assert.strictEqual(res.blocked[0].slug, "c-needs-prereq");
    assert.deepStrictEqual(res.blocked[0].blocked_by, ["prereq-empty"]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC7 - tiên quyết mang content_state: unknown -> đạt kèm warnings", () => {
  const { tmpDir, pathsDir, evalsDir, catFile } = setupFixture();
  try {
    // Catalog có khóa tiên quyết ở state in_catalog với content_state là unknown
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "prereq-unknown", title: "Tiên quyết unknown", state: "in_catalog", content_state: "unknown" }
      ]
    }, null, 2));

    const p = {
      slug: "p-prereq-unknown",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: makeOrigin(tmpDir, "c-passed-with-warn"),
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-passed-with-warn", title: "Khóa Đạt kèm Warning", level: "intermediate", suggested_order: 1, requires: [{ slug: "prereq-unknown", reason: "cần kiến thức" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-passed-with-warn.json"), JSON.stringify({
      slug: "c-passed-with-warn",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "intermediate", path: "p-prereq-unknown", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick?.slug, "c-passed-with-warn");
    assert.ok(Array.isArray(res.warnings), "Kết quả phải chứa mảng warnings");
    const w = res.warnings.find((msg) => msg.includes("prereq-unknown") && msg.includes("unknown"));
    assert.ok(w, "Phải có cảnh báo về khóa tiên quyết unknown: " + JSON.stringify(res.warnings));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: P-12 - khóa tiên quyết thiếu trường content_state -> đạt kèm cảnh báo", () => {
  const { tmpDir, pathsDir, evalsDir, catFile } = setupFixture();
  try {
    // Catalog có khóa tiên quyết ở state in_catalog nhưng hoàn toàn KHÔNG CÓ content_state (catalog từ script cũ)
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "prereq-legacy-no-cs", title: "Tiên quyết cũ không có content_state", state: "in_catalog" }
      ]
    }, null, 2));

    const p = {
      slug: "p-prereq-legacy",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: makeOrigin(tmpDir, "c-legacy-warn"),
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-legacy-warn", title: "Khóa Đạt kèm Cảnh báo thiếu cs", level: "intermediate", suggested_order: 1, requires: [{ slug: "prereq-legacy-no-cs", reason: "cần kiến thức" }] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-legacy-warn.json"), JSON.stringify({
      slug: "c-legacy-warn",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "intermediate", path: "p-prereq-legacy", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick?.slug, "c-legacy-warn");
    assert.ok(Array.isArray(res.warnings), "Kết quả phải chứa mảng warnings");
    const w = res.warnings.find((msg) => msg.includes("prereq-legacy-no-cs") && msg.includes("thiếu content_state"));
    assert.ok(w, "Phải có cảnh báo về khóa tiên quyết thiếu content_state: " + JSON.stringify(res.warnings));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


test("next: P-08 - Gate 6 loại ứng viên khi origin.pitch_slug không thuộc courses của path", () => {
  const { tmpDir, pathsDir, evalsDir, shortlistsDir } = setupFixture();
  try {
    const slData = makeOrigin(tmpDir, "pitch-not-in-path");

    const p = {
      slug: "p-p08-wrong-pitch",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: slData,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-p08-1", title: "Khóa", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-p08-1.json"), JSON.stringify({
      slug: "c-p08-1",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "beginner", path: "p-p08-wrong-pitch", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-p08-1");
    assert.ok(nr, "Phải bị đưa vào needs_research khi pitch_slug không thuộc courses của path");
    assert.match(nr.reason, /không thuộc danh sách courses/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: P-08 - Gate 6 loại ứng viên khi file shortlist không chứa đề xuất có slug đó", () => {
  const { tmpDir, pathsDir, evalsDir, shortlistsDir } = setupFixture();
  try {
    // Shortlist có chosen_slug là c-p08-2 nhưng shortlist[] không chứa c-p08-2
    const slFileRel = ".course-plan/shortlists/missing-pitch.json";
    const slFileAbs = path.join(shortlistsDir, "missing-pitch.json");
    fs.writeFileSync(slFileAbs, JSON.stringify({
      date: "2026-11-13",
      chosen_slug: "c-p08-2",
      shortlist: [{ slug: "other-course", title: "Other" }], // thiếu c-p08-2
      rejected: []
    }, null, 2));

    const p = {
      slug: "p-p08-missing-prop",
      title: "Path",
      status: "approved",
      priority: 1,
      origin: { shortlist: slFileRel, pitch_slug: "c-p08-2" },
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-p08-2", title: "Khóa", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-p08-2.json"), JSON.stringify({
      slug: "c-p08-2",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T", topic: "T", audience: "A", level: "beginner", path: "p-p08-missing-prop", scope_note: "Phạm vi" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-p08-2");
    assert.ok(nr, "Phải bị đưa vào needs_research khi shortlist không chứa đề xuất");
    assert.match(nr.reason, /không chứa đề xuất có slug/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC4 - next.mjs --only <slug> chỉ xét khóa đó và khóa không qua gate cho pick: null", () => {
  const { tmpDir, pathsDir, evalsDir, shortlistsDir } = setupFixture();
  try {
    const origin1 = makeOrigin(tmpDir, "c-only-1");
    const origin2 = makeOrigin(tmpDir, "c-only-2");

    const p = {
      slug: "p-only",
      title: "Path Only",
      status: "approved",
      priority: 1,
      origin: origin1,
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-only-1", title: "Khóa 1", level: "beginner", suggested_order: 1, requires: [] },
        { slug: "c-only-2", title: "Khóa 2", level: "beginner", suggested_order: 2, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-only.json"), JSON.stringify(p, null, 2));

    // Khóa 1 có evaluation hợp lệ
    fs.writeFileSync(path.join(evalsDir, "c-only-1.json"), JSON.stringify({
      slug: "c-only-1",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "T1", topic: "T1", audience: "A", level: "beginner", path: "p-only", scope_note: "S1" }
    }, null, 2));

    // Khóa 2 CỐ Ý KHÔNG CÓ evaluation -> sẽ fail gate 5

    // 1. Chạy với --only c-only-1 -> chỉ xét c-only-1 và pick chính là c-only-1
    const res1 = decideNext({ repoRoot: tmpDir, onlySlug: "c-only-1" });
    assert.ok(res1.pick, "Khóa c-only-1 hợp lệ phải được pick");
    assert.strictEqual(res1.pick.slug, "c-only-1");
    assert.strictEqual(res1.queue[0]?.slug, "c-only-2", "Khóa kế tiếp trong cùng path nằm trong queue");

    // 2. Chạy với --only c-only-2 -> c-only-2 không qua gate (thiếu eval) -> pick: null và có lý do trong needs_research
    const res2 = decideNext({ repoRoot: tmpDir, onlySlug: "c-only-2" });
    assert.strictEqual(res2.pick, null, "Khóa không qua gate phải cho pick: null");
    const nr = res2.needs_research.find((x) => x.slug === "c-only-2");
    assert.ok(nr, "Khóa c-only-2 phải vào needs_research kèm lý do");
    assert.match(nr.reason, /evaluation/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC1 - Gate 6 chấp nhận shortlist cũ có trường legacy quote", () => {
  const { tmpDir, pathsDir, evalsDir, shortlistsDir } = setupFixture();
  try {
    const slFileRel = ".course-plan/shortlists/legacy.json";
    const slFileAbs = path.join(shortlistsDir, "legacy.json");
    const legacyKey = ["user", "quote"].join("_");
    const slData = {
      date: "2026-11-13",
      chosen_slug: "c-legacy",
      shortlist: [{ slug: "c-legacy", title: "Khóa Legacy" }],
      rejected: []
    };
    slData[legacyKey] = "Old legacy quote from past";
    fs.writeFileSync(slFileAbs, JSON.stringify(slData, null, 2));

    const p = {
      slug: "p-legacy",
      title: "Path Legacy",
      status: "approved",
      priority: 1,
      origin: { shortlist: slFileRel, pitch_slug: "c-legacy" },
      evidence: [{ claim: "D", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      courses: [
        { slug: "c-legacy", title: "Khóa Legacy", level: "beginner", suggested_order: 1, requires: [] }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "p-legacy.json"), JSON.stringify(p, null, 2));

    fs.writeFileSync(path.join(evalsDir, "c-legacy.json"), JSON.stringify({
      slug: "c-legacy",
      catalog: { verdict: "new", basis: "New", refs: [] },
      feasibility: { verdict: "feasible", basis: "Ok" },
      handoff: { title: "TL", topic: "TL", audience: "A", level: "beginner", path: "p-legacy", scope_note: "SL" }
    }, null, 2));

    const res = decideNext({ repoRoot: tmpDir, onlySlug: "c-legacy" });
    assert.ok(res.pick, "Khóa có shortlist chứa legacy field vẫn phải qua Gate 6");
    assert.strictEqual(res.pick.slug, "c-legacy");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

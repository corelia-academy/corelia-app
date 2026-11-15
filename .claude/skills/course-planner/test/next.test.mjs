// .claude/skills/course-planner/test/next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { decideNext } from "../scripts/next.mjs";

function setupFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "next-test-"));
  const pathsDir = path.join(tmpDir, ".course-plan", "paths");
  const evalsDir = path.join(tmpDir, ".course-plan", "evaluations");
  const catFile = path.join(tmpDir, ".course-plan", "catalog.json");
  const planDir = path.join(tmpDir, ".course-plan");

  fs.mkdirSync(pathsDir, { recursive: true });
  fs.mkdirSync(evalsDir, { recursive: true });

  fs.writeFileSync(catFile, JSON.stringify({ courses: [] }, null, 2));

  return { tmpDir, pathsDir, evalsDir, catFile, planDir };
}

function makeMap(pathsDir, mapObj) {
  fs.writeFileSync(path.join(pathsDir, `${mapObj.slug}.json`), JSON.stringify(mapObj, null, 2));
  return mapObj;
}

function makeBacklog(planDir, proposals, focus = null) {
  const blData = { focus, proposals };
  fs.writeFileSync(path.join(planDir, "backlog.json"), JSON.stringify(blData, null, 2));
  return blData;
}

function makeEval(evalsDir, evalObj) {
  fs.writeFileSync(path.join(evalsDir, `${evalObj.slug}.json`), JSON.stringify(evalObj, null, 2));
  return evalObj;
}

test("next: AC1 - chạy hai lần trên cùng fixture cho JSON giống hệt", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "accounts", title: "Accounts", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      {
        slug: "c1",
        title: "Khóa 1",
        status: "chosen",
        path_node: { path: "solana", node: "accounts" },
        level: "beginner"
      }
    ], { path: "solana" });

    makeEval(evalsDir, {
      slug: "c1",
      catalog: { verdict: "new", basis: "Mới hoàn toàn", refs: [] },
      feasibility: { verdict: "feasible", basis: "Khả thi" },
      handoff: { title: "Khóa 1", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    const run1 = decideNext({ repoRoot: tmpDir });
    const run2 = decideNext({ repoRoot: tmpDir });

    assert.deepStrictEqual(run1, run2, "Hai lần chạy phải trả về kết quả giống hệt");
    assert.strictEqual(JSON.stringify(run1), JSON.stringify(run2), "Chuỗi JSON phải hoàn toàn đồng nhất");
    assert.ok(run1.pick);
    assert.strictEqual(run1.pick.slug, "c1");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC2 - fixture 2 đề xuất chosen sẵn sàng -> pick 1, đề xuất kia vào queue", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" },
        { id: "n2", title: "Node 2", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "course-1", title: "Khóa 1", status: "chosen", path_node: { path: "solana", node: "n1" }, level: "beginner" },
      { slug: "course-2", title: "Khóa 2", status: "chosen", path_node: { path: "solana", node: "n2" }, level: "beginner" }
    ], { path: "solana" });

    for (const slug of ["course-1", "course-2"]) {
      makeEval(evalsDir, {
        slug,
        catalog: { verdict: "new", basis: "Mới", refs: [] },
        feasibility: { verdict: "feasible", basis: "Khả thi" },
        handoff: { title: slug, audience: "All", level: "beginner", scope_note: "Phạm vi" }
      });
    }

    const res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick);
    assert.strictEqual(res.pick.slug, "course-1");
    assert.strictEqual(res.queue.length, 1);
    assert.strictEqual(res.queue[0].slug, "course-2");
    assert.strictEqual(res.blocked.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC-07 - chosen thiếu path_node hoặc map draft -> bị chặn / needs_research", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    // 1. Map đang ở status draft
    makeMap(pathsDir, {
      slug: "solana-draft",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Draft Map",
      status: "draft",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    // 2. Map approved
    makeMap(pathsDir, {
      slug: "solana-approved",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Approved Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      // Case A: map draft
      { slug: "c-draft-map", title: "Khóa Draft Map", status: "chosen", path_node: { path: "solana-draft", node: "n1" } },
      // Case B: thiếu path_node
      { slug: "c-no-path-node", title: "Khóa No Path Node", status: "chosen" },
      // Case C: map không tồn tại
      { slug: "c-missing-map", title: "Khóa Missing Map", status: "chosen", path_node: { path: "nonexistent", node: "n1" } },
      // Case D: node không tồn tại trong map
      { slug: "c-missing-node", title: "Khóa Missing Node", status: "chosen", path_node: { path: "solana-approved", node: "invalid-node" } }
    ]);

    for (const slug of ["c-draft-map", "c-no-path-node", "c-missing-map", "c-missing-node"]) {
      makeEval(evalsDir, {
        slug,
        catalog: { verdict: "new", basis: "New" },
        feasibility: { verdict: "feasible" },
        handoff: { title: slug, audience: "A", level: "all", scope_note: "Phạm vi" }
      });
    }

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null, "Không khóa nào hợp lệ thì pick phải là null");

    // Case A: map draft
    const nrDraft = res.needs_research.find((x) => x.slug === "c-draft-map");
    assert.ok(nrDraft, "Map draft phải vào needs_research");
    assert.match(nrDraft.reason, /status "draft" \(yêu cầu "approved"\)/);

    // Case B: thiếu path_node
    const nrNoNode = res.needs_research.find((x) => x.slug === "c-no-path-node");
    assert.ok(nrNoNode, "Thiếu path_node phải vào needs_research");
    assert.match(nrNoNode.reason, /thiếu path_node hợp lệ/);

    // Case C: map không tồn tại
    const nrMissMap = res.needs_research.find((x) => x.slug === "c-missing-map");
    assert.ok(nrMissMap, "Map không tồn tại phải vào needs_research");
    assert.match(nrMissMap.reason, /Map "nonexistent" không tồn tại/);

    // Case D: node không tồn tại trong map
    const nrMissNode = res.needs_research.find((x) => x.slug === "c-missing-node");
    assert.ok(nrMissNode, "Node không tồn tại phải vào needs_research");
    assert.match(nrMissNode.reason, /Ô "invalid-node" không tồn tại/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC-07 - ô requires chưa thỏa theo AC-02 -> blocked; thỏa -> sẵn sàng", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "accounts", title: "Accounts", layer: "foundation", requires: [], coverage: "empty" },
        { id: "anchor", title: "Anchor", layer: "core", requires: ["accounts"], coverage: "empty" }
      ]
    });

    // Case 1: ô accounts chưa covered, chưa có proposal chosen/produced
    makeBacklog(planDir, [
      {
        slug: "c-anchor",
        title: "Khóa Anchor",
        status: "chosen",
        path_node: { path: "solana", node: "anchor" }
      }
    ]);

    makeEval(evalsDir, {
      slug: "c-anchor",
      catalog: { verdict: "new", basis: "New" },
      feasibility: { verdict: "feasible" },
      handoff: { title: "Anchor", audience: "A", level: "all", scope_note: "Phạm vi" }
    });

    let res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.blocked.length, 1);
    assert.strictEqual(res.blocked[0].slug, "c-anchor");
    assert.deepStrictEqual(res.blocked[0].blocked_by, ["accounts"]);

    // Case 2: ô accounts được phủ (coverage: "covered")
    const map = JSON.parse(fs.readFileSync(path.join(pathsDir, "solana.json"), "utf8"));
    map.nodes[0].coverage = "covered";
    fs.writeFileSync(path.join(pathsDir, "solana.json"), JSON.stringify(map, null, 2));

    res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick);
    assert.strictEqual(res.pick.slug, "c-anchor");
    assert.strictEqual(res.blocked.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC8 - catalog.verdict = update_existing -> nằm trong updates, không nằm trong pick", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "c-update", title: "Khóa Update", status: "chosen", path_node: { path: "solana", node: "n1" } }
    ]);

    makeEval(evalsDir, {
      slug: "c-update",
      catalog: { verdict: "update_existing", basis: "Đã có khóa tương tự, cần cập nhật", refs: [] },
      feasibility: { verdict: "feasible" },
      handoff: { title: "Update", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.updates.length, 1);
    assert.strictEqual(res.updates[0].slug, "c-update");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: Gate feasibility - verdict not_feasible -> rejected", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "c-infeasible", title: "Khóa Không Khả Thi", status: "chosen", path_node: { path: "solana", node: "n1" } }
    ]);

    makeEval(evalsDir, {
      slug: "c-infeasible",
      catalog: { verdict: "new", basis: "New" },
      feasibility: { verdict: "not_feasible", basis: "Không hỗ trợ công cụ" },
      handoff: { title: "Infeasible", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.rejected.length, 1);
    assert.strictEqual(res.rejected[0].slug, "c-infeasible");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: Gate handoff - thiếu trường bắt buộc -> needs_research", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "c-bad-handoff", title: "Khóa Thiếu Handoff", status: "chosen", path_node: { path: "solana", node: "n1" } }
    ]);

    makeEval(evalsDir, {
      slug: "c-bad-handoff",
      catalog: { verdict: "new", basis: "New" },
      feasibility: { verdict: "feasible" },
      // Thiếu scope_note
      handoff: { title: "Title", audience: "All", level: "beginner" }
    });

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c-bad-handoff");
    assert.ok(nr);
    assert.match(nr.reason, /Handoff thiếu trường bắt buộc/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC4 - next.mjs --only <slug> chỉ xét khóa đó và khóa không qua gate cho pick: null", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" },
        { id: "n2", title: "Node 2", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "c-only-1", title: "Khóa 1", status: "chosen", path_node: { path: "solana", node: "n1" } },
      { slug: "c-only-2", title: "Khóa 2", status: "chosen", path_node: { path: "solana", node: "n2" } }
    ]);

    makeEval(evalsDir, {
      slug: "c-only-1",
      catalog: { verdict: "new", basis: "New" },
      feasibility: { verdict: "feasible" },
      handoff: { title: "Title 1", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    makeEval(evalsDir, {
      slug: "c-only-2",
      catalog: { verdict: "new", basis: "New" },
      feasibility: { verdict: "not_feasible", basis: "Lỗi" },
      handoff: { title: "Title 2", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    // Chỉ xét c-only-2 (không khả thi -> rejected -> pick: null)
    let res = decideNext({ repoRoot: tmpDir, onlySlug: "c-only-2" });
    assert.strictEqual(res.pick, null);
    assert.strictEqual(res.rejected.length, 1);
    assert.strictEqual(res.rejected[0].slug, "c-only-2");

    // Chỉ xét c-only-1 (hợp lệ -> pick: c-only-1)
    res = decideNext({ repoRoot: tmpDir, onlySlug: "c-only-1" });
    assert.ok(res.pick);
    assert.strictEqual(res.pick.slug, "c-only-1");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: AC-07 - candidate trỏ ô đã covered hoặc ô có ref -> needs_research, không pick", () => {
  const { tmpDir, pathsDir, evalsDir, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "covered-node", title: "Covered Node", layer: "foundation", requires: [], coverage: "covered" },
        { id: "ref-node", title: "Ref Node", layer: "foundation", requires: [], ref: "redis#cache", coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "c-covered", title: "Khóa Trỏ Covered", status: "chosen", path_node: { path: "solana", node: "covered-node" } },
      { slug: "c-ref", title: "Khóa Trỏ Ref", status: "chosen", path_node: { path: "solana", node: "ref-node" } }
    ]);

    for (const slug of ["c-covered", "c-ref"]) {
      makeEval(evalsDir, {
        slug,
        catalog: { verdict: "new", basis: "New" },
        feasibility: { verdict: "feasible" },
        handoff: { title: slug, audience: "All", level: "beginner", scope_note: "Phạm vi" }
      });
    }

    const res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);

    const nrCovered = res.needs_research.find((x) => x.slug === "c-covered");
    assert.ok(nrCovered, "Khóa trỏ ô covered phải vào needs_research");
    assert.match(nrCovered.reason, /đã có coverage "covered"/);

    const nrRef = res.needs_research.find((x) => x.slug === "c-ref");
    assert.ok(nrRef, "Khóa trỏ ô có ref phải vào needs_research");
    assert.match(nrRef.reason, /có ref "redis#cache", không thể tạo khóa trực tiếp/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: E-04 - evaluation bị vô hiệu hóa khi catalog có thêm khóa mới chưa được đối chiếu", () => {
  const { tmpDir, pathsDir, evalsDir, catFile, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "n1", title: "Node 1", layer: "foundation", requires: [], coverage: "empty" }
      ]
    });

    // Catalog có 1 khóa active
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "existing-prod-course", title: "Existing", state: "produced", content_state: "complete" }
      ]
    }, null, 2));

    makeBacklog(planDir, [
      { slug: "c1", title: "Khóa 1", status: "chosen", path_node: { path: "solana", node: "n1" } }
    ]);

    // Case A: Evaluation có compared_catalog_slugs rỗng (thiếu existing-prod-course) -> needs_research
    makeEval(evalsDir, {
      slug: "c1",
      catalog: { verdict: "new", basis: "Mới" },
      compared_catalog_slugs: [],
      feasibility: { verdict: "feasible" },
      handoff: { title: "Title", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    let res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null);
    const nr = res.needs_research.find((x) => x.slug === "c1");
    assert.ok(nr, "Evaluation thiếu khóa mới trong catalog phải vào needs_research");
    assert.match(nr.reason, /Catalog có khóa mới chưa đối chiếu trong evaluation: existing-prod-course/);

    // Case B: Evaluation cập nhật đối chiếu existing-prod-course -> sẵn sàng được pick
    makeEval(evalsDir, {
      slug: "c1",
      catalog: { verdict: "new", basis: "Mới" },
      compared_catalog_slugs: ["existing-prod-course"],
      feasibility: { verdict: "feasible" },
      handoff: { title: "Title", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick);
    assert.strictEqual(res.pick.slug, "c1");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: V-05 - prerequisite có course trong catalog nhưng node coverage khác covered -> vẫn blocked (không có catalog bypass)", () => {
  const { tmpDir, pathsDir, evalsDir, catFile, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "accounts", title: "Accounts", layer: "foundation", requires: [], course_slug: "solana-accounts", coverage: "partial" },
        { id: "anchor", title: "Anchor", layer: "core", requires: ["accounts"], coverage: "empty" }
      ]
    });

    // Catalog có khóa accounts với content_state complete
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "solana-accounts", title: "Accounts Course", state: "produced", content_state: "complete" }
      ]
    }, null, 2));

    makeBacklog(planDir, [
      { slug: "c-anchor", title: "Khóa Anchor", status: "chosen", path_node: { path: "solana", node: "anchor" } }
    ]);

    makeEval(evalsDir, {
      slug: "c-anchor",
      catalog: { verdict: "new", basis: "Mới" },
      feasibility: { verdict: "feasible" },
      handoff: { title: "Anchor", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    // Case 1: Node accounts coverage: "partial" -> c-anchor bị blocked (V-05)
    let res = decideNext({ repoRoot: tmpDir });
    assert.strictEqual(res.pick, null, "Không được pick khi prerequisite node chưa covered và chưa có proposal chosen/produced");
    assert.strictEqual(res.blocked.length, 1);
    assert.strictEqual(res.blocked[0].slug, "c-anchor");
    assert.deepStrictEqual(res.blocked[0].blocked_by, ["accounts"]);

    // Case 2: Node accounts được cập nhật coverage: "covered" -> c-anchor được pick
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "accounts", title: "Accounts", layer: "foundation", requires: [], course_slug: "solana-accounts", coverage: "covered" },
        { id: "anchor", title: "Anchor", layer: "core", requires: ["accounts"], coverage: "empty" }
      ]
    });

    res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick, "Khóa c-anchor phải được pick khi prerequisite node đã covered");
    assert.strictEqual(res.pick.slug, "c-anchor");
    assert.strictEqual(res.blocked.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next: prerequisite node covered nhưng catalog thiếu content_state hoặc có content_state unknown -> sẵn sàng kèm warning", () => {
  const { tmpDir, pathsDir, evalsDir, catFile, planDir } = setupFixture();
  try {
    makeMap(pathsDir, {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Solana Map",
      status: "approved",
      nodes: [
        { id: "accounts", title: "Accounts", layer: "foundation", requires: [], course_slug: "solana-accounts", coverage: "covered" },
        { id: "anchor", title: "Anchor", layer: "core", requires: ["accounts"], coverage: "empty" }
      ]
    });

    makeBacklog(planDir, [
      { slug: "c-anchor", title: "Khóa Anchor", status: "chosen", path_node: { path: "solana", node: "anchor" } }
    ]);

    makeEval(evalsDir, {
      slug: "c-anchor",
      catalog: { verdict: "new", basis: "Mới" },
      feasibility: { verdict: "feasible" },
      handoff: { title: "Anchor", audience: "All", level: "beginner", scope_note: "Phạm vi" }
    });

    // Subcase 1: content_state === "unknown"
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "solana-accounts", title: "Accounts Course", state: "in_catalog", content_state: "unknown" }
      ]
    }, null, 2));

    let res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick, "Khóa phải được pick khi prerequisite node đã covered");
    assert.strictEqual(res.pick.slug, "c-anchor");
    assert.strictEqual(res.blocked.length, 0);
    assert.ok(
      res.warnings.some((w) => w.includes("solana-accounts") && w.includes("có content_state unknown")),
      "Phải có warning về content_state unknown: " + res.warnings.join("; ")
    );

    // Subcase 2: thiếu content_state nhưng state = "produced"
    fs.writeFileSync(catFile, JSON.stringify({
      courses: [
        { slug: "solana-accounts", title: "Accounts Course", state: "produced" }
      ]
    }, null, 2));

    res = decideNext({ repoRoot: tmpDir });
    assert.ok(res.pick, "Khóa phải được pick khi prerequisite node đã covered");
    assert.strictEqual(res.pick.slug, "c-anchor");
    assert.strictEqual(res.blocked.length, 0);
    assert.ok(
      res.warnings.some((w) => w.includes("solana-accounts") && w.includes("thiếu content_state")),
      "Phải có warning về thiếu content_state: " + res.warnings.join("; ")
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// .claude/skills/course-planner/test/plan-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { lintPlans } from "../scripts/plan-lint.mjs";

test("plan-lint: AC3 - phát hiện chu trình, trả ok: false và ghi lại đúng các cạnh", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-cycle-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    // Path có chu trình: A requires B, B requires A
    const pathContent = {
      slug: "cycle-path",
      title: "Lộ trình Chu trình",
      axis: "role",
      goal: "Mục tiêu",
      audience: "Đối tượng",
      entry_level: "intermediate",
      scope: ["A"],
      out_of_scope: ["B"],
      status: "approved",
      priority: 1,
      evidence: [{ claim: "Cần thiết", kind: "direct", urls: ["https://example.com"], observed_on: "2026-11-13" }],
      missing_evidence: [],
      courses: [
        {
          slug: "course-a",
          title: "Khóa A",
          task: "Nhiệm vụ A",
          level: "intermediate",
          scope: ["Chủ đề A"],
          out_of_scope: ["Chủ đề ngoài A"],
          suggested_order: 1,
          is_foundation: false,
          requires: [{ slug: "course-b", reason: "Khóa A cần kiến thức của Khóa B" }]
        },
        {
          slug: "course-b",
          title: "Khóa B",
          task: "Nhiệm vụ B",
          level: "intermediate",
          scope: ["Chủ đề B"],
          out_of_scope: ["Chủ đề ngoài B"],
          suggested_order: 2,
          is_foundation: false,
          requires: [{ slug: "course-a", reason: "Khóa B cần kiến thức của Khóa A" }]
        }
      ]
    };

    fs.writeFileSync(path.join(pathsDir, "cycle-path.json"), JSON.stringify(pathContent, null, 2));

    const result = lintPlans(tmpDir);
    assert.strictEqual(result.ok, false, "Có chu trình thì lint phải trả về không ok");
    assert.ok(result.cycleEdges.length >= 2, "Phải ghi nhận ít nhất 2 cạnh của chu trình");

    const edgeAB = result.cycleEdges.find((e) => e.from === "course-a" && e.to === "course-b");
    const edgeBA = result.cycleEdges.find((e) => e.from === "course-b" && e.to === "course-a");
    assert.ok(edgeAB, "Phải có cạnh A -> B");
    assert.ok(edgeBA, "Phải có cạnh B -> A");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("plan-lint: edge case requires.slug trỏ tới khóa chỉ có trong catalog", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-cat-req-"));
  try {
    const planDir = path.join(tmpDir, ".course-plan");
    const pathsDir = path.join(planDir, "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    // Catalog có sẵn khóa 'rust-basics'
    fs.writeFileSync(path.join(planDir, "catalog.json"), JSON.stringify({
      courses: [{ slug: "rust-basics", title: "Cơ bản Rust", state: "produced" }]
    }));

    const pathContent = {
      slug: "rust-adv-path",
      title: "Lộ trình Rust Nâng cao",
      axis: "skill",
      goal: "Mục tiêu",
      audience: "Đối tượng",
      entry_level: "intermediate",
      scope: ["Rust"],
      out_of_scope: [],
      status: "approved",
      priority: 2,
      evidence: [{ claim: "Tuyển dụng nhiều", kind: "direct", urls: ["https://example.com"], observed_on: "2026-11-13" }],
      missing_evidence: [],
      courses: [
        {
          slug: "rust-async",
          title: "Rust Async",
          task: "Nhiệm vụ",
          level: "intermediate",
          scope: ["Async/await"],
          out_of_scope: ["Sync IO"],
          suggested_order: 1,
          is_foundation: false,
          requires: [{ slug: "rust-basics", reason: "Cần nắm vững cú pháp Rust cơ bản" }]
        }
      ]
    };

    fs.writeFileSync(path.join(pathsDir, "rust-adv-path.json"), JSON.stringify(pathContent, null, 2));

    const result = lintPlans(tmpDir);
    assert.strictEqual(result.ok, true, "Khóa yêu cầu tiên quyết từ catalog hợp lệ");
    assert.strictEqual(result.problems.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("plan-lint: báo lỗi khi requires.slug không tồn tại hoặc reason rỗng", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-invalid-req-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    const pathContent = {
      slug: "invalid-req-path",
      title: "Path Lỗi",
      axis: "role",
      goal: "G",
      audience: "A",
      entry_level: "intermediate",
      scope: ["S"],
      out_of_scope: [],
      status: "approved",
      priority: 1,
      evidence: [{ claim: "C", kind: "direct", urls: ["https://u"], observed_on: "2026-11-13" }],
      missing_evidence: [],
      courses: [
        {
          slug: "c1",
          title: "Khóa 1",
          task: "T",
          level: "intermediate",
          scope: ["S1"],
          out_of_scope: ["O1"],
          suggested_order: 1,
          is_foundation: false,
          requires: [
            { slug: "non-existent-course", reason: "Lý do" },
            { slug: "c1", reason: "   " } // reason rỗng
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(pathsDir, "invalid-req-path.json"), JSON.stringify(pathContent, null, 2));

    const result = lintPlans(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("non-existent-course") && p.includes("không tồn tại")));
    assert.ok(result.problems.some((p) => p.includes("reason rỗng")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("plan-lint: V-07 - an toàn không crash khi evidence hoặc courses chứa phần tử null", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-null-elem-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    const pathWithNulls = {
      slug: "null-path",
      title: "Path Nulls",
      axis: "role",
      goal: "G",
      audience: "A",
      entry_level: "beginner",
      scope: ["S"],
      out_of_scope: [],
      status: "approved",
      priority: 1,
      evidence: [null, { claim: "C", kind: "direct", urls: ["https://ex.com"], observed_on: "2026-11-13" }],
      missing_evidence: [],
      courses: [null, { slug: "c1", title: "Khóa 1", task: "T", level: "beginner", scope: ["S"], out_of_scope: ["O"], suggested_order: 1, is_foundation: false, requires: [] }]
    };

    fs.writeFileSync(path.join(pathsDir, "null-path.json"), JSON.stringify(pathWithNulls, null, 2));

    // Không ném TypeError crash
    assert.doesNotThrow(() => {
      const res = lintPlans(tmpDir);
      assert.strictEqual(res.ok, false, "Có phần tử null phải báo lỗi");
      assert.ok(res.problems.some((p) => p.includes("null") || p.includes("không hợp lệ")));
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("plan-lint: E-02 - path beginner không có ô khởi đầu -> lỗi", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-e02-starter-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    // Path beginner nhưng khóa duy nhất lại có requires -> treo
    const pathContent = {
      slug: "beg-no-starter",
      title: "Path Beginner Treo",
      axis: "skill",
      goal: "G",
      audience: "A",
      entry_level: "beginner",
      scope: ["S"],
      out_of_scope: [],
      status: "approved",
      priority: 1,
      evidence: [{ claim: "C", kind: "direct", urls: ["https://u"], observed_on: "2026-11-13" }],
      missing_evidence: [],
      courses: [
        {
          slug: "c1",
          title: "Khóa 1",
          task: "T",
          level: "beginner",
          scope: ["S1"],
          out_of_scope: ["O1"],
          suggested_order: 1,
          is_foundation: false,
          requires: [{ slug: "some-other", reason: "cần" }]
        }
      ]
    };

    fs.writeFileSync(path.join(pathsDir, "beg-no-starter.json"), JSON.stringify(pathContent, null, 2));

    const result = lintPlans(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes('không có ô khởi đầu')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("plan-lint: E-02 - ô thiếu task rỗng hoặc thiếu ranh giới (scope/out_of_scope) -> lỗi", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-e02-boundary-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    const pathContent = {
      slug: "missing-boundary",
      title: "Path Thiếu Ranh Giới",
      axis: "skill",
      goal: "G",
      audience: "A",
      entry_level: "intermediate",
      scope: ["S"],
      out_of_scope: [],
      status: "approved",
      priority: 1,
      evidence: [{ claim: "C", kind: "direct", urls: ["https://u"], observed_on: "2026-11-13" }],
      missing_evidence: [],
      courses: [
        {
          slug: "c1",
          title: "Khóa 1",
          task: "   ", // task rỗng
          level: "intermediate",
          scope: [], // scope rỗng
          out_of_scope: ["O1"],
          suggested_order: 1,
          is_foundation: false,
          requires: []
        },
        {
          slug: "c2",
          title: "Khóa 2",
          task: "T2",
          level: "intermediate",
          scope: ["S2"],
          // thiếu out_of_scope
          suggested_order: 2,
          is_foundation: false,
          requires: []
        }
      ]
    };

    fs.writeFileSync(path.join(pathsDir, "missing-boundary.json"), JSON.stringify(pathContent, null, 2));

    const result = lintPlans(tmpDir);
    assert.strictEqual(result.ok, false);
    assert.ok(result.problems.some((p) => p.includes("khóa thiếu task hoặc task rỗng")));
    assert.ok(result.problems.some((p) => p.includes("khóa thiếu scope hoặc scope rỗng")));
    assert.ok(result.problems.some((p) => p.includes("khóa thiếu out_of_scope hoặc out_of_scope rỗng")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// .claude/skills/course-planner/test/catalog-snapshot.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { takeCatalogSnapshot } from "../scripts/catalog-snapshot.mjs";

test("catalog-snapshot: AC11 - quét trên fixture cô lập nhận đúng 2 khóa hiện có và state produced", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cat-snap-fixture-"));
  try {
    const fixtureRepo = path.resolve(".claude/skills/course-planner/test/fixtures/repo");
    fs.cpSync(fixtureRepo, tmpDir, { recursive: true });
    const catalog = takeCatalogSnapshot(tmpDir);

    assert.ok(catalog);
    assert.ok(Array.isArray(catalog.courses));
    assert.strictEqual(catalog.courses.length, 2);

    const rust = catalog.courses.find((c) => c.slug === "rust-error-handling");
    assert.ok(rust, "Phải tìm thấy rust-error-handling");
    assert.strictEqual(rust.state, "produced");
    assert.strictEqual(rust.level, "intermediate");
    assert.ok(rust.modules.length > 0);

    const sc = catalog.courses.find((c) => c.slug === "smart-contract-reading-before-interacting");
    assert.ok(sc, "Phải tìm thấy smart-contract-reading-before-interacting");
    assert.strictEqual(sc.state, "produced");
    assert.strictEqual(sc.level, "beginner");
    assert.ok(sc.modules.length > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("catalog-snapshot: phân loại đúng in_production, produced và in_catalog trên fixture cô lập", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cat-snap-"));
  try {
    const runsDir = path.join(tmpDir, ".course-runs");
    fs.mkdirSync(runsDir, { recursive: true });

    // Khóa 1: chỉ có brief -> in_production
    const k1 = path.join(runsDir, "c1-brief-only");
    fs.mkdirSync(k1, { recursive: true });
    fs.writeFileSync(path.join(k1, "brief.json"), JSON.stringify({ slug: "c1-brief-only", title: "Khóa 1", level: "beginner" }));

    // Khóa 2: đủ lesson và mọi review pass -> produced
    const k2 = path.join(runsDir, "c2-produced");
    fs.mkdirSync(path.join(k2, "lessons"), { recursive: true });
    fs.mkdirSync(path.join(k2, "reviews"), { recursive: true });
    fs.writeFileSync(path.join(k2, "brief.json"), JSON.stringify({ slug: "c2-produced", title: "Khóa 2", level: "intermediate" }));
    fs.writeFileSync(path.join(k2, "curriculum.json"), JSON.stringify({
      modules: [{ module_id: "M1", title: "Mod 1", lessons: [{ lesson_id: "L1", title: "Bài 1" }] }]
    }));
    fs.writeFileSync(path.join(k2, "lessons", "L1.json"), JSON.stringify({ title: "Bài 1" }));
    fs.writeFileSync(path.join(k2, "reviews", "L1.json"), JSON.stringify({ verdict: "pass" }));
    fs.writeFileSync(path.join(k2, "reviews", "curriculum.json"), JSON.stringify({ verdict: "pass" }));

    // Khóa 3: export DB -> in_catalog
    const planDir = path.join(tmpDir, ".course-plan");
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, "catalog-export.json"), JSON.stringify([
      { slug: "c3-db", title: "Khóa 3 DB", level: "advanced", state: "in_catalog", source: "db_export" }
    ]));

    const result = takeCatalogSnapshot(tmpDir);
    assert.strictEqual(result.courses.length, 3);

    const r1 = result.courses.find((c) => c.slug === "c1-brief-only");
    const r2 = result.courses.find((c) => c.slug === "c2-produced");
    const r3 = result.courses.find((c) => c.slug === "c3-db");

    assert.strictEqual(r1.state, "in_production");
    assert.strictEqual(r2.state, "produced");
    assert.strictEqual(r3.state, "in_catalog");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("catalog-snapshot: E-01 - handoff slug X -> snapshot sau khi có brief.json vẫn một mục X", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cat-snap-e01-"));
  try {
    const runsDir = path.join(tmpDir, ".course-runs");
    const kDir = path.join(runsDir, "course-x");
    fs.mkdirSync(kDir, { recursive: true });

    // Ban đầu chỉ có handoff
    fs.writeFileSync(path.join(kDir, "handoff.json"), JSON.stringify({ slug: "course-x", title: "Khóa X" }));
    let result = takeCatalogSnapshot(tmpDir);
    assert.strictEqual(result.courses.length, 1);
    assert.strictEqual(result.courses[0].slug, "course-x");
    assert.strictEqual(result.courses[0].state, "in_production");

    // Sau đó author tạo brief.json cùng slug
    fs.writeFileSync(path.join(kDir, "brief.json"), JSON.stringify({ slug: "course-x", title: "Khóa X", level: "beginner" }));
    result = takeCatalogSnapshot(tmpDir);
    assert.strictEqual(result.courses.length, 1);
    assert.strictEqual(result.courses[0].slug, "course-x");
    assert.strictEqual(result.courses[0].state, "in_production");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("catalog-snapshot: E-01 - brief.slug khác tên thư mục -> cảnh báo có tên cả hai", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cat-snap-e01-warn-"));
  try {
    const runsDir = path.join(tmpDir, ".course-runs");
    const kDir = path.join(runsDir, "folder-name");
    fs.mkdirSync(kDir, { recursive: true });
    fs.writeFileSync(path.join(kDir, "brief.json"), JSON.stringify({ slug: "different-slug", title: "Khóa lệch" }));

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      takeCatalogSnapshot(tmpDir);
    } finally {
      console.warn = origWarn;
    }

    const warnMsg = warnings.find((w) => w.includes("different-slug") && w.includes("folder-name"));
    assert.ok(warnMsg, "Cảnh báo phải nêu rõ cả brief.slug và folderName: " + warnings.join("; "));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("catalog-snapshot: E-01 - export DB dùng slug lệch đã khai báo ánh xạ -> một mục duy nhất, state in_catalog", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cat-snap-e01-alias-"));
  try {
    const planDir = path.join(tmpDir, ".course-plan");
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(
      path.join(planDir, "slug-aliases.json"),
      JSON.stringify({ "legacy-old-slug": "canonical-new-slug" })
    );
    fs.writeFileSync(
      path.join(planDir, "catalog-export.json"),
      JSON.stringify([
        { slug: "legacy-old-slug", title: "Khóa cũ", level: "beginner", state: "in_catalog", source: "db_export" },
      ])
    );

    const result = takeCatalogSnapshot(tmpDir);
    assert.strictEqual(result.courses.length, 1);
    assert.strictEqual(result.courses[0].slug, "canonical-new-slug");
    assert.strictEqual(result.courses[0].state, "in_catalog");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("catalog-snapshot: AC6 - kiểm tra đúng lessons_total, lessons_published và content_state ở cả 4 trạng thái", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cat-snap-ac6-"));
  try {
    const planDir = path.join(tmpDir, ".course-plan");
    fs.mkdirSync(planDir, { recursive: true });

    const exportData = [
      {
        slug: "c-empty-no-lessons",
        title: "Khóa rỗng không có bài",
        modules: []
      },
      {
        slug: "c-empty-zero-pub",
        title: "Khóa rỗng chưa publish bài nào",
        modules: [
          {
            id: "m1",
            lessons: [
              { id: "l1", title: "Bài 1", published: false },
              { id: "l2", title: "Bài 2", published: false }
            ]
          }
        ]
      },
      {
        slug: "c-partial",
        title: "Khóa publish dở dang",
        modules: [
          {
            id: "m1",
            lessons: [
              { id: "l1", title: "Bài 1", published: true },
              { id: "l2", title: "Bài 2", published: false }
            ]
          }
        ]
      },
      {
        slug: "c-complete",
        title: "Khóa hoàn tất",
        modules: [
          {
            id: "m1",
            lessons: [
              { id: "l1", title: "Bài 1", published: true },
              { id: "l2", title: "Bài 2", published: true }
            ]
          }
        ]
      },
      {
        slug: "c-unknown-legacy",
        title: "Khóa export cũ không có cột published",
        modules: [
          {
            id: "m1",
            lessons: [
              { id: "l1", title: "Bài 1" },
              { id: "l2", title: "Bài 2" }
            ]
          }
        ]
      }
    ];

    fs.writeFileSync(path.join(planDir, "catalog-export.json"), JSON.stringify(exportData, null, 2));

    const result = takeCatalogSnapshot(tmpDir);
    assert.strictEqual(result.courses.length, 5);

    const emptyNo = result.courses.find((c) => c.slug === "c-empty-no-lessons");
    assert.strictEqual(emptyNo.lessons_total, 0);
    assert.strictEqual(emptyNo.lessons_published, 0);
    assert.strictEqual(emptyNo.content_state, "empty");

    const emptyZero = result.courses.find((c) => c.slug === "c-empty-zero-pub");
    assert.strictEqual(emptyZero.lessons_total, 2);
    assert.strictEqual(emptyZero.lessons_published, 0);
    assert.strictEqual(emptyZero.content_state, "empty");

    const partial = result.courses.find((c) => c.slug === "c-partial");
    assert.strictEqual(partial.lessons_total, 2);
    assert.strictEqual(partial.lessons_published, 1);
    assert.strictEqual(partial.content_state, "partial");

    const complete = result.courses.find((c) => c.slug === "c-complete");
    assert.strictEqual(complete.lessons_total, 2);
    assert.strictEqual(complete.lessons_published, 2);
    assert.strictEqual(complete.content_state, "complete");

    const unknown = result.courses.find((c) => c.slug === "c-unknown-legacy");
    assert.strictEqual(unknown.lessons_total, 2);
    assert.strictEqual(unknown.lessons_published, 0);
    assert.strictEqual(unknown.content_state, "unknown");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

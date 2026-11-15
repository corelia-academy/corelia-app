// .claude/skills/course-planner/test/export-catalog.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exportCatalog } from "../scripts/export-catalog.mjs";
import { takeCatalogSnapshot } from "../scripts/catalog-snapshot.mjs";

test("export-catalog: W4 - thành công ghi export mới và snapshot ra content_state khác unknown", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-cat-success-"));
  try {
    const mockDbOutput = JSON.stringify([
      {
        slug: "solana-anchor-dev",
        title: "Khóa Lập trình Solana Anchor",
        level: "intermediate",
        state: "in_catalog",
        source: "db_export",
        is_updating: false,
        goals: ["Hiểu Anchor"],
        outcomes: ["Tự build program"],
        modules: [
          {
            id: "m1",
            title: "Module 1",
            lessons: [
              { id: "l1", title: "Bài 1", published: true },
              { id: "l2", title: "Bài 2", published: true },
            ],
          },
        ],
      },
    ]);

    const res = exportCatalog(tmpDir, {
      runner: () => mockDbOutput,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.coursesCount, 1);

    const exportPath = path.join(tmpDir, ".course-plan", "catalog-export.json");
    assert.ok(fs.existsSync(exportPath));
    const saved = JSON.parse(fs.readFileSync(exportPath, "utf8"));
    assert.strictEqual(saved.source, "local_db");
    assert.ok(saved.exported_at);

    // Chạy snapshot trên tmpDir
    const snapshot = takeCatalogSnapshot(tmpDir);
    assert.strictEqual(snapshot.courses.length, 1);
    const course = snapshot.courses[0];
    assert.strictEqual(course.slug, "solana-anchor-dev");
    assert.strictEqual(course.lessons_total, 2);
    assert.strictEqual(course.lessons_published, 2);
    assert.strictEqual(course.content_state, "complete"); // khác unknown!
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("export-catalog: W4 - lệnh lỗi thì export cũ giữ nguyên byte và có cảnh báo", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-cat-err-"));
  try {
    const planDir = path.join(tmpDir, ".course-plan");
    fs.mkdirSync(planDir, { recursive: true });
    const exportFile = path.join(planDir, "catalog-export.json");
    const originalContent = JSON.stringify({ original: "data-giu-nguyen-byte" }, null, 2);
    fs.writeFileSync(exportFile, originalContent, "utf8");

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    let res;
    try {
      res = exportCatalog(tmpDir, {
        runner: () => {
          throw new Error("Cannot connect to the Docker daemon");
        },
      });
    } finally {
      console.warn = origWarn;
    }

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.keptExisting, true);
    assert.ok(warnings.some((w) => w.includes("Container local không chạy") || w.includes("Docker daemon")));

    // File cũ giữ nguyên từng byte
    const currentContent = fs.readFileSync(exportFile, "utf8");
    assert.strictEqual(currentContent, originalContent);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("export-catalog: W4 - output hỏng JSON thì không ghi đè export cũ", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-cat-bad-json-"));
  try {
    const planDir = path.join(tmpDir, ".course-plan");
    fs.mkdirSync(planDir, { recursive: true });
    const exportFile = path.join(planDir, "catalog-export.json");
    const originalContent = JSON.stringify({ original: "valid-json-must-stay" }, null, 2);
    fs.writeFileSync(exportFile, originalContent, "utf8");

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));

    let res;
    try {
      res = exportCatalog(tmpDir, {
        runner: () => "ERROR: relation \"courses\" does not exist (INVALID JSON)",
      });
    } finally {
      console.warn = origWarn;
    }

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.keptExisting, true);
    assert.ok(warnings.some((w) => w.includes("không phải JSON hợp lệ")));

    // Không ghi đè file cũ
    const currentContent = fs.readFileSync(exportFile, "utf8");
    assert.strictEqual(currentContent, originalContent);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


test("export-catalog & rank: W-13 - runner lỗi -> snapshot và bảng có cảnh báo kèm thời điểm; runner thành công -> không cảnh báo", async () => {
  const { rankShortlist, formatShortlistTable } = await import("../scripts/rank.mjs");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-cat-w13-"));
  try {
    const planDir = path.join(tmpDir, ".course-plan");
    fs.mkdirSync(planDir, { recursive: true });
    const exportFile = path.join(planDir, "catalog-export.json");
    const oldExportedAt = "2026-11-13T10:00:00.000Z";

    // Khởi tạo file export cũ
    fs.writeFileSync(
      exportFile,
      JSON.stringify(
        {
          exported_at: oldExportedAt,
          source: "local_db",
          courses: [
            {
              slug: "existing-course",
              title: "Khóa Hiện Có",
              level: "beginner",
              modules: [{ id: "m1", lessons: [{ id: "l1", published: true }] }],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const mockShortlist = {
      shortlist: [
        {
          pitch_slug: "new-course",
          title: "Khóa Mới",
          promise: "Tự làm dApp",
          direction: { axis: "blockchain", entry: "Web3" },
          starting_point: { requires: ["existing-course"] },
          feasibility: "feasible",
          tools: [],
          criteria: {
            practical: { met: true, basis: "Đạt", refs: ["r1"] },
            actionable: { met: true, basis: "Đạt", refs: ["r1"] },
            measurable: { met: true, basis: "Đạt", refs: ["r1"] },
            foundational: { met: true, basis: "Đạt", refs: ["r1"] },
            novel: { met: true, basis: "Đạt", refs: ["r1"] },
            rigorous: { met: true, basis: "Đạt", refs: ["r1"] },
            continues_catalog: { met: true, basis: "Đạt", refs: ["existing-course"] },
          },
        },
      ],
    };

    // --- Case 1: Runner lỗi ---
    const snapshotWarns = [];
    const origWarn = console.warn;
    console.warn = (...args) => snapshotWarns.push(args.join(" "));

    let staleSnapshot;
    try {
      // 1. Export lỗi -> giữ export cũ và đánh dấu status stale
      exportCatalog(tmpDir, {
        runner: () => {
          throw new Error("Connection failed");
        },
      });
      // 2. Snapshot -> in cảnh báo và ghi metadata stale
      staleSnapshot = takeCatalogSnapshot(tmpDir);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(
      snapshotWarns.some((w) => w.includes(`catalog lấy từ export cũ (thời điểm ${oldExportedAt})`)),
      "Snapshot phải in cảnh báo khi export cũ"
    );
    assert.strictEqual(staleSnapshot.export_metadata?.export_status, "stale");

    // 3. Rank shortlist và xuất bảng -> bảng phải có cảnh báo kèm thời điểm
    const rankedStale = rankShortlist(mockShortlist, staleSnapshot, { toolChecker: () => true });
    const tableStale = formatShortlistTable(rankedStale);
    assert.ok(
      tableStale.includes(`⚠️ Cảnh báo: catalog lấy từ export cũ (thời điểm ${oldExportedAt})`),
      "Bảng rank phải có dòng cảnh báo catalog cũ kèm thời điểm"
    );

    // --- Case 2: Runner thành công ---
    const freshDbOutput = JSON.stringify([
      {
        slug: "existing-course",
        title: "Khóa Hiện Có Mới Nhất",
        level: "beginner",
        modules: [{ id: "m1", lessons: [{ id: "l1", published: true }] }],
      },
    ]);

    const freshWarns = [];
    console.warn = (...args) => freshWarns.push(args.join(" "));

    let freshSnapshot;
    try {
      exportCatalog(tmpDir, {
        runner: () => freshDbOutput,
      });
      freshSnapshot = takeCatalogSnapshot(tmpDir);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(
      !freshWarns.some((w) => w.includes("catalog lấy từ export cũ")),
      "Snapshot không được in cảnh báo khi export thành công"
    );
    assert.notStrictEqual(freshSnapshot.export_metadata?.export_status, "stale");

    const rankedFresh = rankShortlist(mockShortlist, freshSnapshot, { toolChecker: () => true });
    const tableFresh = formatShortlistTable(rankedFresh);
    assert.ok(
      !tableFresh.includes("catalog lấy từ export cũ"),
      "Bảng rank không được có cảnh báo khi export mới"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


test("export-catalog & rank: W-15 - runner lỗi và chưa có export -> snapshot có warnings khác rỗng, bảng rank có dòng cảnh báo", async () => {
  const { rankShortlist, formatShortlistTable } = await import("../scripts/rank.mjs");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-cat-w15-"));
  try {
    const mockShortlist = {
      shortlist: [
        {
          pitch_slug: "new-course",
          title: "Khóa Mới",
          promise: "Tự làm dApp",
          direction: { axis: "blockchain", entry: "Web3" },
          starting_point: { requires: [] },
          feasibility: "feasible",
          tools: [],
          criteria: {
            practical: { met: true, basis: "Đạt", refs: ["r1"] },
            actionable: { met: true, basis: "Đạt", refs: ["r1"] },
            measurable: { met: true, basis: "Đạt", refs: ["r1"] },
            foundational: { met: true, basis: "Đạt", refs: ["r1"] },
            novel: { met: true, basis: "Đạt", refs: ["r1"] },
            rigorous: { met: true, basis: "Đạt", refs: ["r1"] },
            continues_catalog: { met: false, basis: "Khóa khởi đầu", refs: [] },
          },
        },
      ],
    };

    const snapshotWarns = [];
    const origWarn = console.warn;
    console.warn = (...args) => snapshotWarns.push(args.join(" "));

    let missingSnapshot;
    try {
      // 1. Export lỗi khi chưa từng có export
      const expRes = exportCatalog(tmpDir, {
        runner: () => {
          throw new Error("Docker daemon not running");
        },
      });
      assert.strictEqual(expRes.success, false);
      assert.strictEqual(expRes.keptExisting, false);

      // 2. Snapshot -> có warnings khác rỗng và export_status: missing
      missingSnapshot = takeCatalogSnapshot(tmpDir);
    } finally {
      console.warn = origWarn;
    }

    assert.ok(
      snapshotWarns.some((w) => w.includes("chưa có export catalog từ DB local")),
      "Snapshot phải in cảnh báo khi chưa có export và runner lỗi"
    );
    assert.strictEqual(missingSnapshot.export_metadata?.export_status, "missing");
    assert.ok(Array.isArray(missingSnapshot.warnings) && missingSnapshot.warnings.length > 0, "Snapshot phải có warnings khác rỗng");
    assert.ok(
      missingSnapshot.warnings.some((w) => w.includes("chưa có export catalog từ DB local")),
      "Warnings của snapshot phải nêu rõ chưa có export catalog từ DB local"
    );

    // 3. Rank shortlist và xuất bảng
    const ranked = rankShortlist(mockShortlist, missingSnapshot, { toolChecker: () => true });
    const table = formatShortlistTable(ranked);
    assert.ok(
      table.includes("⚠️ Cảnh báo: chưa có export catalog từ DB local, catalog chỉ gồm các khóa trong .course-runs/"),
      "Bảng rank phải có dòng cảnh báo chưa có export catalog"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("export-catalog & catalog-snapshot: AC-01 - xuất đúng published_lessons và lesson_counts; cảnh báo khi thiếu", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-cat-ac01-"));
  try {
    // 1. Giả lập DB export có cả bài published, bài nháp (published: false)
    const mockDbOutput = JSON.stringify([
      {
        slug: "solana-bootcamp",
        title: "Solana Bootcamp",
        level: "all",
        state: "in_catalog",
        source: "db_export",
        is_updating: false,
        goals: [],
        outcomes: [],
        lesson_counts: { total: 5, published: 2 },
        published_lessons: [
          { section_title: "Chương 1", title: "Bài 1.1", section_order: 1, lesson_order: 1 },
          { section_title: "Chương 2", title: "Bài 2.1", section_order: 2, lesson_order: 1 },
        ],
        modules: [
          {
            id: "s1",
            title: "Chương 1",
            lessons: [
              { id: "l1", title: "Bài 1.1", published: true },
              { id: "l2", title: "Bài 1.2 Nháp", published: false },
            ],
          },
          {
            id: "s2",
            title: "Chương 2",
            lessons: [
              { id: "l3", title: "Bài 2.1", published: true },
              { id: "l4", title: "Bài 2.2 Nháp", published: false },
              { id: "l5", title: "Bài 2.3 Nháp", published: false },
            ],
          },
        ],
      },
    ]);

    const res = exportCatalog(tmpDir, {
      runner: () => mockDbOutput,
    });
    assert.strictEqual(res.success, true);

    const snapshot = takeCatalogSnapshot(tmpDir);
    const course = snapshot.courses.find((c) => c.slug === "solana-bootcamp");
    assert.ok(course);
    assert.deepStrictEqual(course.lesson_counts, { total: 5, published: 2 });
    assert.strictEqual(course.published_lessons.length, 2);
    assert.strictEqual(course.published_lessons[0].title, "Bài 1.1");
    assert.strictEqual(course.published_lessons[1].title, "Bài 2.1");
    // Không chứa tên bài nháp trong published_lessons
    assert.strictEqual(course.published_lessons.some((l) => l.title.includes("Nháp")), false);

    // 2. Case export cũ thiếu published_lessons -> catalog snapshot phải ghi warning
    const staleExportPath = path.join(tmpDir, ".course-plan", "catalog-export.json");
    fs.writeFileSync(
      staleExportPath,
      JSON.stringify({
        exported_at: new Date().toISOString(),
        source: "local_db",
        courses: [
          {
            slug: "old-course",
            title: "Old Course",
            modules: [{ id: "m1", lessons: [{ id: "l1", published: true }] }],
          },
        ],
      }),
      "utf8"
    );

    const staleSnapshot = takeCatalogSnapshot(tmpDir);
    assert.ok(
      staleSnapshot.warnings.some((w) => w.includes("thiếu published_lessons")),
      "Catalog snapshot phải có cảnh báo thiếu published_lessons khi đọc export cũ"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

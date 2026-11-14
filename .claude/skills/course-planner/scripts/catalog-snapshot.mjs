// .claude/skills/course-planner/scripts/catalog-snapshot.mjs
// Đọc .course-runs/*/ và file export tùy chọn .course-plan/catalog-export.json, ghi .course-plan/catalog.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function calculateContentState(modules) {
  let lessons_total = 0;
  let lessons_published = 0;
  let hasAnyPublishedField = false;

  for (const m of modules || []) {
    for (const l of m.lessons || []) {
      lessons_total++;
      if (typeof l.published === "boolean") {
        hasAnyPublishedField = true;
        if (l.published) {
          lessons_published++;
        }
      }
    }
  }

  let content_state = "unknown";
  if (lessons_total === 0) {
    content_state = "empty";
  } else if (!hasAnyPublishedField) {
    content_state = "unknown";
  } else if (lessons_published === 0) {
    content_state = "empty";
  } else if (lessons_published < lessons_total) {
    content_state = "partial";
  } else {
    content_state = "complete";
  }

  return { lessons_total, lessons_published, content_state };
}

export function takeCatalogSnapshot(repoRoot = ".", options = {}) {
  const root = path.resolve(repoRoot);
  const courseRunsDir = path.join(root, ".course-runs");
  const coursePlanDir = path.join(root, ".course-plan");
  const exportFile = path.join(coursePlanDir, "catalog-export.json");
  const catalogOutputFile = path.join(coursePlanDir, "catalog.json");
  const aliasesFile = path.join(coursePlanDir, "slug-aliases.json");

  // Đọc bảng ánh xạ slug cũ nếu có
  let slugAliases = {};
  if (fs.existsSync(aliasesFile)) {
    try {
      slugAliases = JSON.parse(fs.readFileSync(aliasesFile, "utf8"));
    } catch (err) {
      console.warn(`[catalog-snapshot] Cảnh báo đọc ${aliasesFile}: ${err.message}`);
    }
  }

  // Đọc file export tùy chọn từ DB nếu có
  let dbCourses = [];
  let exportMetadata = null;
  if (fs.existsSync(exportFile)) {
    try {
      const raw = fs.readFileSync(exportFile, "utf8");
      const parsed = JSON.parse(raw);
      dbCourses = Array.isArray(parsed) ? parsed : (parsed.courses ?? []);
      if (!Array.isArray(parsed) && parsed.exported_at) {
        exportMetadata = { exported_at: parsed.exported_at, source: parsed.source || "db_export" };
      } else {
        const stats = fs.statSync(exportFile);
        exportMetadata = { exported_at: stats.mtime.toISOString(), source: "db_export" };
      }
    } catch (err) {
      console.warn(`[catalog-snapshot] Cảnh báo đọc ${exportFile}: ${err.message}`);
    }
  }

  // W-13: Đọc file trạng thái export nếu có hoặc từ options
  const statusFile = path.join(coursePlanDir, ".catalog-export-status.json");
  let exportStatus = options.exportStatus || null;
  if (!exportStatus && fs.existsSync(statusFile)) {
    try {
      const parsedStatus = JSON.parse(fs.readFileSync(statusFile, "utf8"));
      exportStatus = parsedStatus.status || null;
    } catch {}
  }

  if (exportMetadata && exportStatus === "stale") {
    exportMetadata.export_status = "stale";
  } else if (!exportMetadata && exportStatus === "stale") {
    exportMetadata = {
      exported_at: null,
      source: "none",
      export_status: "missing",
    };
  }

  let staleWarning = null;
  if (exportMetadata?.export_status === "stale") {
    staleWarning = `catalog lấy từ export cũ (thời điểm ${exportMetadata.exported_at})`;
    console.warn(`[catalog-snapshot] Cảnh báo: ${staleWarning}`);
  } else if (exportMetadata?.export_status === "missing") {
    staleWarning = "chưa có export catalog từ DB local, catalog chỉ gồm các khóa trong .course-runs/";
    console.warn(`[catalog-snapshot] Cảnh báo: ${staleWarning}`);
  }

  const coursesMap = new Map();

  // Nạp các khóa từ DB export, áp dụng ánh xạ slug cũ nếu có
  for (const c of dbCourses) {
    if (!c || !c.slug) continue;
    const resolvedSlug = slugAliases[c.slug] || c.slug;
    const modules = Array.isArray(c.modules) ? c.modules : [];
    const stats = calculateContentState(modules);

    coursesMap.set(resolvedSlug, {
      slug: resolvedSlug,
      title: c.title || resolvedSlug,
      level: c.level || "all",
      state: "in_catalog",
      source: c.source || "db_export",
      is_updating: Boolean(c.is_updating),
      goals: Array.isArray(c.goals) ? c.goals : [],
      modules,
      outcomes: Array.isArray(c.outcomes) ? c.outcomes : [],
      lessons_total: stats.lessons_total,
      lessons_published: stats.lessons_published,
      content_state: stats.content_state
    });
  }

  // Quét các thư mục trong .course-runs/
  if (fs.existsSync(courseRunsDir)) {
    const entries = fs.readdirSync(courseRunsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const folderName = ent.name;
      const runDir = path.join(courseRunsDir, folderName);
      const briefFile = path.join(runDir, "brief.json");
      const handoffFile = path.join(runDir, "handoff.json");
      const curFile = path.join(runDir, "curriculum.json");

      const hasBrief = fs.existsSync(briefFile);
      const hasHandoff = fs.existsSync(handoffFile);

      if (!hasBrief && !hasHandoff) {
        continue;
      }

      let brief = null;
      if (hasBrief) {
        try {
          brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
        } catch (err) {
          console.warn(`[catalog-snapshot] Cảnh báo đọc ${briefFile}: ${err.message}`);
        }
      }

      let handoff = null;
      if (hasHandoff) {
        try {
          handoff = JSON.parse(fs.readFileSync(handoffFile, "utf8"));
        } catch (err) {
          console.warn(`[catalog-snapshot] Cảnh báo đọc ${handoffFile}: ${err.message}`);
        }
      }

      if (!brief && !handoff) {
        continue;
      }

      // Kiểm tra cảnh báo lệch slug giữa brief.slug và folderName
      if (brief && brief.slug && brief.slug !== folderName) {
        console.warn(`[catalog-snapshot] Cảnh báo lệch slug: brief.slug "${brief.slug}" khác tên thư mục "${folderName}" tại ${runDir}`);
      }

      let curriculum = null;
      if (fs.existsSync(curFile)) {
        try {
          curriculum = JSON.parse(fs.readFileSync(curFile, "utf8"));
        } catch (err) {
          console.warn(`[catalog-snapshot] Cảnh báo đọc ${curFile}: ${err.message}`);
        }
      }

      // Suy state từ file:
      // - có handoff.json hoặc brief.json -> in_production
      // - đủ lesson và mọi review pass (kể cả reviews/course.json nếu có) -> produced
      // - có trong file export DB -> in_catalog
      let state = "in_production";

      if (curriculum && Array.isArray(curriculum.modules) && curriculum.modules.length > 0) {
        const lessonIds = curriculum.modules.flatMap((m) =>
          (m.lessons || []).map((l) => l.lesson_id).filter(Boolean)
        );

        if (lessonIds.length > 0) {
          const lessonsDir = path.join(runDir, "lessons");
          const reviewsDir = path.join(runDir, "reviews");

          const allLessonsExist = lessonIds.every((id) =>
            fs.existsSync(path.join(lessonsDir, `${id}.json`))
          );

          let allReviewsPass = false;
          if (allLessonsExist && fs.existsSync(reviewsDir)) {
            allReviewsPass = lessonIds.every((id) => {
              const rf = path.join(reviewsDir, `${id}.json`);
              if (!fs.existsSync(rf)) return false;
              try {
                const r = JSON.parse(fs.readFileSync(rf, "utf8"));
                return r.verdict === "pass";
              } catch {
                return false;
              }
            });

            // Kiểm tra thêm review của curriculum nếu có
            const curRevFile = path.join(reviewsDir, "curriculum.json");
            if (fs.existsSync(curRevFile)) {
              try {
                const cr = JSON.parse(fs.readFileSync(curRevFile, "utf8"));
                if (cr.verdict !== "pass") {
                  allReviewsPass = false;
                }
              } catch {
                allReviewsPass = false;
              }
            }

            // E-08: Kiểm tra thêm review cấp khóa nếu có
            const courseRevFile = path.join(reviewsDir, "course.json");
            if (fs.existsSync(courseRevFile)) {
              try {
                const cr = JSON.parse(fs.readFileSync(courseRevFile, "utf8"));
                if (cr.verdict !== "pass") {
                  allReviewsPass = false;
                }
              } catch {
                allReviewsPass = false;
              }
            }
          }

          if (allLessonsExist && allReviewsPass) {
            state = "produced";
          }
        }
      }

      const modules = (curriculum?.modules || []).map((m) => ({
        id: m.module_id || m.id || "",
        title: m.title || "",
        lessons: (m.lessons || []).map((l) => ({
          id: l.lesson_id || l.id || "",
          title: l.title || ""
        }))
      }));

      // Áp dụng slug alias nếu folderName được ánh xạ
      const canonicalSlug = slugAliases[folderName] || folderName;

      // Nếu đã có từ export DB thì giữ state in_catalog
      if (coursesMap.has(canonicalSlug)) {
        const existing = coursesMap.get(canonicalSlug);
        existing.state = "in_catalog";
        if ((!existing.modules || existing.modules.length === 0) && modules.length > 0) {
          existing.modules = modules;
          const stats = calculateContentState(modules);
          existing.lessons_total = stats.lessons_total;
          existing.lessons_published = stats.lessons_published;
          existing.content_state = stats.content_state;
        }
        if ((!existing.goals || existing.goals.length === 0) && brief?.goals) {
          existing.goals = brief.goals;
        }
        if ((!existing.outcomes || existing.outcomes.length === 0) && curriculum?.outcomes) {
          existing.outcomes = curriculum.outcomes;
        }
      } else {
        const itemInfo = brief || handoff || {};
        const stats = calculateContentState(modules);
        coursesMap.set(canonicalSlug, {
          slug: canonicalSlug,
          title: itemInfo.title || itemInfo.title_en || canonicalSlug,
          level: itemInfo.level || "all",
          state,
          source: `.course-runs/${folderName}`,
          is_updating: false,
          goals: Array.isArray(itemInfo.goals) ? itemInfo.goals : [],
          modules,
          outcomes: curriculum?.outcomes || [],
          lessons_total: stats.lessons_total,
          lessons_published: stats.lessons_published,
          content_state: stats.content_state
        });
      }
    }
  }

  const coursesList = Array.from(coursesMap.values()).sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );

  const catalog = {
    generated_at: new Date().toISOString(),
    export_metadata: exportMetadata,
    warnings: staleWarning ? [staleWarning] : [],
    courses: coursesList
  };

  if (!fs.existsSync(coursePlanDir)) {
    fs.mkdirSync(coursePlanDir, { recursive: true });
  }

  fs.writeFileSync(catalogOutputFile, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] || ".";
  const catalog = takeCatalogSnapshot(root);
  console.log(`[catalog-snapshot] Đã ghi catalog gồm ${catalog.courses.length} khóa vào .course-plan/catalog.json`);
}

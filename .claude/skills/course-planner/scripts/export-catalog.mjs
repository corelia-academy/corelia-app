// .claude/skills/course-planner/scripts/export-catalog.mjs
// Xuất dữ liệu catalog từ container DB local (supabase_db_corelia-app) qua export-catalog.sql và ghi vào .course-plan/catalog-export.json.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultDockerRunner(sqlContent) {
  // Chạy docker exec -i supabase_db_corelia-app psql -U postgres -d postgres -t -A
  return execSync("docker exec -i supabase_db_corelia-app psql -U postgres -d postgres -t -A", {
    input: sqlContent,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 10000,
  });
}

export function exportCatalog(repoRoot = ".", options = {}) {
  const root = path.resolve(repoRoot);
  const planDir = path.join(root, ".course-plan");
  const exportFile = path.join(planDir, "catalog-export.json");
  const sqlFile = path.join(__dirname, "export-catalog.sql");
  const runner = options.runner || defaultDockerRunner;

  if (!fs.existsSync(planDir)) {
    fs.mkdirSync(planDir, { recursive: true });
  }

  const statusFile = path.join(planDir, ".catalog-export-status.json");
  const writeStatus = (status, extra = {}) => {
    try {
      fs.writeFileSync(statusFile, JSON.stringify({ status, at: new Date().toISOString(), ...extra }, null, 2) + "\n", "utf8");
    } catch {}
  };

  let sqlContent = "";
  try {
    sqlContent = fs.readFileSync(sqlFile, "utf8");
  } catch (err) {
    const warnMsg = `Không đọc được file SQL: ${err.message}`;
    console.warn(`[export-catalog] Không đọc được file SQL ${sqlFile}: ${err.message}`);
    writeStatus("stale", { warning: warnMsg });
    return { success: false, warning: warnMsg, keptExisting: fs.existsSync(exportFile) };
  }

  let rawOutput = "";
  try {
    rawOutput = runner(sqlContent);
  } catch (err) {
    const warnMsg = `Container local không chạy hoặc lệnh docker lỗi: ${err.message}. Giữ catalog-export.json cũ nếu có.`;
    console.warn(`[export-catalog] Cảnh báo: ${warnMsg}`);
    writeStatus("stale", { warning: warnMsg });
    return { success: false, warning: warnMsg, keptExisting: fs.existsSync(exportFile) };
  }

  let parsed = null;
  try {
    const trimmed = (rawOutput || "").trim();
    if (!trimmed) throw new Error("Output từ DB rỗng");
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const warnMsg = `Dữ liệu từ DB không phải JSON hợp lệ: ${err.message}. Giữ catalog-export.json cũ nếu có.`;
    console.warn(`[export-catalog] Cảnh báo: ${warnMsg}`);
    writeStatus("stale", { warning: warnMsg });
    return { success: false, warning: warnMsg, keptExisting: fs.existsSync(exportFile) };
  }

  const courses = Array.isArray(parsed) ? parsed : (parsed.courses ?? []);
  const exportData = {
    exported_at: new Date().toISOString(),
    source: "local_db",
    courses,
  };

  const tmpFile = path.join(planDir, `catalog-export-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(exportData, null, 2) + "\n", "utf8");
    fs.renameSync(tmpFile, exportFile);
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
    const warnMsg = `Không ghi được catalog-export.json: ${err.message}`;
    console.warn(`[export-catalog] Cảnh báo: ${warnMsg}`);
    writeStatus("stale", { warning: warnMsg });
    return { success: false, warning: warnMsg, keptExisting: fs.existsSync(exportFile) };
  }

  writeStatus("fresh", { exported_at: exportData.exported_at });
  return { success: true, exportFile, coursesCount: courses.length, exported_at: exportData.exported_at };
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] || ".";
  const res = exportCatalog(root);
  if (res.success) {
    console.log(`[export-catalog] Đã xuất thành công ${res.coursesCount} khóa vào ${res.exportFile} (${res.exported_at})`);
  } else {
    console.log(`[export-catalog] Bỏ qua export mới: ${res.warning}`);
  }
}

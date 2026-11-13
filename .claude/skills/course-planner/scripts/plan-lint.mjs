// .claude/skills/course-planner/scripts/plan-lint.mjs
// Kiểm schema path; requires.slug tồn tại; reason không rỗng; không có chu trình trên toàn bộ path.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_AXES = new Set(["role", "skill", "ecosystem"]);
const VALID_ENTRY_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const VALID_STATUSES = new Set(["draft", "approved"]);
const VALID_EVIDENCE_KINDS = new Set(["direct", "inferred"]);

export function lintPlans(repoRoot = ".") {
  const root = path.resolve(repoRoot);
  const pathsDir = path.join(root, ".course-plan", "paths");
  const catalogFile = path.join(root, ".course-plan", "catalog.json");

  const problems = [];
  const cycleEdges = [];

  // Đọc catalog nếu có để lấy danh sách slug hợp lệ ngoài path
  const catalogSlugs = new Set();
  if (fs.existsSync(catalogFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
      const list = Array.isArray(parsed) ? parsed : (parsed.courses ?? []);
      for (const c of list) {
        if (c && c.slug) catalogSlugs.add(c.slug);
      }
    } catch {
      // Bỏ qua lỗi catalog ở bước lint path
    }
  }

  if (!fs.existsSync(pathsDir)) {
    return { ok: true, problems: [], cycleEdges: [], pathsChecked: 0 };
  }

  const files = fs.readdirSync(pathsDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    return { ok: true, problems: [], cycleEdges: [], pathsChecked: 0 };
  }

  const paths = [];
  const allPathCourseSlugs = new Set();

  for (const file of files) {
    const fullPath = path.join(pathsDir, file);
    let p = null;
    try {
      p = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (err) {
      problems.push(`${file}: JSON không hợp lệ: ${err.message}`);
      continue;
    }

    const fileSlug = file.replace(/\.json$/, "");
    if (!p.slug || typeof p.slug !== "string") {
      problems.push(`${file}: slug không được để trống`);
    } else if (p.slug !== fileSlug) {
      problems.push(`${file}: slug "${p.slug}" không khớp tên file "${fileSlug}"`);
    }

    if (!p.title || typeof p.title !== "string" || !p.title.trim()) {
      problems.push(`${file}: title không được để trống`);
    }

    if (typeof p.goal !== "string") {
      problems.push(`${file}: goal phải là chuỗi`);
    }

    if (typeof p.audience !== "string") {
      problems.push(`${file}: audience phải là chuỗi`);
    }

    if (!VALID_AXES.has(p.axis)) {
      problems.push(`${file}: axis "${p.axis}" không hợp lệ (phải là role|skill|ecosystem)`);
    }

    if (!VALID_ENTRY_LEVELS.has(p.entry_level)) {
      problems.push(`${file}: entry_level "${p.entry_level}" không hợp lệ (phải là beginner|intermediate|advanced)`);
    }

    if (!VALID_STATUSES.has(p.status)) {
      problems.push(`${file}: status "${p.status}" không hợp lệ (phải là draft|approved)`);
    }

    if (typeof p.priority !== "number" || !Number.isInteger(p.priority) || p.priority < 1) {
      problems.push(`${file}: priority phải là số nguyên >= 1`);
    }

    if (!Array.isArray(p.scope)) {
      problems.push(`${file}: scope phải là mảng chuỗi`);
    }
    if (!Array.isArray(p.out_of_scope)) {
      problems.push(`${file}: out_of_scope phải là mảng chuỗi`);
    }
    if (!Array.isArray(p.missing_evidence)) {
      problems.push(`${file}: missing_evidence phải là mảng chuỗi`);
    }

    if (!Array.isArray(p.evidence)) {
      problems.push(`${file}: evidence phải là mảng`);
    } else {
      p.evidence.forEach((ev, idx) => {
        if (!ev || typeof ev !== "object") {
          problems.push(`${file}: evidence[${idx}] bị null hoặc không phải object`);
          return;
        }
        if (typeof ev.claim !== "string") {
          problems.push(`${file}: evidence[${idx}].claim không hợp lệ`);
        }
        if (!VALID_EVIDENCE_KINDS.has(ev.kind)) {
          problems.push(`${file}: evidence[${idx}].kind "${ev.kind}" không hợp lệ (phải là direct|inferred)`);
        }
        if (!Array.isArray(ev.urls)) {
          problems.push(`${file}: evidence[${idx}].urls phải là mảng chuỗi`);
        }
        if (!ev.observed_on || typeof ev.observed_on !== "string") {
          problems.push(`${file}: evidence[${idx}].observed_on phải là chuỗi YYYY-MM-DD`);
        }
      });
    }

    if (!Array.isArray(p.courses)) {
      problems.push(`${file}: courses phải là mảng`);
    } else {
      for (const c of p.courses) {
        if (c && typeof c === "object" && c.slug) {
          allPathCourseSlugs.add(c.slug);
        }
      }

      // E-02: Path có entry_level: "beginner" phải có ít nhất một ô khởi đầu (level: "beginner" và requires rỗng)
      if (p.entry_level === "beginner" && p.courses.length > 0) {
        const hasBeginnerStarter = p.courses.some(
          (c) => c && c.level === "beginner" && (!Array.isArray(c.requires) || c.requires.length === 0)
        );
        if (!hasBeginnerStarter) {
          problems.push(
            `${file}: path có entry_level "beginner" nhưng không có ô khởi đầu (cần ít nhất một khóa level "beginner" và không có requires)`
          );
        }
      }
    }

    paths.push({ file, data: p });
  }

  // Tập slug hợp lệ: từ các path + từ catalog.json
  const validSlugs = new Set([...allPathCourseSlugs, ...catalogSlugs]);

  // Kiểm tra từng khóa và requires
  // Xây dựng đồ thị phụ thuộc để tìm chu trình
  // Cạnh u -> v: khóa u yêu cầu khóa v (u requires v)
  const adj = new Map(); // slug -> Set of required slugs
  const edgeDetails = new Map(); // `${u}->${v}` -> reason

  for (const { file, data: p } of paths) {
    if (!Array.isArray(p.courses)) continue;
    for (const c of p.courses) {
      if (!c || typeof c !== "object") {
        problems.push(`${file}: phần tử trong courses bị null hoặc không phải object`);
        continue;
      }
      if (!c.slug || typeof c.slug !== "string") {
        problems.push(`${file}: khóa thiếu slug`);
        continue;
      }
      if (!c.title || typeof c.title !== "string" || !c.title.trim()) {
        problems.push(`${file} (${c.slug}): khóa thiếu title`);
      }
      if (!c.task || typeof c.task !== "string" || !c.task.trim()) {
        problems.push(`${file} (${c.slug}): khóa thiếu task hoặc task rỗng`);
      }
      if (!Array.isArray(c.scope) || c.scope.length === 0 || !c.scope.every((s) => typeof s === "string" && s.trim())) {
        problems.push(`${file} (${c.slug}): khóa thiếu scope hoặc scope rỗng (cần mảng chuỗi)`);
      }
      if (!Array.isArray(c.out_of_scope) || c.out_of_scope.length === 0 || !c.out_of_scope.every((s) => typeof s === "string" && s.trim())) {
        problems.push(`${file} (${c.slug}): khóa thiếu out_of_scope hoặc out_of_scope rỗng (cần mảng chuỗi nêu ranh giới)`);
      }
      if (typeof c.level !== "string") {
        problems.push(`${file} (${c.slug}): khóa thiếu level hoặc level không phải chuỗi`);
      }
      if (typeof c.suggested_order !== "number") {
        problems.push(`${file} (${c.slug}): khóa thiếu suggested_order hoặc suggested_order không phải số`);
      }
      if (typeof c.is_foundation !== "boolean") {
        problems.push(`${file} (${c.slug}): khóa thiếu is_foundation hoặc is_foundation không phải boolean`);
      }

      if (!adj.has(c.slug)) {
        adj.set(c.slug, new Set());
      }

      if (!Array.isArray(c.requires)) {
        problems.push(`${file} (${c.slug}): requires phải là mảng`);
        continue;
      }

      for (const req of c.requires) {
        if (!req || typeof req !== "object" || typeof req.slug !== "string") {
          problems.push(`${file} (${c.slug}): requires có phần tử thiếu slug hoặc không phải object`);
          continue;
        }

        if (!validSlugs.has(req.slug)) {
          problems.push(`${file} (${c.slug}): requires.slug "${req.slug}" không tồn tại trong path nào hoặc catalog`);
        }

        if (!req.reason || typeof req.reason !== "string" || !req.reason.trim()) {
          problems.push(`${file} (${c.slug}): requires "${req.slug}" có reason rỗng hoặc không phải chuỗi`);
        }

        adj.get(c.slug).add(req.slug);
        edgeDetails.set(`${c.slug}->${req.slug}`, req.reason || "");
      }
    }
  }

  // Tìm chu trình bằng DFS 3 trạng thái: 0: unvisited, 1: visiting, 2: visited
  const visited = new Map();
  const parent = new Map();
  const allNodes = Array.from(adj.keys());

  function dfs(u) {
    visited.set(u, 1);
    const neighbors = adj.get(u) || new Set();
    for (const v of neighbors) {
      if (!adj.has(v)) {
        // v là khóa ngoài chỉ có trong catalog, không có outgoing requires
        continue;
      }
      if (visited.get(v) === 1) {
        // Phát hiện chu trình: trace ngược từ u về v
        const cycle = [v, u];
        let curr = u;
        while (curr !== v && parent.has(curr)) {
          curr = parent.get(curr);
          cycle.push(curr);
        }
        cycle.reverse();

        // Ghi lại các cạnh trong chu trình
        for (let i = 0; i < cycle.length - 1; i++) {
          const from = cycle[i];
          const to = cycle[i + 1];
          const edgeKey = `${from}->${to}`;
          cycleEdges.push({
            from,
            to,
            reason: edgeDetails.get(edgeKey) || ""
          });
        }
      } else if (!visited.has(v)) {
        parent.set(v, u);
        dfs(v);
      }
    }
    visited.set(u, 2);
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  if (cycleEdges.length > 0) {
    problems.push(`Phát hiện chu trình phụ thuộc (${cycleEdges.length} cạnh)`);
  }

  return {
    ok: problems.length === 0,
    problems,
    cycleEdges,
    pathsChecked: paths.length
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] || ".";
  const result = lintPlans(root);
  if (!result.ok) {
    console.error(`[plan-lint] LỖI: Tìm thấy ${result.problems.length} vấn đề:`);
    for (const prob of result.problems) {
      console.error(`  - ${prob}`);
    }
    if (result.cycleEdges.length > 0) {
      console.error("[plan-lint] Các cạnh tạo thành chu trình:");
      for (const e of result.cycleEdges) {
        console.error(`  ${e.from} -> ${e.to}${e.reason ? ` (lý do: ${e.reason})` : ""}`);
      }
    }
    process.exit(1);
  } else {
    console.log(`[plan-lint] Đạt: ${result.pathsChecked} path kiểm tra thành công, không có lỗi chu trình hay schema.`);
    process.exit(0);
  }
}

// .claude/skills/course-planner/scripts/next.mjs
// Tính toán khóa nên tạo tiếp theo (pick) và danh sách kế tiếp (queue) dựa trên skill map và backlog.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNodeSatisfied } from "./plan-lint.mjs";

export function decideNext({
  repoRoot = ".",
  nowDate = null,
  onlySlug = null,
} = {}) {
  const root = path.resolve(repoRoot);
  const pathsDir = path.join(root, ".course-plan", "paths");
  const catalogFile = path.join(root, ".course-plan", "catalog.json");
  const evaluationsDir = path.join(root, ".course-plan", "evaluations");
  const backlogFile = path.join(root, ".course-plan", "backlog.json");

  // 1. Đọc catalog.json
  const catalogMap = new Map();
  if (fs.existsSync(catalogFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
      const list = Array.isArray(raw) ? raw : (raw.courses ?? []);
      for (const c of list) {
        if (c && c.slug) {
          catalogMap.set(c.slug, c);
        }
      }
    } catch {}
  }

  // 2. Đọc các skill map từ .course-plan/paths/
  const allMaps = new Map();
  if (fs.existsSync(pathsDir)) {
    const files = fs.readdirSync(pathsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(pathsDir, file), "utf8"));
        if (m && m.slug) {
          allMaps.set(m.slug, m);
        }
      } catch {}
    }
  }

  // 3. Đọc backlog.json
  let proposals = [];
  if (fs.existsSync(backlogFile)) {
    try {
      const blData = JSON.parse(fs.readFileSync(backlogFile, "utf8"));
      proposals = Array.isArray(blData.proposals) ? blData.proposals : [];
    } catch {}
  }

  const updates = [];
  const rejected = [];
  const needs_research = [];
  const blocked = [];
  const readyCandidates = [];
  const allWarnings = [];

  // 4. Xác định danh sách candidate
  let candidatesToEvaluate = [];
  if (onlySlug) {
    const matched = proposals.find((p) => p.slug === onlySlug);
    if (!matched) {
      needs_research.push({
        slug: onlySlug,
        title: onlySlug,
        path_slug: "unknown",
        reason: `Backlog không chứa đề xuất có slug "${onlySlug}"`,
      });
    } else {
      candidatesToEvaluate.push(matched);
    }
  } else {
    // Không có onlySlug: quét các đề xuất đang ở status "chosen"
    candidatesToEvaluate = proposals.filter((p) => p.status === "chosen");
  }

  // 5. Đánh giá từng candidate qua các Gate mới (AC-07)
  for (const cand of candidatesToEvaluate) {
    // Điều kiện A: Đề xuất phải có status "chosen"
    if (cand.status !== "chosen") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.path_node?.path || "unknown",
        reason: `Đề xuất trong backlog có status "${cand.status || "không xác định"}" (yêu cầu "chosen")`,
      });
      continue;
    }

    // Điều kiện B: Có path_node hợp lệ
    const pathNode = cand.path_node;
    if (!pathNode || typeof pathNode !== "object" || !pathNode.path || !pathNode.node) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: "unknown",
        reason: "Đề xuất chosen thiếu path_node hợp lệ",
      });
      continue;
    }

    // Điều kiện C: Map tồn tại và có status "approved"
    const map = allMaps.get(pathNode.path);
    if (!map) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Map "${pathNode.path}" không tồn tại`,
      });
      continue;
    }

    if (map.status !== "approved") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Map "${pathNode.path}" có status "${map.status}" (yêu cầu "approved")`,
      });
      continue;
    }

    // Điều kiện D: Ô tồn tại trong map
    const node = (map.nodes || []).find((n) => n.id === pathNode.node);
    if (!node) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Ô "${pathNode.node}" không tồn tại trong map "${pathNode.path}"`,
      });
      continue;
    }

    if (node.coverage === "covered") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Ô "${pathNode.node}" trong map "${pathNode.path}" đã có coverage "covered"`,
      });
      continue;
    }

    if (node.ref != null) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Ô "${pathNode.node}" trong map "${pathNode.path}" có ref "${node.ref}", không thể tạo khóa trực tiếp`,
      });
      continue;
    }

    // Điều kiện E (AC-02 & AC-07): mọi ô trong requires đã covered hoặc đã có đề xuất chosen/produced
    const nodeRequires = Array.isArray(node.requires) ? node.requires : [];
    const unmetRequires = [];

    for (const reqId of nodeRequires) {
      const reqNode = (map.nodes || []).find((n) => n.id === reqId);

      if (reqNode?.course_slug) {
        const catReq = catalogMap.get(reqNode.course_slug);
        if (catReq && (!catReq.content_state || catReq.content_state === "unknown")) {
          allWarnings.push(
            `Khóa tiên quyết "${reqNode.course_slug}" của "${cand.slug}" ${
              !catReq.content_state ? "thiếu content_state" : "có content_state unknown"
            } (cần export catalog mới)`
          );
        }
      }

      // V-05: requires chỉ thỏa khi ô tiên quyết covered hoặc có đề xuất chosen/produced
      if (!isNodeSatisfied(reqNode, proposals, pathNode.path)) {
        unmetRequires.push(reqId);
      }
    }

    if (unmetRequires.length > 0) {
      blocked.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        blocked_by: unmetRequires.sort(),
      });
      continue;
    }

    // Điều kiện F: Đánh giá file evaluation (Gate catalog, feasibility, handoff)
    const evalFile = path.join(evaluationsDir, `${cand.slug}.json`);
    if (!fs.existsSync(evalFile)) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: "Thiếu file evaluation",
      });
      continue;
    }

    let evData = null;
    try {
      evData = JSON.parse(fs.readFileSync(evalFile, "utf8"));
    } catch (err) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `File evaluation hỏng: ${err.message}`,
      });
      continue;
    }

    // Gate catalog: verdict === "new"
    const catVerdict = evData.catalog?.verdict;
    if (catVerdict === "update_existing") {
      updates.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: evData.catalog?.basis || "Cần cập nhật khóa có sẵn",
      });
      continue;
    } else if (catVerdict !== "new") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Catalog verdict không hợp lệ (${catVerdict})`,
      });
      continue;
    }

    // E-04: Kiểm tra evaluation có đối chiếu đầy đủ các khóa hiện có trong catalog hay không
    const activeCatalogSlugs = Array.from(catalogMap.values())
      .filter((c) => c.state === "produced" || c.state === "in_catalog")
      .map((c) => c.slug);

    if (Array.isArray(evData.catalog_courses) || Array.isArray(evData.compared_catalog_slugs)) {
      const comparedSlugs = new Set(evData.catalog_courses || evData.compared_catalog_slugs);
      const missingFromEval = activeCatalogSlugs.filter((s) => s !== cand.slug && !comparedSlugs.has(s));
      if (missingFromEval.length > 0) {
        needs_research.push({
          slug: cand.slug,
          title: cand.title,
          path_slug: pathNode.path,
          reason: `Catalog có khóa mới chưa đối chiếu trong evaluation: ${missingFromEval.join(", ")}`,
        });
        continue;
      }
    }

    // Gate feasibility: verdict khác not_feasible
    const feasVerdict = evData.feasibility?.verdict;
    if (feasVerdict === "not_feasible") {
      rejected.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Không khả thi: ${evData.feasibility?.basis || ""}`,
      });
      continue;
    } else if (feasVerdict !== "feasible" && feasVerdict !== "feasible_with_limits") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: `Feasibility verdict không hợp lệ (${feasVerdict})`,
      });
      continue;
    }

    // Gate handoff: đủ title, audience, level, scope_note
    const handoff = evData.handoff;
    if (
      !handoff ||
      typeof handoff.title !== "string" || !handoff.title.trim() ||
      typeof handoff.audience !== "string" || !handoff.audience.trim() ||
      typeof handoff.level !== "string" || !handoff.level.trim() ||
      typeof handoff.scope_note !== "string" || !handoff.scope_note.trim()
    ) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: pathNode.path,
        reason: "Handoff thiếu trường bắt buộc (title, audience, level, scope_note)",
      });
      continue;
    }

    readyCandidates.push({
      slug: cand.slug,
      title: cand.title,
      path_slug: pathNode.path,
      path_title: map.title,
      node_id: pathNode.node,
      layer: node.layer,
      level: cand.level || "all",
      requires: nodeRequires,
    });
  }

  // 6. Xếp thứ tự readyCandidates và chọn pick
  readyCandidates.sort((a, b) => a.slug.localeCompare(b.slug));

  const pick = readyCandidates.length > 0 ? readyCandidates[0] : null;
  const queue = readyCandidates.slice(1);

  const decision = {
    pick: pick
      ? {
          slug: pick.slug,
          title: pick.title,
          path_slug: pick.path_slug,
          path_title: pick.path_title,
          node_id: pick.node_id,
          layer: pick.layer,
          level: pick.level,
          evaluation_ref: `.course-plan/evaluations/${pick.slug}.json`,
        }
      : null,
    tie: null,
    queue: queue.map((q) => ({
      slug: q.slug,
      title: q.title,
      level: q.level,
      path_slug: q.path_slug,
      node_id: q.node_id,
      layer: q.layer,
      requires: q.requires,
    })),
    updates,
    blocked,
    needs_research,
    rejected,
    warnings: allWarnings,
    user_decision: null,
  };

  return decision;
}

export function saveDecision(decision, repoRoot = ".", customDate = null) {
  const root = path.resolve(repoRoot);
  const decisionsDir = path.join(root, ".course-plan", "decisions");
  if (!fs.existsSync(decisionsDir)) {
    fs.mkdirSync(decisionsDir, { recursive: true });
  }

  const d = customDate ? new Date(customDate) : new Date();
  const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD

  const existingFiles = fs.readdirSync(decisionsDir);
  const regex = new RegExp(`^${dateStr}-(\\d+)\\.json$`);
  let maxN = 0;
  for (const f of existingFiles) {
    const m = f.match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }

  const nextN = maxN + 1;
  const fileName = `${dateStr}-${nextN}.json`;
  const filePath = path.join(decisionsDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(decision, null, 2) + "\n", "utf8");
  return { fileName, filePath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let shouldWrite = false;
  let root = ".";
  let onlySlug = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--write") {
      shouldWrite = true;
    } else if (arg === "--only" && args[i + 1]) {
      onlySlug = args[++i];
    } else if (arg.startsWith("--only=")) {
      onlySlug = arg.slice("--only=".length);
    } else if (!arg.startsWith("--")) {
      root = arg;
    }
  }

  const decision = decideNext({ repoRoot: root, onlySlug });

  if (shouldWrite) {
    const { fileName, filePath } = saveDecision(decision, root);
    console.log(`[next] Đã ghi quyết định vào ${fileName}`);
  }

  console.log(JSON.stringify(decision, null, 2));
}

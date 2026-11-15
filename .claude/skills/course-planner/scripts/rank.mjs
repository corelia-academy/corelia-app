// .claude/skills/course-planner/scripts/rank.mjs
// Xếp hạng các đề xuất khóa học từ shortlist/backlog theo tiêu chí khách quan và in bảng Markdown.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  SHORTLIST_MIN_PROPOSALS,
  SHORTLIST_MAX_PROPOSALS,
  SHORTLIST_MIN_DIRECTIONS,
  SHORTLIST_MIN_ALTERNATIVES,
  SHORTLIST_CRITERIA_KEYS,
  MAP_LAYERS,
} from "./constants.mjs";

export {
  SHORTLIST_MIN_PROPOSALS,
  SHORTLIST_MAX_PROPOSALS,
  SHORTLIST_MIN_DIRECTIONS,
  SHORTLIST_MIN_ALTERNATIVES,
  SHORTLIST_CRITERIA_KEYS,
};

export function escapeTableCell(text) {
  if (text == null) return "";
  return String(text)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>")
    .trim();
}

export function defaultToolChecker(tool) {
  if (!tool || typeof tool !== "string") return false;
  const trimmed = tool.trim();
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return false;
  try {
    execSync(`${trimmed} --version`, { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export function rankShortlist(shortlistData, catalogData, { toolChecker = defaultToolChecker, repoRoot = ".", pathsDir = null } = {}) {
  const catalogCourses = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.courses ?? []);
  const catalogBySlug = new Map(catalogCourses.map((c) => [c.slug, c]));

  const allProposals = Array.isArray(shortlistData?.proposals)
    ? shortlistData.proposals
    : (Array.isArray(shortlistData?.shortlist) ? shortlistData.shortlist : []);

  // AC-05: Kiểm tra focus
  const focusMapSlug = typeof shortlistData?.focus === "object" && !Array.isArray(shortlistData?.focus)
    ? shortlistData.focus?.path
    : null;

  let mapData = null;
  let mapNodes = new Map();
  const depthMemo = new Map();

  function getNodeDepth(id) {
    if (depthMemo.has(id)) return depthMemo.get(id);
    const node = mapNodes.get(id);
    if (!node || !Array.isArray(node.requires) || node.requires.length === 0) {
      depthMemo.set(id, 0);
      return 0;
    }
    let maxReq = 0;
    for (const reqId of node.requires) {
      maxReq = Math.max(maxReq, getNodeDepth(reqId) + 1);
    }
    depthMemo.set(id, maxReq);
    return maxReq;
  }

  if (focusMapSlug) {
    const pDir = pathsDir || path.join(path.resolve(repoRoot), ".course-plan", "paths");
    const mapFile = path.join(pDir, `${focusMapSlug}.json`);
    if (!fs.existsSync(mapFile)) {
      return {
        needs_map: true,
        focus_map: focusMapSlug,
        message: `Chưa có skill map "${focusMapSlug}". Cần dựng map và được Human duyệt trước.`,
        total: 0,
        eligible_count: 0,
        envWarnings: [`Chưa có skill map "${focusMapSlug}". Cần chạy role 01-path.md để dựng map trước.`],
        rows: [],
      };
    }

    try {
      mapData = JSON.parse(fs.readFileSync(mapFile, "utf8"));
      mapNodes = new Map((mapData.nodes || []).map((n) => [n.id, n]));
    } catch (err) {
      return {
        needs_map: true,
        focus_map: focusMapSlug,
        message: `Lỗi đọc file map "${focusMapSlug}": ${err.message}`,
        total: 0,
        eligible_count: 0,
        envWarnings: [`File map "${focusMapSlug}" bị lỗi: ${err.message}`],
        rows: [],
      };
    }
  }

  // AC-03 & AC-05: Lọc các đề xuất open. Khi có focus, chỉ xét đề xuất open thuộc map focus
  const rawProposals = allProposals.filter((prop) => {
    if (prop?.status && prop.status !== "open") {
      return false;
    }
    if (focusMapSlug) {
      return prop?.path_node?.path === focusMapSlug;
    }
    return true;
  });

  const processed = rawProposals.map((prop) => {
    const tools = Array.isArray(prop?.tools)
      ? prop.tools.filter((t) => typeof t === "string" && t.trim())
      : [];
    const missingTools = [];
    if (typeof toolChecker === "function" && tools.length > 0) {
      for (const t of tools) {
        if (!toolChecker(t.trim())) {
          missingTools.push(t.trim());
        }
      }
    }

    const requires = Array.isArray(prop?.starting_point?.requires)
      ? prop.starting_point.requires
      : [];

    const unmetRequires = [];
    const warnings = [];

    for (const reqSlug of requires) {
      const catCourse = catalogBySlug.get(reqSlug);
      if (!catCourse) {
        unmetRequires.push(`${reqSlug} (không có trong catalog)`);
      } else if (catCourse.content_state === "empty") {
        unmetRequires.push(`${reqSlug} (khóa rỗng, chưa có bài nào publish)`);
      } else if (catCourse.content_state === "unknown" || !catCourse.content_state) {
        warnings.push(`Khóa tiên quyết "${reqSlug}" có content_state unknown (cần export catalog mới)`);
      }
    }

    const allRequiresMet = unmetRequires.length === 0;

    // Tự động tính continues_catalog
    const criteria = { ...(prop.criteria || {}) };
    if (requires.length > 0 && allRequiresMet) {
      criteria.continues_catalog = {
        met: true,
        basis: `Tiếp nối khóa học trong catalog: ${requires.join(", ")}`,
        refs: [...requires],
      };
    } else {
      criteria.continues_catalog = {
        met: false,
        basis: requires.length === 0
          ? "Khóa dành cho người mới, không yêu cầu khóa tiên quyết"
          : `Khóa tiên quyết chưa hoàn thành: ${unmetRequires.join("; ")}`,
        refs: [],
      };
    }

    const isFeasible = prop.feasibility !== "not_feasible";
    const hasAllTools = missingTools.length === 0;
    const eligible = allRequiresMet && isFeasible && hasAllTools;

    // Đếm số tiêu chí met: true
    let metCount = 0;
    const metCriteriaList = [];
    const unmetCriteriaList = [];

    for (const cKey of SHORTLIST_CRITERIA_KEYS) {
      const cObj = criteria[cKey];
      if (cObj && cObj.met === true) {
        metCount++;
        metCriteriaList.push({ key: cKey, ...cObj });
      } else {
        unmetCriteriaList.push({ key: cKey, ...(cObj || {}) });
      }
    }

    // Đếm URL bằng chứng direct
    let directUrlCount = 0;
    if (prop.why_now?.kind === "direct" && Array.isArray(prop.why_now?.urls)) {
      directUrlCount = prop.why_now.urls.filter((u) => typeof u === "string" && u.trim()).length;
    }

    // AC-05: Thông tin layer và nhánh khi có map
    let layer = null;
    let branch = null;
    let layerOrder = 999;
    let requiresDepth = 999;

    if (focusMapSlug && prop?.path_node?.node) {
      const node = mapNodes.get(prop.path_node.node);
      if (node) {
        layer = node.layer;
        branch = node.branch || null;
        const layers = mapData && mapData.kind && MAP_LAYERS[mapData.kind] ? MAP_LAYERS[mapData.kind] : [];
        layerOrder = layers.indexOf(node.layer);
        if (layerOrder < 0) layerOrder = 999;
        requiresDepth = getNodeDepth(node.id);
      }
    }

    return {
      ...prop,
      tools,
      missingTools,
      criteria,
      eligible,
      unmetRequires,
      warnings,
      metCount,
      directUrlCount,
      metCriteriaList,
      unmetCriteriaList,
      layer,
      branch,
      layerOrder,
      requiresDepth,
    };
  });

  // AC-05: Sắp xếp
  // Khóa sắp xếp chính là thứ tự layer, sau đó tới độ sâu requires; tiêu chí cũ chỉ dùng để phá hòa
  processed.sort((a, b) => {
    // 1. Nhóm đủ điều kiện đứng trước
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }

    if (a.eligible) {
      if (focusMapSlug) {
        // 2. Thứ tự layer tăng dần (foundation -> language -> core -> branch)
        if (a.layerOrder !== b.layerOrder) {
          return a.layerOrder - b.layerOrder;
        }
        // 3. Độ sâu requires tăng dần
        if (a.requiresDepth !== b.requiresDepth) {
          return a.requiresDepth - b.requiresDepth;
        }
      }

      // 4. Tiêu chí cũ để phá hòa: số tiêu chí đạt giảm dần
      if (b.metCount !== a.metCount) {
        return b.metCount - a.metCount;
      }
      // 5. Số URL direct evidence giảm dần
      if (b.directUrlCount !== a.directUrlCount) {
        return b.directUrlCount - a.directUrlCount;
      }
    }

    // 6. Slug tăng dần
    return a.slug.localeCompare(b.slug);
  });

  // Gán rank
  let currentRank = 1;
  const rows = processed.map((item) => {
    let rank = null;
    if (item.eligible) {
      rank = currentRank++;
    }
    return {
      rank,
      ...item,
    };
  });

  // Kiểm tra công cụ nền (deno, yt-dlp, docker) một lần
  const envWarnings = [];
  if (typeof toolChecker === "function") {
    const hasYtDlp = toolChecker("yt-dlp");
    const hasDeno = toolChecker("deno");
    const hasDocker = toolChecker("docker");

    if (!hasYtDlp) {
      envWarnings.push("Thiếu công cụ nền yt-dlp: khóa sẽ không có bài video.");
    }
    if (!hasDeno || !hasDocker) {
      const missingEnv = [];
      if (!hasDeno) missingEnv.push("deno");
      if (!hasDocker) missingEnv.push("docker");
      envWarnings.push(`Thiếu công cụ nền ${missingEnv.join(", ")}: luồng sẽ dừng trước bước nhập.`);
    }
  }

  // W-13 / W-15: Cảnh báo catalog lấy từ export cũ hoặc chưa có export DB local
  if (catalogData?.export_metadata?.export_status === "stale") {
    const exportedAt = catalogData.export_metadata.exported_at || "không rõ";
    envWarnings.push(`catalog lấy từ export cũ (thời điểm ${exportedAt})`);
  } else if (catalogData?.export_metadata?.export_status === "missing") {
    envWarnings.push("chưa có export catalog từ DB local, catalog chỉ gồm các khóa trong .course-runs/");
  }

  return {
    date: shortlistData?.date || null,
    total: rows.length,
    eligible_count: rows.filter((r) => r.eligible).length,
    envWarnings,
    hasMap: Boolean(focusMapSlug && mapData),
    focus_map: focusMapSlug,
    rows,
  };
}

export function formatShortlistTable(rankedResult) {
  if (rankedResult?.needs_map) {
    let out = `⚠️ Cần dựng map "${rankedResult.focus_map}" trước khi xếp hạng đề xuất.`;
    if (Array.isArray(rankedResult.envWarnings) && rankedResult.envWarnings.length > 0) {
      for (const w of rankedResult.envWarnings) {
        out += `\n⚠️ Cảnh báo: ${w}`;
      }
    }
    return out;
  }

  const hasMap = Boolean(rankedResult?.hasMap);
  const headers = hasMap
    ? ["Rank", "Khóa đề xuất", "Hướng", "Layer / Nhánh", "Cơ sở đề xuất", "Ghi chú"]
    : ["Rank", "Khóa đề xuất", "Hướng", "Cơ sở đề xuất", "Ghi chú"];

  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;

  const rowsLines = rankedResult.rows.map((row) => {
    const rankStr = row.rank != null ? String(row.rank) : "—";

    // Khóa đề xuất: title, complete_existing note, promise
    let courseDesc = `**${row.title}**`;
    if (row.kind === "complete_existing") {
      courseDesc += " *(Hoàn thiện khóa có sẵn)*";
    }
    if (row.promise) {
      courseDesc += `<br>${row.promise}`;
    }

    // Hướng: axis & entry
    const directionStr = `${row.direction?.axis || "chưa rõ"} — ${row.direction?.entry || "chưa rõ"}`;

    // Layer / Nhánh (khi có map)
    const layerBranchStr = row.branch ? `${row.layer} (${row.branch})` : (row.layer || "—");

    // Cơ sở đề xuất: từng tiêu chí đạt kèm basis rút gọn và refs[0]
    const basisParts = (row.metCriteriaList || []).map((m) => {
      const refStr = m.refs && m.refs[0] ? ` (\`${m.refs[0]}\`)` : "";
      return `• **${m.key}**: ${m.basis || "Đạt"}${refStr}`;
    });
    const basisStr = basisParts.length > 0 ? basisParts.join("<br>") : "Không có tiêu chí đạt";

    // Ghi chú: lý do không đủ điều kiện, tiêu chí chưa đạt, feasibility_with_limits, risks, missing_evidence, warnings
    const notes = [];
    if (!row.eligible) {
      if (Array.isArray(row.unmetRequires) && row.unmetRequires.length > 0) {
        notes.push(`**Chặn bởi khóa tiên quyết:** ${row.unmetRequires.join("; ")}`);
      }
      if (row.feasibility === "not_feasible") {
        notes.push(`**Không khả thi:** ${row.feasibility_basis || "Không vượt qua kiểm tra feasibility"}`);
      }
    }

    if (row.feasibility === "feasible_with_limits") {
      notes.push(`**Khả thi có giới hạn:** ${row.feasibility_basis || ""}`);
    }

    for (const unmet of (row.unmetCriteriaList || [])) {
      notes.push(`Chưa đạt \`${unmet.key}\`${unmet.basis ? `: ${unmet.basis}` : ""}`);
    }

    for (const w of (row.warnings || [])) {
      notes.push(`⚠️ ${w}`);
    }

    if (Array.isArray(row.missingTools) && row.missingTools.length > 0) {
      notes.push(`Thiếu công cụ: ${row.missingTools.join(", ")}`);
    }

    if (Array.isArray(row.risks) && row.risks.length > 0) {
      notes.push(`**Rủi ro:** ${row.risks.join("; ")}`);
    }

    if (Array.isArray(row.missing_evidence) && row.missing_evidence.length > 0) {
      notes.push(`**Thiếu bằng chứng:** ${row.missing_evidence.join("; ")}`);
    }

    const notesStr = notes.length > 0 ? notes.join("<br>") : "—";

    if (hasMap) {
      return `| ${escapeTableCell(rankStr)} | ${escapeTableCell(courseDesc)} | ${escapeTableCell(directionStr)} | ${escapeTableCell(layerBranchStr)} | ${escapeTableCell(basisStr)} | ${escapeTableCell(notesStr)} |`;
    }

    return `| ${escapeTableCell(rankStr)} | ${escapeTableCell(courseDesc)} | ${escapeTableCell(directionStr)} | ${escapeTableCell(basisStr)} | ${escapeTableCell(notesStr)} |`;
  });

  const tableLines = [headerLine, separatorLine, ...rowsLines];
  if (Array.isArray(rankedResult.envWarnings) && rankedResult.envWarnings.length > 0) {
    tableLines.push("");
    for (const w of rankedResult.envWarnings) {
      tableLines.push(`⚠️ Cảnh báo: ${w}`);
    }
  }

  return tableLines.join("\n");
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let shortlistPath = null;
  let catalogPath = null;
  let isTable = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--table") {
      isTable = true;
    } else if (args[i] === "--catalog" && args[i + 1]) {
      catalogPath = args[++i];
    } else if (!args[i].startsWith("--") && !shortlistPath) {
      shortlistPath = args[i];
    }
  }

  if (!shortlistPath) {
    console.error("Cách dùng: node rank.mjs <backlog.json> [--catalog <catalog.json>] [--table]");
    process.exit(1);
  }

  const sPath = path.resolve(shortlistPath);
  if (!fs.existsSync(sPath)) {
    console.error(`Không tìm thấy file: ${sPath}`);
    process.exit(1);
  }

  const cPath = catalogPath
    ? path.resolve(catalogPath)
    : path.resolve(".course-plan/catalog.json");

  let shortlistData = {};
  try {
    shortlistData = JSON.parse(fs.readFileSync(sPath, "utf8"));
  } catch (err) {
    console.error(`Lỗi đọc shortlist: ${err.message}`);
    process.exit(1);
  }

  let catalogData = null;
  if (fs.existsSync(cPath)) {
    try {
      catalogData = JSON.parse(fs.readFileSync(cPath, "utf8"));
    } catch (err) {
      console.error(`Lỗi đọc file catalog ${cPath}: ${err.message}`);
      process.exit(1);
    }
  }

  const ranked = rankShortlist(shortlistData, catalogData);

  if (isTable) {
    console.log(formatShortlistTable(ranked));
  } else {
    console.log(JSON.stringify(ranked, null, 2));
  }
}

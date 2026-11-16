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
  getFocusPaths,
} from "./constants.mjs";
import { isNodeSatisfied } from "./plan-lint.mjs";

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

const toolCheckCache = new Map();
export function defaultToolChecker(tool) {
  if (!tool || typeof tool !== "string") return false;
  const trimmed = tool.trim();
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return false;
  if (toolCheckCache.has(trimmed)) {
    return toolCheckCache.get(trimmed);
  }
  try {
    execSync(`${trimmed} --version`, { stdio: "ignore", timeout: 2000 });
    toolCheckCache.set(trimmed, true);
    return true;
  } catch {
    toolCheckCache.set(trimmed, false);
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

  const envWarnings = [];

  // AC-05: Hỗ trợ focus dạng { paths: string[] } hoặc { path: string }
  const focusPaths = getFocusPaths(shortlistData?.focus);

  const pDir = pathsDir || path.join(path.resolve(repoRoot), ".course-plan", "paths");
  const loadedMaps = new Map();
  const allMapOverviews = [];

  if (focusPaths && focusPaths.length > 0) {
    for (const fMapSlug of focusPaths) {
      const mapFile = path.join(pDir, `${fMapSlug}.json`);
      if (!fs.existsSync(mapFile)) {
        loadedMaps.set(fMapSlug, {
          missing: true,
          slug: fMapSlug,
          message: `Chưa có skill map "${fMapSlug}". Cần dựng map trước.`,
        });
        continue;
      }

      try {
        const mData = JSON.parse(fs.readFileSync(mapFile, "utf8"));
        const mNodes = new Map((mData.nodes || []).map((n) => [n.id, n]));
        const dMemo = new Map();

        function getDepth(id) {
          if (dMemo.has(id)) return dMemo.get(id);
          const node = mNodes.get(id);
          if (!node || !Array.isArray(node.requires) || node.requires.length === 0) {
            dMemo.set(id, 0);
            return 0;
          }
          let maxReq = 0;
          for (const reqId of node.requires) {
            maxReq = Math.max(maxReq, getDepth(reqId) + 1);
          }
          dMemo.set(id, maxReq);
          return maxReq;
        }

        const layers = mData.kind && MAP_LAYERS[mData.kind] ? MAP_LAYERS[mData.kind] : [];
        const overview = (mData.nodes || []).map((n, idx) => {
          const layer = n?.layer || "—";
          const branch = n?.branch || null;
          const layerBranch = branch ? `${layer} (${branch})` : layer;
          let layerOrder = layers.indexOf(layer);
          if (layerOrder < 0) layerOrder = 999;
          const depth = getDepth(n.id);
          const coverage = n?.coverage || "empty";
          const course_slug = n?.course_slug || null;
          const currentCourse = course_slug || "—";
          const nodeRequires = Array.isArray(n?.requires) ? n.requires : [];

          let status = "sẵn sàng";
          const unmetRequires = [];

          if (n?.ref != null) {
            status = "ref";
          } else if (coverage === "covered") {
            status = "đã phủ";
          } else {
            for (const reqId of nodeRequires) {
              const reqNode = mNodes.get(reqId);
              if (!isNodeSatisfied(reqNode, allProposals, fMapSlug)) {
                unmetRequires.push(reqId);
              }
            }
            if (unmetRequires.length > 0) {
              status = `chờ ${unmetRequires.join(", ")}`;
            } else {
              status = "sẵn sàng";
            }
          }

          return {
            id: n.id,
            title: n.title || n.id,
            layer,
            branch,
            layerBranch,
            layerOrder,
            depth,
            idx,
            coverage,
            course_slug,
            currentCourse,
            requires: nodeRequires,
            unmetRequires,
            status,
          };
        });

        overview.sort((a, b) => {
          if (a.layerOrder !== b.layerOrder) return a.layerOrder - b.layerOrder;
          if (a.depth !== b.depth) return a.depth - b.depth;
          return a.idx - b.idx;
        });

        // Đếm chuỗi ô sẵn sàng liên tiếp
        let maxConsecutiveReady = 0;
        let currentConsecutive = 0;
        for (const item of overview) {
          if (item.status === "sẵn sàng") {
            currentConsecutive++;
            if (currentConsecutive > maxConsecutiveReady) {
              maxConsecutiveReady = currentConsecutive;
            }
          } else {
            currentConsecutive = 0;
          }
        }

        const mapEntry = {
          missing: false,
          slug: fMapSlug,
          mapData: mData,
          mapNodes: mNodes,
          getNodeDepth: getDepth,
          mapOverview: overview,
          maxConsecutiveReady,
        };
        loadedMaps.set(fMapSlug, mapEntry);
        allMapOverviews.push(mapEntry);
      } catch (err) {
        loadedMaps.set(fMapSlug, {
          missing: false,
          error: err.message,
          slug: fMapSlug,
          message: `File map "${fMapSlug}" bị lỗi: ${err.message}`,
        });
      }
    }

    // Nếu chỉ có đúng 1 map trong focus mà map đó thiếu -> needs_map: true (để tương thích ngược)
    if (focusPaths.length === 1) {
      const singleMap = loadedMaps.get(focusPaths[0]);
      if (singleMap?.missing) {
        return {
          needs_map: true,
          focus_map: focusPaths[0],
          focus_maps: focusPaths,
          message: singleMap.message,
          total: 0,
          eligible_count: 0,
          envWarnings: [`Chưa có skill map "${focusPaths[0]}". Cần chạy role 01-path.md để dựng map trước.`],
          rows: [],
        };
      }
      if (singleMap?.error) {
        return {
          needs_map: true,
          focus_map: focusPaths[0],
          focus_maps: focusPaths,
          message: singleMap.message,
          total: 0,
          eligible_count: 0,
          envWarnings: [singleMap.message],
          rows: [],
        };
      }
    }
  }

  // Lọc đề xuất open của mọi map trong focus.paths
  const rawProposals = allProposals.filter((prop) => {
    if (prop?.status && prop.status !== "open") {
      return false;
    }
    if (focusPaths && focusPaths.length > 0) {
      const propMap = prop?.path_nodes?.path || prop?.path_node?.path;
      return propMap && focusPaths.includes(propMap);
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
    // AC-05: eligible KHÔNG phụ thuộc hasAllTools!
    const eligible = allRequiresMet && isFeasible;

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

    // AC-05: Thông tin layer và độ sâu requires của đề xuất
    const propMapSlug = prop?.path_nodes?.path || prop?.path_node?.path;
    const mapEntry = propMapSlug ? loadedMaps.get(propMapSlug) : null;
    let minLayerOrder = 999;
    let requiresDepth = 999;
    let layer = null;
    let branch = null;
    let layerBranch = "—";

    if (mapEntry && !mapEntry.missing && mapEntry.mapData) {
      const mData = mapEntry.mapData;
      const layers = mData.kind && MAP_LAYERS[mData.kind] ? MAP_LAYERS[mData.kind] : [];

      if (prop?.path_nodes && Array.isArray(prop.path_nodes.nodes)) {
        const nodeOrders = [];
        const nodeDepths = [];
        const nodeLayers = [];

        for (const nId of prop.path_nodes.nodes) {
          const node = mapEntry.mapNodes.get(nId);
          if (node) {
            const lIdx = layers.indexOf(node.layer);
            nodeOrders.push(lIdx >= 0 ? lIdx : 999);
            nodeDepths.push(mapEntry.getNodeDepth(node.id));
            nodeLayers.push(node.branch ? `${node.layer} (${node.branch})` : node.layer);
          }
        }

        if (nodeOrders.length > 0) {
          minLayerOrder = Math.min(...nodeOrders);
          requiresDepth = Math.min(...nodeDepths);
          layerBranch = Array.from(new Set(nodeLayers)).join(", ");
        }
      } else if (prop?.path_node?.node) {
        const node = mapEntry.mapNodes.get(prop.path_node.node);
        if (node) {
          layer = node.layer;
          branch = node.branch || null;
          layerBranch = branch ? `${layer} (${branch})` : layer;
          const lIdx = layers.indexOf(node.layer);
          minLayerOrder = lIdx >= 0 ? lIdx : 999;
          requiresDepth = mapEntry.getNodeDepth(node.id);
        }
      }
    }

    return {
      ...prop,
      mapSlug: propMapSlug || null,
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
      layerBranch,
      minLayerOrder,
      requiresDepth,
    };
  });

  // AC-05: Sắp xếp theo:
  // 1. Nhóm eligible đứng trước
  // 2. Layer thấp nhất của khóa (minLayerOrder tăng dần)
  // 3. Độ sâu requires (requiresDepth tăng dần)
  // 4. Tiêu chí cũ để phá hòa: metCount giảm dần -> directUrlCount giảm dần -> slug tăng dần
  processed.sort((a, b) => {
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }

    if (a.eligible) {
      if (a.minLayerOrder !== b.minLayerOrder) {
        return a.minLayerOrder - b.minLayerOrder;
      }
      if (a.requiresDepth !== b.requiresDepth) {
        return a.requiresDepth - b.requiresDepth;
      }
      if (b.metCount !== a.metCount) {
        return b.metCount - a.metCount;
      }
      if (b.directUrlCount !== a.directUrlCount) {
        return b.directUrlCount - a.directUrlCount;
      }
    }

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

  const hasAnyMap = allMapOverviews.length > 0;
  const firstOverview = allMapOverviews[0]?.mapOverview || null;

  return {
    date: shortlistData?.date || null,
    total: rows.length,
    eligible_count: rows.filter((r) => r.eligible).length,
    envWarnings,
    hasMap: Boolean(focusPaths && focusPaths.length > 0 && hasAnyMap),
    focus_map: focusPaths ? (focusPaths.length === 1 ? focusPaths[0] : focusPaths.join(", ")) : null,
    focus_maps: focusPaths || [],
    mapOverview: firstOverview,
    mapOverviews: loadedMaps,
    allMapOverviews,
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

  const sections = [];
  const focusMaps = rankedResult?.focus_maps || (rankedResult?.focus_map ? [rankedResult.focus_map] : []);

  // AC-05: In bảng tổng quan cho từng map focus
  if (focusMaps.length > 0) {
    const loadedMaps = rankedResult?.mapOverviews || new Map();

    for (const fMapSlug of focusMaps) {
      const mapEntry = loadedMaps.get ? loadedMaps.get(fMapSlug) : loadedMaps[fMapSlug];

      if (!mapEntry || mapEntry.missing) {
        sections.push(`### Tổng quan map: ${fMapSlug}\n\n⚠️ Chưa có skill map "${fMapSlug}". Cần dựng map trước.`);
        continue;
      }

      if (mapEntry.error) {
        sections.push(`### Tổng quan map: ${fMapSlug}\n\n⚠️ ${mapEntry.message}`);
        continue;
      }

      if (Array.isArray(mapEntry.mapOverview) && mapEntry.mapOverview.length > 0) {
        const mapHeaders = ["Layer / Nhánh", "Ô (title)", "Coverage", "Khóa hiện có", "Trạng thái"];
        const mapHeaderLine = `| ${mapHeaders.join(" | ")} |`;
        const mapSeparatorLine = `| ${mapHeaders.map(() => "---").join(" | ")} |`;
        const mapRowLines = mapEntry.mapOverview.map((item) => {
          return `| ${escapeTableCell(item.layerBranch)} | ${escapeTableCell(item.title)} | ${escapeTableCell(item.coverage)} | ${escapeTableCell(item.currentCourse)} | ${escapeTableCell(item.status)} |`;
        });

        const overviewSection = [
          focusMaps.length === 1 ? "### Tổng quan map" : `### Tổng quan map: ${fMapSlug}`,
          "",
          mapHeaderLine,
          mapSeparatorLine,
          ...mapRowLines,
        ];

        // Edge case: Map focus có < 3 ô sẵn sàng liên tiếp -> báo trong bảng tổng quan
        if (mapEntry.maxConsecutiveReady < 3) {
          overviewSection.push("", `⚠️ Map "${fMapSlug}" có < 3 ô sẵn sàng liên tiếp: không đề xuất khóa cho map này.`);
        }

        sections.push(overviewSection.join("\n"));
      }
    }
  }

  // Bảng xếp hạng đề xuất (AC-05: có cột Map và Modules khi có map)
  const hasMap = Boolean(rankedResult?.hasMap || (focusMaps.length > 0));

  const rankHeaders = hasMap
    ? ["Rank", "Map", "Khóa đề xuất", "Modules", "Layer / Nhánh", "Cơ sở đề xuất", "Ghi chú"]
    : ["Rank", "Khóa đề xuất", "Hướng", "Cơ sở đề xuất", "Ghi chú"];

  const rankHeaderLine = `| ${rankHeaders.join(" | ")} |`;
  const rankSeparatorLine = `| ${rankHeaders.map(() => "---").join(" | ")} |`;

  const rowsLines = (rankedResult.rows || []).map((row) => {
    const rankStr = row.rank != null ? String(row.rank) : "—";

    let courseDesc = `**${row.title}**`;
    if (row.kind === "complete_existing") {
      courseDesc += " *(Hoàn thiện khóa có sẵn)*";
    }
    if (row.promise) {
      courseDesc += `<br>${row.promise}`;
    }

    const mapStr = row.path_nodes?.path || row.path_node?.path || row.direction?.entry || "—";

    let modulesStr = "—";
    if (Array.isArray(row.modules) && row.modules.length > 0) {
      modulesStr = row.modules.map((m) => m?.node || m).join(", ");
    } else if (Array.isArray(row.path_nodes?.nodes) && row.path_nodes.nodes.length > 0) {
      modulesStr = row.path_nodes.nodes.join(", ");
    } else if (row.path_node?.node) {
      modulesStr = row.path_node.node;
    }

    const directionStr = `${row.direction?.axis || "chưa rõ"} — ${row.direction?.entry || "chưa rõ"}`;
    const layerBranchStr = row.layerBranch || (row.branch ? `${row.layer} (${row.branch})` : (row.layer || "—"));

    const basisParts = (row.metCriteriaList || []).map((m) => {
      const refStr = m.refs && m.refs[0] ? ` (\`${m.refs[0]}\`)` : "";
      return `• **${m.key}**: ${m.basis || "Đạt"}${refStr}`;
    });
    const basisStr = basisParts.length > 0 ? basisParts.join("<br>") : "Không có tiêu chí đạt";

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
      return `| ${escapeTableCell(rankStr)} | ${escapeTableCell(mapStr)} | ${escapeTableCell(courseDesc)} | ${escapeTableCell(modulesStr)} | ${escapeTableCell(layerBranchStr)} | ${escapeTableCell(basisStr)} | ${escapeTableCell(notesStr)} |`;
    }

    return `| ${escapeTableCell(rankStr)} | ${escapeTableCell(courseDesc)} | ${escapeTableCell(directionStr)} | ${escapeTableCell(basisStr)} | ${escapeTableCell(notesStr)} |`;
  });

  const rankSectionLines = [];
  if (hasMap) {
    rankSectionLines.push("### Bảng xếp hạng đề xuất", "");
  }

  if (rowsLines.length > 0) {
    rankSectionLines.push(rankHeaderLine, rankSeparatorLine, ...rowsLines);
  } else {
    rankSectionLines.push("*(Bảng xếp hạng rỗng — không có đề xuất khả dụng trong backlog)*");
  }

  sections.push(rankSectionLines.join("\n"));

  if (Array.isArray(rankedResult.envWarnings) && rankedResult.envWarnings.length > 0) {
    const warningLines = [];
    for (const w of rankedResult.envWarnings) {
      warningLines.push(`⚠️ Cảnh báo: ${w}`);
    }
    sections.push(warningLines.join("\n"));
  }

  return sections.join("\n\n");
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

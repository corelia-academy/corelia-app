// .claude/skills/course-planner/scripts/rank.mjs
// Xếp hạng các đề xuất khóa học từ shortlist theo tiêu chí khách quan và in bảng Markdown.
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

export function rankShortlist(shortlistData, catalogData, { toolChecker = defaultToolChecker } = {}) {
  const catalogCourses = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.courses ?? []);
  const catalogBySlug = new Map(catalogCourses.map((c) => [c.slug, c]));

  const rawProposals = Array.isArray(shortlistData?.shortlist)
    ? shortlistData.shortlist
    : [];

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
    };
  });

  // Sắp xếp 4 bậc
  processed.sort((a, b) => {
    // 1. Nhóm đủ điều kiện đứng trước
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }

    if (a.eligible) {
      // 2. Số tiêu chí đạt giảm dần
      if (b.metCount !== a.metCount) {
        return b.metCount - a.metCount;
      }
      // 3. Số URL direct evidence giảm dần
      if (b.directUrlCount !== a.directUrlCount) {
        return b.directUrlCount - a.directUrlCount;
      }
    }

    // 4. Slug tăng dần
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

  return {
    date: shortlistData?.date || null,
    round: shortlistData?.round || null,
    total: rows.length,
    eligible_count: rows.filter((r) => r.eligible).length,
    rows,
  };
}

export function formatShortlistTable(rankedResult) {
  const headers = ["Rank", "Khóa đề xuất", "Hướng", "Cơ sở đề xuất", "Ghi chú"];
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

    // Cơ sở đề xuất: từng tiêu chí đạt kèm basis rút gọn và refs[0]
    const basisParts = row.metCriteriaList.map((m) => {
      const refStr = m.refs && m.refs[0] ? ` (\`${m.refs[0]}\`)` : "";
      return `• **${m.key}**: ${m.basis || "Đạt"}${refStr}`;
    });
    const basisStr = basisParts.length > 0 ? basisParts.join("<br>") : "Không có tiêu chí đạt";

    // Ghi chú: lý do không đủ điều kiện, tiêu chí chưa đạt, feasibility_with_limits, risks, missing_evidence, warnings
    const notes = [];
    if (!row.eligible) {
      if (row.unmetRequires.length > 0) {
        notes.push(`**Chặn bởi khóa tiên quyết:** ${row.unmetRequires.join("; ")}`);
      }
      if (row.feasibility === "not_feasible") {
        notes.push(`**Không khả thi:** ${row.feasibility_basis || "Không vượt qua kiểm tra feasibility"}`);
      }
    }

    if (row.feasibility === "feasible_with_limits") {
      notes.push(`**Khả thi có giới hạn:** ${row.feasibility_basis || ""}`);
    }

    for (const unmet of row.unmetCriteriaList) {
      notes.push(`Chưa đạt \`${unmet.key}\`${unmet.basis ? `: ${unmet.basis}` : ""}`);
    }

    for (const w of row.warnings) {
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

    return `| ${escapeTableCell(rankStr)} | ${escapeTableCell(courseDesc)} | ${escapeTableCell(directionStr)} | ${escapeTableCell(basisStr)} | ${escapeTableCell(notesStr)} |`;
  });

  return [headerLine, separatorLine, ...rowsLines].join("\n");
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
    console.error("Cách dùng: node rank.mjs <shortlist.json> [--catalog <catalog.json>] [--table]");
    process.exit(1);
  }

  const sPath = path.resolve(shortlistPath);
  if (!fs.existsSync(sPath)) {
    console.error(`Không tìm thấy file shortlist: ${sPath}`);
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

  if (!fs.existsSync(cPath)) {
    console.error(`Không tìm thấy catalog tại ${cPath}. Cần chạy catalog-snapshot.mjs trước.`);
    process.exit(1);
  }

  let catalogData = null;
  try {
    catalogData = JSON.parse(fs.readFileSync(cPath, "utf8"));
  } catch (err) {
    console.error(`Lỗi đọc file catalog ${cPath}: ${err.message}`);
    process.exit(1);
  }

  const ranked = rankShortlist(shortlistData, catalogData);

  if (isTable) {
    console.log(formatShortlistTable(ranked));
  } else {
    console.log(JSON.stringify(ranked, null, 2));
  }
}

// .claude/skills/course-planner/scripts/plan-lint.mjs
// Kiểm schema skill map (ecosystem/role/skill), layer, requires, ref, sources, và backlog proposals.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHORTLIST_MIN_PROPOSALS,
  SHORTLIST_MAX_PROPOSALS,
  SHORTLIST_MIN_DIRECTIONS,
  SHORTLIST_MIN_ALTERNATIVES,
  SHORTLIST_CRITERIA_KEYS,
  BACKLOG_MIN_OPEN_PROPOSALS,
  BACKLOG_MAX_OPEN_PROPOSALS,
  BACKLOG_MIN_DIRECTIONS,
  VALID_PROPOSAL_STATUSES,
  PROMISE_FORBIDDEN_PREFIX,
  VALID_AXES,
  MAP_KINDS,
  MAP_LAYERS,
  MAP_STATUSES,
  MAP_COVERAGE_STATUSES,
  KNOWN_BAD_TOOLS,
  TOOL_NAME_REGEX,
  VALID_FINAL_ASSIGNMENT_FIELDS,
  KNOWN_BAD_ASSIGNMENT_FIELDS,
  COURSE_MIN_NODES,
  COURSE_MAX_NODES,
  MAX_OPEN_PROPOSALS_PER_MAP,
  MIN_MAPS_WITH_OPEN_PROPOSALS,
  TOOLING_KEYWORDS,
  matchesToolingKeyword,
  P1_OBSERVABLE_ACTIONS,
  P1_CODE_ACTIONS,
  getFocusPaths,
  getFocusEntries,
} from "./constants.mjs";

export {
  SHORTLIST_MIN_PROPOSALS,
  SHORTLIST_MAX_PROPOSALS,
  SHORTLIST_MIN_DIRECTIONS,
  SHORTLIST_MIN_ALTERNATIVES,
  SHORTLIST_CRITERIA_KEYS,
  BACKLOG_MIN_OPEN_PROPOSALS,
  BACKLOG_MAX_OPEN_PROPOSALS,
  BACKLOG_MIN_DIRECTIONS,
  VALID_PROPOSAL_STATUSES,
  MAP_KINDS,
  MAP_LAYERS,
  MAP_STATUSES,
  MAP_COVERAGE_STATUSES,
  KNOWN_BAD_TOOLS,
  TOOL_NAME_REGEX,
  VALID_FINAL_ASSIGNMENT_FIELDS,
  KNOWN_BAD_ASSIGNMENT_FIELDS,
  COURSE_MIN_NODES,
  COURSE_MAX_NODES,
  MAX_OPEN_PROPOSALS_PER_MAP,
  MIN_MAPS_WITH_OPEN_PROPOSALS,
  TOOLING_KEYWORDS,
  P1_OBSERVABLE_ACTIONS,
  P1_CODE_ACTIONS,
  getFocusPaths,
};

// V-05: Tiên quyết requires chỉ được coi là thỏa khi:
// 1. Ô tiên quyết có coverage === "covered", HOẶC
// 2. Backlog có đề xuất cho ô đó với status ∈ {"chosen", "produced"}.
// Không có nhánh suy diễn từ catalog partial.
export function isNodeSatisfied(reqNode, proposals = [], mapSlug = null) {
  if (!reqNode) return false;
  if (reqNode.coverage === "covered") return true;
  if (Array.isArray(proposals)) {
    return proposals.some((p) => {
      const isChosenOrProduced = p?.status === "chosen" || p?.status === "produced";
      if (!isChosenOrProduced) return false;

      if (p?.path_nodes && typeof p.path_nodes === "object") {
        const matchMap = mapSlug ? p.path_nodes.path === mapSlug : true;
        return matchMap && Array.isArray(p.path_nodes.nodes) && p.path_nodes.nodes.includes(reqNode.id);
      }

      if (p?.path_node && typeof p.path_node === "object") {
        const matchMap = mapSlug ? p.path_node.path === mapSlug : true;
        return matchMap && p.path_node.node === reqNode.id;
      }

      return false;
    });
  }
  return false;
}

export function parseCommaSeparatedList(text) {
  if (!text || typeof text !== "string") return [];
  let cleaned = text.trim().replace(/\.+$/, "").trim();
  cleaned = cleaned.replace(/,\s*và\s+/gi, ", ").replace(/\s+và\s+/gi, ", ");
  return cleaned
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function extractProposalSections(docContent) {
  const sections = {
    role: "",
    skill: "",
    ecosystem: "",
  };

  if (typeof docContent !== "string") return sections;

  const roleMatch = docContent.match(/###\s*Role-based([\s\S]*?)(?=###\s*Skill-based|$)/i);
  if (roleMatch) sections.role = roleMatch[1];

  const skillMatch = docContent.match(/###\s*Skill-based([\s\S]*?)(?=###\s*Blockchain ecosystem-based|$)/i);
  if (skillMatch) sections.skill = skillMatch[1];

  const ecoMatch = docContent.match(/###\s*Blockchain ecosystem-based([\s\S]*?)(?=##\s*Premium|$)/i);
  if (ecoMatch) sections.ecosystem = ecoMatch[1];

  return sections;
}

export function extractProposalEntries(docContent) {
  const result = {
    role: new Set(),
    skill: new Set(),
    ecosystem: new Set(),
  };

  if (typeof docContent !== "string") return result;

  const sections = extractProposalSections(docContent);

  // 1. Role-based
  if (sections.role) {
    const lines = sections.role.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- **")) continue;

      if (trimmed.includes("**Blockchain:**")) {
        result.role.add("Blockchain");
        const web3Match = trimmed.match(/bổ sung các role Web3:\s*([^.\n]+)/i);
        if (web3Match) {
          const web3Items = parseCommaSeparatedList(web3Match[1]);
          for (const item of web3Items) {
            result.role.add(item);
          }
        }
        continue;
      }

      const colonMatch = trimmed.match(/^-\s*\*\*[^*]+:\*\*\s*(.+)$/);
      if (colonMatch) {
        const items = parseCommaSeparatedList(colonMatch[1]);
        for (const item of items) {
          result.role.add(item);
        }
      }
    }
  }

  // 2. Skill-based
  if (sections.skill) {
    const lines = sections.skill.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- **")) continue;
      const colonMatch = trimmed.match(/^-\s*\*\*[^*]+:\*\*\s*(.+)$/);
      if (colonMatch) {
        const items = parseCommaSeparatedList(colonMatch[1]);
        for (const item of items) {
          result.skill.add(item);
        }
      }
    }
  }

  // 3. Blockchain ecosystem-based
  if (sections.ecosystem) {
    const ecoMatch = sections.ecosystem.match(/đề xuất:\s*([^.\n]+)/i);
    if (ecoMatch) {
      const items = parseCommaSeparatedList(ecoMatch[1]);
      for (const item of items) {
        result.ecosystem.add(item);
      }
    }
  }

  return result;
}

export function validateProposalFields(prop, idx, { catalogBySlug, entriesByAxis, add }) {
  const slug = prop?.slug || `proposal_${idx + 1}`;

  if (!prop?.slug || typeof prop.slug !== "string") {
    add(slug, "slug", "thiếu slug hoặc slug không phải chuỗi");
  }

  if (!prop?.title || typeof prop.title !== "string" || !prop.title.trim()) {
    add(slug, "title", "thiếu title hoặc title rỗng");
  }

  const direction = prop?.direction;
  if (!direction || typeof direction !== "object") {
    add(slug, "direction", "thiếu direction hoặc direction không phải object");
  } else {
    const axis = direction.axis;
    const entry = direction.entry;

    if (!VALID_AXES.has(axis)) {
      add(slug, "direction-axis", `axis "${axis}" không hợp lệ (phải là role|skill|ecosystem)`);
    }

    if (!entry || typeof entry !== "string" || !entry.trim()) {
      add(slug, "direction-entry", "entry không được để trống");
    } else {
      const cleanEntry = entry.trim();

      // So khớp trọn mục (exact match) trong danh sách tách được từ learn-proposal.md
      if (entriesByAxis) {
        const axisEntries = entriesByAxis[axis];
        if (!axisEntries || !axisEntries.has(cleanEntry)) {
          const inOtherAxis = Object.keys(entriesByAxis).find(
            (other) => other !== axis && entriesByAxis[other].has(cleanEntry)
          );
          if (inOtherAxis) {
            add(
              slug,
              "direction-entry",
              `entry "${cleanEntry}" xuất hiện trong tài liệu nhưng sai axis "${axis}" (thuộc axis "${inOtherAxis}")`
            );
          } else {
            add(
              slug,
              "direction-entry",
              `entry "${cleanEntry}" không phải là một mục hợp lệ trong tài liệu learn-proposal.md`
            );
          }
        }
      }
    }
  }

  // Kiểm tra promise
  const promise = prop?.promise;
  if (!promise || typeof promise !== "string" || !promise.trim()) {
    add(slug, "promise", "thiếu promise hoặc promise rỗng");
  } else if (PROMISE_FORBIDDEN_PREFIX.test(promise.trim())) {
    add(slug, "promise", `promise "${promise}" mở đầu bằng từ cấm (không được mở bằng hiểu, nắm, biết, tìm hiểu, làm quen)`);
  }

  // Kiểm tra alternatives >= 2 và mọi alternative có url
  const alts = prop?.alternatives;
  if (!Array.isArray(alts) || alts.length < SHORTLIST_MIN_ALTERNATIVES) {
    add(slug, "alternatives", `cần ít nhất ${SHORTLIST_MIN_ALTERNATIVES} nguồn thay thế (hiện có ${Array.isArray(alts) ? alts.length : 0})`);
  } else {
    alts.forEach((alt, aIdx) => {
      if (!alt?.url || typeof alt.url !== "string" || !alt.url.trim()) {
        add(slug, "alternatives", `nguồn thay thế thứ ${aIdx + 1} thiếu url`);
      }
    });
  }

  // Kiểm tra why_now
  const whyNow = prop?.why_now;
  if (!whyNow || typeof whyNow !== "object") {
    add(slug, "why_now", "thiếu why_now");
  } else {
    if (!Array.isArray(whyNow.urls) || whyNow.urls.length < 1) {
      add(slug, "why_now-urls", "cần ít nhất 1 URL bằng chứng trong why_now.urls");
    }
    if (whyNow.kind !== "direct" && whyNow.kind !== "inferred") {
      add(slug, "why_now-kind", `kind "${whyNow.kind}" không hợp lệ (phải là direct|inferred)`);
    }
    if (whyNow.kind === "direct") {
      if (!whyNow.quote || typeof whyNow.quote !== "string" || whyNow.quote.trim().length < 20 || whyNow.quote.trim().length > 300) {
        add(slug, "why_now-quote", 'why_now có kind: "direct" bắt buộc có quote từ 20 đến 300 ký tự');
      }
    }
  }

  // Kiểm tra criteria
  const criteria = prop?.criteria;
  if (!criteria || typeof criteria !== "object") {
    add(slug, "criteria", "thiếu criteria");
  } else {
    for (const cKey of SHORTLIST_CRITERIA_KEYS) {
      if (!(cKey in criteria)) {
        add(slug, "criteria-keys", `thiếu tiêu chí "${cKey}" trong criteria`);
        continue;
      }
      const cVal = criteria[cKey];
      if (cVal && cVal.met === true) {
        if (!cVal.basis || typeof cVal.basis !== "string" || !cVal.basis.trim()) {
          add(slug, "criteria-basis", `tiêu chí "${cKey}" có met: true nhưng basis rỗng`);
        }
        if (!Array.isArray(cVal.refs) || cVal.refs.length === 0) {
          add(slug, "criteria-refs", `tiêu chí "${cKey}" có met: true nhưng thiếu refs`);
        }
      }
    }

    // timely.met: true đòi hỏi why_now.kind === "direct" và có quote
    if (criteria.timely?.met === true) {
      if (whyNow?.kind !== "direct") {
        add(slug, "timely-direct", 'tiêu chí "timely" có met: true đòi hỏi why_now.kind phải là "direct"');
      } else if (!whyNow?.quote || typeof whyNow.quote !== "string" || whyNow.quote.trim().length < 20 || whyNow.quote.trim().length > 300) {
        add(slug, "timely-quote", 'tiêu chí "timely" có met: true đòi hỏi why_now có quote từ 20 đến 300 ký tự');
      }
    }

    // AC-05: Kiểm tra criteria.showable_product.refs
    if (criteria.showable_product?.met === true && Array.isArray(criteria.showable_product.refs)) {
      for (const r of criteria.showable_product.refs) {
        if (KNOWN_BAD_ASSIGNMENT_FIELDS.has(r)) {
          add(
            slug,
            "showable_product-refs",
            `trường nộp bài "${r}" trong showable_product.refs không hợp lệ, hãy đổi thành "transaction_url" hoặc "deployment_url"`
          );
        }
      }
    }
  }

  // AC-05: Kiểm tra final_product không chứa trường nộp bài sai chuẩn
  if (typeof prop?.final_product === "string") {
    if (/\btestnet_tx_hash\b/.test(prop.final_product)) {
      add(slug, "final_product", 'final_product chứa tên trường nộp bài sai chuẩn "testnet_tx_hash" (hãy đổi thành "transaction_url")');
    }
    if (/\bdeployed_url\b/.test(prop.final_product)) {
      add(slug, "final_product", 'final_product chứa tên trường nộp bài sai chuẩn "deployed_url" (hãy đổi thành "deployment_url")');
    }
  }

  // Kiểm tra kind vs slug vs catalog
  const kind = prop?.kind;
  if (kind === "new") {
    if (catalogBySlug.has(slug)) {
      add(slug, "kind-new", `kind là "new" nhưng slug "${slug}" đã tồn tại trong catalog`);
    }
  } else if (kind === "complete_existing") {
    const catEntry = catalogBySlug.get(slug);
    if (!catEntry) {
      add(slug, "kind-complete_existing", `kind là "complete_existing" nhưng slug "${slug}" không tồn tại trong catalog`);
    } else {
      const cState = catEntry.content_state;
      if (cState !== "empty" && cState !== "partial") {
        add(slug, "kind-complete_existing", `kind là "complete_existing" đòi hỏi catalog content_state phải là "empty" hoặc "partial" (thực tế là "${cState || "không xác định"}")`);
      }
    }
  } else {
    add(slug, "kind", `kind "${kind}" không hợp lệ (phải là new|complete_existing)`);
  }

  // V-06: Kiểm tra tools phải là tên lệnh CLI thực thi được
  if (prop?.tools != null) {
    if (!Array.isArray(prop.tools)) {
      add(slug, "tools", "tools phải là mảng chuỗi");
    } else {
      for (const t of prop.tools) {
        if (typeof t !== "string" || !TOOL_NAME_REGEX.test(t)) {
          add(slug, "tools", `tên tool "${t}" không hợp lệ (phải khớp ${TOOL_NAME_REGEX})`);
        } else if (KNOWN_BAD_TOOLS[t]) {
          add(slug, "tools", `tên tool "${t}" là tên gói/alias, hãy đổi thành "${KNOWN_BAD_TOOLS[t]}"`);
        }
      }
    }
  }
}

// AC-04: Lint skill map
export function lintMapData(mapData, { proposalDocContent = null, pathsDir = null, allMaps = null, catalogData = null } = {}) {
  const problems = [];
  const warnings = [];
  const add = (rule, detail) => problems.push(`${mapData?.slug || "map"}: ${rule}: ${detail}`);
  const addWarn = (rule, detail) => warnings.push(`${mapData?.slug || "map"}: ${rule}: ${detail}`);

  if (!mapData || typeof mapData !== "object") {
    problems.push("map: Dữ liệu map bị null hoặc không phải object");
    return { ok: false, problems, warnings };
  }

  const { slug, kind, entry, title, goal, status, sources, nodes } = mapData;

  const catalogCourses = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.courses ?? []);
  const catalogBySlug = new Map(catalogCourses.map((c) => [c.slug, c]));

  if (!slug || typeof slug !== "string" || !slug.trim()) {
    add("slug", "thiếu slug hoặc slug rỗng");
  }

  if (!kind || !MAP_KINDS.has(kind)) {
    add("kind", `kind "${kind}" không hợp lệ (phải là ecosystem|role|skill)`);
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    add("title", "thiếu title hoặc title rỗng");
  }

  if (typeof goal !== "string") {
    add("goal", "goal phải là chuỗi");
  }

  if (!status || !MAP_STATUSES.has(status)) {
    add("status", `status "${status}" không hợp lệ (phải là draft|approved)`);
  }

  // Kiểm tra entry so với learn-proposal.md
  if (proposalDocContent && typeof proposalDocContent === "string" && kind && MAP_KINDS.has(kind)) {
    const entriesByAxis = extractProposalEntries(proposalDocContent);
    const validEntries = entriesByAxis[kind];
    const cleanEntry = typeof entry === "string" ? entry.trim() : "";
    if (!cleanEntry || !validEntries || !validEntries.has(cleanEntry)) {
      add("entry", `entry "${entry}" không phải là mục hợp lệ trong learn-proposal.md (mục ${kind})`);
    }
  } else if (!entry || typeof entry !== "string" || !entry.trim()) {
    add("entry", "thiếu entry hoặc entry rỗng");
  }

  // Kiểm tra sources
  if (!Array.isArray(sources) || sources.length === 0) {
    add("sources", "sources phải là mảng không rỗng");
  } else {
    sources.forEach((src, sIdx) => {
      if (!src || typeof src !== "object") {
        add("sources", `sources[${sIdx}] không phải object`);
        return;
      }
      if (!src.url || typeof src.url !== "string" || !/^https?:\/\//i.test(src.url.trim())) {
        add("sources", `sources[${sIdx}].url không hợp lệ`);
      }
      if (!src.observed_on || typeof src.observed_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(src.observed_on)) {
        add("sources", `sources[${sIdx}].observed_on phải có định dạng YYYY-MM-DD`);
      }
    });
  }

  // Kiểm tra nodes
  if (!Array.isArray(nodes) || nodes.length === 0) {
    add("nodes", "nodes phải là mảng không rỗng");
    return { ok: problems.length === 0, problems };
  }

  const validLayers = kind && MAP_LAYERS[kind] ? MAP_LAYERS[kind] : [];
  const validLayersSet = new Set(validLayers);
  const nodeIds = new Set();
  const nodeMap = new Map();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const nId = n?.id || `node_${i + 1}`;

    if (!n?.id || typeof n.id !== "string" || !n.id.trim()) {
      add("node-id", `nodes[${i}] thiếu id hoặc id rỗng`);
    } else if (nodeIds.has(n.id)) {
      add("node-id", `id "${n.id}" bị trùng lặp trong map`);
    } else {
      nodeIds.add(n.id);
      nodeMap.set(n.id, n);
    }

    if (!n?.title || typeof n.title !== "string" || !n.title.trim()) {
      add(`${nId}:title`, "thiếu title hoặc title rỗng");
    }

    if (!n?.layer || !validLayersSet.has(n.layer)) {
      add(`${nId}:layer`, `layer "${n?.layer}" không hợp lệ cho kind "${kind}" (phải là ${validLayers.join("|")})`);
    }

    // Kiểm tra branch
    if (n?.layer === "branch") {
      if (!n.branch || typeof n.branch !== "string" || !n.branch.trim()) {
        add(`${nId}:branch`, 'ô ở layer "branch" bắt buộc có branch không rỗng');
      }
    } else {
      if (n?.branch != null) {
        add(`${nId}:branch`, `branch phải là null ở layer "${n?.layer}" (chỉ dùng ở layer "branch")`);
      }
    }

    // AC-03 (Mới): Các trường bắt buộc của ô map (mental_model, concepts, app_use, pitfalls)
    if (!n?.mental_model || typeof n.mental_model !== "string" || !n.mental_model.trim()) {
      add(`${nId}:mental_model`, "thiếu mental_model hoặc mental_model rỗng (bắt buộc một câu nêu cơ chế)");
    }

    if (!Array.isArray(n?.concepts) || n.concepts.length < 2 || !n.concepts.every((c) => typeof c === "string" && c.trim())) {
      add(`${nId}:concepts`, "concepts phải là mảng ít nhất 2 khái niệm (chuỗi không rỗng)");
    }

    if (!Array.isArray(n?.app_use) || n.app_use.length < 1 || !n.app_use.every((u) => typeof u === "string" && u.trim())) {
      add(`${nId}:app_use`, "app_use phải là mảng ít nhất 1 cách dùng cơ chế khi build app");
    }

    if (!Array.isArray(n?.pitfalls) || n.pitfalls.length < 1 || !n.pitfalls.every((p) => typeof p === "string" && p.trim())) {
      add(`${nId}:pitfalls`, "pitfalls phải là mảng ít nhất 1 lỗi hoặc bẫy bảo mật hay gặp");
    }

    // AC-03 & V-12: Không có ô riêng chỉ để cài đặt hoặc công cụ (ngoại lệ: allow_tooling: true + reason)
    // So khớp theo từ hoặc cụm từ trọn vẹn (có ranh giới từ), không theo chuỗi con.
    // Ô chỉ bị chặn khi khớp từ khóa VÀ mọi mục trong scope cũng khớp từ khóa công cụ.
    const titleText = n?.title || "";
    const idText = n?.id || "";
    const matchesTitleOrId = TOOLING_KEYWORDS.some((kw) =>
      matchesToolingKeyword(titleText, kw) ||
      matchesToolingKeyword(idText.replace(/-/g, " "), kw) ||
      matchesToolingKeyword(idText, kw)
    );

    let isTooling = false;
    if (matchesTitleOrId) {
      const scopeList = Array.isArray(n?.scope) ? n.scope : [];
      if (scopeList.length === 0) {
        isTooling = true;
      } else {
        isTooling = scopeList.every((item) =>
          typeof item === "string" &&
          TOOLING_KEYWORDS.some((kw) => matchesToolingKeyword(item, kw))
        );
      }
    }

    if (isTooling) {
      if (n?.allow_tooling !== true || typeof n?.reason !== "string" || !n.reason.trim()) {
        add(`${nId}:allow_tooling`, 'ô công cụ không được phép tồn tại riêng lẻ trừ khi có allow_tooling: true kèm reason giải thích hợp lệ');
      }
    }

    // AC-03: Kiểm tra coverage và mối quan hệ với course_slug, covered_lessons
    if (!n?.coverage || !MAP_COVERAGE_STATUSES.has(n.coverage)) {
      add(`${nId}:coverage`, `coverage "${n?.coverage}" không hợp lệ (phải là empty|partial|covered)`);
    } else if (n.coverage === "empty") {
      if (n.course_slug != null) {
        add(`${nId}:coverage`, 'coverage là "empty" thì course_slug phải là null');
      }
      if (Array.isArray(n.covered_lessons) && n.covered_lessons.length > 0) {
        add(`${nId}:coverage`, 'coverage là "empty" thì không được có covered_lessons');
      }
    } else {
      // partial hoặc covered
      if (!n.course_slug || typeof n.course_slug !== "string" || !n.course_slug.trim()) {
        add(`${nId}:coverage`, `coverage là "${n.coverage}" bắt buộc phải có course_slug`);
      }
      if (!Array.isArray(n.covered_lessons) || n.covered_lessons.length === 0) {
        add(`${nId}:coverage`, `coverage là "${n.coverage}" bắt buộc phải có covered_lessons (mảng { title, teaches } không rỗng)`);
      } else {
        for (let cIdx = 0; cIdx < n.covered_lessons.length; cIdx++) {
          const item = n.covered_lessons[cIdx];
          if (typeof item === "string" || !item || typeof item !== "object") {
            add(`${nId}:covered_lessons`, `covered_lessons[${cIdx}] không phải là object { title, teaches } (không được dùng chuỗi)`);
          } else {
            if (!item.title || typeof item.title !== "string" || !item.title.trim()) {
              add(`${nId}:covered_lessons`, `covered_lessons[${cIdx}] thiếu title hoặc title rỗng`);
            }
            if (!item.teaches || typeof item.teaches !== "string" || !item.teaches.trim()) {
              add(`${nId}:covered_lessons`, `covered_lessons[${cIdx}] thiếu teaches hoặc teaches rỗng (phải nêu cơ chế bài đó dạy)`);
            }
          }
        }
      }

      // V-09: Kiểm tra course_slug và covered_lessons đối chiếu với catalogData
      if (catalogBySlug.size > 0 && n.course_slug) {
        const catCourse = catalogBySlug.get(n.course_slug);
        if (!catCourse) {
          add(`${nId}:course_slug`, `course_slug "${n.course_slug}" không tồn tại trong catalog`);
        } else {
          if (!Array.isArray(catCourse.published_lessons)) {
            const warnMsg = `catalog thiếu published_lessons cho khóa "${n.course_slug}"`;
            addWarn(`${nId}:published_lessons`, warnMsg);
            console.warn(`[plan-lint] Cảnh báo: ${mapData?.slug || "map"}: ${nId}: ${warnMsg}`);
          } else {
            const publishedTitles = new Set(
              catCourse.published_lessons
                .map((pl) => (typeof pl === "string" ? pl : pl?.title))
                .filter(Boolean)
                .map((t) => t.trim())
            );
            for (const item of (n.covered_lessons || [])) {
              const itemTitle = typeof item === "string" ? item.trim() : (item?.title ? String(item.title).trim() : "");
              if (itemTitle && !publishedTitles.has(itemTitle)) {
                add(
                  `${nId}:covered_lessons`,
                  `bài học "${itemTitle}" trong covered_lessons không nằm trong published_lessons của khóa "${n.course_slug}"`
                );
              }
            }
          }
        }
      }
    }

    // AC-03: required_tools tùy chọn (nếu có thì phải là mảng chuỗi tên tool hợp lệ)
    if (n?.required_tools != null) {
      if (!Array.isArray(n.required_tools)) {
        add(`${nId}:required_tools`, "required_tools phải là mảng chuỗi");
      } else {
        for (const t of n.required_tools) {
          if (typeof t !== "string" || !TOOL_NAME_REGEX.test(t)) {
            add(`${nId}:required_tools`, `tên tool "${t}" không hợp lệ (phải khớp ${TOOL_NAME_REGEX})`);
          } else if (KNOWN_BAD_TOOLS[t]) {
            add(`${nId}:required_tools`, `tên tool "${t}" là tên gói/alias, hãy đổi thành "${KNOWN_BAD_TOOLS[t]}"`);
          }
        }
      }
    }
    if (!Array.isArray(n?.scope)) {
      add(`${nId}:scope`, "scope phải là mảng chuỗi");
    }

    // Kiểm tra ref
    if (n?.ref != null) {
      if (typeof n.ref !== "string" || !/^[^#]+#[^#]+$/.test(n.ref)) {
        add(`${nId}:ref`, 'ref phải có định dạng "<map slug>#<node id>"');
      } else {
        const [targetMapSlug, targetNodeId] = n.ref.split("#");
        let targetMap = allMaps?.get(targetMapSlug);
        if (!targetMap && pathsDir) {
          const targetPath = path.join(pathsDir, `${targetMapSlug}.json`);
          if (fs.existsSync(targetPath)) {
            try {
              targetMap = JSON.parse(fs.readFileSync(targetPath, "utf8"));
            } catch {}
          }
        }
        if (!targetMap) {
          add(`${nId}:ref`, `ref trỏ map "${targetMapSlug}" không tồn tại`);
        } else {
          const targetNode = (targetMap.nodes || []).find((x) => x.id === targetNodeId);
          if (!targetNode) {
            add(`${nId}:ref`, `ref trỏ ô "${targetNodeId}" không tồn tại trong map "${targetMapSlug}"`);
          }
        }
      }
    }
  }

  // Kiểm tra requires: không trỏ id không tồn tại, không trỏ layer sau, không có chu trình
  const adj = new Map();
  for (const n of nodes) {
    if (!n?.id) continue;
    adj.set(n.id, []);

    if (!Array.isArray(n.requires)) {
      add(`${n.id}:requires`, "requires phải là mảng");
      continue;
    }

    const currLayerIdx = validLayers.indexOf(n.layer);

    for (const reqId of n.requires) {
      if (typeof reqId !== "string" || !reqId.trim()) {
        add(`${n.id}:requires`, "phần tử trong requires phải là chuỗi id");
        continue;
      }

      if (!nodeIds.has(reqId)) {
        add(`${n.id}:requires`, `requires trỏ id "${reqId}" không tồn tại trong map`);
        continue;
      }

      const reqNode = nodeMap.get(reqId);
      if (reqNode && currLayerIdx >= 0) {
        const reqLayerIdx = validLayers.indexOf(reqNode.layer);
        if (reqLayerIdx > currLayerIdx) {
          add(
            `${n.id}:requires`,
            `requires không được trỏ tới ô ở layer sau ("${reqNode.layer}" sau "${n.layer}")`
          );
        }
      }

      adj.get(n.id).push(reqId);
    }
  }

  // DFS phát hiện chu trình trong map requires
  const visited = new Map();
  let hasCycle = false;
  function dfs(u) {
    visited.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (visited.get(v) === 1) {
        hasCycle = true;
      } else if (!visited.has(v)) {
        dfs(v);
      }
    }
    visited.set(u, 2);
  }

  for (const id of adj.keys()) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  if (hasCycle) {
    add("requires", "phát hiện chu trình phụ thuộc trong requires của map");
  }

  // Quy tắc tổng thể theo kind
  if (kind === "ecosystem") {
    const presentLayers = new Set(nodes.map((n) => n?.layer).filter(Boolean));
    const requiredFoundationLayers = ["foundation", "language", "core"];
    const missingLayers = requiredFoundationLayers.filter((l) => !presentLayers.has(l));
    if (missingLayers.length > 0) {
      add("ecosystem-layers", `map ecosystem phải có đủ 3 layer nền (foundation, language, core), thiếu: ${missingLayers.join(", ")}`);
    }

    const branchNodes = nodes.filter((n) => n?.layer === "branch");
    const distinctBranches = new Set(branchNodes.map((n) => n?.branch).filter(Boolean));
    if (distinctBranches.size < 2) {
      add("ecosystem-branches", `map ecosystem phải có ít nhất 2 nhánh branch khác nhau (hiện có ${distinctBranches.size})`);
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    warnings,
  };
}

export function lintBacklogData(backlogData, { catalogData = null, proposalDocContent = null, pathsDir = null, mapsBySlug = null } = {}) {
  const problems = [];
  const warnings = [];
  const add = (propId, rule, detail) => problems.push(`${propId}: ${rule}: ${detail}`);
  const addWarn = (propId, rule, detail) => warnings.push(`${propId}: ${rule}: ${detail}`);

  if (!backlogData || typeof backlogData !== "object") {
    problems.push("backlog: Dữ liệu backlog bị null hoặc không phải object");
    return { ok: false, problems, warnings };
  }

  const proposals = backlogData.proposals;
  if (!Array.isArray(proposals)) {
    problems.push("backlog: Thiếu trường proposals hoặc proposals không phải mảng");
    return { ok: false, problems, warnings };
  }

  const focusEntries = getFocusEntries(backlogData.focus);
  const focusPaths = getFocusPaths(backlogData.focus);

  if (!proposalDocContent || typeof proposalDocContent !== "string") {
    problems.push("backlog: Thiếu nội dung tài liệu docs/learn/learn-proposal.md để kiểm tra direction.entry");
  }

  const entriesByAxis = proposalDocContent ? extractProposalEntries(proposalDocContent) : null;

  // V-13: Kiểm tra focus.paths nhận phần tử { path, kind, entry }
  if (focusEntries && focusEntries.length > 0) {
    for (const fItem of focusEntries) {
      if (fItem.kind != null || fItem.entry != null) {
        if (!fItem.kind || !MAP_KINDS.has(fItem.kind)) {
          problems.push(`backlog: focus path "${fItem.path}" có kind "${fItem.kind}" không hợp lệ (phải là ecosystem|role|skill)`);
        }
        if (!fItem.entry || typeof fItem.entry !== "string" || !fItem.entry.trim()) {
          problems.push(`backlog: focus path "${fItem.path}" thiếu entry hoặc entry rỗng`);
        } else if (entriesByAxis && fItem.kind && MAP_KINDS.has(fItem.kind)) {
          const axisEntries = entriesByAxis[fItem.kind];
          if (!axisEntries || !axisEntries.has(fItem.entry.trim())) {
            problems.push(
              `backlog: focus path "${fItem.path}" có entry "${fItem.entry}" không tồn tại trong mục "${fItem.kind}" của learn-proposal.md`
            );
          }
        }

        // Map đã dựng phải có kind/entry trùng phần tử focus
        let mapData = mapsBySlug?.get(fItem.path);
        if (!mapData && pathsDir) {
          const mPath = path.join(pathsDir, `${fItem.path}.json`);
          if (fs.existsSync(mPath)) {
            try {
              mapData = JSON.parse(fs.readFileSync(mPath, "utf8"));
            } catch {}
          }
        }
        if (mapData && fItem.kind && fItem.entry) {
          if (mapData.kind !== fItem.kind || mapData.entry !== fItem.entry) {
            problems.push(
              `backlog: map "${fItem.path}" đã dựng có kind "${mapData.kind}" / entry "${mapData.entry}" không khớp với focus ({ kind: "${fItem.kind}", entry: "${fItem.entry}" })`
            );
          }
        }
      }
    }
  }

  const catalogCourses = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.courses ?? []);
  const catalogBySlug = new Map(catalogCourses.map((c) => [c.slug, c]));

  const seenSlugs = new Set();
  const chosenSlugs = [];
  const openProposals = [];
  const usedOpenChosenNodes = new Map();

  for (let idx = 0; idx < proposals.length; idx++) {
    const prop = proposals[idx];
    const slug = prop?.slug || `proposal_${idx + 1}`;

    // Kiểm tra slug trùng lặp
    if (seenSlugs.has(slug)) {
      add(slug, "slug", `slug "${slug}" bị trùng lặp trong backlog`);
    } else {
      seenSlugs.add(slug);
    }

    // Kiểm tra status
    const status = prop?.status;
    if (!VALID_PROPOSAL_STATUSES.has(status)) {
      add(slug, "status", `status "${status}" không hợp lệ (phải là open|chosen|rejected|produced)`);
    }

    // Kiểm tra added_on
    if (!prop?.added_on || typeof prop.added_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(prop.added_on)) {
      add(slug, "added_on", "thiếu added_on hoặc added_on không đúng định dạng YYYY-MM-DD");
    }

    // Kiểm tra status-specific fields
    if (status === "chosen") {
      chosenSlugs.push(slug);
      if (!prop?.decided_on || typeof prop.decided_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(prop.decided_on)) {
        add(slug, "decided_on", 'status là "chosen" bắt buộc có decided_on định dạng YYYY-MM-DD');
      }
    } else if (status === "rejected") {
      if (!prop?.decided_on || typeof prop.decided_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(prop.decided_on)) {
        add(slug, "decided_on", 'status là "rejected" bắt buộc có decided_on định dạng YYYY-MM-DD');
      }
      if (!prop?.reject_reason || typeof prop.reject_reason !== "string" || !prop.reject_reason.trim()) {
        add(slug, "reject_reason", 'status là "rejected" bắt buộc có reject_reason không rỗng');
      }
    } else if (status === "produced") {
      if (!prop?.decided_on || typeof prop.decided_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(prop.decided_on)) {
        add(slug, "decided_on", 'status là "produced" bắt buộc có decided_on định dạng YYYY-MM-DD');
      }
    } else if (status === "open") {
      openProposals.push(prop);
      if (prop?.decided_on != null) {
        add(slug, "decided_on", 'status là "open" thì decided_on phải là null');
      }
      if (prop?.reject_reason != null) {
        add(slug, "reject_reason", 'status là "open" thì reject_reason phải là null');
      }
    }

    // AC-04: Kiểm tra path_nodes và modules cho đề xuất open và chosen
    if (status === "open" || status === "chosen") {
      if (prop?.path_nodes) {
        if (typeof prop.path_nodes !== "object" || !prop.path_nodes.path || !Array.isArray(prop.path_nodes.nodes)) {
          add(slug, "path_nodes", 'path_nodes phải là object có dạng { path: "<map slug>", nodes: string[] }');
        } else {
          const mapSlug = prop.path_nodes.path;
          const nodes = prop.path_nodes.nodes;

          if (nodes.length < COURSE_MIN_NODES || nodes.length > COURSE_MAX_NODES) {
            add(slug, "path_nodes-nodes", `path_nodes.nodes phải có từ ${COURSE_MIN_NODES} đến ${COURSE_MAX_NODES} ô (hiện có ${nodes.length})`);
          }

          const nodeSet = new Set();
          for (const nId of nodes) {
            if (nodeSet.has(nId)) {
              add(slug, "path_nodes-nodes", `ô "${nId}" bị lặp lại trong path_nodes.nodes`);
            }
            nodeSet.add(nId);
          }

          let mapData = mapsBySlug?.get(mapSlug);
          if (!mapData && pathsDir) {
            const mapPath = path.join(pathsDir, `${mapSlug}.json`);
            if (fs.existsSync(mapPath)) {
              try {
                mapData = JSON.parse(fs.readFileSync(mapPath, "utf8"));
              } catch {}
            }
          }

          if (mapData) {
            const allRequiredTools = new Set();

            for (const nodeId of nodes) {
              const matchedNode = (mapData.nodes || []).find((n) => n.id === nodeId);
              if (!matchedNode) {
                add(slug, "path_nodes-node", `ô "${nodeId}" không tồn tại trong map "${mapSlug}"`);
              } else {
                if (Array.isArray(matchedNode.required_tools)) {
                  matchedNode.required_tools.forEach((t) => allRequiredTools.add(t));
                }

                if (matchedNode.coverage === "covered") {
                  add(
                    slug,
                    "node-coverage",
                    `ô "${nodeId}" trong map "${mapSlug}" đã có coverage: "covered", không thể đề xuất thêm khóa mới`
                  );
                }

                if (matchedNode.ref != null) {
                  add(
                    slug,
                    "node-ref",
                    `ô "${nodeId}" trong map "${mapSlug}" có ref "${matchedNode.ref}", không thể tạo khóa trực tiếp`
                  );
                }

                if (Array.isArray(matchedNode.requires) && matchedNode.requires.length > 0) {
                  const unmetRequires = [];
                  for (const reqId of matchedNode.requires) {
                    if (nodes.includes(reqId)) {
                      // Nằm trong chính khóa đó
                      continue;
                    }
                    const reqNode = (mapData.nodes || []).find((n) => n.id === reqId);
                    if (!isNodeSatisfied(reqNode, proposals, mapSlug)) {
                      unmetRequires.push(reqId);
                    }
                  }
                  if (unmetRequires.length > 0) {
                    add(
                      slug,
                      "node-readiness",
                      `ô "${nodeId}" chưa sẵn sàng vì các ô tiên quyết chưa hoàn thành và không nằm trong khóa (${unmetRequires.join(", ")})`
                    );
                  }
                }
              }

              // Không ô nào trong path_nodes thuộc đề xuất open/chosen khác
              const key = `${mapSlug}#${nodeId}`;
              if (usedOpenChosenNodes.has(key)) {
                add(
                  slug,
                  "node-conflict",
                  `ô "${nodeId}" trong map "${mapSlug}" đã thuộc đề xuất khác đang open hoặc chosen ("${usedOpenChosenNodes.get(key)}")`
                );
              } else {
                usedOpenChosenNodes.set(key, slug);
              }
            }

            // AC-04: tools thiếu required_tools chuyển thành cảnh báo
            if (allRequiredTools.size > 0) {
              const propTools = new Set(Array.isArray(prop.tools) ? prop.tools : []);
              const missing = Array.from(allRequiredTools).filter((t) => !propTools.has(t));
              if (missing.length > 0) {
                addWarn(slug, "required_tools", `tools thiếu required_tools của các ô (${missing.join(", ")})`);
              }
            }
          } else if (mapsBySlug || pathsDir) {
            if (!focusPaths || !focusPaths.includes(mapSlug)) {
              add(slug, "path_nodes-map", `map "${mapSlug}" không tồn tại`);
            }
          }

          // Kiểm tra modules
          if (!Array.isArray(prop.modules)) {
            add(slug, "modules", "thiếu modules hoặc modules không phải mảng");
          } else {
            if (prop.modules.length !== nodes.length) {
              add(slug, "modules-count", `số lượng modules (${prop.modules.length}) không khớp với path_nodes.nodes (${nodes.length})`);
            }
            for (let mIdx = 0; mIdx < prop.modules.length; mIdx++) {
              const mod = prop.modules[mIdx];
              const expectedNodeId = nodes[mIdx];
              if (!mod || typeof mod !== "object") {
                add(slug, "modules", `modules[${mIdx}] không phải object`);
                continue;
              }
              if (mod.node !== expectedNodeId) {
                add(slug, "modules-order", `modules[${mIdx}].node "${mod.node}" không khớp thứ tự với path_nodes.nodes[${mIdx}] "${expectedNodeId}"`);
              }
              if (!mod.mechanism || typeof mod.mechanism !== "string" || !mod.mechanism.trim()) {
                add(slug, "modules-mechanism", `modules[${mIdx}] thiếu mechanism hoặc mechanism rỗng`);
              }
              const hasAppUse = Array.isArray(mod.app_use)
                ? mod.app_use.length > 0 && mod.app_use.every((u) => typeof u === "string" && u.trim())
                : (typeof mod.app_use === "string" && mod.app_use.trim());
              if (!hasAppUse) {
                add(slug, "modules-app_use", `modules[${mIdx}] thiếu app_use hoặc app_use rỗng`);
              }
              const hasPitfalls = Array.isArray(mod.pitfalls)
                ? mod.pitfalls.length > 0 && mod.pitfalls.every((p) => typeof p === "string" && p.trim())
                : (typeof mod.pitfalls === "string" && mod.pitfalls.trim());
              if (!hasPitfalls) {
                add(slug, "modules-pitfalls", `modules[${mIdx}] thiếu pitfalls (phải có ít nhất 1 bẫy/lỗi)`);
              }
              if (!mod.outcome || typeof mod.outcome !== "string" || !mod.outcome.trim()) {
                add(slug, "modules-outcome", `modules[${mIdx}] thiếu outcome hoặc outcome rỗng`);
              } else {
                const outcomeLower = mod.outcome.toLowerCase();
                const matchesObservable = P1_OBSERVABLE_ACTIONS.some((act) => outcomeLower.includes(act));
                const matchesCode = P1_CODE_ACTIONS.some((act) => outcomeLower.includes(act));
                if (!matchesObservable && !matchesCode) {
                  add(
                    slug,
                    "modules-outcome",
                    `modules[${mIdx}].outcome "${mod.outcome}" phải là hành động quan sát được theo P1 (dự đoán, giải thích, chẩn đoán, chọn, thiết kế)`
                  );
                } else if (matchesCode) {
                  const matchedNode = mapData ? (mapData.nodes || []).find((n) => n.id === mod.node) : null;
                  const isLanguageOrCore = matchedNode && (matchedNode.layer === "language" || matchedNode.layer === "core");
                  if (!isLanguageOrCore) {
                    add(
                      slug,
                      "modules-outcome",
                      `modules[${mIdx}].outcome "${mod.outcome}" dùng hành động "viết/sửa" chỉ được phép cho ô ở layer language hoặc core (ô "${mod.node}" ở layer "${matchedNode?.layer || "không rõ"}")`
                    );
                  }
                }
              }
            }
          }
        }
      } else if (prop?.path_node) {
        add(slug, "path_nodes", `đề xuất ở status "${status}" bắt buộc dùng path_nodes gom 3–7 ô thay vì path_node đơn lẻ`);
      }
    }

    // Validate các trường nội dung đề xuất (bắt buộc đầy đủ cho open và chosen)
    if (status === "open" || status === "chosen") {
      validateProposalFields(prop, idx, { catalogBySlug, entriesByAxis, add });
    } else {
      if (!prop?.title || typeof prop.title !== "string" || !prop.title.trim()) {
        add(slug, "title", "thiếu title hoặc title rỗng");
      }
      if (!prop?.direction || typeof prop.direction !== "object") {
        add(slug, "direction", "thiếu direction hoặc direction không phải object");
      }
    }
  }

  // Tối đa 1 đề xuất chosen cùng lúc trong backlog
  if (chosenSlugs.length > 1) {
    problems.push(`backlog: Có nhiều hơn 1 đề xuất đang ở status "chosen": ${chosenSlugs.join(", ")}`);
  }

  // AC-02 & AC-04: Phân bổ đề xuất open
  const openByMap = new Map();
  for (const op of openProposals) {
    if (op?.path_nodes?.path) {
      const m = op.path_nodes.path;
      openByMap.set(m, (openByMap.get(m) || 0) + 1);
    }
  }

  for (const [mSlug, count] of openByMap.entries()) {
    if (count > MAX_OPEN_PROPOSALS_PER_MAP) {
      problems.push(`backlog: map "${mSlug}" có ${count} đề xuất open (tối đa ${MAX_OPEN_PROPOSALS_PER_MAP} đề xuất mỗi map)`);
    }
  }

  if (focusPaths && focusPaths.length > 0) {
    let readyMapsCount = 0;
    for (const fMapSlug of focusPaths) {
      let fMapData = mapsBySlug?.get(fMapSlug);
      if (!fMapData && pathsDir) {
        const fPath = path.join(pathsDir, `${fMapSlug}.json`);
        if (fs.existsSync(fPath)) {
          try {
            fMapData = JSON.parse(fs.readFileSync(fPath, "utf8"));
          } catch {}
        }
      }
      if (fMapData && Array.isArray(fMapData.nodes)) {
        // Đếm số ô sẵn sàng có thể gom khóa (ref null, coverage != covered, requires thỏa mãn)
        const readyNodes = fMapData.nodes.filter((n) => {
          if (n.ref != null || n.coverage === "covered") return false;
          const reqs = Array.isArray(n.requires) ? n.requires : [];
          return reqs.every((reqId) => {
            const rNode = fMapData.nodes.find((x) => x.id === reqId);
            return isNodeSatisfied(rNode, proposals, fMapSlug);
          });
        });
        if (readyNodes.length >= COURSE_MIN_NODES) {
          readyMapsCount++;
        }
      }
    }
    if (readyMapsCount >= MIN_MAPS_WITH_OPEN_PROPOSALS) {
      if (openByMap.size < MIN_MAPS_WITH_OPEN_PROPOSALS) {
        problems.push(`backlog: có ${readyMapsCount} map focus có ô sẵn sàng nhưng đề xuất open chỉ trải trên ${openByMap.size} map (yêu cầu ít nhất ${MIN_MAPS_WITH_OPEN_PROPOSALS} map)`);
      }
    }
  } else {
    if (openProposals.length < BACKLOG_MIN_OPEN_PROPOSALS || openProposals.length > BACKLOG_MAX_OPEN_PROPOSALS) {
      problems.push(`backlog: Số lượng đề xuất open là ${openProposals.length} (phải từ ${BACKLOG_MIN_OPEN_PROPOSALS} đến ${BACKLOG_MAX_OPEN_PROPOSALS} đề xuất)`);
    }

    const distinctOpenEntries = new Set();
    for (const op of openProposals) {
      const entry = op?.direction?.entry?.trim();
      if (entry) distinctOpenEntries.add(entry);
    }

    if (distinctOpenEntries.size < BACKLOG_MIN_DIRECTIONS) {
      problems.push(`backlog: Đề xuất open chỉ thuộc ${distinctOpenEntries.size} direction.entry khác nhau (yêu cầu ít nhất ${BACKLOG_MIN_DIRECTIONS})`);
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    warnings,
  };
}

export function lintShortlistData(shortlistData, { catalogData = null, proposalDocContent = null } = {}) {
  const problems = [];
  const add = (propId, rule, detail) => problems.push(`${propId}: ${rule}: ${detail}`);

  if (!shortlistData || typeof shortlistData !== "object") {
    problems.push("shortlist: Dữ liệu shortlist bị null hoặc không phải object");
    return { ok: false, problems };
  }

  const proposals = shortlistData.shortlist;
  if (!Array.isArray(proposals)) {
    problems.push("shortlist: Thiếu trường shortlist hoặc shortlist không phải mảng");
    return { ok: false, problems };
  }

  if (proposals.length < SHORTLIST_MIN_PROPOSALS || proposals.length > SHORTLIST_MAX_PROPOSALS) {
    problems.push(`shortlist: Số lượng đề xuất là ${proposals.length} (phải từ ${SHORTLIST_MIN_PROPOSALS} đến ${SHORTLIST_MAX_PROPOSALS} đề xuất)`);
  }

  if (!proposalDocContent || typeof proposalDocContent !== "string") {
    problems.push("shortlist: Thiếu nội dung tài liệu docs/learn/learn-proposal.md để kiểm tra direction.entry");
  }

  const entriesByAxis = proposalDocContent ? extractProposalEntries(proposalDocContent) : null;

  const catalogCourses = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.courses ?? []);
  const catalogBySlug = new Map(catalogCourses.map((c) => [c.slug, c]));

  const distinctEntries = new Set();

  proposals.forEach((prop, idx) => {
    if (prop?.direction?.entry && typeof prop.direction.entry === "string") {
      distinctEntries.add(prop.direction.entry.trim());
    }
    validateProposalFields(prop, idx, { catalogBySlug, entriesByAxis, add });
  });

  if (distinctEntries.size < SHORTLIST_MIN_DIRECTIONS) {
    problems.push(`shortlist: Đề xuất chỉ thuộc ${distinctEntries.size} direction.entry khác nhau (yêu cầu ít nhất ${SHORTLIST_MIN_DIRECTIONS})`);
  }

  return {
    ok: problems.length === 0,
    problems,
  };
}

// AC-02: Lint file evaluation của ứng viên khóa học
export function lintEvaluationData(evData, { catalogData = null } = {}) {
  const problems = [];
  const slug = evData?.slug || "evaluation";
  const add = (rule, detail) => problems.push(`${slug}: ${rule}: ${detail}`);

  if (!evData || typeof evData !== "object") {
    problems.push(`${slug}: Dữ liệu evaluation bị null hoặc không phải object`);
    return { ok: false, problems };
  }

  if (!evData.slug || typeof evData.slug !== "string" || !evData.slug.trim()) {
    add("slug", "thiếu slug hoặc slug không phải chuỗi");
  }

  // 1. Kiểm tra catalog
  const catalog = evData.catalog;
  if (!catalog || typeof catalog !== "object") {
    add("catalog", "thiếu catalog hoặc catalog không phải object");
  } else {
    const verdict = catalog.verdict;
    const validVerdicts = new Set(["new", "covered", "update_existing", "overlap_warning"]);
    if (!verdict || !validVerdicts.has(verdict)) {
      add("catalog-verdict", `verdict "${verdict}" không hợp lệ (phải là new|covered|update_existing|overlap_warning)`);
    } else if (verdict === "covered" || verdict === "update_existing" || verdict === "overlap_warning") {
      // AC-02: Bắt buộc nêu ít nhất một tên bài đã publish làm căn cứ
      let publishedLessonTitles = [];
      if (catalogData && Array.isArray(catalogData.courses)) {
        for (const c of catalogData.courses) {
          if (Array.isArray(c.published_lessons)) {
            for (const pl of c.published_lessons) {
              if (pl?.title && typeof pl.title === "string") {
                publishedLessonTitles.push(pl.title.trim().toLowerCase());
              }
            }
          }
        }
      }

      const basis = (typeof catalog.basis === "string" ? catalog.basis : "").toLowerCase();
      const refs = Array.isArray(catalog.refs) ? catalog.refs : [];
      const refsText = refs.join(" ").toLowerCase();
      const combinedEvidence = `${basis} ${refsText}`;

      if (catalogData) {
        if (publishedLessonTitles.length === 0) {
          add(
            "catalog-verdict",
            `verdict "${verdict}" không hợp lệ vì catalog không có bài học published nào làm căn cứ trùng lặp`
          );
        } else {
          const hasMatch = publishedLessonTitles.some((t) => combinedEvidence.includes(t));
          if (!hasMatch) {
            add(
              "catalog-verdict",
              `verdict "${verdict}" bắt buộc nêu ít nhất một tên bài đã publish trong catalog làm căn cứ (trong refs hoặc basis)`
            );
          }
        }
      } else {
        if (refs.length === 0 && !basis.trim()) {
          add(
            "catalog-verdict",
            `verdict "${verdict}" bắt buộc nêu ít nhất một tên bài đã publish làm căn cứ trong refs hoặc basis`
          );
        }
      }
    }
  }

  // 2. Kiểm tra feasibility
  const feas = evData.feasibility;
  if (!feas || typeof feas !== "object") {
    add("feasibility", "thiếu feasibility");
  } else {
    const validFeas = new Set(["feasible", "feasible_with_limits", "not_feasible"]);
    if (!validFeas.has(feas.verdict)) {
      add("feasibility-verdict", `verdict "${feas.verdict}" không hợp lệ (phải là feasible|feasible_with_limits|not_feasible)`);
    }
  }

  // 3. Kiểm tra handoff
  const handoff = evData.handoff;
  if (!handoff || typeof handoff !== "object") {
    add("handoff", "thiếu handoff");
  } else {
    if (!handoff.title || typeof handoff.title !== "string" || !handoff.title.trim()) {
      add("handoff-title", "thiếu handoff.title");
    }
    if (!handoff.audience || typeof handoff.audience !== "string" || !handoff.audience.trim()) {
      add("handoff-audience", "thiếu handoff.audience");
    }
    if (!handoff.level || typeof handoff.level !== "string" || !handoff.level.trim()) {
      add("handoff-level", "thiếu handoff.level");
    }
    if (!handoff.scope_note || typeof handoff.scope_note !== "string" || !handoff.scope_note.trim()) {
      add("handoff-scope_note", "thiếu handoff.scope_note");
    }
  }

  // 4. AC-02: draft_lessons_ignored và compared_published_counts
  if (evData.draft_lessons_ignored != null) {
    if (typeof evData.draft_lessons_ignored !== "number" || evData.draft_lessons_ignored < 0) {
      add("draft_lessons_ignored", "draft_lessons_ignored phải là số không âm");
    }
  }

  if (evData.compared_published_counts != null) {
    if (typeof evData.compared_published_counts !== "object" || Array.isArray(evData.compared_published_counts)) {
      add("compared_published_counts", "compared_published_counts phải là object");
    } else {
      for (const [cSlug, count] of Object.entries(evData.compared_published_counts)) {
        if (typeof count !== "number" || count < 0) {
          add("compared_published_counts", `số lượng bài published của "${cSlug}" phải là số không âm`);
        }
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

// AC-08 & AC-06: Cập nhật ô trong map khi đề xuất được sản xuất thành công
export function updateMapNodeOnProduced({ repoRoot = ".", mapSlug, nodeId = null, nodeIds = null, courseSlug, coveredLessons = null }) {
  const mapFile = path.join(path.resolve(repoRoot), ".course-plan", "paths", `${mapSlug}.json`);
  if (!fs.existsSync(mapFile)) {
    throw new Error(`Map "${mapSlug}" không tồn tại tại ${mapFile}`);
  }
  const data = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  const targetIds = Array.isArray(nodeIds) && nodeIds.length > 0 ? nodeIds : (nodeId ? [nodeId] : []);
  if (targetIds.length === 0) {
    throw new Error("Cần chỉ định nodeId hoặc nodeIds");
  }

  for (const id of targetIds) {
    const node = (data.nodes || []).find((n) => n.id === id);
    if (!node) {
      throw new Error(`Ô "${id}" không tồn tại trong map "${mapSlug}"`);
    }
    node.course_slug = courseSlug;
    node.coverage = "covered";
    node.covered_lessons = Array.isArray(coveredLessons) && coveredLessons.length > 0
      ? coveredLessons
      : (Array.isArray(node.covered_lessons) && node.covered_lessons.length > 0
          ? node.covered_lessons
          : [{ title: courseSlug, teaches: node.mental_model || courseSlug }]);
  }

  fs.writeFileSync(mapFile, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export function lintPlans(repoRoot = ".") {
  const root = path.resolve(repoRoot);
  const pathsDir = path.join(root, ".course-plan", "paths");
  const catalogFile = path.join(root, ".course-plan", "catalog.json");
  const backlogFile = path.join(root, ".course-plan", "backlog.json");

  const problems = [];
  let pathsChecked = 0;
  let backlogChecked = 0;

  let proposalDocContent = null;
  let docPath = path.join(root, "docs", "learn", "learn-proposal.md");
  if (!fs.existsSync(docPath)) {
    const fallback = path.resolve("docs/learn/learn-proposal.md");
    if (fs.existsSync(fallback)) docPath = fallback;
  }
  if (fs.existsSync(docPath)) {
    try {
      proposalDocContent = fs.readFileSync(docPath, "utf8");
    } catch {}
  }

  let catalogData = null;
  if (fs.existsSync(catalogFile)) {
    try {
      catalogData = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
    } catch {}
  }

  // 1. Quét toàn bộ map trong pathsDir
  const mapsBySlug = new Map();
  if (fs.existsSync(pathsDir)) {
    const files = fs.readdirSync(pathsDir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(pathsDir, f), "utf8"));
        if (m && m.slug) mapsBySlug.set(m.slug, m);
      } catch (err) {
        problems.push(`${f}: Lỗi đọc JSON: ${err.message}`);
      }
    }

    for (const f of files) {
      const fileSlug = f.replace(/\.json$/, "");
      const map = mapsBySlug.get(fileSlug);
      if (!map) continue;
      if (map.slug !== fileSlug) {
        problems.push(`${f}: slug "${map.slug}" không khớp tên file "${fileSlug}"`);
      }
      const res = lintMapData(map, { proposalDocContent, pathsDir, allMaps: mapsBySlug, catalogData });
      pathsChecked++;
      for (const p of res.problems) {
        problems.push(`${f}: ${p}`);
      }
    }
  }

  // 2. Kiểm tra backlog
  if (fs.existsSync(backlogFile)) {
    try {
      const blData = JSON.parse(fs.readFileSync(backlogFile, "utf8"));
      const blRes = lintBacklogData(blData, { catalogData, proposalDocContent, pathsDir, mapsBySlug });
      backlogChecked++;
      for (const p of blRes.problems) {
        problems.push(`backlog.json: ${p}`);
      }
    } catch (err) {
      problems.push(`backlog.json: Lỗi đọc JSON: ${err.message}`);
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    cycleEdges: [],
    pathsChecked,
    backlogChecked,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const target = process.argv[2] || ".";
  const resolved = path.resolve(target);

  // Nếu target là file json đơn lẻ
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory() && resolved.endsWith(".json")) {
    const root = path.resolve(".");
    let proposalDocContent = null;
    const docPath = path.join(root, "docs", "learn", "learn-proposal.md");
    if (fs.existsSync(docPath)) {
      try {
        proposalDocContent = fs.readFileSync(docPath, "utf8");
      } catch {}
    }

    let catalogData = null;
    const catalogFile = path.join(root, ".course-plan", "catalog.json");
    if (fs.existsSync(catalogFile)) {
      try {
        catalogData = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
      } catch {}
    }

    try {
      const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
      const isBacklog = Array.isArray(data.proposals) || path.basename(resolved) === "backlog.json";
      const isMap = Array.isArray(data.nodes) || data.kind != null;
      const isEvaluation = data.catalog != null && data.feasibility != null && data.handoff != null;
      let result;
      let label;
      if (isBacklog) {
        let pDir = null;
        const candidatePDir = path.join(path.dirname(resolved), "paths");
        if (fs.existsSync(candidatePDir)) {
          pDir = candidatePDir;
        }
        result = lintBacklogData(data, { catalogData, proposalDocContent, pathsDir: pDir });
        label = "backlog";
      } else if (isMap) {
        result = lintMapData(data, { proposalDocContent, pathsDir: path.dirname(resolved), catalogData });
        label = "skill map";
      } else if (isEvaluation) {
        result = lintEvaluationData(data, { catalogData });
        label = "evaluation";
      } else {
        result = lintShortlistData(data, { catalogData, proposalDocContent });
        label = "shortlist";
      }

      if (!result.ok) {
        console.error(`[plan-lint] LỖI ${label} (${path.basename(resolved)}): ${result.problems.length} vấn đề:`);
        for (const prob of result.problems) console.error(`  - ${prob}`);
        process.exit(1);
      } else {
        console.log(`[plan-lint] Đạt: ${label} (${path.basename(resolved)}) hợp lệ.`);
        process.exit(0);
      }
    } catch (err) {
      console.error(`[plan-lint] Lỗi đọc file ${resolved}: ${err.message}`);
      process.exit(1);
    }
  }

  const result = lintPlans(resolved);
  if (!result.ok) {
    console.error(`[plan-lint] LỖI: Tìm thấy ${result.problems.length} vấn đề:`);
    for (const prob of result.problems) {
      console.error(`  - ${prob}`);
    }
    process.exit(1);
  } else {
    console.log(`[plan-lint] Đạt: ${result.pathsChecked} map, ${result.backlogChecked || 0} backlog kiểm tra thành công.`);
    process.exit(0);
  }
}

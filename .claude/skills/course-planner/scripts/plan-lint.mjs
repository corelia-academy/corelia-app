// .claude/skills/course-planner/scripts/plan-lint.mjs
// Kiểm schema path; requires.slug tồn tại; reason không rỗng; không có chu trình trên toàn bộ path.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHORTLIST_MIN_PROPOSALS,
  SHORTLIST_MAX_PROPOSALS,
  SHORTLIST_MIN_DIRECTIONS,
  SHORTLIST_MIN_ALTERNATIVES,
  SHORTLIST_CRITERIA_KEYS,
  PROMISE_FORBIDDEN_PREFIX,
  VALID_AXES,
} from "./constants.mjs";

const VALID_ENTRY_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const VALID_STATUSES = new Set(["draft", "approved"]);
const VALID_EVIDENCE_KINDS = new Set(["direct", "inferred"]);

export {
  SHORTLIST_MIN_PROPOSALS,
  SHORTLIST_MAX_PROPOSALS,
  SHORTLIST_MIN_DIRECTIONS,
  SHORTLIST_MIN_ALTERNATIVES,
  SHORTLIST_CRITERIA_KEYS,
};

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

  // Tách các entry từ learn-proposal.md nếu có
  const entriesByAxis = proposalDocContent ? extractProposalEntries(proposalDocContent) : null;

  // Catalog Map
  const catalogCourses = Array.isArray(catalogData)
    ? catalogData
    : (catalogData?.courses ?? []);
  const catalogBySlug = new Map(catalogCourses.map((c) => [c.slug, c]));

  const distinctEntries = new Set();

  proposals.forEach((prop, idx) => {
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
        distinctEntries.add(cleanEntry);

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

      // timely.met: true đòi hỏi why_now.kind === "direct"
      if (criteria.timely?.met === true && whyNow?.kind !== "direct") {
        add(slug, "timely-direct", 'tiêu chí "timely" có met: true đòi hỏi why_now.kind phải là "direct"');
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
  });

  if (distinctEntries.size < SHORTLIST_MIN_DIRECTIONS) {
    problems.push(`shortlist: Đề xuất chỉ thuộc ${distinctEntries.size} direction.entry khác nhau (yêu cầu ít nhất ${SHORTLIST_MIN_DIRECTIONS})`);
  }

  return {
    ok: problems.length === 0,
    problems,
  };
}

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

    // P-08 & AC3: Kiểm tra origin trước để xác định tính hợp lệ của origin
    let hasValidOrigin = false;
    if (p.origin) {
      if (typeof p.origin !== "object") {
        problems.push(`${file}: origin phải là object`);
      } else {
        const pitchSlug = p.origin.pitch_slug;
        const shortlistRef = p.origin.shortlist;
        const pathCourseSlugs = new Set((p.courses || []).map((c) => c?.slug).filter(Boolean));

        let originErr = false;
        if (!pitchSlug || typeof pitchSlug !== "string") {
          problems.push(`${file}: origin.pitch_slug không được để trống`);
          originErr = true;
        } else if (!pathCourseSlugs.has(pitchSlug)) {
          problems.push(`${file}: origin.pitch_slug "${pitchSlug}" không thuộc danh sách courses[] của path`);
          originErr = true;
        }

        if (!shortlistRef || typeof shortlistRef !== "string") {
          problems.push(`${file}: origin.shortlist không được để trống`);
          originErr = true;
        } else {
          let slPath = path.isAbsolute(shortlistRef)
            ? shortlistRef
            : path.join(root, shortlistRef);
          if (!fs.existsSync(slPath)) {
            const inShortlistsDir = path.join(root, ".course-plan", "shortlists", path.basename(shortlistRef));
            if (fs.existsSync(inShortlistsDir)) {
              slPath = inShortlistsDir;
            }
          }

          if (!fs.existsSync(slPath)) {
            problems.push(`${file}: file shortlist "${shortlistRef}" không tồn tại`);
            originErr = true;
          } else {
            try {
              const slData = JSON.parse(fs.readFileSync(slPath, "utf8"));
              const slProposals = Array.isArray(slData.shortlist) ? slData.shortlist : [];
              const hasPitch = slProposals.some((prop) => prop?.slug === pitchSlug);
              if (!hasPitch) {
                problems.push(`${file}: shortlist "${shortlistRef}" không chứa đề xuất có slug "${pitchSlug}"`);
                originErr = true;
              }
            } catch (err) {
              problems.push(`${file}: file shortlist "${shortlistRef}" hỏng: ${err.message}`);
              originErr = true;
            }
          }
        }
        if (!originErr) {
          hasValidOrigin = true;
        }
      }
    }

    // AC3: Path có origin hợp lệ thì không bắt buộc priority; path không origin hoặc origin lỗi bắt buộc priority >= 1
    if (p.priority != null) {
      if (typeof p.priority !== "number" || !Number.isInteger(p.priority) || p.priority < 1) {
        problems.push(`${file}: priority phải là số nguyên >= 1`);
      }
    } else {
      if (!hasValidOrigin) {
        problems.push(`${file}: priority phải là số nguyên >= 1`);
      }
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

  // Kiểm tra shortlists nếu có trong .course-plan/shortlists/
  const shortlistsDir = path.join(root, ".course-plan", "shortlists");
  let shortlistsChecked = 0;
  if (fs.existsSync(shortlistsDir)) {
    const sFiles = fs.readdirSync(shortlistsDir).filter((f) => f.endsWith(".json"));
    let proposalDocContent = null;
    const docPath = path.join(root, "docs", "learn", "learn-proposal.md");
    if (!fs.existsSync(docPath)) {
      problems.push(`[shortlist] Không tìm thấy tài liệu định hướng tại ${docPath}`);
    } else {
      try {
        proposalDocContent = fs.readFileSync(docPath, "utf8");
      } catch (err) {
        problems.push(`[shortlist] Lỗi đọc tài liệu ${docPath}: ${err.message}`);
      }
    }

    let catalogData = null;
    if (fs.existsSync(catalogFile)) {
      try {
        catalogData = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
      } catch {}
    }

    for (const sf of sFiles) {
      try {
        const sData = JSON.parse(fs.readFileSync(path.join(shortlistsDir, sf), "utf8"));
        const sRes = lintShortlistData(sData, { catalogData, proposalDocContent });
        shortlistsChecked++;
        for (const p of sRes.problems) {
          problems.push(`shortlist/${sf}: ${p}`);
        }
      } catch (err) {
        problems.push(`shortlist/${sf}: Lỗi đọc JSON: ${err.message}`);
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    cycleEdges,
    pathsChecked: paths.length,
    shortlistsChecked
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
    if (!fs.existsSync(docPath)) {
      console.error(`[plan-lint] Lỗi: Không tìm thấy tài liệu định hướng tại ${docPath}`);
      process.exit(1);
    }
    try {
      proposalDocContent = fs.readFileSync(docPath, "utf8");
    } catch (err) {
      console.error(`[plan-lint] Lỗi đọc tài liệu ${docPath}: ${err.message}`);
      process.exit(1);
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
      const result = lintShortlistData(data, { catalogData, proposalDocContent });
      if (!result.ok) {
        console.error(`[plan-lint] LỖI shortlist (${path.basename(resolved)}): ${result.problems.length} vấn đề:`);
        for (const prob of result.problems) console.error(`  - ${prob}`);
        process.exit(1);
      } else {
        console.log(`[plan-lint] Đạt: shortlist (${path.basename(resolved)}) hợp lệ.`);
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
    if (result.cycleEdges.length > 0) {
      console.error("[plan-lint] Các cạnh tạo thành chu trình:");
      for (const e of result.cycleEdges) {
        console.error(`  ${e.from} -> ${e.to}${e.reason ? ` (lý do: ${e.reason})` : ""}`);
      }
    }
    process.exit(1);
  } else {
    console.log(`[plan-lint] Đạt: ${result.pathsChecked} path, ${result.shortlistsChecked || 0} shortlist kiểm tra thành công, không có lỗi chu trình hay schema.`);
    process.exit(0);
  }
}

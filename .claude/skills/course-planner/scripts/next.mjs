// .claude/skills/course-planner/scripts/next.mjs
// Tính toán khóa nên tạo tiếp theo (pick) và danh sách kế tiếp (queue).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function decideNext({
  repoRoot = ".",
  nowDate = null
} = {}) {
  const root = path.resolve(repoRoot);
  const pathsDir = path.join(root, ".course-plan", "paths");
  const catalogFile = path.join(root, ".course-plan", "catalog.json");
  const evaluationsDir = path.join(root, ".course-plan", "evaluations");

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
    } catch {
      // Catalog không hợp lệ hoặc chưa có
    }
  }

  // Helper kiểm tra state đã hoàn thành hoặc đang sản xuất
  const isExcludedState = (state) =>
    state === "in_production" || state === "produced" || state === "in_catalog";

  const isSatisfiedState = (catReq) => {
    if (!catReq) return false;
    if (catReq.content_state) {
      return catReq.content_state !== "empty";
    }
    return catReq.state === "produced" || catReq.state === "in_catalog";
  };

  // 2. Đọc các path có status === "approved"
  const approvedPaths = [];
  if (fs.existsSync(pathsDir)) {
    const files = fs.readdirSync(pathsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(pathsDir, file), "utf8"));
        if (p.status === "approved") {
          approvedPaths.push(p);
        }
      } catch {
        // Bỏ qua file lỗi cú pháp (đã có plan-lint kiểm tra)
      }
    }
  }

  // 3. Gom candidate từ các approved path
  // Candidate: ô khóa có state chưa phải in_production, produced, in_catalog
  const candidateMap = new Map();

  for (const p of approvedPaths) {
    const hasDirectEvidence = Array.isArray(p.evidence) &&
      p.evidence.some((ev) => ev && ev.kind === "direct");

    for (const c of (p.courses || [])) {
      if (!c || !c.slug) continue;
      const catEntry = catalogMap.get(c.slug);
      if (catEntry && isExcludedState(catEntry.state)) {
        // Đã có trong catalog / production -> không phải candidate
        continue;
      }

      if (!candidateMap.has(c.slug)) {
        candidateMap.set(c.slug, {
          slug: c.slug,
          title: c.title || c.slug,
          task: c.task || "",
          level: c.level || "all",
          suggested_order: typeof c.suggested_order === "number" ? c.suggested_order : 9999,
          is_foundation: Boolean(c.is_foundation),
          requires: Array.isArray(c.requires) ? c.requires : [],
          paths: []
        });
      }

      const cand = candidateMap.get(c.slug);
      cand.paths.push({
        slug: p.slug,
        title: p.title,
        priority: typeof p.priority === "number" ? p.priority : 9999,
        hasDirectEvidence,
        origin: p.origin || null,
        pathRaw: p,
        suggested_order: typeof c.suggested_order === "number" ? c.suggested_order : 9999
      });
    }
  }

  // Helper kiểm tra target_slug có phụ thuộc bắc cầu vào cand_slug không (V-07)
  function targetTransitivelyRequires(startSlug, targetSlug, allApprovedPaths) {
    const visited = new Set();
    const queue = [startSlug];
    visited.add(startSlug);

    while (queue.length > 0) {
      const curr = queue.shift();
      for (const p of allApprovedPaths) {
        for (const c of (p.courses || [])) {
          if (c && c.slug === curr && Array.isArray(c.requires)) {
            for (const req of c.requires) {
              if (req && req.slug) {
                if (req.slug === targetSlug) {
                  return true;
                }
                if (!visited.has(req.slug)) {
                  visited.add(req.slug);
                  queue.push(req.slug);
                }
              }
            }
          }
        }
      }
    }
    return false;
  }

  // Helper lấy thứ tự gợi ý của khóa trong một path cụ thể (V-01)
  function getCourseOrderInPath(cand, pathSlug) {
    const found = cand.paths?.find((p) => p.slug === pathSlug);
    return typeof found?.suggested_order === "number" ? found.suggested_order : (cand.suggested_order ?? 9999);
  }

  // Gán minPriority và primaryPath cho mỗi candidate
  for (const cand of candidateMap.values()) {
    cand.paths.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.slug.localeCompare(b.slug);
    });
    cand.minPriority = cand.paths[0].priority;
    cand.primaryPath = cand.paths[0];
    cand.suggested_order = cand.primaryPath.suggested_order;
  }

  const updates = [];
  const rejected = [];
  const needs_research = [];
  const blocked = [];
  const readyCandidates = [];
  const allWarnings = [];

  // 4. Kiểm tra điều kiện "Sẵn sàng" TRƯỚC (V-02)
  // Khóa chưa đủ điều kiện tiên quyết (requires chưa produced / in_catalog) vào blocked ngay,
  // không bắt buộc phải có evaluation và không bị xếp vào needs_research.
  const candidateList = Array.from(candidateMap.values());

  for (const cand of candidateList) {
    const unmetRequires = [];
    for (const req of cand.requires) {
      if (!req || !req.slug) continue;
      const catReq = catalogMap.get(req.slug);
      if (!catReq || !isSatisfiedState(catReq)) {
        unmetRequires.push(req.slug);
      } else if (!catReq.content_state || catReq.content_state === "unknown") {
        allWarnings.push(`Khóa tiên quyết "${req.slug}" của "${cand.slug}" ${!catReq.content_state ? "thiếu content_state" : "có content_state unknown"} (cần export catalog mới)`);
      }
    }

    if (unmetRequires.length > 0) {
      blocked.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        blocked_by: unmetRequires.sort()
      });
      continue;
    }

    // Đã thỏa mãn tiên quyết (SẴN SÀNG) -> Thẩm định 5 Gate
    const evalFile = path.join(evaluationsDir, `${cand.slug}.json`);
    if (!fs.existsSync(evalFile)) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: "Thiếu file evaluation"
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
        path_slug: cand.primaryPath.slug,
        reason: `File evaluation hỏng: ${err.message}`
      });
      continue;
    }

    // Gate 3: catalog.verdict
    const catVerdict = evData.catalog?.verdict;
    if (catVerdict === "update_existing") {
      updates.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        basis: evData.catalog?.basis || "",
        refs: evData.catalog?.refs || []
      });
      continue;
    } else if (catVerdict === "covered") {
      rejected.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `Đã được đáp ứng trong catalog: ${evData.catalog?.basis || ""}`
      });
      continue;
    } else if (catVerdict === "overlap_warning") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `Cảnh báo trùng lặp với catalog: ${evData.catalog?.basis || ""}`
      });
      continue;
    } else if (catVerdict !== "new") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `Catalog verdict không hợp lệ (${catVerdict})`
      });
      continue;
    }

    // Gate 4: feasibility.verdict khác not_feasible
    const feasVerdict = evData.feasibility?.verdict;
    if (feasVerdict === "not_feasible") {
      rejected.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `Không khả thi: ${evData.feasibility?.basis || ""}`
      });
      continue;
    } else if (feasVerdict !== "feasible" && feasVerdict !== "feasible_with_limits") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `Feasibility verdict không hợp lệ (${feasVerdict})`
      });
      continue;
    }

    // E-04: Kiểm tra evaluation có chứa đầy đủ các khóa produced hoặc in_catalog hiện có trong catalog.json hay không
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
          path_slug: cand.primaryPath.slug,
          reason: `Catalog có khóa mới chưa đối chiếu trong evaluation: ${missingFromEval.join(", ")}`
        });
        continue;
      }
    }

    // Gate 5: handoff đủ title, audience, level, scope_note (E-03)
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
        path_slug: cand.primaryPath.slug,
        reason: "Handoff thiếu trường bắt buộc (title, audience, level, scope_note)"
      });
      continue;
    }

    // Gate 2: Path có ít nhất một direct evidence, HOẶC foundation_basis trỏ tới khóa đích thuộc path có direct evidence (V-07)
    let passesEvidence = cand.paths.some((p) => p.hasDirectEvidence);
    if (!passesEvidence && evData.foundation_basis) {
      const fb = evData.foundation_basis;
      const targetSlug = fb?.target_slug;
      const reason = fb?.reason;

      const hasValidReason = typeof reason === "string" && reason.trim().length > 0;
      const targetDependsOnCand = targetSlug
        ? targetTransitivelyRequires(targetSlug, cand.slug, approvedPaths)
        : false;

      if (hasValidReason && targetDependsOnCand) {
        // Tìm path chứa targetSlug có direct evidence
        const targetPaths = approvedPaths.filter((ap) =>
          (ap.courses || []).some((c) => c && c.slug === targetSlug)
        );
        const targetHasDirect = targetPaths.some((ap) =>
          Array.isArray(ap.evidence) && ap.evidence.some((ev) => ev && ev.kind === "direct")
        );
        if (targetHasDirect) {
          passesEvidence = true;
        }
      }
    }

    if (!passesEvidence) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: evData.foundation_basis
          ? "foundation_basis trỏ tới path không có evidence direct hoặc target không phụ thuộc vào khóa nền hoặc reason rỗng"
          : "Path không có evidence direct và không có foundation_basis hợp lệ"
      });
      continue;
    }

    // Gate 6: path của ứng viên có origin trỏ tới một shortlist tồn tại,
    // trong đó chosen_slug bằng origin.pitch_slug và user_quote khác rỗng.
    const pathOrigin = cand.primaryPath?.origin;
    if (!pathOrigin || typeof pathOrigin !== "object") {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: "Path thiếu origin trỏ tới shortlist"
      });
      continue;
    }

    const shortlistRef = pathOrigin.shortlist;
    const pitchSlug = pathOrigin.pitch_slug;
    if (!shortlistRef || !pitchSlug) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: "Path origin thiếu shortlist hoặc pitch_slug"
      });
      continue;
    }

    // P-08: origin.pitch_slug phải thuộc courses[] của path
    const pathCourses = cand.primaryPath?.pathRaw?.courses || [];
    const pathCourseSlugs = new Set(pathCourses.map((c) => c?.slug).filter(Boolean));
    if (!pathCourseSlugs.has(pitchSlug)) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `origin.pitch_slug "${pitchSlug}" không thuộc danh sách courses của path "${cand.primaryPath.slug}"`
      });
      continue;
    }

    let slFilePath = path.isAbsolute(shortlistRef)
      ? shortlistRef
      : path.join(root, shortlistRef);
    if (!fs.existsSync(slFilePath)) {
      const inDir = path.join(root, ".course-plan", "shortlists", path.basename(shortlistRef));
      if (fs.existsSync(inDir)) {
        slFilePath = inDir;
      }
    }

    if (!fs.existsSync(slFilePath)) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `File shortlist "${shortlistRef}" không tồn tại`
      });
      continue;
    }

    let slData = null;
    try {
      slData = JSON.parse(fs.readFileSync(slFilePath, "utf8"));
    } catch (err) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `File shortlist hỏng: ${err.message}`
      });
      continue;
    }

    if (!slData.chosen_slug) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: "Shortlist chưa có chosen_slug được Human phê duyệt"
      });
      continue;
    }

    if (slData.chosen_slug !== pitchSlug) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `chosen_slug "${slData.chosen_slug}" không khớp origin.pitch_slug "${pitchSlug}"`
      });
      continue;
    }

    // P-08: file shortlist phải chứa đề xuất có slug đó
    const slProposals = Array.isArray(slData.shortlist) ? slData.shortlist : [];
    const hasPitch = slProposals.some((prop) => prop?.slug === pitchSlug);
    if (!hasPitch) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: `shortlist "${shortlistRef}" không chứa đề xuất có slug "${pitchSlug}"`
      });
      continue;
    }

    if (!slData.user_quote || typeof slData.user_quote !== "string" || !slData.user_quote.trim()) {
      needs_research.push({
        slug: cand.slug,
        title: cand.title,
        path_slug: cand.primaryPath.slug,
        reason: "Shortlist thiếu user_quote của Human"
      });
      continue;
    }

    // Đã thỏa mãn tiên quyết và qua cả 6 Gate -> Sẵn sàng
    readyCandidates.push({
      ...cand,
      evaluation: evData
    });
  }

  // 5. Chọn pick và xử lý tie
  let pick = null;
  let tie = null;
  let queue = [];

  if (readyCandidates.length > 0) {
    // Tìm minPriority nhỏ nhất
    const bestPriority = Math.min(...readyCandidates.map((c) => c.minPriority));
    const topReady = readyCandidates.filter((c) => c.minPriority === bestPriority);

    // Gom top ready candidate theo từng path có priority == bestPriority
    const pathsWithBestPriority = new Map();
    for (const c of topReady) {
      for (const p of c.paths) {
        if (p.priority === bestPriority) {
          if (!pathsWithBestPriority.has(p.slug)) {
            pathsWithBestPriority.set(p.slug, []);
          }
          pathsWithBestPriority.get(p.slug).push(c);
        }
      }
    }

    // Với mỗi path, chọn khóa đứng đầu theo topo -> suggested_order trong path đó -> slug (V-01)
    const pathWinners = [];
    for (const [pathSlug, cands] of pathsWithBestPriority.entries()) {
      cands.sort((a, b) => {
        const orderA = getCourseOrderInPath(a, pathSlug);
        const orderB = getCourseOrderInPath(b, pathSlug);
        if (orderA !== orderB) return orderA - orderB;
        return a.slug.localeCompare(b.slug);
      });
      pathWinners.push({
        pathSlug,
        winner: cands[0]
      });
    }

    // Kiểm tra xem các path có chọn cùng một khóa không
    const distinctWinnersMap = new Map();
    for (const pw of pathWinners) {
      if (!distinctWinnersMap.has(pw.winner.slug)) {
        distinctWinnersMap.set(pw.winner.slug, pw.winner);
      }
    }

    if (distinctWinnersMap.size > 1) {
      // Hai path cùng priority có khóa sẵn sàng đứng đầu khác nhau -> tie
      pick = null;
      tie = Array.from(distinctWinnersMap.values())
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .map((c) => ({
          slug: c.slug,
          title: c.title,
          path_slug: c.primaryPath.slug,
          priority: c.minPriority
        }));
    } else {
      // Có 1 winner duy nhất
      pick = Array.from(distinctWinnersMap.values())[0];
    }
  }

  // 6. Xây dựng queue nếu có pick
  // queue: các khóa kế tiếp cùng path với pick, theo cùng quy tắc, kể cả khóa đang bị chặn bởi chính pick
  if (pick) {
    const chosenPathSlug = pick.primaryPath.slug;
    const targetPath = approvedPaths.find((p) => p.slug === chosenPathSlug);

    if (targetPath && Array.isArray(targetPath.courses)) {
      // Lấy tất cả các khóa khác trong targetPath chưa in_production, in_catalog, produced
      // Loại trừ các khóa nằm trong updates hoặc rejected
      const excludedSlugs = new Set([
        pick.slug,
        ...updates.map((u) => u.slug),
        ...rejected.map((r) => r.slug)
      ]);

      const queueCandidates = [];
      for (const c of targetPath.courses) {
        if (excludedSlugs.has(c.slug)) continue;
        const cat = catalogMap.get(c.slug);
        if (cat && isExcludedState(cat.state)) continue;

        queueCandidates.push({
          slug: c.slug,
          title: c.title || c.slug,
          task: c.task || "",
          level: c.level || "all",
          suggested_order: typeof c.suggested_order === "number" ? c.suggested_order : 9999,
          is_foundation: Boolean(c.is_foundation),
          requires: Array.isArray(c.requires) ? c.requires : []
        });
      }

      // Sắp xếp topo bằng Kahn's algorithm
      // Node u -> v: v requires u (u must come before v)
      const qSlugs = new Set(queueCandidates.map((c) => c.slug));
      const inDegree = new Map();
      const graph = new Map(); // u -> set of v

      for (const c of queueCandidates) {
        inDegree.set(c.slug, 0);
        graph.set(c.slug, new Set());
      }

      for (const c of queueCandidates) {
        for (const req of c.requires) {
          if (qSlugs.has(req.slug)) {
            graph.get(req.slug).add(c.slug);
            inDegree.set(c.slug, (inDegree.get(c.slug) || 0) + 1);
          }
        }
      }

      // Priority queue cho Kahn's: inDegree == 0
      const candBySlug = new Map(queueCandidates.map((c) => [c.slug, c]));
      const available = queueCandidates
        .filter((c) => inDegree.get(c.slug) === 0)
        .map((c) => c.slug);

      const sortedQueue = [];

      while (available.length > 0) {
        available.sort((slugA, slugB) => {
          const a = candBySlug.get(slugA);
          const b = candBySlug.get(slugB);
          if (a.suggested_order !== b.suggested_order) return a.suggested_order - b.suggested_order;
          return a.slug.localeCompare(b.slug);
        });

        const nextSlug = available.shift();
        const nextCand = candBySlug.get(nextSlug);
        sortedQueue.push(nextCand);

        for (const dependent of graph.get(nextSlug)) {
          const newDeg = inDegree.get(dependent) - 1;
          inDegree.set(dependent, newDeg);
          if (newDeg === 0) {
            available.push(dependent);
          }
        }
      }

      // Nếu còn sót do dependency ngoài queue, thêm nốt
      if (sortedQueue.length < queueCandidates.length) {
        const handled = new Set(sortedQueue.map((c) => c.slug));
        const remaining = queueCandidates.filter((c) => !handled.has(c.slug));
        remaining.sort((a, b) => {
          if (a.suggested_order !== b.suggested_order) return a.suggested_order - b.suggested_order;
          return a.slug.localeCompare(b.slug);
        });
        sortedQueue.push(...remaining);
      }

      queue = sortedQueue;
    }
  }

  // Sắp xếp các danh sách khác theo slug để đảm bảo tính tất định (AC1)
  updates.sort((a, b) => a.slug.localeCompare(b.slug));
  rejected.sort((a, b) => a.slug.localeCompare(b.slug));
  needs_research.sort((a, b) => a.slug.localeCompare(b.slug));
  blocked.sort((a, b) => a.slug.localeCompare(b.slug));

  const decision = {
    pick: pick
      ? {
          slug: pick.slug,
          title: pick.title,
          path_slug: pick.primaryPath.slug,
          path_title: pick.primaryPath.title,
          priority: pick.minPriority,
          level: pick.level,
          is_foundation: pick.is_foundation,
          evaluation_ref: `.course-plan/evaluations/${pick.slug}.json`
        }
      : null,
    tie: tie || null,
    queue: queue.map((q) => ({
      slug: q.slug,
      title: q.title,
      level: q.level,
      suggested_order: q.suggested_order,
      requires: q.requires,
      is_foundation: q.is_foundation
    })),
    updates,
    blocked,
    needs_research,
    rejected,
    warnings: allWarnings,
    user_decision: null
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

  // Tìm index n kế tiếp
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

  for (const arg of args) {
    if (arg === "--write") {
      shouldWrite = true;
    } else if (!arg.startsWith("--")) {
      root = arg;
    }
  }

  const decision = decideNext({ repoRoot: root });

  if (shouldWrite) {
    const { fileName, filePath } = saveDecision(decision, root);
    console.log(`[next] Đã ghi quyết định vào ${fileName}`);
  }

  console.log(JSON.stringify(decision, null, 2));
}

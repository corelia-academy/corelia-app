// .claude/skills/course-planner/scripts/plan-update.mjs
// Cập nhật backlog.json và skill map trong khóa "plan", để nhiều app chạy song song không ghi đè thay đổi của nhau.
// Coordinator dùng script này thay cho sửa tay backlog.json / paths/*.json.
//
//   node plan-update.mjs status <slug> <open|chosen|produced|rejected> [--reason "<lý do>"] [--date YYYY-MM-DD] [--root <repo>]
//   node plan-update.mjs cover <slug> [--root <repo>]   (đặt course_slug và coverage "covered" cho các ô path_nodes của đề xuất)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lockDir, withLock, writeJsonAtomic } from "./lock.mjs";

const STATUSES = new Set(["open", "chosen", "produced", "rejected"]);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export function setProposalStatus(repoRoot, slug, status, { reason = null, date = null } = {}) {
  if (!STATUSES.has(status)) throw new Error(`status không hợp lệ: ${status}`);
  if (status === "rejected" && !reason) throw new Error("status rejected cần --reason");
  const root = path.resolve(repoRoot);
  const backlogFile = path.join(root, ".course-plan", "backlog.json");
  return withLock(lockDir(root, "plan"), () => {
    const data = readJson(backlogFile);
    const proposal = (data.proposals ?? []).find((p) => p.slug === slug);
    if (!proposal) throw new Error(`backlog không có đề xuất slug "${slug}"`);
    proposal.status = status;
    proposal.decided_on = date ?? new Date().toISOString().slice(0, 10);
    if (status === "rejected") proposal.reject_reason = reason;
    else delete proposal.reject_reason;
    writeJsonAtomic(backlogFile, data);
    return proposal;
  });
}

export function coverProposalNodes(repoRoot, slug) {
  const root = path.resolve(repoRoot);
  const backlogFile = path.join(root, ".course-plan", "backlog.json");
  return withLock(lockDir(root, "plan"), () => {
    const proposal = (readJson(backlogFile).proposals ?? []).find((p) => p.slug === slug);
    if (!proposal) throw new Error(`backlog không có đề xuất slug "${slug}"`);
    const mapSlug = proposal.path_nodes?.path;
    const nodeIds = proposal.path_nodes?.nodes;
    if (!mapSlug || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      throw new Error(`đề xuất "${slug}" thiếu path_nodes hợp lệ`);
    }
    const mapFile = path.join(root, ".course-plan", "paths", `${mapSlug}.json`);
    const map = readJson(mapFile);
    const missing = nodeIds.filter((id) => !(map.nodes ?? []).some((n) => n.id === id));
    if (missing.length) throw new Error(`map "${mapSlug}" không có ô: ${missing.join(", ")}`);
    for (const node of map.nodes) {
      if (nodeIds.includes(node.id)) {
        node.course_slug = slug;
        node.coverage = "covered";
      }
    }
    writeJsonAtomic(mapFile, map);
    return { map: mapSlug, nodes: nodeIds };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  const [command, slug, status] = positional;
  const root = opt("--root") ?? ".";
  try {
    if (command === "status" && slug && status) {
      const p = setProposalStatus(root, slug, status, { reason: opt("--reason"), date: opt("--date") });
      console.log(`[plan-update] ${slug}: status=${p.status} decided_on=${p.decided_on}`);
    } else if (command === "cover" && slug) {
      const r = coverProposalNodes(root, slug);
      console.log(`[plan-update] ${slug}: covered ${r.nodes.join(", ")} trong map ${r.map}`);
    } else {
      console.error("Dùng: plan-update.mjs status <slug> <open|chosen|produced|rejected> [--reason ...] | cover <slug> [--root <repo>]");
      process.exitCode = 2;
    }
  } catch (err) {
    console.error(`[plan-update] Lỗi: ${err.message}`);
    process.exitCode = 1;
  }
}

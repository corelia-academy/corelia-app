// .claude/skills/course-author/scripts/resources.mjs
// Cấp tài nguyên máy riêng cho một khóa khi kiểm chứng, để nhiều app chạy song song không tranh cổng hay DB tạm.
// Sổ cấp phát: .course-runs/.resources.json, ghi trong khóa "resources".
//
//   node resources.mjs <slug> [--root <repo>]            in JSON tài nguyên của khóa (cấp mới nếu chưa có)
//   node resources.mjs <slug> --release [--root <repo>]  trả lại khi khóa xong
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lockDir, withLock, writeJsonAtomic } from "../../course-planner/scripts/lock.mjs";

const PORT_BASE = 20000;
const BLOCK_SIZE = 100;
const MAX_BLOCKS = 400; // 20000–59999

export function describeBlock(slug, block) {
  const base = PORT_BASE + block * BLOCK_SIZE;
  const dbSuffix = slug.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48);
  return {
    slug,
    block,
    // validator cục bộ: --rpc-port, --faucet-port, --dynamic-port-range
    rpc_port: base,
    faucet_port: base + 1,
    app_ports: [base + 2, base + 9], // server ví dụ (Express...) của bài thực hành
    dynamic_port_range: `${base + 10}-${base + BLOCK_SIZE - 1}`,
    // database Postgres tạm trong container supabase_db_corelia-app; drop khi xong
    temp_db: `cr_tmp_${dbSuffix}`,
  };
}

function registryFile(root) {
  return path.join(root, ".course-runs", ".resources.json");
}

function readRegistry(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return { allocations: {} };
    throw err;
  }
}

export function allocate(repoRoot, slug) {
  const root = path.resolve(repoRoot);
  const file = registryFile(root);
  return withLock(lockDir(root, "resources"), () => {
    const reg = readRegistry(file);
    reg.allocations ??= {};
    if (reg.allocations[slug]) return describeBlock(slug, reg.allocations[slug].block);
    const used = new Set(Object.values(reg.allocations).map((a) => a.block));
    let block = 0;
    while (used.has(block)) block++;
    if (block >= MAX_BLOCKS) throw new Error(`Hết dải cổng (${MAX_BLOCKS} khóa đang giữ); release các khóa đã xong`);
    reg.allocations[slug] = { block, at: new Date().toISOString() };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeJsonAtomic(file, reg);
    return describeBlock(slug, block);
  });
}

export function release(repoRoot, slug) {
  const root = path.resolve(repoRoot);
  const file = registryFile(root);
  return withLock(lockDir(root, "resources"), () => {
    const reg = readRegistry(file);
    if (!reg.allocations?.[slug]) return false;
    delete reg.allocations[slug];
    writeJsonAtomic(file, reg);
    return true;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--root");
  const root = i >= 0 ? args[i + 1] : ".";
  const slug = args.find((a, k) => !a.startsWith("--") && !(k > 0 && args[k - 1] === "--root"));
  if (!slug) {
    console.error("Dùng: resources.mjs <slug> [--release] [--root <repo>]");
    process.exitCode = 2;
  } else if (args.includes("--release")) {
    console.log(release(root, slug) ? `[resources] Đã trả tài nguyên của ${slug}` : `[resources] ${slug} không giữ tài nguyên nào`);
  } else {
    console.log(JSON.stringify(allocate(root, slug), null, 2));
  }
}

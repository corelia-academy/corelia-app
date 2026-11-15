// .claude/skills/course-planner/test/plan-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { lintMapData, lintPlans, updateMapNodeOnProduced } from "../scripts/plan-lint.mjs";

const realDoc = fs.readFileSync(path.resolve("docs/learn/learn-proposal.md"), "utf8");

function getBaseValidEcosystemMap() {
  return {
    slug: "solana",
    kind: "ecosystem",
    entry: "Solana",
    title: "Lộ trình Phát triển trên Hệ sinh thái Solana",
    goal: "Đào tạo lập trình viên xây dựng ứng dụng phi tập trung hoàn chỉnh trên Solana",
    status: "approved",
    sources: [
      {
        url: "https://solana.com/docs",
        quote: "Solana documentation provides developers with tools and resources",
        observed_on: "2026-11-15"
      }
    ],
    nodes: [
      {
        id: "accounts-model",
        title: "Mô hình Account và State trên Solana",
        layer: "foundation",
        branch: null,
        requires: [],
        ref: null,
        required_tools: ["solana-cli"],
        scope: ["Account types", "Rent", "PDA"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "rust-basics",
        title: "Ngôn ngữ Rust cho Solana",
        layer: "language",
        branch: null,
        requires: ["accounts-model"],
        ref: null,
        required_tools: ["cargo", "rustc"],
        scope: ["Ownership", "Borrowing"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "anchor-programs",
        title: "Lập trình Solana Program với Anchor",
        layer: "core",
        branch: null,
        requires: ["rust-basics"],
        ref: null,
        required_tools: ["anchor", "cargo"],
        scope: ["Anchor macros", "CPI"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "token-program",
        title: "Phát triển Token SPL trên Solana",
        layer: "branch",
        branch: "token",
        requires: ["anchor-programs"],
        ref: null,
        required_tools: ["spl-token", "anchor"],
        scope: ["SPL Token 2022"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "metaplex-nfts",
        title: "Phát hành NFT với Metaplex Core",
        layer: "branch",
        branch: "nft",
        requires: ["anchor-programs"],
        ref: null,
        required_tools: ["node", "anchor"],
        scope: ["Metaplex Core standard"],
        course_slug: "metaplex-core-nft-collection",
        coverage: "covered"
      }
    ]
  };
}

function getBaseValidSkillMap() {
  return {
    slug: "redis",
    kind: "skill",
    entry: "Redis",
    title: "Lộ trình Làm chủ Redis",
    goal: "Đào tạo kỹ sư sử dụng thành thạo Redis trong kiến trúc dữ liệu và caching",
    status: "approved",
    sources: [
      {
        url: "https://redis.io/docs",
        quote: "Redis is an in-memory data store used by millions of developers",
        observed_on: "2026-11-15"
      }
    ],
    nodes: [
      {
        id: "redis-fundamentals",
        title: "Cơ chế In-memory và Cấu trúc Dữ liệu Redis",
        layer: "fundamentals",
        branch: null,
        requires: [],
        ref: null,
        required_tools: ["redis-cli"],
        scope: ["Strings", "Hashes"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "caching",
        title: "Chiến lược Caching và Eviction Policies",
        layer: "core",
        branch: null,
        requires: ["redis-fundamentals"],
        ref: null,
        required_tools: ["redis-cli"],
        scope: ["Cache-aside", "TTL"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "redis-cluster",
        title: "Scale và High Availability với Redis Sentinel/Cluster",
        layer: "production",
        branch: null,
        requires: ["caching"],
        ref: null,
        required_tools: ["docker", "redis-cli"],
        scope: ["Replication", "Clustering"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "redis-streams",
        title: "Tích hợp Message Broker với Redis Streams",
        layer: "integration",
        branch: null,
        requires: ["caching"],
        ref: null,
        required_tools: ["node", "redis-cli"],
        scope: ["Streams"],
        course_slug: null,
        coverage: "empty"
      }
    ]
  };
}

function getBaseValidRoleMap() {
  return {
    slug: "backend-engineer",
    kind: "role",
    entry: "Backend",
    title: "Lộ trình Kỹ sư Backend",
    goal: "Đào tạo kỹ sư backend toàn diện",
    status: "approved",
    sources: [
      {
        url: "https://roadmap.sh/backend",
        quote: "Step by step guide to becoming a modern backend developer in 2026",
        observed_on: "2026-11-15"
      }
    ],
    nodes: [
      {
        id: "backend-foundations",
        title: "Nền tảng Mạng và Giao thức HTTP/HTTPS",
        layer: "foundation",
        branch: null,
        requires: [],
        ref: null,
        required_tools: ["curl"],
        scope: ["OSI", "HTTP/2"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "api-development",
        title: "Thiết kế và Xây dựng RESTful API",
        layer: "competency",
        branch: null,
        requires: ["backend-foundations"],
        ref: null,
        required_tools: ["node"],
        scope: ["Routing", "Middleware"],
        course_slug: null,
        coverage: "empty"
      },
      {
        id: "system-observability",
        title: "Giám sát và Vận hành Hệ thống Backend",
        layer: "production",
        branch: null,
        requires: ["api-development"],
        ref: null,
        required_tools: ["docker"],
        scope: ["Metrics", "Tracing"],
        course_slug: null,
        coverage: "empty"
      }
    ]
  };
}

test("plan-lint: AC-04 - chấp nhận map hợp lệ cho cả 3 kind (ecosystem, skill, role)", () => {
  const ecoRes = lintMapData(getBaseValidEcosystemMap(), { proposalDocContent: realDoc });
  assert.strictEqual(ecoRes.ok, true, "Ecosystem map hợp lệ phải pass: " + ecoRes.problems.join("; "));

  const skillRes = lintMapData(getBaseValidSkillMap(), { proposalDocContent: realDoc });
  assert.strictEqual(skillRes.ok, true, "Skill map hợp lệ phải pass: " + skillRes.problems.join("; "));

  const roleRes = lintMapData(getBaseValidRoleMap(), { proposalDocContent: realDoc });
  assert.strictEqual(roleRes.ok, true, "Role map hợp lệ phải pass: " + roleRes.problems.join("; "));
});

test("plan-lint: AC-04 - từ chối layer sai cho từng kind", () => {
  // 1. Ecosystem dùng layer "competency" (thuộc role)
  const ecoMap = getBaseValidEcosystemMap();
  ecoMap.nodes[0].layer = "competency";
  let res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('layer "competency" không hợp lệ cho kind "ecosystem"')));

  // 2. Skill dùng layer "branch" (thuộc ecosystem)
  const skillMap = getBaseValidSkillMap();
  skillMap.nodes[0].layer = "branch";
  skillMap.nodes[0].branch = "defi";
  res = lintMapData(skillMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('layer "branch" không hợp lệ cho kind "skill"')));

  // 3. Role dùng layer "integration" (thuộc skill)
  const roleMap = getBaseValidRoleMap();
  roleMap.nodes[0].layer = "integration";
  res = lintMapData(roleMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('layer "integration" không hợp lệ cho kind "role"')));
});

test("plan-lint: AC-04 - từ chối requires ngược lên layer sau", () => {
  const ecoMap = getBaseValidEcosystemMap();
  // Ô accounts-model ở layer foundation lại requires anchor-programs ở layer core
  ecoMap.nodes[0].requires = ["anchor-programs"];
  const res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("requires không được trỏ tới ô ở layer sau")),
    "Phải báo lỗi requires trỏ lên layer sau: " + res.problems.join("; ")
  );
});

test("plan-lint: AC-04 - phát hiện chu trình trong requires của map", () => {
  const ecoMap = getBaseValidEcosystemMap();
  // accounts-model và rust-basics requires lẫn nhau (cả hai layer hợp lệ nhưng tạo chu trình)
  ecoMap.nodes[0].requires = ["rust-basics"];
  ecoMap.nodes[1].requires = ["accounts-model"];
  const res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("chu trình phụ thuộc trong requires")),
    "Phải báo lỗi chu trình: " + res.problems.join("; ")
  );
});

test("plan-lint: AC-04 - từ chối ref hỏng (map không tồn tại hoặc ô không tồn tại)", () => {
  const allMaps = new Map();
  const redisMap = getBaseValidSkillMap();
  allMaps.set("redis", redisMap);

  const roleMap = getBaseValidRoleMap();

  // 1. Ref trỏ map không tồn tại
  roleMap.nodes[1].ref = "nonexistent-map#node1";
  let res = lintMapData(roleMap, { proposalDocContent: realDoc, allMaps });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('ref trỏ map "nonexistent-map" không tồn tại')));

  // 2. Ref trỏ ô không tồn tại trong map hợp lệ
  roleMap.nodes[1].ref = "redis#unknown-node-id";
  res = lintMapData(roleMap, { proposalDocContent: realDoc, allMaps });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('ref trỏ ô "unknown-node-id" không tồn tại trong map "redis"')));

  // 3. Ref hợp lệ
  roleMap.nodes[1].ref = "redis#caching";
  res = lintMapData(roleMap, { proposalDocContent: realDoc, allMaps });
  assert.strictEqual(res.ok, true, "Ref hợp lệ phải pass: " + res.problems.join("; "));
});

test("plan-lint: AC-04 - map ecosystem thiếu layer nền hoặc có < 2 branch", () => {
  // 1. Thiếu layer core
  let ecoMap = getBaseValidEcosystemMap();
  ecoMap.nodes = ecoMap.nodes.filter((n) => n.layer !== "core");
  let res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("thiếu: core")));

  // 2. Chỉ có 1 nhánh branch (chỉ có nhánh token)
  ecoMap = getBaseValidEcosystemMap();
  ecoMap.nodes = ecoMap.nodes.filter((n) => n.id !== "metaplex-nfts");
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("ít nhất 2 nhánh branch khác nhau")));
});

test("plan-lint: AC-04 - kiểm tra trường branch (bắt buộc ở layer branch, cấm ở layer khác)", () => {
  // 1. Layer branch nhưng branch rỗng / null
  let ecoMap = getBaseValidEcosystemMap();
  ecoMap.nodes[3].branch = null;
  let res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('ô ở layer "branch" bắt buộc có branch không rỗng')));

  // 2. Layer foundation nhưng lại có branch
  ecoMap = getBaseValidEcosystemMap();
  ecoMap.nodes[0].branch = "core-branch";
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('branch phải là null ở layer "foundation"')));
});

test("plan-lint: AC-08 - updateMapNodeOnProduced cập nhật đúng course_slug và coverage covered", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "produced-test-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    const ecoMap = getBaseValidEcosystemMap();
    fs.writeFileSync(path.join(pathsDir, "solana.json"), JSON.stringify(ecoMap, null, 2));

    const updated = updateMapNodeOnProduced({
      repoRoot: tmpDir,
      mapSlug: "solana",
      nodeId: "anchor-programs",
      courseSlug: "solana-anchor-course"
    });

    assert.strictEqual(updated.nodes.find((n) => n.id === "anchor-programs").course_slug, "solana-anchor-course");
    assert.strictEqual(updated.nodes.find((n) => n.id === "anchor-programs").coverage, "covered");

    // Kiểm tra đã ghi ra file thật
    const reloaded = JSON.parse(fs.readFileSync(path.join(pathsDir, "solana.json"), "utf8"));
    const node = reloaded.nodes.find((n) => n.id === "anchor-programs");
    assert.strictEqual(node.course_slug, "solana-anchor-course");
    assert.strictEqual(node.coverage, "covered");

    // Ném lỗi khi map hoặc node không tồn tại
    assert.throws(
      () => updateMapNodeOnProduced({ repoRoot: tmpDir, mapSlug: "solana", nodeId: "invalid-node", courseSlug: "c" }),
      /không tồn tại trong map/
    );
    assert.throws(
      () => updateMapNodeOnProduced({ repoRoot: tmpDir, mapSlug: "invalid-map", nodeId: "n", courseSlug: "c" }),
      /không tồn tại/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

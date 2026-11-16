// .claude/skills/course-planner/test/plan-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { lintMapData, lintPlans, updateMapNodeOnProduced, lintEvaluationData } from "../scripts/plan-lint.mjs";

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
        mental_model: "Mọi dữ liệu và logic trên Solana đều lưu trong Account; program không lưu state nội tại mà chỉ xử lý các account được truyền vào.",
        concepts: ["Account types", "Rent exemption", "PDA"],
        app_use: ["Thiết kế schema dữ liệu cho app phi tập trung phân tách giữa logic và storage"],
        pitfalls: ["Quên kiểm tra owner của account dẫn tới lỗ hổng giả mạo dữ liệu"],
        required_tools: ["solana"],
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
        mental_model: "Rust quản lý bộ nhớ không cần garbage collection thông qua hệ thống ownership và borrow checker, phù hợp runtime deterministic khắt khe.",
        concepts: ["Ownership", "Borrowing", "Traits", "Memory layout"],
        app_use: ["Tối ưu compute units và zero-copy deserialization khi xử lý transaction high-throughput"],
        pitfalls: ["Unwrap gây panic dẫn tới transaction abort và lãng phí gas"],
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
        mental_model: "Anchor framework trừu tượng hóa boilerplate tuần tự hóa và validation account bằng declarative IDL và macros.",
        concepts: ["Anchor macros", "CPI", "Account validation"],
        app_use: ["Xây dựng smart contract chuẩn hóa với auto-generated TypeScript client"],
        pitfalls: ["Thiếu signer validation hoặc mutable constraint trong account struct"],
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
        mental_model: "Token trên Solana là mint account gắn liền với các token account của người dùng, phân tách quyền sở hữu token với logic mint.",
        concepts: ["SPL Token 2022", "Associated Token Account", "Mint authority"],
        app_use: ["Tạo utility token hoặc transfer hook cho sàn giao dịch DEX"],
        pitfalls: ["Không khởi tạo ATA dẫn tới gửi token vào account thường gây kẹt tiền"],
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
        mental_model: "Metaplex Core lưu metadata trực tiếp vào một account duy nhất để tối ưu hóa rent và đơn giản hóa quản lý lifecycle NFT.",
        concepts: ["Metaplex Core standard", "Plugin lifecycle", "Collection management"],
        app_use: ["Phát hành bộ sưu tập NFT vé sự kiện với dynamic metadata plugin"],
        pitfalls: ["Ghi đè plugin authority khiến mất quyền cập nhật metadata sau mint"],
        required_tools: ["node", "anchor"],
        scope: ["Metaplex Core standard"],
        course_slug: null,
        coverage: "empty"
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
        mental_model: "Redis lưu trữ dữ liệu hoàn toàn trên RAM và xử lý đơn luồng qua event loop, mang lại độ trễ microsecond cho các cấu trúc dữ liệu phong phú.",
        concepts: ["Strings", "Hashes", "Event loop", "RAM persistence"],
        app_use: ["Xây dựng leaderboards và session store tốc độ cao"],
        pitfalls: ["Lưu object JSON khổng lồ vào 1 string key làm nghẽn single thread event loop"],
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
        mental_model: "Cache đóng vai trò lớp đệm trước database; tính nhất quán được duy trì qua các chiến lược vô hiệu hóa và thuật toán loại bỏ khi RAM đầy.",
        concepts: ["Cache-aside", "TTL", "LRU/LFU eviction", "Cache stampede"],
        app_use: ["Tối ưu latency cho endpoint đọc heavy và bảo vệ primary database khỏi traffic spike"],
        pitfalls: ["Cache stampede (thundering herd) khi hot key hết hạn cùng lúc"],
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
        mental_model: "High availability đạt được qua Sentinel tự động failover, còn horizontal scale đạt được qua Cluster sharding data trên 16384 hash slots.",
        concepts: ["Sentinel failover", "Hash slots", "Gossip protocol", "Split brain"],
        app_use: ["Triển khai cluster chịu tải cao cho payment gateway và e-commerce"],
        pitfalls: ["Multi-key commands trên các key không cùng hash tag trong cluster"],
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
        mental_model: "Redis Streams là append-only log logico cho phép nhiều consumer group đọc tin nhắn song song với cơ chế ACK và PEL.",
        concepts: ["Consumer groups", "Pending Entries List", "XADD/XREADGROUP"],
        app_use: ["Xây dựng event-driven asynchronous processing pipeline giữa các microservices"],
        pitfalls: ["Không xử lý message trong PEL dẫn tới memory leak vô hình trong Redis"],
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
        mental_model: "Giao tiếp mạng hoạt động theo mô hình phân tầng; client và server đàm phán kết nối TCP/TLS trước khi trao đổi message HTTP vô trạng thái.",
        concepts: ["OSI model", "TCP handshake", "TLS termination", "HTTP/2 multiplexing"],
        app_use: ["Thiết kế reverse proxy và tối ưu handshake latency cho API gateway"],
        pitfalls: ["Header injection và không cấu hình timeout gây socket leak treo server"],
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
        mental_model: "RESTful API định nghĩa tài nguyên qua URL danh từ và thao tác bằng HTTP verbs chuẩn hóa, bảo đảm tính idempotent cho các thao tác cập nhật.",
        concepts: ["Routing", "Middleware pipeline", "Idempotency keys", "Status codes"],
        app_use: ["Xây dựng hệ thống checkout và webhook integration với bên thứ ba"],
        pitfalls: ["Xử lý thanh toán thiếu idempotency key gây trừ tiền hai lần"],
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
        mental_model: "Khả năng quan sát (observability) được xây dựng từ ba trụ cột: logs có cấu trúc, metrics tổng hợp, và distributed tracing theo dõi toàn bộ request lifecycle.",
        concepts: ["Structured logging", "Prometheus metrics", "Distributed tracing", "Alert rules"],
        app_use: ["Phát hiện nút thắt cổ chai hiệu năng và debug distributed failure trong microservice"],
        pitfalls: ["Log PII/token nhạy cảm ra plain log hoặc trace span gây rò rỉ dữ liệu"],
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

test("plan-lint: V-06 - lintMapData bắt lỗi required_tools là alias/package hoặc sai định dạng", () => {
  const ecoMap = getBaseValidEcosystemMap();

  // 1. Tool nằm trong KNOWN_BAD_TOOLS (solana-cli, anchor-cli, rust)
  ecoMap.nodes[0].required_tools = ["solana-cli"];
  let res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "solana-cli" là tên gói/alias, hãy đổi thành "solana"')),
    "Phải bắt lỗi tên gói solana-cli: " + res.problems.join("; ")
  );

  ecoMap.nodes[0].required_tools = ["anchor-cli"];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "anchor-cli" là tên gói/alias, hãy đổi thành "anchor"')),
    "Phải bắt lỗi tên gói anchor-cli"
  );

  ecoMap.nodes[0].required_tools = ["rust"];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "rust" là tên gói/alias, hãy đổi thành "rustc"')),
    "Phải bắt lỗi tên gói rust"
  );

  // 2. Tool có ký tự không hợp lệ
  ecoMap.nodes[0].required_tools = ["solana cli"];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "solana cli" không hợp lệ')),
    "Phải bắt lỗi tool có khoảng trắng"
  );

  // 3. Tool hợp lệ -> pass
  ecoMap.nodes[0].required_tools = ["solana", "cargo", "rustc"];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, true, "Tools hợp lệ phải pass: " + res.problems.join("; "));
});

test("plan-lint: AC-03 - lintMapData kiểm tra coverage tính từ published_lessons (empty vs partial/covered)", () => {
  const ecoMap = getBaseValidEcosystemMap();

  // 1. coverage là empty nhưng lại có course_slug -> lỗi
  ecoMap.nodes[0].coverage = "empty";
  ecoMap.nodes[0].course_slug = "solana-bootcamp";
  let res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('coverage là "empty" thì course_slug phải là null')));

  // 2. coverage là partial nhưng thiếu course_slug -> lỗi
  ecoMap.nodes[0].coverage = "partial";
  ecoMap.nodes[0].course_slug = null;
  ecoMap.nodes[0].covered_lessons = [{ title: "Bài 1", teaches: "Cơ chế 1" }];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('coverage là "partial" bắt buộc phải có course_slug')));

  // 3. coverage là partial có course_slug nhưng thiếu covered_lessons -> lỗi
  ecoMap.nodes[0].course_slug = "solana-bootcamp";
  ecoMap.nodes[0].covered_lessons = [];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('bắt buộc phải có covered_lessons')));

  // 4. coverage là covered có đủ course_slug và covered_lessons -> pass
  ecoMap.nodes[0].coverage = "covered";
  ecoMap.nodes[0].course_slug = "solana-bootcamp";
  ecoMap.nodes[0].covered_lessons = [
    { title: "Hello Solana Setup", teaches: "Setup môi trường" },
    { title: "PDA Counter", teaches: "Cơ chế PDA" }
  ];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, true, "Map có covered_lessons hợp lệ phải pass: " + res.problems.join("; "));
});

test("plan-lint: AC-02 - lintEvaluationData bắt buộc nêu bài published cho verdict overlap_warning / update_existing / covered", () => {
  const mockCatalog = {
    courses: [
      {
        slug: "solana-bootcamp",
        published_lessons: [
          { section_title: "Chương 1", title: "PDA Counter", section_order: 1, lesson_order: 1 },
          { section_title: "Chương 2", title: "Voting App", section_order: 2, lesson_order: 1 },
        ],
      },
    ],
  };

  const baseEval = {
    slug: "solana-pda-course",
    catalog: {
      verdict: "overlap_warning",
      basis: "Trùng lặp khái niệm nhưng không nhắc bài cụ thể nào",
      refs: [],
    },
    feasibility: {
      verdict: "feasible",
      basis: "Khả thi theo platform.md",
    },
    handoff: {
      title: "Solana PDA",
      audience: "Devs",
      level: "beginner",
      scope_note: "Phạm vi",
    },
  };

  // 1. overlap_warning nhưng không nêu tên bài published nào -> lỗi
  let res = lintEvaluationData(baseEval, { catalogData: mockCatalog });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('bắt buộc nêu ít nhất một tên bài đã publish trong catalog làm căn cứ')),
    "Phải bắt lỗi không nêu bài published: " + res.problems.join("; ")
  );

  // 2. Nêu đúng tên bài published trong basis hoặc refs -> PASS
  baseEval.catalog.basis = "Trùng lặp với bài PDA Counter đã publish trong solana-bootcamp";
  res = lintEvaluationData(baseEval, { catalogData: mockCatalog });
  assert.strictEqual(res.ok, true, "Nêu bài published trong basis phải pass: " + res.problems.join("; "));

  // 3. Verdict new thì không bắt buộc nêu bài published -> PASS
  baseEval.catalog.verdict = "new";
  baseEval.catalog.basis = "Khóa hoàn toàn mới, chưa có bài nào dạy";
  res = lintEvaluationData(baseEval, { catalogData: mockCatalog });
  assert.strictEqual(res.ok, true, "Verdict new phải pass");
});

test("plan-lint: V-09 - lintMapData đối chiếu covered_lessons và course_slug với catalogData", () => {
  const mockCatalog = {
    courses: [
      {
        slug: "solana-bootcamp",
        published_lessons: [
          { section_title: "Chương 1", title: "Giới thiệu", section_order: 1, lesson_order: 1 },
          { section_title: "Chương 1", title: "Hello Solana Setup", section_order: 1, lesson_order: 2 },
          { section_title: "Chương 2", title: "PDA Counter", section_order: 2, lesson_order: 1 },
        ],
      },
    ],
  };

  const ecoMap = getBaseValidEcosystemMap();

  // 1. course_slug không có trong catalog -> FAIL
  ecoMap.nodes[0].coverage = "partial";
  ecoMap.nodes[0].course_slug = "non-existent-course";
  ecoMap.nodes[0].covered_lessons = [{ title: "Giới thiệu", teaches: "Tổng quan" }];
  let res = lintMapData(ecoMap, { proposalDocContent: realDoc, catalogData: mockCatalog });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('course_slug "non-existent-course" không tồn tại trong catalog')),
    "Phải bắt lỗi course_slug không có trong catalog: " + res.problems.join("; ")
  );

  // 2. covered_lessons chứa bài nháp (không nằm trong published_lessons) -> FAIL
  ecoMap.nodes[0].course_slug = "solana-bootcamp";
  ecoMap.nodes[0].covered_lessons = [{ title: "Rent, Space & Serialization", teaches: "Cơ chế Rent" }];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc, catalogData: mockCatalog });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) =>
      p.includes('bài học "Rent, Space & Serialization" trong covered_lessons không nằm trong published_lessons của khóa "solana-bootcamp"')
    ),
    "Phải bắt lỗi bài học nháp không nằm trong published_lessons: " + res.problems.join("; ")
  );

  // 3. covered_lessons dùng bài published -> PASS
  ecoMap.nodes[0].coverage = "covered";
  ecoMap.nodes[0].covered_lessons = [
    { title: "Giới thiệu", teaches: "Tổng quan" },
    { title: "Hello Solana Setup", teaches: "Setup môi trường" }
  ];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc, catalogData: mockCatalog });
  assert.strictEqual(res.ok, true, "Bài published phải pass: " + res.problems.join("; "));

  // 4. catalog thiếu published_lessons -> WARN (không fatal error)
  const catalogWithoutPub = {
    courses: [
      {
        slug: "solana-bootcamp",
        // thiếu published_lessons
      },
    ],
  };
  ecoMap.nodes[0].covered_lessons = [{ title: "Bất kỳ bài nào", teaches: "Cơ chế" }];
  res = lintMapData(ecoMap, { proposalDocContent: realDoc, catalogData: catalogWithoutPub });
  assert.strictEqual(res.ok, true, "Thiếu published_lessons trong catalog chỉ warn, không fatal error: " + res.problems.join("; "));
  assert.ok(
    res.warnings.some((w) => w.includes('catalog thiếu published_lessons cho khóa "solana-bootcamp"')),
    "Phải có warning khi catalog thiếu published_lessons: " + res.warnings.join("; ")
  );

  // 5. Fixture test/fixtures/paths/solana.json đã sửa -> PASS
  const fixturePath = path.resolve(".claude/skills/course-planner/test/fixtures/paths/solana.json");
  const fixtureData = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  res = lintMapData(fixtureData, { proposalDocContent: realDoc, catalogData: mockCatalog });
  assert.strictEqual(res.ok, true, "Fixture solana.json đã sửa phải pass: " + res.problems.join("; "));
});

test("plan-lint: AC-03 - kiểm tra contract ô map mới (mental_model, concepts, app_use, pitfalls, allow_tooling, covered_lessons format)", () => {
  // 1. Thiếu mental_model hoặc rỗng
  let map = getBaseValidEcosystemMap();
  delete map.nodes[0].mental_model;
  let res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("thiếu mental_model")));

  map = getBaseValidEcosystemMap();
  map.nodes[0].mental_model = "   ";
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("thiếu mental_model")));

  // 2. concepts < 2
  map = getBaseValidEcosystemMap();
  map.nodes[0].concepts = ["Chỉ có 1"];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("concepts phải là mảng ít nhất 2 khái niệm")));

  // 3. Thiếu app_use hoặc rỗng
  map = getBaseValidEcosystemMap();
  map.nodes[0].app_use = [];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("app_use phải là mảng ít nhất 1 cách dùng")));

  // 4. Thiếu pitfalls hoặc rỗng
  map = getBaseValidEcosystemMap();
  map.nodes[0].pitfalls = [];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("pitfalls phải là mảng ít nhất 1 lỗi hoặc bẫy")));

  // 5. Ô tooling không có allow_tooling + reason -> lỗi
  map = getBaseValidEcosystemMap();
  map.nodes[0].title = "Cài đặt môi trường và công cụ Solana CLI";
  map.nodes[0].scope = ["cài đặt công cụ", "setup CLI"];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("ô công cụ không được phép tồn tại riêng lẻ")));

  // 5b. Có allow_tooling: true + reason -> pass
  map.nodes[0].allow_tooling = true;
  map.nodes[0].reason = "Bắt buộc cài đặt validator local để test program offline";
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, true, "Có allow_tooling và reason phải pass: " + res.problems.join("; "));

  // 6. covered_lessons là mảng string hoặc thiếu teaches -> lỗi
  map = getBaseValidEcosystemMap();
  map.nodes[0].coverage = "partial";
  map.nodes[0].course_slug = "solana-bootcamp";
  map.nodes[0].covered_lessons = ["Bài 1 dạng chuỗi"];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("không phải là object { title, teaches }")));

  map.nodes[0].covered_lessons = [{ title: "Bài 1" }]; // thiếu teaches
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("thiếu teaches")));
});

test("plan-lint: V-12 - ô công cụ không khớp nhầm ô khái niệm (có ranh giới từ, kiểm tra scope)", () => {
  // 1. Ô environment-config với title "Tách cấu hình theo môi trường và quản lý secret", scope có khái niệm thực chất -> PASS
  let map = getBaseValidRoleMap();
  map.nodes[0].id = "environment-config";
  map.nodes[0].title = "Tách cấu hình theo môi trường và quản lý secret";
  map.nodes[0].scope = ["12-factor config", "secret rotation", "khác biệt dev/staging/prod"];
  map.nodes[1].requires = ["environment-config"];
  let res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, true, "Ô environment-config có scope khái niệm không được bị coi là ô tooling: " + res.problems.join("; "));

  // 2. Ô có id chứa client (deploy-idl-client) -> không bị dính từ khóa tooling -> PASS
  map = getBaseValidEcosystemMap();
  map.nodes[4].id = "deploy-idl-client";
  map.nodes[4].title = "Triển khai Devnet, IDL và client TypeScript";
  map.nodes[4].scope = ["IDL codegen", "TypeScript client", "Devnet deployment"];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, true, "Id deploy-idl-client không được bị coi là tooling: " + res.problems.join("; "));

  // 3. Ô "Cài đặt Solana CLI" với scope toàn bộ là tooling -> FAIL (lỗi allow_tooling)
  map = getBaseValidEcosystemMap();
  map.nodes[0].id = "solana-cli-install";
  map.nodes[0].title = "Cài đặt Solana CLI";
  map.nodes[0].scope = ["cài đặt CLI", "setup ví"];
  map.nodes[1].requires = ["solana-cli-install"];
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("ô công cụ không được phép tồn tại riêng lẻ")),
    "Ô cài đặt với scope tooling phải bị chặn: " + res.problems.join("; ")
  );

  // 4. Ô trên có allow_tooling: true + reason -> PASS
  map.nodes[0].allow_tooling = true;
  map.nodes[0].reason = "Bắt buộc có CLI để chạy test suite localnet";
  res = lintMapData(map, { proposalDocContent: realDoc });
  assert.strictEqual(res.ok, true, "Ô tooling có allow_tooling và reason phải pass: " + res.problems.join("; "));
});

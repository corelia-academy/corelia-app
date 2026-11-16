// .claude/skills/course-planner/test/backlog-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lintBacklogData, extractProposalEntries } from "../scripts/plan-lint.mjs";

const fixtureDoc = fs.readFileSync(path.resolve(".claude/skills/course-planner/test/fixtures/learn-proposal.md"), "utf8");
const realDoc = fs.readFileSync(path.resolve("docs/learn/learn-proposal.md"), "utf8");

function getBaseValidBacklog() {
  const raw = fs.readFileSync(path.resolve(".claude/skills/course-planner/test/fixtures/backlog/valid-backlog.json"), "utf8");
  return JSON.parse(raw);
}

const mockCatalog = [
  { slug: "c-partial", title: "Khóa partial", content_state: "partial" },
  { slug: "c-complete", title: "Khóa complete", content_state: "complete" }
];

function getMockSolanaMap() {
  return {
    slug: "solana",
    kind: "ecosystem",
    entry: "Solana",
    title: "Lộ trình Solana",
    nodes: [
      {
        id: "accounts-model",
        title: "Accounts Model",
        layer: "foundation",
        branch: null,
        requires: [],
        ref: null,
        mental_model: "Mọi state trong account",
        concepts: ["AccountInfo", "Rent"],
        app_use: ["Tách state"],
        pitfalls: ["Quên tính rent"],
        required_tools: ["solana"],
        coverage: "empty"
      },
      {
        id: "rust-basics",
        title: "Rust cho Solana",
        layer: "language",
        branch: null,
        requires: ["accounts-model"],
        ref: null,
        mental_model: "Rust an toàn bộ nhớ",
        concepts: ["Ownership", "Borrowing"],
        app_use: ["Tối ưu compute unit"],
        pitfalls: ["Unwrap panic"],
        required_tools: ["cargo"],
        coverage: "empty"
      },
      {
        id: "anchor-programs",
        title: "Anchor Programs",
        layer: "core",
        branch: null,
        requires: ["rust-basics"],
        ref: null,
        mental_model: "Macro validate account",
        concepts: ["Anchor macro", "CPI"],
        app_use: ["Viết program"],
        pitfalls: ["UncheckedAccount"],
        required_tools: ["anchor", "cargo"],
        coverage: "empty"
      },
      {
        id: "token-program",
        title: "SPL Token",
        layer: "branch",
        branch: "token",
        requires: ["anchor-programs"],
        ref: null,
        mental_model: "Token account",
        concepts: ["Mint", "ATA"],
        app_use: ["Mint token"],
        pitfalls: ["Thiếu ATA"],
        required_tools: ["anchor"],
        coverage: "empty"
      },
      {
        id: "ref-node",
        title: "Node trỏ map khác",
        layer: "branch",
        branch: "infra",
        requires: ["accounts-model"],
        ref: "redis#caching",
        required_tools: [],
        coverage: "empty"
      }
    ]
  };
}

function makeValidProposal({
  slug = "test-proposal",
  title = "Thiết kế Program Solana với Anchor",
  path = "solana",
  nodes = ["accounts-model", "rust-basics", "anchor-programs"],
  status = "open",
  decided_on = null,
  reject_reason = null,
  tools = ["solana", "cargo", "anchor"],
  final_product = "Ứng dụng bỏ phiếu phi tập trung mới kèm bản ghi chú notes giải thích kiến trúc lựa chọn",
  modules = null
} = {}) {
  const defaultModules = nodes.map((nId) => ({
    node: nId,
    mechanism: `Cơ chế của ${nId}`,
    app_use: [`Dùng ${nId} khi build app thực tế`],
    pitfalls: [`Bẫy hay gặp ở ${nId}`],
    outcome: "thiết kế kiến trúc hệ thống và xử lý logic an toàn"
  }));

  return {
    slug,
    title,
    direction: { axis: "ecosystem", entry: "Solana" },
    level: "intermediate",
    kind: "new",
    promise: "Xây dựng ứng dụng hoàn chỉnh trên hệ sinh thái Solana",
    starting_point: { knowledge: "Lập trình cơ bản", requires: [] },
    final_product,
    tools,
    alternatives: [
      { name: "Source A", url: "https://example.com/a", gap: "Thiếu bài thực hành" },
      { name: "Source B", url: "https://example.com/b", gap: "Không cập nhật" }
    ],
    why_now: {
      kind: "direct",
      urls: ["https://example.com"],
      quote: "Direct quote for course why now requirement"
    },
    criteria: {
      continues_catalog: { met: false, basis: "Khóa mới", refs: [] },
      fills_direction: { met: true, basis: "Đạt", refs: ["r1"] },
      timely: { met: true, basis: "Đạt", refs: ["r2"] },
      differentiated: { met: true, basis: "Đạt", refs: ["r3"] },
      showable_product: { met: true, basis: "Đạt", refs: ["github_url", "notes"] }
    },
    path_nodes: {
      path,
      nodes
    },
    modules: modules || defaultModules,
    status,
    added_on: "2026-11-15",
    decided_on,
    reject_reason
  };
}

test("backlog-lint: chấp nhận một backlog hợp lệ 4 đề xuất open, thuộc 3 entry khi không có focus", () => {
  const data = getBaseValidBacklog();
  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, true, "Backlog hợp lệ phải pass lint: " + res.problems.join("; "));
  assert.strictEqual(res.problems.length, 0);
});

test("backlog-lint: từ chối status không hợp lệ", () => {
  const data = getBaseValidBacklog();
  data.proposals[0].status = "in_progress";
  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('status "in_progress" không hợp lệ')));
});

test("backlog-lint: rejected bắt buộc có decided_on và reject_reason không rỗng", () => {
  const data = getBaseValidBacklog();
  // Thiếu reject_reason
  data.proposals.push({
    ...data.proposals[0],
    slug: "pitch-rejected-1",
    status: "rejected",
    decided_on: "2026-11-14",
    reject_reason: null
  });
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("bắt buộc có reject_reason không rỗng")));

  // Thiếu decided_on
  data.proposals[data.proposals.length - 1].reject_reason = "Không phù hợp";
  data.proposals[data.proposals.length - 1].decided_on = null;
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("bắt buộc có decided_on định dạng YYYY-MM-DD")));
});

test("backlog-lint: chosen bắt buộc có decided_on", () => {
  const data = getBaseValidBacklog();
  data.proposals[0].status = "chosen";
  data.proposals[0].decided_on = null;
  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('status là "chosen" bắt buộc có decided_on định dạng YYYY-MM-DD')));
});

test("backlog-lint: có > 1 đề xuất chosen thì lint lỗi", () => {
  const data = getBaseValidBacklog();
  data.proposals[0].status = "chosen";
  data.proposals[0].decided_on = "2026-11-14";
  data.proposals[1].status = "chosen";
  data.proposals[1].decided_on = "2026-11-14";
  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("Có nhiều hơn 1 đề xuất đang ở status \"chosen\"")),
    "Phải báo lỗi nhiều hơn 1 đề xuất chosen: " + res.problems.join("; ")
  );
});

test("backlog-lint: quy tắc phân bổ đề xuất open theo focus (tối đa 2 đề xuất mỗi map)", () => {
  const data = getBaseValidBacklog();
  data.focus = { paths: ["solana", "redis", "backend-engineer"] };

  // Đặt 2 đề xuất open cho map solana
  data.proposals[0] = makeValidProposal({ slug: "solana-open-1", path: "solana", nodes: ["accounts-model", "rust-basics", "anchor-programs"] });
  data.proposals[1] = makeValidProposal({ slug: "solana-open-2", path: "solana", nodes: ["token-program", "metaplex-nfts", "node-extra"], modules: [
    { node: "token-program", mechanism: "SPL Token", app_use: ["Token DEX"], pitfalls: ["Missing ATA"], outcome: "thiết kế tokenomics" },
    { node: "metaplex-nfts", mechanism: "NFT Core", app_use: ["Vé NFT"], pitfalls: ["Authority override"], outcome: "thiết kế plugin" },
    { node: "node-extra", mechanism: "Extra node", app_use: ["Extra app use"], pitfalls: ["Extra pitfall"], outcome: "thiết kế extra" }
  ] });
  data.proposals = [data.proposals[0], data.proposals[1]];

  // 2 đề xuất cùng map solana -> PASS (<= 2 đề xuất)
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, true, "Tối đa 2 đề xuất open cho mỗi map phải pass: " + res.problems.join("; "));

  // Thêm đề xuất thứ 3 vào cùng map solana -> lỗi (> 2 đề xuất)
  data.proposals.push(makeValidProposal({
    slug: "solana-open-3",
    path: "solana",
    nodes: ["node-a", "node-b", "node-c"]
  }));
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("tối đa 2 đề xuất mỗi map")));
});

test("backlog-lint: AC-02 - chặn đề xuất vào ô đã covered, ô có ref, hoặc ô chưa sẵn sàng", () => {
  const pathsFixtureDir = path.resolve(".claude/skills/course-planner/test/fixtures/paths");
  const solanaMapFixture = JSON.parse(fs.readFileSync(path.join(pathsFixtureDir, "solana.json"), "utf8"));
  const backendMapFixture = JSON.parse(fs.readFileSync(path.join(pathsFixtureDir, "backend-engineer.json"), "utf8"));

  const mapsBySlug = new Map([
    ["solana", solanaMapFixture],
    ["backend-engineer", backendMapFixture]
  ]);

  // 1. open trỏ ô đã có coverage: "covered" -> lỗi
  const coveredSolanaFixture = JSON.parse(JSON.stringify(solanaMapFixture));
  coveredSolanaFixture.nodes[0].coverage = "covered";
  coveredSolanaFixture.nodes[0].course_slug = "solana-bootcamp";
  coveredSolanaFixture.nodes[0].covered_lessons = [{ title: "Giới thiệu", teaches: "Khái niệm" }];

  const mapsWithCovered = new Map([
    ["solana", coveredSolanaFixture],
    ["backend-engineer", backendMapFixture]
  ]);

  const data1 = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "solana-covered-check",
        path: "solana",
        nodes: ["accounts-model", "rust-basics", "anchor-programs"]
      })
    ]
  };
  const res1 = lintBacklogData(data1, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug: mapsWithCovered });
  assert.strictEqual(res1.ok, false);
  assert.ok(
    res1.problems.some((p) => p.includes('đã có coverage: "covered"')),
    "Phải báo lỗi ô accounts-model đã covered: " + res1.problems.join("; ")
  );

  // 2. open trỏ token-program và metaplex-nfts (requires anchor-programs chưa covered/chosen) -> lỗi readiness
  const data2 = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "solana-branch-check",
        path: "solana",
        nodes: ["token-program", "metaplex-nfts", "node-extra"],
        modules: [
          { node: "token-program", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế token" },
          { node: "metaplex-nfts", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế nft" },
          { node: "node-extra", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế extra" }
        ]
      })
    ]
  };
  const res2 = lintBacklogData(data2, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res2.ok, false);
  assert.ok(
    res2.problems.some((p) => p.includes("chưa sẵn sàng vì các ô tiên quyết chưa hoàn thành")),
    "Phải báo lỗi readiness: " + res2.problems.join("; ")
  );

  // 3. Thêm chosen cho anchor-programs (gom 3 ô đầu tiên) -> token-program pass readiness
  const data3 = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "solana-first-3",
        status: "chosen",
        decided_on: "2026-11-15",
        path: "solana",
        nodes: ["accounts-model", "rust-basics", "anchor-programs"]
      }),
      makeValidProposal({
        slug: "solana-branch-check",
        status: "open",
        path: "solana",
        nodes: ["token-program", "metaplex-nfts", "node-extra"],
        modules: [
          { node: "token-program", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế token" },
          { node: "metaplex-nfts", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế nft" },
          { node: "node-extra", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế extra" }
        ]
      })
    ]
  };
  const res3 = lintBacklogData(data3, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.ok(
    !res3.problems.some((p) => p.includes("token-program") && p.includes("node-readiness")),
    "token-program phải vượt qua kiểm tra readiness khi anchor-programs đã có chosen: " + res3.problems.join("; ")
  );

  // 4. open trỏ ô có ref trong backend-engineer.json -> lỗi
  const data4 = {
    focus: { paths: ["backend-engineer"] },
    proposals: [
      makeValidProposal({
        slug: "backend-ref-check",
        path: "backend-engineer",
        nodes: ["backend-foundations", "api-development", "backend-caching"],
        modules: [
          { node: "backend-foundations", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế mạng" },
          { node: "api-development", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "viết api" },
          { node: "backend-caching", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế cache" }
        ]
      })
    ]
  };
  const res4 = lintBacklogData(data4, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res4.ok, false);
  assert.ok(
    res4.problems.some((p) => p.includes('có ref "redis#caching", không thể tạo khóa trực tiếp')),
    "Phải báo lỗi ô có ref: " + res4.problems.join("; ")
  );

  // 5. produced dạng path_node cũ không bị kiểm tra lỗi node
  const data5 = {
    focus: { paths: ["solana"] },
    proposals: [
      {
        slug: "solana-legacy-produced",
        status: "produced",
        decided_on: "2026-11-15",
        path_node: { path: "solana", node: "accounts-model" },
        direction: { axis: "ecosystem", entry: "Solana" },
        title: "Khóa cũ đã sản xuất"
      }
    ]
  };
  const res5 = lintBacklogData(data5, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.ok(
    !res5.problems.some((p) => p.includes("path_nodes")),
    "Đề xuất produced dạng path_node cũ không bị bắt lỗi path_nodes: " + res5.problems.join("; ")
  );
});

test("backlog-lint: AC-03 - required_tools thiếu chuyển thành cảnh báo (không làm fail backlog)", () => {
  const mapsBySlug = new Map();
  mapsBySlug.set("solana", getMockSolanaMap());

  const data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "solana-warn-tools",
        path: "solana",
        nodes: ["accounts-model", "rust-basics", "anchor-programs"],
        tools: ["node"] // thiếu solana, cargo, anchor
      })
    ]
  };

  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Thiếu required_tools không làm fail backlog lint: " + res.problems.join("; "));
  assert.ok(
    res.warnings.some((w) => w.includes("tools thiếu required_tools")),
    "Phải có warning cảnh báo thiếu required_tools: " + res.warnings.join("; ")
  );
});

test("backlog-lint: AC-04 - bỏ ràng buộc final_product-onchain và hasTest (cho phép app mới kèm notes)", () => {
  const mapsBySlug = new Map();
  mapsBySlug.set("solana", getMockSolanaMap());

  const data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "solana-app-notes",
        path: "solana",
        nodes: ["accounts-model", "rust-basics", "anchor-programs"],
        final_product: "Tình huống app sàn giao dịch DEX mới với kiến trúc phân tách account, nộp kèm bản thiết kế và notes giải thích lựa chọn kỹ thuật"
      })
    ]
  };

  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Final product kèm notes không đòi onchain/test phải pass: " + res.problems.join("; "));
});

test("backlog-lint: AC-05 - thêm đề xuất có slug trùng lặp bất kỳ trạng thái nào (kể cả rejected) thì lint báo lỗi", () => {
  const data = getBaseValidBacklog();
  data.proposals.push({
    ...data.proposals[0],
    slug: "base-l2-dapp-builder",
    status: "rejected",
    decided_on: "2026-11-14",
    reject_reason: "OnchainKit Retired"
  });
  data.proposals.push({
    ...data.proposals[1],
    slug: "base-l2-dapp-builder",
    status: "open",
    decided_on: null,
    reject_reason: null
  });
  const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("slug \"base-l2-dapp-builder\" bị trùng lặp")),
    "Phải báo lỗi slug bị trùng lặp: " + res.problems.join("; ")
  );
});

test("backlog-lint: P-07 - từ chối chuỗi con không phải là entry trọn mục", () => {
  const substrings = [
    { axis: "role", entry: "Developer" },
    { axis: "role", entry: "e" },
    { axis: "role", entry: "Smart Contract" }
  ];

  for (const item of substrings) {
    const data = getBaseValidBacklog();
    data.proposals[0].direction = item;
    const res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
    assert.strictEqual(res.ok, false, `Entry chuỗi con "${item.entry}" phải bị từ chối`);
    assert.ok(
      res.problems.some((p) => p.includes("không phải là một mục hợp lệ")),
      `Phải có thông báo lỗi mục không hợp lệ cho "${item.entry}": ` + res.problems.join("; ")
    );
  }
});

test("backlog-lint: P-07 - đọc docs/learn/learn-proposal.md thật phát hiện đúng cấu trúc các mục", () => {
  const entries = extractProposalEntries(realDoc);
  assert.ok(entries.role.has("Smart Contract Developer"));
  assert.ok(entries.role.has("Web3 Security Auditor"));
  assert.ok(entries.role.has("Frontend"));
  assert.ok(entries.skill.has("Rust"));
  assert.ok(entries.skill.has("AI Agents"));
  assert.ok(entries.skill.has("React"));
  assert.ok(entries.ecosystem.has("Solana"));
  assert.ok(entries.ecosystem.has("Arbitrum"));
});

test("backlog-lint: kiểm tra các ràng buộc nội dung đề xuất (promise cấm, alternatives < 2, why_now thiếu quote, kind new trùng catalog)", () => {
  // 1. Promise cấm
  let data = getBaseValidBacklog();
  data.proposals[0].promise = "Hiểu rõ về cách thức hoạt động của EVM";
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("mở đầu bằng từ cấm")));

  // 2. Alternatives < 2
  data = getBaseValidBacklog();
  data.proposals[0].alternatives = [{ name: "One", url: "https://example.com", gap: "G" }];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("cần ít nhất 2 nguồn thay thế")));

  // 3. Kind new trùng catalog
  data = getBaseValidBacklog();
  data.proposals[0].kind = "new";
  data.proposals[0].slug = "c-complete";
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("đã tồn tại trong catalog")));
});

test("backlog-lint: V-06 - lintBacklogData bắt lỗi tools trong proposal là alias/package hoặc sai định dạng", () => {
  const data = getBaseValidBacklog();

  // 1. Tool solana-cli
  data.proposals[0].tools = ["node", "solana-cli"];
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "solana-cli" là tên gói/alias, hãy đổi thành "solana"')),
    "Phải bắt lỗi tên gói solana-cli"
  );

  // 2. Tool anchor-cli
  data.proposals[0].tools = ["node", "anchor-cli"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "anchor-cli" là tên gói/alias, hãy đổi thành "anchor"')),
    "Phải bắt lỗi tên gói anchor-cli"
  );

  // 3. Tool rust
  data.proposals[0].tools = ["node", "rust"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "rust" là tên gói/alias, hãy đổi thành "rustc"')),
    "Phải bắt lỗi tên gói rust"
  );

  // 4. Tool sai định dạng
  data.proposals[0].tools = ["node", "bad tool!"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('tên tool "bad tool!" không hợp lệ')),
    "Phải bắt lỗi tool sai format"
  );

  // 5. Tools hợp lệ -> pass
  data.proposals[0].tools = ["node", "solana", "cargo", "rustc", "spl-token"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, true, "Tools hợp lệ phải pass: " + res.problems.join("; "));
});

test("backlog-lint: V-05 - ô tiên quyết chỉ partial qua catalog KHÔNG thỏa mãn requires (không có catalog bypass)", () => {
  const mapsBySlug = new Map();
  const mockMap = getMockSolanaMap();

  // Node accounts-model: coverage: "partial", course_slug: "c-complete"
  mockMap.nodes[0].coverage = "partial";
  mockMap.nodes[0].course_slug = "c-complete";
  mapsBySlug.set("solana", mockMap);

  const data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "solana-requires-check",
        path: "solana",
        nodes: ["rust-basics", "anchor-programs", "token-program"],
        modules: [
          { node: "rust-basics", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "viết mã rust" },
          { node: "anchor-programs", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "viết program" },
          { node: "token-program", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế token" }
        ]
      })
    ]
  };

  // Case 1: Tiên quyết partial qua catalog -> VẪN BỊ BÁO LỖI node-readiness (V-05)
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false, "Tiên quyết partial qua catalog không được thỏa mãn");
  assert.ok(
    res.problems.some((p) => p.includes("chưa sẵn sàng vì các ô tiên quyết chưa hoàn thành") && p.includes("accounts-model")),
    "Phải bắt lỗi node-readiness: " + res.problems.join("; ")
  );

  // Case 2: Đặt accounts-model thành covered trong map -> PASS
  mockMap.nodes[0].coverage = "covered";
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Tiên quyết covered phải pass: " + res.problems.join("; "));

  // Case 3: accounts-model quay lại partial, nhưng có 1 đề xuất chosen gom accounts-model trong backlog -> PASS
  mockMap.nodes[0].coverage = "partial";
  // Bổ sung node-x, node-y vào mockMap để ô tồn tại
  mockMap.nodes.push(
    { id: "node-x", layer: "foundation", requires: [], ref: null, mental_model: "M", concepts: ["C1", "C2"], app_use: ["A"], pitfalls: ["P"], coverage: "empty" },
    { id: "node-y", layer: "foundation", requires: [], ref: null, mental_model: "M", concepts: ["C1", "C2"], app_use: ["A"], pitfalls: ["P"], coverage: "empty" }
  );
  data.proposals.push(
    makeValidProposal({
      slug: "solana-accounts-intro",
      status: "chosen",
      decided_on: "2026-11-15",
      path: "solana",
      nodes: ["accounts-model", "node-x", "node-y"],
      modules: [
        { node: "accounts-model", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế account" },
        { node: "node-x", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế x" },
        { node: "node-y", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế y" }
      ]
    })
  );

  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Có đề xuất chosen cho tiên quyết phải pass: " + res.problems.join("; "));
});

test("backlog-lint: AC-04 - kiểm tra toàn diện ràng buộc path_nodes và modules (7 trường hợp bắt buộc)", () => {
  const mapsBySlug = new Map();
  const mockMap = getMockSolanaMap();
  mapsBySlug.set("solana", mockMap);

  // 1. 2 ô (< 3 ô) -> lỗi
  let data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "p-2-nodes",
        nodes: ["accounts-model", "rust-basics"]
      })
    ]
  };
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("từ 3 đến 7 ô")), "Case 1: 2 ô phải báo lỗi: " + res.problems.join("; "));

  // 2. 8 ô (> 7 ô) -> lỗi
  const eightNodes = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"];
  data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "p-8-nodes",
        nodes: eightNodes
      })
    ]
  };
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("từ 3 đến 7 ô")), "Case 2: 8 ô phải báo lỗi: " + res.problems.join("; "));

  // 3. ô khác map (không tồn tại trong map) -> lỗi
  data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "p-unknown-node",
        nodes: ["accounts-model", "rust-basics", "non-existent-node"]
      })
    ]
  };
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("không tồn tại trong map")), "Case 3: ô khác map phải báo lỗi: " + res.problems.join("; "));

  // 4. ô đã covered -> lỗi
  const mapWithCovered = JSON.parse(JSON.stringify(mockMap));
  mapWithCovered.nodes[0].coverage = "covered";
  const mapsWithCov = new Map([["solana", mapWithCovered]]);
  data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "p-covered-node",
        nodes: ["accounts-model", "rust-basics", "anchor-programs"]
      })
    ]
  };
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug: mapsWithCov });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes('đã có coverage: "covered"')), "Case 4: ô đã covered phải báo lỗi: " + res.problems.join("; "));

  // 5. modules lệch nodes về số lượng hoặc thứ tự -> lỗi
  data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({
        slug: "p-mismatched-modules",
        nodes: ["accounts-model", "rust-basics", "anchor-programs"],
        modules: [
          // Sai thứ tự: rust-basics trước accounts-model
          { node: "rust-basics", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "viết code" },
          { node: "accounts-model", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "thiết kế state" },
          { node: "anchor-programs", mechanism: "M", app_use: ["A"], pitfalls: ["P"], outcome: "viết program" }
        ]
      })
    ]
  };
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("không khớp thứ tự")), "Case 5: modules lệch nodes phải báo lỗi: " + res.problems.join("; "));

  // 6. 3 đề xuất cùng một map -> lỗi (> 2 đề xuất mỗi map)
  data = {
    focus: { paths: ["solana"] },
    proposals: [
      makeValidProposal({ slug: "prop-1", nodes: ["n1", "n2", "n3"] }),
      makeValidProposal({ slug: "prop-2", nodes: ["n4", "n5", "n6"] }),
      makeValidProposal({ slug: "prop-3", nodes: ["n7", "n8", "n9"] })
    ]
  };
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("tối đa 2 đề xuất mỗi map")), "Case 6: 3 đề xuất cùng map phải báo lỗi: " + res.problems.join("; "));

  // 7. 3 map có ô sẵn sàng mà đề xuất chỉ ở 2 map -> lỗi
  // Tạo 3 map có >= 3 ô sẵn sàng: solana, redis, backend
  const mapSolanaReady = {
    slug: "solana",
    nodes: [
      { id: "s1", coverage: "empty", ref: null, requires: [] },
      { id: "s2", coverage: "empty", ref: null, requires: [] },
      { id: "s3", coverage: "empty", ref: null, requires: [] }
    ]
  };
  const mapRedisReady = {
    slug: "redis",
    nodes: [
      { id: "r1", coverage: "empty", ref: null, requires: [] },
      { id: "r2", coverage: "empty", ref: null, requires: [] },
      { id: "r3", coverage: "empty", ref: null, requires: [] }
    ]
  };
  const mapBackendReady = {
    slug: "backend",
    nodes: [
      { id: "b1", coverage: "empty", ref: null, requires: [] },
      { id: "b2", coverage: "empty", ref: null, requires: [] },
      { id: "b3", coverage: "empty", ref: null, requires: [] }
    ]
  };
  const threeReadyMaps = new Map([
    ["solana", mapSolanaReady],
    ["redis", mapRedisReady],
    ["backend", mapBackendReady]
  ]);

  // Đề xuất chỉ trải trên 2 map (solana và redis), bỏ qua backend
  data = {
    focus: { paths: ["solana", "redis", "backend"] },
    proposals: [
      makeValidProposal({ slug: "sol-1", path: "solana", nodes: ["s1", "s2", "s3"] }),
      makeValidProposal({ slug: "red-1", path: "redis", nodes: ["r1", "r2", "r3"] })
    ]
  };
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug: threeReadyMaps });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("có 3 map focus có ô sẵn sàng nhưng đề xuất open chỉ trải trên 2 map")),
    "Case 7: 3 map sẵn sàng mà đề xuất chỉ 2 map phải báo lỗi: " + res.problems.join("; ")
  );
});

test("backlog-lint: AC-05 - từ chối tên trường nộp bài sai chuẩn (testnet_tx_hash, deployed_url)", () => {
  const data = getBaseValidBacklog();

  // 1. criteria.showable_product.refs chứa testnet_tx_hash -> lỗi
  data.proposals[0].criteria.showable_product = {
    met: true,
    basis: "Nộp qua testnet",
    refs: ["github_url", "testnet_tx_hash"],
  };
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('trường nộp bài "testnet_tx_hash" trong showable_product.refs không hợp lệ')),
    "Phải bắt lỗi testnet_tx_hash trong refs: " + res.problems.join("; ")
  );

  // 2. criteria.showable_product.refs chứa deployed_url -> lỗi
  data.proposals[0].criteria.showable_product.refs = ["github_url", "deployed_url"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('trường nộp bài "deployed_url" trong showable_product.refs không hợp lệ')),
    "Phải bắt lỗi deployed_url trong refs: " + res.problems.join("; ")
  );

  // 3. final_product chứa testnet_tx_hash -> lỗi
  data.proposals[0].criteria.showable_product.refs = ["github_url", "transaction_url"];
  data.proposals[0].final_product = "Kho repo nộp qua testnet_tx_hash và link";
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('final_product chứa tên trường nộp bài sai chuẩn "testnet_tx_hash"')),
    "Phải bắt lỗi testnet_tx_hash trong final_product"
  );

  // 4. final_product chứa deployed_url -> lỗi
  data.proposals[0].final_product = "Kho repo nộp qua deployed_url và link";
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('final_product chứa tên trường nộp bài sai chuẩn "deployed_url"')),
    "Phải bắt lỗi deployed_url trong final_product"
  );

  // 5. Sử dụng đúng chuẩn (transaction_url, deployment_url) -> PASS
  data.proposals[0].final_product = "Kho repo nộp qua transaction_url và deployment_url";
  data.proposals[0].criteria.showable_product.refs = ["github_url", "transaction_url", "deployment_url", "notes"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, true, "Trường nộp bài đúng chuẩn phải pass: " + res.problems.join("; "));
});

test("backlog-lint: V-13 - focus.paths dạng object { path, kind, entry } (entry sai -> lỗi, map lệch -> lỗi, chuỗi cũ -> pass)", () => {
  const pathsFixtureDir = path.resolve(".claude/skills/course-planner/test/fixtures/paths");
  const solanaMapFixture = JSON.parse(fs.readFileSync(path.join(pathsFixtureDir, "solana.json"), "utf8"));
  const mapsBySlug = new Map([["solana", solanaMapFixture]]);

  // 1. Entry sai (không tồn tại trong mục kind tương ứng của learn-proposal) -> lỗi
  const dataBadEntry = {
    focus: {
      paths: [
        { path: "solana", kind: "ecosystem", entry: "Solana Non-Existent Entry" }
      ]
    },
    proposals: []
  };
  let res = lintBacklogData(dataBadEntry, { proposalDocContent: realDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes('không tồn tại trong mục "ecosystem" của learn-proposal.md')),
    "Entry sai phải báo lỗi: " + res.problems.join("; ")
  );

  // 2. Map đã dựng có kind/entry lệch với focus -> lỗi
  const dataMismatchedMap = {
    focus: {
      paths: [
        // solana fixture thật có kind: "ecosystem", entry: "Solana"
        // Ở đây khai báo kind: "role", entry: "Web3 Security Auditor" (thuộc role)
        { path: "solana", kind: "role", entry: "Web3 Security Auditor" }
      ]
    },
    proposals: []
  };
  res = lintBacklogData(dataMismatchedMap, { proposalDocContent: realDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("không khớp với focus")),
    "Map đã dựng lệch kind/entry phải báo lỗi: " + res.problems.join("; ")
  );

  // 3. Đúng chuẩn ánh xạ 10 entries -> PASS
  const dataValid10 = {
    focus: {
      paths: [
        { path: "solana", kind: "ecosystem", entry: "Solana" },
        { path: "ethereum", kind: "ecosystem", entry: "Ethereum" },
        { path: "web3-security", kind: "role", entry: "Web3 Security Auditor" },
        { path: "react", kind: "skill", entry: "React" },
        { path: "nextjs", kind: "skill", entry: "Next.js" },
        { path: "backend", kind: "role", entry: "Backend" },
        { path: "full-stack", kind: "role", entry: "Full Stack" },
        { path: "devops", kind: "role", entry: "DevOps" },
        { path: "ai-engineer", kind: "role", entry: "AI Engineer" },
        { path: "vibe-coding", kind: "skill", entry: "Vibe Coding" }
      ]
    },
    proposals: []
  };
  res = lintBacklogData(dataValid10, { proposalDocContent: realDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "10 focus entries chuẩn phải pass: " + res.problems.join("; "));

  // 4. Focus dạng chuỗi cũ (string slug) -> vẫn đọc được bình thường (backward compatible)
  const dataLegacyString = {
    focus: {
      paths: ["solana", "ethereum", "react"]
    },
    proposals: []
  };
  res = lintBacklogData(dataLegacyString, { proposalDocContent: realDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Dạng chuỗi cũ phải đọc được: " + res.problems.join("; "));
});

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
        required_tools: ["solana"],
        coverage: "empty"
      },
      {
        id: "anchor-programs",
        title: "Anchor Programs",
        layer: "core",
        branch: null,
        requires: ["accounts-model"],
        ref: null,
        required_tools: ["anchor", "cargo"],
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

test("backlog-lint: khi có focus, bỏ ràng buộc >=3 entry và tối đa 4 đề xuất open", () => {
  const data = getBaseValidBacklog();
  data.focus = { path: "solana" };

  // Đổi cả 4 đề xuất cùng trỏ vào 1 entry "Solana"
  for (let i = 0; i < 4; i++) {
    data.proposals[i].path_node = { path: "solana", node: `n-${i}` };
    data.proposals[i].direction = { axis: "ecosystem", entry: "Solana" };
  }

  // 4 đề xuất cùng entry -> phải PASS vì khi có focus không đòi >= 3 entry
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, true, "Khi có focus, cùng 1 entry vẫn pass: " + res.problems.join("; "));

  // Thêm đề xuất thứ 5 trong focus -> vượt quá tối đa 4 đề xuất open
  data.proposals.push({
    ...data.proposals[0],
    slug: "solana-fifth",
    path_node: { path: "solana", node: "n-5" },
    status: "open",
    decided_on: null,
    reject_reason: null
  });
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("tối đa 4 đề xuất")));
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
  coveredSolanaFixture.nodes[0].covered_lessons = ["Giới thiệu"];

  const mapsWithCovered = new Map([
    ["solana", coveredSolanaFixture],
    ["backend-engineer", backendMapFixture]
  ]);

  const data1 = getBaseValidBacklog();
  data1.focus = { path: "solana" };
  data1.proposals[0].path_node = { path: "solana", node: "accounts-model" };
  data1.proposals[0].tools = ["solana"];
  const res1 = lintBacklogData(data1, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug: mapsWithCovered });
  assert.strictEqual(res1.ok, false);
  assert.ok(
    res1.problems.some((p) => p.includes('đã có coverage: "covered", không thể đề xuất thêm khóa mới')),
    "Phải báo lỗi ô accounts-model đã covered: " + res1.problems.join("; ")
  );

  // 2. open trỏ token-program khi anchor-programs chưa covered và chưa chosen -> lỗi readiness
  const data2 = getBaseValidBacklog();
  data2.focus = { path: "solana" };
  data2.proposals[0].path_node = { path: "solana", node: "token-program" };
  data2.proposals[0].tools = ["spl-token", "anchor"];
  const res2 = lintBacklogData(data2, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res2.ok, false);
  assert.ok(
    res2.problems.some((p) => p.includes('ô "token-program" chưa sẵn sàng vì các ô tiên quyết chưa hoàn thành (anchor-programs)')),
    "Phải báo lỗi readiness cho token-program: " + res2.problems.join("; ")
  );

  // 3. Thêm chosen cho anchor-programs -> token-program pass readiness
  const data3 = getBaseValidBacklog();
  data3.focus = { path: "solana" };
  data3.proposals[0].path_node = { path: "solana", node: "token-program" };
  data3.proposals[0].tools = ["spl-token", "anchor"];
  data3.proposals.push({
    ...data3.proposals[1],
    slug: "anchor-program-builder",
    status: "chosen",
    decided_on: "2026-11-15",
    path_node: { path: "solana", node: "anchor-programs" },
    tools: ["anchor", "cargo"],
    final_product: "Smart contract program Anchor và test suite tự động"
  });
  const res3 = lintBacklogData(data3, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.ok(
    !res3.problems.some((p) => p.includes("token-program") && p.includes("node-readiness")),
    "token-program phải vượt qua kiểm tra readiness khi anchor-programs đã có chosen: " + res3.problems.join("; ")
  );

  // 4. open trỏ ô có ref trong backend-engineer.json -> lỗi
  const data4 = getBaseValidBacklog();
  data4.focus = { path: "backend-engineer" };
  data4.proposals[0].path_node = { path: "backend-engineer", node: "backend-caching" };
  data4.proposals[0].tools = ["redis-cli"];
  const res4 = lintBacklogData(data4, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res4.ok, false);
  assert.ok(
    res4.problems.some((p) => p.includes('có ref "redis#caching", không thể tạo khóa trực tiếp')),
    "Phải báo lỗi ô có ref: " + res4.problems.join("; ")
  );

  // 5. produced trỏ ô covered -> pass không lỗi
  const data5 = getBaseValidBacklog();
  data5.focus = { path: "solana" };
  data5.proposals[0].status = "produced";
  data5.proposals[0].decided_on = "2026-11-15";
  data5.proposals[0].path_node = { path: "solana", node: "metaplex-nfts" };
  data5.proposals[0].tools = ["node", "anchor"];
  const res5 = lintBacklogData(data5, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.ok(
    !res5.problems.some((p) => p.includes("node-coverage") || p.includes("node-readiness") || p.includes("node-ref")),
    "Đề xuất produced trỏ ô covered phải pass không có lỗi node: " + res5.problems.join("; ")
  );
});

test("backlog-lint: AC-03 - kiểm tra required_tools của ô", () => {
  const mapsBySlug = new Map();
  mapsBySlug.set("solana", getMockSolanaMap());

  const data = getBaseValidBacklog();
  data.focus = { path: "solana" };
  data.proposals[0].path_node = { path: "solana", node: "accounts-model" };

  // Ô accounts-model yêu cầu ["solana"], nhưng proposals[0].tools chỉ có ["node"]
  data.proposals[0].tools = ["node"];
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("tools thiếu required_tools của ô \"accounts-model\" (solana)")),
    "Phải báo lỗi thiếu solana: " + res.problems.join("; ")
  );

  // Bổ sung solana -> pass
  data.proposals[0].tools = ["node", "solana"];
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Có đủ required_tools phải pass: " + res.problems.join("; "));
});

test("backlog-lint: AC-03 - ô ecosystem ở layer core bắt buộc final_product có code on-chain và test", () => {
  const mapsBySlug = new Map();
  const mockMap = getMockSolanaMap();
  mockMap.nodes[0].coverage = "covered"; // accounts-model covered để anchor-programs thỏa mãn readiness
  mapsBySlug.set("solana", mockMap);

  const data = getBaseValidBacklog();
  data.focus = { path: "solana" };
  data.proposals[0].path_node = { path: "solana", node: "anchor-programs" };
  data.proposals[0].tools = ["anchor", "cargo"];

  // final_product chỉ ghi tài liệu, không có code on-chain hay test
  data.proposals[0].final_product = "Slide thuyết trình và tài liệu PDF giới thiệu về Anchor";
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false);
  assert.ok(
    res.problems.some((p) => p.includes("bắt buộc final_product phải có code on-chain (program/contract) và test chạy được")),
    "Phải báo lỗi thiếu code on-chain và test: " + res.problems.join("; ")
  );

  // final_product hợp lệ có contract/program và test
  data.proposals[0].final_product = "Kho lưu trữ GitHub chứa smart contract program Anchor và bộ kiểm thử tự động test";
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Final product có code on-chain và test phải pass: " + res.problems.join("; "));
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

  // Node 0 (accounts-model): coverage: "partial", course_slug: "c-complete" (có trong mockCatalog với content_state: "complete")
  mockMap.nodes[0].coverage = "partial";
  mockMap.nodes[0].course_slug = "c-complete";
  mapsBySlug.set("solana", mockMap);

  const data = getBaseValidBacklog();
  data.focus = { path: "solana" };

  // Đề xuất cho anchor-programs (requires accounts-model)
  data.proposals[0].path_node = { path: "solana", node: "anchor-programs" };
  data.proposals[0].final_product = "Program on-chain bằng Anchor và test tự động";
  data.proposals[0].tools = ["anchor", "cargo"];

  // Case 1: Tiên quyết partial qua catalog -> VẪN BỊ BÁO LỖI node-readiness (V-05)
  let res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, false, "Tiên quyết partial qua catalog không được thỏa mãn");
  assert.ok(
    res.problems.some((p) => p.includes('chưa sẵn sàng vì các ô tiên quyết chưa hoàn thành (accounts-model)')),
    "Phải bắt lỗi node-readiness: " + res.problems.join("; ")
  );

  // Case 2: Đặt accounts-model thành covered trong map -> PASS
  mockMap.nodes[0].coverage = "covered";
  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Tiên quyết covered phải pass: " + res.problems.join("; "));

  // Case 3: accounts-model quay lại partial, nhưng có 1 đề xuất chosen cho accounts-model trong backlog -> PASS
  mockMap.nodes[0].coverage = "partial";
  data.proposals.push({
    slug: "solana-accounts-intro",
    title: "Khóa học nền tảng Accounts",
    path_node: { path: "solana", node: "accounts-model" },
    direction: { axis: "ecosystem", entry: "Solana" },
    level: "beginner",
    kind: "new",
    promise: "Thực hiện tạo account trên Solana",
    starting_point: { knowledge: "Cơ bản", requires: [] },
    final_product: "Script CLI tạo account",
    tools: ["solana"],
    alternatives: [
      { name: "A1", url: "https://example.com/1" },
      { name: "A2", url: "https://example.com/2" }
    ],
    why_now: { kind: "direct", urls: ["https://example.com"], quote: "Accounts are fundamental to Solana architecture." },
    criteria: {
      continues_catalog: { met: false, basis: "Nền", refs: [] },
      fills_direction: { met: true, basis: "Đạt", refs: ["r1"] },
      timely: { met: true, basis: "Đạt", refs: ["r2"] },
      differentiated: { met: true, basis: "Đạt", refs: ["r3"] },
      showable_product: { met: true, basis: "Đạt", refs: ["r4"] }
    },
    status: "chosen",
    added_on: "2026-11-15",
    decided_on: "2026-11-15",
    reject_reason: null
  });

  res = lintBacklogData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc, mapsBySlug });
  assert.strictEqual(res.ok, true, "Có đề xuất chosen cho tiên quyết phải pass: " + res.problems.join("; "));
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

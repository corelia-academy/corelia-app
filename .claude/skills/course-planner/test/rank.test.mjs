// .claude/skills/course-planner/test/rank.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { rankShortlist, formatShortlistTable } from "../scripts/rank.mjs";

const mockCatalog = [
  { slug: "prereq-ready", title: "Khóa tiên quyết hoàn tất", content_state: "complete" },
  { slug: "prereq-empty", title: "Khóa tiên quyết rỗng", content_state: "empty" },
  { slug: "c-partial", title: "Khóa partial", content_state: "partial" }
];

test("rank: AC3 - xếp hạng đúng 4 bậc, ghi đè continues_catalog, tất định qua 2 lần chạy", () => {
  const shortlistData = {
    date: "2026-11-13",
    shortlist: [
      // 1. Đủ điều kiện, 4 tiêu chí đạt, 2 direct urls, slug: "course-b"
      {
        slug: "course-b",
        title: "Khóa B",
        direction: { axis: "role", entry: "Smart Contract Developer" },
        level: "intermediate",
        kind: "new",
        promise: "Vá lỗi smart contract",
        starting_point: { knowledge: "Cơ bản", requires: [] },
        final_product: "Báo cáo audit",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com", "https://d2.com"] },
        criteria: {
          continues_catalog: { met: true, basis: "Role khai bừa nhưng không requires", refs: [] }, // sẽ bị ghi đè thành false vì requires rỗng
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      },
      // 2. Đủ điều kiện, 4 tiêu chí đạt, 2 direct urls, slug: "course-a" (hòa course-b về tiêu chí và direct urls, thắng slug a < b)
      {
        slug: "course-a",
        title: "Khóa A",
        direction: { axis: "role", entry: "Solana Developer" },
        level: "beginner",
        kind: "new",
        promise: "Viết chương trình Anchor",
        starting_point: { knowledge: "Rust", requires: [] },
        final_product: "Mã nguồn Anchor",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com", "https://d2.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      },
      // 3. Đủ điều kiện, 4 tiêu chí đạt, 1 direct url (thua a và b về direct url)
      {
        slug: "course-c",
        title: "Khóa C",
        direction: { axis: "ecosystem", entry: "Arbitrum" },
        level: "intermediate",
        kind: "new",
        promise: "Deploy Arbitrum",
        starting_point: { knowledge: "Solidity", requires: [] },
        final_product: "Contract deploy",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      },
      // 4. Đủ điều kiện, 5 tiêu chí đạt (thắng cả a, b, c vì nhiều tiêu chí đạt hơn)
      {
        slug: "course-top",
        title: "Khóa Top",
        direction: { axis: "skill", entry: "React" },
        level: "intermediate",
        kind: "new",
        promise: "Xây dựng DApp Web3",
        starting_point: { knowledge: "Cần khóa nền", requires: ["prereq-ready"] },
        final_product: "DApp",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Role khai sai", refs: [] }, // sẽ được script tự tính thành true vì prereq-ready complete!
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      },
      // 5. Không đủ điều kiện: bị chặn bởi khóa tiên quyết rỗng
      {
        slug: "course-blocked",
        title: "Khóa Bị Chặn",
        direction: { axis: "skill", entry: "TypeScript" },
        level: "advanced",
        kind: "new",
        promise: "TypeScript nâng cao",
        starting_point: { knowledge: "Cần khóa rỗng", requires: ["prereq-empty"] },
        final_product: "Framework",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Chưa đạt", refs: [] },
          fills_direction: { met: true, basis: "Đạt", refs: ["ref1"] },
          timely: { met: true, basis: "Đạt", refs: ["ref2"] },
          differentiated: { met: true, basis: "Đạt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Đạt", refs: ["ref4"] }
        }
      }
    ]
  };

  const res1 = rankShortlist(shortlistData, mockCatalog);
  const res2 = rankShortlist(shortlistData, mockCatalog);

  // Tất định qua 2 lần chạy
  assert.deepStrictEqual(res1, res2);
  assert.strictEqual(JSON.stringify(res1), JSON.stringify(res2));

  // Thứ tự mong đợi:
  // Rank 1: course-top (5 tiêu chí đạt, continues_catalog được tự động ghi đè thành true)
  // Rank 2: course-a (4 tiêu chí đạt, 2 direct urls, slug 'a' < 'b')
  // Rank 3: course-b (4 tiêu chí đạt, 2 direct urls, slug 'b' > 'a')
  // Rank 4: course-c (4 tiêu chí đạt, 1 direct url)
  // Rank —: course-blocked (bị chặn bởi prereq-empty)

  assert.strictEqual(res1.rows[0].slug, "course-top");
  assert.strictEqual(res1.rows[0].rank, 1);
  assert.strictEqual(res1.rows[0].criteria.continues_catalog.met, true, "continues_catalog phải được tự tính thành true khi requires đạt");

  assert.strictEqual(res1.rows[1].slug, "course-a");
  assert.strictEqual(res1.rows[1].rank, 2);

  assert.strictEqual(res1.rows[2].slug, "course-b");
  assert.strictEqual(res1.rows[2].rank, 3);
  assert.strictEqual(res1.rows[2].criteria.continues_catalog.met, false, "continues_catalog bị ghi đè thành false khi requires rỗng");

  assert.strictEqual(res1.rows[3].slug, "course-c");
  assert.strictEqual(res1.rows[3].rank, 4);

  assert.strictEqual(res1.rows[4].slug, "course-blocked");
  assert.strictEqual(res1.rows[4].rank, null);
  assert.strictEqual(res1.rows[4].eligible, false);
  assert.ok(res1.rows[4].unmetRequires.some((ur) => ur.includes("prereq-empty")), "Ghi nhận khóa chặn prereq-empty");
});

test("rank: AC4 - rank.mjs --table in đúng 5 cột, mọi tiêu chí đạt ở Cơ sở, không đạt ở Ghi chú, an toàn với ký tự | và xuống dòng", () => {
  const shortlistData = {
    shortlist: [
      {
        slug: "course-multiline",
        title: "Khóa Có Ký Tự Đặc Biệt | Pipe",
        direction: { axis: "role", entry: "Smart Contract Developer" },
        level: "intermediate",
        kind: "complete_existing",
        promise: "Dòng 1 promise\nDòng 2 promise | có pipe",
        starting_point: { knowledge: "Cơ bản", requires: [] },
        final_product: "Sản phẩm",
        feasibility: "feasible_with_limits",
        feasibility_basis: "Cần máy tính mạnh | 16GB RAM\nYêu cầu GPU",
        why_now: { kind: "direct", urls: ["https://ex.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Lấp hướng | hoàn toàn", refs: ["catalog.json"] },
          timely: { met: true, basis: "Cấp thiết trong năm", refs: ["https://news.com"] },
          differentiated: { met: false, basis: "Chưa có điểm khác biệt rõ ràng", refs: [] },
          showable_product: { met: true, basis: "Nộp dự án", refs: ["repo"] }
        },
        risks: ["Rủi ro về mạng | RPC lỗi\nTimeout"],
        missing_evidence: []
      }
    ]
  };

  const ranked = rankShortlist(shortlistData, mockCatalog);
  const table = formatShortlistTable(ranked);

  // 1. Kiểm tra 5 cột
  const lines = table.trim().split("\n");
  assert.ok(lines.length >= 3);
  assert.strictEqual(lines[0], "| Rank | Khóa đề xuất | Hướng | Cơ sở đề xuất | Ghi chú |");
  assert.strictEqual(lines[1], "| --- | --- | --- | --- | --- |");

  // Dòng dữ liệu không được có ký tự xuống dòng thô làm tăng số dòng markdown table
  assert.strictEqual(lines.length, 3, "Bảng markdown chỉ có đúng 3 dòng (header, separator, 1 data row); xuống dòng phải chuyển thành <br>");

  // Từng cột phân tách bằng |
  const cells = lines[2].split(" | ");
  assert.strictEqual(cells.length, 5);

  const basisCell = cells[3];
  const notesCell = cells[4];

  // Tiêu chí đạt nằm ở Cơ sở đề xuất
  assert.ok(basisCell.includes("fills_direction"));
  assert.ok(basisCell.includes("timely"));
  assert.ok(basisCell.includes("showable_product"));

  // Tiêu chí không đạt nằm ở Ghi chú
  assert.ok(notesCell.includes("continues_catalog"));
  assert.ok(notesCell.includes("differentiated"));

  // Feasible with limits và risks nằm ở Ghi chú
  assert.ok(notesCell.includes("Khả thi có giới hạn"));
  assert.ok(notesCell.includes("Rủi ro"));

  // Ký tự | được escape thành \|
  assert.ok(lines[2].includes("\\|"), "Ký tự | trong nội dung ô phải được escape thành \\|");
});

test("rank: W5 - đề xuất thiếu công cụ thành Rank — và các dòng khác dồn hạng; thiếu yt-dlp sinh đúng một cảnh báo", () => {
  const shortlistData = {
    date: "2026-11-14",
    shortlist: [
      {
        slug: "course-1",
        title: "Khóa 1",
        direction: { axis: "role", entry: "Smart Contract Developer" },
        level: "intermediate",
        kind: "new",
        promise: "Vá lỗi smart contract",
        starting_point: { knowledge: "Cơ bản", requires: [] },
        final_product: "Báo cáo audit",
        feasibility: "feasible",
        tools: ["forge", "slither"],
        why_now: { kind: "direct", urls: ["https://d1.com", "https://d2.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      },
      {
        slug: "course-2",
        title: "Khóa 2",
        direction: { axis: "skill", entry: "React" },
        level: "intermediate",
        kind: "new",
        promise: "Xây dựng DApp Web3",
        starting_point: { knowledge: "Cơ bản", requires: [] },
        final_product: "DApp",
        feasibility: "feasible",
        tools: ["node"],
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      },
      {
        slug: "course-3",
        title: "Khóa 3",
        direction: { axis: "role", entry: "Solana Developer" },
        level: "beginner",
        kind: "new",
        promise: "Viết Solana",
        starting_point: { knowledge: "Cơ bản", requires: [] },
        final_product: "Solana Program",
        feasibility: "feasible",
        tools: ["anchor"],
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        }
      }
    ]
  };

  // Mock tool checker 1: Đủ tất cả công cụ (kể cả công cụ nền deno, yt-dlp, docker)
  const fullToolChecker = () => true;
  const resFull = rankShortlist(shortlistData, mockCatalog, { toolChecker: fullToolChecker });
  // Cả 3 khóa đều eligible, rank 1, 2, 3
  assert.strictEqual(resFull.rows.find((r) => r.slug === "course-1").rank, 1);
  assert.strictEqual(resFull.rows.find((r) => r.slug === "course-2").rank, 2);
  assert.strictEqual(resFull.rows.find((r) => r.slug === "course-3").rank, 3);
  assert.strictEqual(resFull.envWarnings.length, 0);

  const tableFull = formatShortlistTable(resFull);
  assert.doesNotMatch(tableFull, /⚠️ Cảnh báo:/);

  // Mock tool checker 2: Khóa 1 thiếu forge/slither; công cụ nền thiếu đúng yt-dlp (có deno và docker)
  const mockToolChecker = (tool) => {
    if (tool === "forge" || tool === "slither") return false;
    if (tool === "yt-dlp") return false;
    return true; // node, anchor, deno, docker: ok
  };

  const resMissing = rankShortlist(shortlistData, mockCatalog, { toolChecker: mockToolChecker });

  // Khóa 1 thiếu công cụ -> Rank null (hiển thị —), eligible: false
  const r1 = resMissing.rows.find((r) => r.slug === "course-1");
  assert.strictEqual(r1.eligible, false);
  assert.strictEqual(r1.rank, null);
  assert.deepStrictEqual(r1.missingTools, ["forge", "slither"]);

  // Các khóa còn lại dồn hạng: Khóa 2 thành Rank 1, Khóa 3 thành Rank 2
  const r2 = resMissing.rows.find((r) => r.slug === "course-2");
  const r3 = resMissing.rows.find((r) => r.slug === "course-3");
  assert.strictEqual(r2.eligible, true);
  assert.strictEqual(r2.rank, 1);
  assert.strictEqual(r3.eligible, true);
  assert.strictEqual(r3.rank, 2);

  // Công cụ nền thiếu yt-dlp: sinh đúng 1 cảnh báo
  assert.strictEqual(resMissing.envWarnings.length, 1);
  assert.ok(resMissing.envWarnings[0].includes("yt-dlp") && resMissing.envWarnings[0].includes("bài video"));

  // Format bảng
  const tableMissing = formatShortlistTable(resMissing);
  assert.ok(tableMissing.includes("| — |"));
  assert.ok(tableMissing.includes("Thiếu công cụ: forge, slither"));
  assert.ok(tableMissing.includes("⚠️ Cảnh báo: Thiếu công cụ nền yt-dlp: khóa sẽ không có bài video."));
  assert.doesNotMatch(tableMissing, /luồng sẽ dừng trước bước nhập/);
});

test("rank: AC-03 & AC-04 - chỉ xếp hạng đề xuất open từ backlog, không có round, dòng không nhắc tới giữ open", () => {
  const backlogData = {
    focus: [],
    proposals: [
      {
        slug: "course-open-1",
        title: "Khóa Open 1",
        direction: { axis: "role", entry: "Smart Contract Developer" },
        level: "intermediate",
        kind: "new",
        promise: "Vá lỗi smart contract",
        starting_point: { knowledge: "Cơ bản", requires: [] },
        final_product: "Báo cáo audit",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        },
        status: "open",
        added_on: "2026-11-15",
        decided_on: null,
        reject_reason: null
      },
      {
        slug: "course-chosen",
        title: "Khóa Chosen",
        direction: { axis: "skill", entry: "AI Agents" },
        level: "intermediate",
        kind: "new",
        promise: "Xây dựng MCP Server",
        starting_point: { knowledge: "TS", requires: [] },
        final_product: "Repo MCP Server",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        },
        status: "chosen",
        added_on: "2026-11-15",
        decided_on: "2026-11-15",
        reject_reason: null
      },
      {
        slug: "course-rejected",
        title: "Khóa Bị Loại",
        direction: { axis: "role", entry: "Frontend" },
        level: "beginner",
        kind: "new",
        promise: "Lập trình web cơ bản",
        starting_point: { knowledge: "HTML", requires: [] },
        final_product: "Web",
        feasibility: "feasible",
        why_now: { kind: "direct", urls: ["https://d1.com"] },
        criteria: {
          continues_catalog: { met: false, basis: "Người mới", refs: [] },
          fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
          timely: { met: true, basis: "2026", refs: ["ref2"] },
          differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
          showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
        },
        status: "rejected",
        added_on: "2026-11-14",
        decided_on: "2026-11-14",
        reject_reason: "Không phù hợp định hướng"
      }
    ]
  };

  const ranked = rankShortlist(backlogData, mockCatalog);
  assert.strictEqual(ranked.round, undefined, "Kết quả xếp hạng không còn trường round");
  assert.strictEqual(ranked.total, 1, "Chỉ xếp hạng đúng 1 đề xuất open, bỏ qua chosen và rejected");
  assert.strictEqual(ranked.rows[0].slug, "course-open-1");

  const table = formatShortlistTable(ranked);
  assert.strictEqual(table.includes("Khóa Chosen"), false, "Bảng không được chứa khóa chosen");
  assert.strictEqual(table.includes("Khóa Bị Loại"), false, "Bảng không được chứa khóa rejected");
  assert.ok(table.includes("Khóa Open 1"), "Bảng phải chứa khóa open");

  // AC-04: Dòng không nhắc tới giữ open (dòng course-open-1 không bị loại hàng loạt)
  assert.strictEqual(backlogData.proposals[0].status, "open");
});

test("rank: AC-05 - xử lý focus map: báo cần dựng map khi chưa có, xếp theo layer/depth và ẩn đề xuất ngoài focus", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rank-focus-test-"));
  try {
    const pathsDir = path.join(tmpDir, ".course-plan", "paths");
    fs.mkdirSync(pathsDir, { recursive: true });

    // 1. Chưa có map solana -> báo cần dựng map, không crash
    const backlogNoMap = {
      focus: { path: "solana" },
      proposals: [
        {
          slug: "c1",
          title: "Khóa 1",
          status: "open",
          path_node: { path: "solana", node: "n1" }
        }
      ]
    };
    const resNoMap = rankShortlist(backlogNoMap, mockCatalog, { pathsDir, repoRoot: tmpDir });
    assert.strictEqual(resNoMap.needs_map, true);
    assert.strictEqual(resNoMap.focus_map, "solana");
    const tableNoMap = formatShortlistTable(resNoMap);
    assert.ok(tableNoMap.includes('Cần dựng map "solana" trước khi xếp hạng đề xuất'));

    // 2. Tạo map solana trong pathsDir
    const solanaMap = {
      slug: "solana",
      kind: "ecosystem",
      entry: "Solana",
      title: "Lộ trình Solana",
      nodes: [
        { id: "accounts", title: "Accounts", layer: "foundation", requires: [], coverage: "empty" },
        { id: "rust", title: "Rust", layer: "language", requires: ["accounts"], coverage: "empty" },
        { id: "anchor", title: "Anchor", layer: "core", requires: ["rust"], coverage: "empty" },
        { id: "token", title: "Token", layer: "branch", branch: "token", requires: ["anchor"], coverage: "empty" }
      ]
    };
    fs.writeFileSync(path.join(pathsDir, "solana.json"), JSON.stringify(solanaMap, null, 2));

    // Backlog có 3 đề xuất thuộc solana (ở các layer khác nhau) và 1 đề xuất ngoài focus (thuộc redis)
    const baseProp = {
      level: "beginner",
      kind: "new",
      promise: "Học và thực hành đầy đủ nội dung bài tập",
      starting_point: { knowledge: "Cơ bản", requires: [] },
      final_product: "Kho GitHub mã nguồn và test kiểm thử",
      feasibility: "feasible",
      why_now: { kind: "direct", urls: ["https://d1.com"] },
      criteria: {
        continues_catalog: { met: false, basis: "Người mới", refs: [] },
        fills_direction: { met: true, basis: "Chưa có", refs: ["ref1"] },
        timely: { met: true, basis: "2026", refs: ["ref2"] },
        differentiated: { met: true, basis: "Khác biệt", refs: ["ref3"] },
        showable_product: { met: true, basis: "Nộp bài", refs: ["ref4"] }
      },
      status: "open",
      added_on: "2026-11-15",
      decided_on: null,
      reject_reason: null
    };

    const backlogWithMap = {
      focus: { path: "solana" },
      proposals: [
        // Proposal ở layer branch
        {
          ...baseProp,
          slug: "c-token",
          title: "Khóa Token SPL",
          direction: { axis: "ecosystem", entry: "Solana" },
          path_node: { path: "solana", node: "token" }
        },
        // Proposal ở layer foundation (phải đứng trước layer branch!)
        {
          ...baseProp,
          slug: "c-accounts",
          title: "Khóa Accounts Model",
          direction: { axis: "ecosystem", entry: "Solana" },
          path_node: { path: "solana", node: "accounts" }
        },
        // Proposal ở layer core
        {
          ...baseProp,
          slug: "c-anchor",
          title: "Khóa Anchor Framework",
          direction: { axis: "ecosystem", entry: "Solana" },
          path_node: { path: "solana", node: "anchor" }
        },
        // Proposal ngoài focus (thuộc redis) -> PHẢI BỊ ẨN KHỎI BẢNG XẾP HẠNG
        {
          ...baseProp,
          slug: "c-redis-outside",
          title: "Khóa Redis Ngoài Focus",
          direction: { axis: "skill", entry: "Redis" },
          path_node: { path: "redis", node: "caching" }
        }
      ]
    };

    const ranked = rankShortlist(backlogWithMap, mockCatalog, { pathsDir, repoRoot: tmpDir });
    // Chỉ có 3 đề xuất thuộc solana được đưa vào bảng xếp hạng
    assert.strictEqual(ranked.total, 3, "Chỉ hiển thị 3 đề xuất thuộc map solana; đề xuất redis ngoài focus bị ẩn");
    assert.strictEqual(ranked.hasMap, true);

    // Thứ tự sắp xếp theo layer: foundation -> core -> branch
    assert.strictEqual(ranked.rows[0].slug, "c-accounts", "Layer foundation phải đứng đầu (Rank 1)");
    assert.strictEqual(ranked.rows[1].slug, "c-anchor", "Layer core phải đứng thứ 2 (Rank 2)");
    assert.strictEqual(ranked.rows[2].slug, "c-token", "Layer branch phải đứng thứ 3 (Rank 3)");

    const table = formatShortlistTable(ranked);
    // Bảng có cột Layer / Nhánh
    assert.ok(table.includes("Layer / Nhánh"), "Bảng phải có cột Layer / Nhánh");
    assert.ok(table.includes("branch (token)"), "Bảng hiển thị đúng nhánh của layer branch");
    assert.strictEqual(table.includes("Khóa Redis Ngoài Focus"), false, "Không hiển thị đề xuất ngoài focus");

    // Đề xuất ngoài focus trong backlog vẫn giữ status open
    assert.strictEqual(backlogWithMap.proposals[3].status, "open", "Đề xuất ngoài focus vẫn giữ status open trong backlog");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("rank: AC-03 - Tổng quan map có đủ mọi ô, đúng thứ tự layer/requires, đúng trạng thái với fixture solana.json và backend-engineer.json", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rank-overview-test-"));
  const pathsDir = path.join(tmpDir, ".course-plan", "paths");
  fs.mkdirSync(pathsDir, { recursive: true });

  try {
    // Copy 2 fixture map vào pathsDir
    const fixturesDir = path.resolve(".claude/skills/course-planner/test/fixtures/paths");
    fs.copyFileSync(path.join(fixturesDir, "solana.json"), path.join(pathsDir, "solana.json"));
    fs.copyFileSync(path.join(fixturesDir, "backend-engineer.json"), path.join(pathsDir, "backend-engineer.json"));

    // 1. Kiểm tra với solana.json fixture (5 nodes)
    const backlogSolana = {
      focus: { path: "solana" },
      proposals: []
    };
    const rankedSolana = rankShortlist(backlogSolana, [], { pathsDir, repoRoot: tmpDir });
    assert.strictEqual(rankedSolana.hasMap, true);
    assert.ok(Array.isArray(rankedSolana.mapOverview));
    assert.strictEqual(rankedSolana.mapOverview.length, 5, "Bảng tổng quan solana phải có đủ 5 ô");

    // Kiểm tra thứ tự và trạng thái của từng ô trong solana.json
    // accounts-model (foundation, depth 0) -> sẵn sàng
    assert.strictEqual(rankedSolana.mapOverview[0].id, "accounts-model");
    assert.strictEqual(rankedSolana.mapOverview[0].layer, "foundation");
    assert.strictEqual(rankedSolana.mapOverview[0].status, "sẵn sàng");

    // rust-basics (language, depth 1) -> chờ accounts-model
    assert.strictEqual(rankedSolana.mapOverview[1].id, "rust-basics");
    assert.strictEqual(rankedSolana.mapOverview[1].layer, "language");
    assert.strictEqual(rankedSolana.mapOverview[1].status, "chờ accounts-model");

    // anchor-programs (core, depth 2) -> chờ rust-basics
    assert.strictEqual(rankedSolana.mapOverview[2].id, "anchor-programs");
    assert.strictEqual(rankedSolana.mapOverview[2].layer, "core");
    assert.strictEqual(rankedSolana.mapOverview[2].status, "chờ rust-basics");

    // token-program (branch token, depth 3) -> chờ anchor-programs
    assert.strictEqual(rankedSolana.mapOverview[3].id, "token-program");
    assert.strictEqual(rankedSolana.mapOverview[3].layerBranch, "branch (token)");
    assert.strictEqual(rankedSolana.mapOverview[3].status, "chờ anchor-programs");

    // metaplex-nfts (branch nft, depth 3, coverage covered) -> đã phủ
    assert.strictEqual(rankedSolana.mapOverview[4].id, "metaplex-nfts");
    assert.strictEqual(rankedSolana.mapOverview[4].layerBranch, "branch (nft)");
    assert.strictEqual(rankedSolana.mapOverview[4].status, "đã phủ");

    const tableSolana = formatShortlistTable(rankedSolana);
    assert.ok(tableSolana.includes("### Tổng quan map"));
    assert.ok(tableSolana.includes("| Layer / Nhánh | Ô (title) | Coverage | Khóa hiện có | Trạng thái |"));
    assert.ok(tableSolana.includes("Mô hình Account và State trên Solana"));
    assert.ok(tableSolana.includes("sẵn sàng"));
    assert.ok(tableSolana.includes("chờ accounts-model"));
    assert.ok(tableSolana.includes("đã phủ"));

    // 2. Kiểm tra với backend-engineer.json fixture (4 nodes, kind role)
    const backlogBackend = {
      focus: { path: "backend-engineer" },
      proposals: []
    };
    const rankedBackend = rankShortlist(backlogBackend, [], { pathsDir, repoRoot: tmpDir });
    assert.strictEqual(rankedBackend.hasMap, true);
    assert.strictEqual(rankedBackend.mapOverview.length, 4, "Bảng tổng quan backend-engineer phải có đủ 4 ô");

    // backend-foundations (foundation) -> sẵn sàng
    assert.strictEqual(rankedBackend.mapOverview[0].id, "backend-foundations");
    assert.strictEqual(rankedBackend.mapOverview[0].status, "sẵn sàng");

    // api-development (competency) -> chờ backend-foundations
    assert.strictEqual(rankedBackend.mapOverview[1].id, "api-development");
    assert.strictEqual(rankedBackend.mapOverview[1].status, "chờ backend-foundations");

    // backend-caching (competency, ref: redis#caching) -> ref
    assert.strictEqual(rankedBackend.mapOverview[2].id, "backend-caching");
    assert.strictEqual(rankedBackend.mapOverview[2].status, "ref");

    // system-observability (production) -> chờ api-development
    assert.strictEqual(rankedBackend.mapOverview[3].id, "system-observability");
    assert.strictEqual(rankedBackend.mapOverview[3].status, "chờ api-development");

    const tableBackend = formatShortlistTable(rankedBackend);
    assert.ok(tableBackend.includes("### Tổng quan map"));
    assert.ok(tableBackend.includes("ref"));
    assert.ok(tableBackend.includes("chờ backend-foundations"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("rank: AC-03 & AC-05 - không focus thì không in tổng quan; bảng rank rỗng vẫn in tổng quan", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rank-nofocus-test-"));
  const pathsDir = path.join(tmpDir, ".course-plan", "paths");
  fs.mkdirSync(pathsDir, { recursive: true });

  try {
    const fixturesDir = path.resolve(".claude/skills/course-planner/test/fixtures/paths");
    fs.copyFileSync(path.join(fixturesDir, "solana.json"), path.join(pathsDir, "solana.json"));

    // Case 1: Không có focus -> KHÔNG in tổng quan map
    const backlogNoFocus = {
      focus: null,
      proposals: [
        {
          slug: "c-general",
          title: "Khóa học chung",
          direction: { axis: "skill", entry: "Rust" },
          level: "beginner",
          kind: "new",
          promise: "Lập trình Rust cơ bản",
          starting_point: { knowledge: "Cơ bản", requires: [] },
          final_product: "Chương trình Rust",
          feasibility: "feasible",
          why_now: { kind: "direct", urls: ["https://d1.com"] },
          criteria: {
            continues_catalog: { met: false, basis: "Mới", refs: [] },
            fills_direction: { met: true, basis: "Đạt", refs: ["r1"] },
            timely: { met: true, basis: "Đạt", refs: ["r2"] },
            differentiated: { met: true, basis: "Đạt", refs: ["r3"] },
            showable_product: { met: true, basis: "Đạt", refs: ["r4"] }
          },
          status: "open"
        }
      ]
    };
    const rankedNoFocus = rankShortlist(backlogNoFocus, [], { pathsDir, repoRoot: tmpDir });
    assert.strictEqual(rankedNoFocus.hasMap, false);
    assert.strictEqual(rankedNoFocus.mapOverview, null);
    const tableNoFocus = formatShortlistTable(rankedNoFocus);
    assert.strictEqual(tableNoFocus.includes("Tổng quan map"), false, "Không có focus thì không được in bảng tổng quan map");
    assert.strictEqual(tableNoFocus.includes("### Bảng xếp hạng đề xuất"), false, "Không có map thì in bảng rank trực tiếp không có tiêu đề h3");

    // Case 2: Focus có map nhưng bảng rank rỗng (không có đề xuất) -> VẪN in tổng quan map
    const backlogEmptyRank = {
      focus: { path: "solana" },
      proposals: [] // Bảng rank rỗng
    };
    const rankedEmptyRank = rankShortlist(backlogEmptyRank, [], { pathsDir, repoRoot: tmpDir });
    assert.strictEqual(rankedEmptyRank.hasMap, true);
    assert.strictEqual(rankedEmptyRank.total, 0, "Bảng rank có 0 đề xuất");
    assert.ok(rankedEmptyRank.mapOverview && rankedEmptyRank.mapOverview.length > 0);

    const tableEmptyRank = formatShortlistTable(rankedEmptyRank);
    assert.ok(tableEmptyRank.includes("### Tổng quan map"), "Bảng rank rỗng vẫn phải in bảng tổng quan map");
    assert.ok(tableEmptyRank.includes("Mô hình Account và State trên Solana"), "Vẫn có các ô của map trong bảng tổng quan");
    assert.ok(tableEmptyRank.includes("Bảng xếp hạng rỗng"), "Thông báo bảng rank rỗng");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

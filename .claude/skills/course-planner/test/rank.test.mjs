// .claude/skills/course-planner/test/rank.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { rankShortlist, formatShortlistTable } from "../scripts/rank.mjs";

const mockCatalog = [
  { slug: "prereq-ready", title: "Khóa tiên quyết hoàn tất", content_state: "complete" },
  { slug: "prereq-empty", title: "Khóa tiên quyết rỗng", content_state: "empty" },
  { slug: "c-partial", title: "Khóa partial", content_state: "partial" }
];

test("rank: AC3 - xếp hạng đúng 4 bậc, ghi đè continues_catalog, tất định qua 2 lần chạy", () => {
  const shortlistData = {
    date: "2026-11-13",
    round: 1,
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

test("rank: AC2 - rank.mjs với hàm kiểm công cụ giả: công cụ thiếu hiện trong Ghi chú; rank không đổi", () => {
  const shortlistData = {
    date: "2026-11-14",
    round: 1,
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
      }
    ]
  };

  // Mock tool checker: chỉ có node là có sẵn, forge và slither bị thiếu
  const mockToolChecker = (tool) => tool === "node";

  // Chạy xếp hạng không có checker
  const resWithoutChecker = rankShortlist(shortlistData, mockCatalog, { toolChecker: () => true });
  // Chạy xếp hạng có mock checker
  const resWithChecker = rankShortlist(shortlistData, mockCatalog, { toolChecker: mockToolChecker });

  // Khẳng định rank không đổi
  assert.strictEqual(resWithChecker.rows[0].slug, resWithoutChecker.rows[0].slug);
  assert.strictEqual(resWithChecker.rows[0].rank, 1);
  assert.strictEqual(resWithChecker.rows[1].slug, resWithoutChecker.rows[1].slug);
  assert.strictEqual(resWithChecker.rows[1].rank, 2);

  // Khóa 1 thiếu forge và slither
  assert.deepStrictEqual(resWithChecker.rows[0].missingTools, ["forge", "slither"]);
  // Khóa 2 không thiếu công cụ
  assert.deepStrictEqual(resWithChecker.rows[1].missingTools, []);

  // Format bảng: Ghi chú của Khóa 1 phải chứa "Thiếu công cụ: forge, slither"
  const table = formatShortlistTable(resWithChecker);
  const lines = table.split("\n");
  const row1 = lines[2];
  const row2 = lines[3];

  assert.ok(row1.includes("Thiếu công cụ: forge, slither"), `Ghi chú khóa 1 phải nêu công cụ thiếu, thực tế: ${row1}`);
  assert.ok(!row2.includes("Thiếu công cụ"), `Khóa 2 không thiếu công cụ, thực tế: ${row2}`);
});

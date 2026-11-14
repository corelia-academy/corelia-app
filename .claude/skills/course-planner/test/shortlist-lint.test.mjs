// .claude/skills/course-planner/test/shortlist-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lintShortlistData, extractProposalEntries } from "../scripts/plan-lint.mjs";

const fixtureDoc = fs.readFileSync(path.resolve(".claude/skills/course-planner/test/fixtures/learn-proposal.md"), "utf8");
const realDoc = fs.readFileSync(path.resolve("docs/learn/learn-proposal.md"), "utf8");

function getBaseValidShortlist() {
  const raw = fs.readFileSync(path.resolve(".claude/skills/course-planner/test/fixtures/shortlists/valid-shortlist.json"), "utf8");
  return JSON.parse(raw);
}

const mockCatalog = [
  { slug: "c-partial", title: "Khóa partial", content_state: "partial" },
  { slug: "c-complete", title: "Khóa complete", content_state: "complete" }
];

test("shortlist-lint: AC2 - chấp nhận một shortlist hợp lệ 4 đề xuất, 3 entry, có một complete_existing trỏ khóa partial", () => {
  const data = getBaseValidShortlist();
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, true, "Shortlist hợp lệ phải pass lint: " + res.problems.join("; "));
  assert.strictEqual(res.problems.length, 0);
});

test("shortlist-lint: P-07 - từ chối chuỗi con không phải là entry trọn mục ('Developer', 'e', 'Smart Contract')", () => {
  const substrings = [
    { axis: "role", entry: "Developer" },
    { axis: "role", entry: "e" },
    { axis: "role", entry: "Smart Contract" }
  ];

  for (const item of substrings) {
    const data = getBaseValidShortlist();
    data.shortlist[0].direction = item;
    const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
    assert.strictEqual(res.ok, false, `Entry chuỗi con "${item.entry}" phải bị từ chối`);
    assert.ok(
      res.problems.some((p) => p.includes("không phải là một mục hợp lệ")),
      `Phải có thông báo lỗi mục không hợp lệ cho "${item.entry}": ` + res.problems.join("; ")
    );
  }
});

test("shortlist-lint: P-07 - chấp nhận các entry trọn mục hợp lệ ('Smart Contract Developer', 'Web3 Security Auditor', 'Solana', 'Rust', 'AI Agents')", () => {
  const validEntries = [
    { axis: "role", entry: "Smart Contract Developer" },
    { axis: "role", entry: "Web3 Security Auditor" },
    { axis: "ecosystem", entry: "Solana" },
    { axis: "skill", entry: "Rust" },
    { axis: "skill", entry: "AI Agents" }
  ];

  for (const item of validEntries) {
    const data = getBaseValidShortlist();
    data.shortlist[0].direction = item;
    const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
    const hasEntryError = res.problems.some((p) => p.includes(item.entry));
    assert.strictEqual(hasEntryError, false, `Entry hợp lệ "${item.entry}" không được bị báo lỗi: ` + res.problems.join("; "));
  }
});

test("shortlist-lint: P-07 - đọc docs/learn/learn-proposal.md thật phát hiện đúng cấu trúc các mục", () => {
  const entries = extractProposalEntries(realDoc);
  assert.ok(entries.role.has("Smart Contract Developer"));
  assert.ok(entries.role.has("Web3 Security Auditor"));
  assert.ok(entries.role.has("Frontend"));
  assert.ok(entries.skill.has("Rust"));
  assert.ok(entries.skill.has("AI Agents"));
  assert.ok(entries.skill.has("React"));
  assert.ok(entries.ecosystem.has("Solana"));
  assert.ok(entries.ecosystem.has("Arbitrum"));

  // Đảm bảo không chứa chuỗi con bị tách sai
  assert.strictEqual(entries.role.has("Developer"), false);
  assert.strictEqual(entries.role.has("e"), false);
  assert.strictEqual(entries.role.has("Smart Contract"), false);
});

test("shortlist-lint: P-10 - báo lỗi khi proposalDocContent là null", () => {
  const data = getBaseValidShortlist();
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: null });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("Thiếu nội dung tài liệu")));
});

test("shortlist-lint: AC1.1 - từ chối khi chỉ có 3 đề xuất", () => {
  const data = getBaseValidShortlist();
  data.shortlist = data.shortlist.slice(0, 3);
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("phải từ 4 đến 6 đề xuất")));
});

test("shortlist-lint: AC1.2 - từ chối khi 4 đề xuất chỉ thuộc 2 entry", () => {
  const data = getBaseValidShortlist();
  data.shortlist[2].direction = { axis: "role", entry: "Smart Contract Developer" };
  data.shortlist[3].direction = { axis: "role", entry: "Solana Developer" };
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("direction.entry khác nhau (yêu cầu ít nhất 3)")));
});

test("shortlist-lint: AC1.3 - từ chối khi entry không có trong tài liệu learn-proposal.md", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].direction = { axis: "role", entry: "Nonexistent Mystery Role" };
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("không phải là một mục hợp lệ")));
});

test("shortlist-lint: AC1.4 - từ chối khi entry có trong tài liệu nhưng sai axis", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].direction = { axis: "ecosystem", entry: "React" };
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("sai axis")));
});

test("shortlist-lint: AC1.5 - từ chối khi promise mở bằng từ cấm ('Hiểu...')", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].promise = "Hiểu rõ về cách thức hoạt động của EVM";
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("mở đầu bằng từ cấm")));
});

test("shortlist-lint: AC1.6 - từ chối khi chỉ có 1 nguồn thay thế (alternatives < 2)", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].alternatives = [
    { name: "Only One", url: "https://example.com", gap: "Chỉ có một nguồn" }
  ];
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("cần ít nhất 2 nguồn thay thế")));
});

test("shortlist-lint: AC1.7 - từ chối khi thiếu why_now.urls", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].why_now.urls = [];
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("cần ít nhất 1 URL bằng chứng trong why_now.urls")));
});

test("shortlist-lint: AC1.8 - từ chối khi criteria thiếu một khóa bắt buộc", () => {
  const data = getBaseValidShortlist();
  delete data.shortlist[0].criteria.showable_product;
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("thiếu tiêu chí \"showable_product\"")));
});

test("shortlist-lint: AC1.9 - từ chối khi tiêu chí có met: true nhưng thiếu refs", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].criteria.fills_direction.refs = [];
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("thiếu refs")));
});

test("shortlist-lint: AC1.10 - từ chối khi timely.met: true nhưng why_now.kind là inferred", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].criteria.timely.met = true;
  data.shortlist[0].why_now.kind = "inferred";
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("đòi hỏi why_now.kind phải là \"direct\"")));
});

test("shortlist-lint: AC1.11 - từ chối khi kind: new trùng slug đã có trong catalog", () => {
  const data = getBaseValidShortlist();
  data.shortlist[0].kind = "new";
  data.shortlist[0].slug = "c-complete";
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("đã tồn tại trong catalog")));
});

test("shortlist-lint: AC1.12 - từ chối khi complete_existing trỏ khóa complete", () => {
  const data = getBaseValidShortlist();
  data.shortlist[3].kind = "complete_existing";
  data.shortlist[3].slug = "c-complete";
  const res = lintShortlistData(data, { catalogData: mockCatalog, proposalDocContent: fixtureDoc });
  assert.strictEqual(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("đòi hỏi catalog content_state phải là \"empty\" hoặc \"partial\"")));
});

import { describe, expect, it } from "vitest";

import {
  acceptCatalogResearch,
  assembleCatalogBase,
  boundAppCourses,
  buildCatalogInput,
  CATALOG_RESEARCH_SCHEMA,
  catalogGap,
  catalogJobCostUsd,
  generationCostUsd,
  catalogResearchGap,
  catalogStatus,
  CatalogInputError,
  failuresOfRound,
  MAX_CATALOG_RESEARCH_ROUNDS,
  planCatalogJob,
  type CatalogCriterion,
  type CatalogGeneration,
  type CatalogResearch,
  type CatalogRows,
} from "./catalog.ts";
import { SEEDED_PROMPTS } from "./prompt_seed_test_helper.ts";
import { MAX_TRANSPORT_FAILURES } from "./retry.ts";
import { SUBMIT_STALE_MS } from "./steps.ts";

const TODAY = "2026-10-23";
const CTX = { today: TODAY, groupKinds: ["skill", "role"], hasAppCourses: true };

const crit = (criterion: string, over: Partial<CatalogCriterion> = {}): CatalogCriterion => ({
  criterion,
  level: 3,
  evidence_ids: ["w1"],
  confidence: "medium",
  missing_data: "",
  conflicts: "",
  ...over,
});

function research(over: Partial<CatalogResearch> = {}): CatalogResearch {
  const groupCriteria = () => [crit("corelia_fit", { evidence_ids: ["i1"] }), crit("catalog_gap", { evidence_ids: ["i2", "w1"] })];
  return {
    status: "evidence_ok",
    shared: ["trend", "demand", "ai_feasibility", "maintainability"].map((c) => crit(c)),
    by_group: [
      { group_kind: "skill", criteria: groupCriteria() },
      { group_kind: "role", criteria: groupCriteria() },
    ],
    web_evidence: [
      { evidence_id: "w1", url: "https://example.com/a", metric: "m", period: "90 ngày", checked_at: TODAY },
    ],
    input_evidence: [
      { evidence_id: "i1", input_ref: "groups.skill.corelia_direction", note: "định hướng của nhóm" },
      { evidence_id: "i2", input_ref: "groups.skill.other_courses", note: "các khóa khác" },
    ],
    ...over,
  };
}

function reason(output: CatalogResearch): string {
  const r = acceptCatalogResearch(output, CTX);
  if (r.ok) throw new Error("expected a rejection");
  return r.reason;
}

describe("CATALOG_RESEARCH_SCHEMA", () => {
  // Strict structured outputs: every object lists all its properties as required and forbids extras.
  const visit = (node: unknown, path: string, seen: string[]) => {
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}[${i}]`, seen));
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.type === "object") {
      const props = Object.keys(o.properties as object);
      expect(o.additionalProperties, path).toBe(false);
      expect([...(o.required as string[])].sort(), path).toEqual([...props].sort());
      seen.push(path);
    }
    for (const [k, v] of Object.entries(o)) visit(v, `${path}.${k}`, seen);
  };

  it("is strict at every object level", () => {
    const seen: string[] = [];
    visit(CATALOG_RESEARCH_SCHEMA, "$", seen);
    expect(seen.length).toBe(6); // root, shared criterion, by_group item, group criterion, web evidence, input evidence
  });

  it("has the contract's top-level fields, with level an integer or null", () => {
    const s = CATALOG_RESEARCH_SCHEMA as { required: string[]; properties: Record<string, any> };
    expect(s.required).toEqual(["status", "shared", "by_group", "web_evidence", "input_evidence"]);
    expect(s.properties).not.toHaveProperty("open_questions");
    expect(s.properties.shared.items.properties.level).toEqual({ type: ["integer", "null"] });
    expect(s.properties.shared.items.properties.criterion.enum).toEqual(["trend", "demand", "ai_feasibility", "maintainability"]);
    expect(s.properties.by_group.items.properties.criteria.items.properties.criterion.enum).toEqual(["corelia_fit", "catalog_gap"]);
    expect(s.properties.status.enum).toEqual(["evidence_ok", "needs_more_sources"]);
    expect(Object.keys(s.properties.web_evidence.items.properties)).toEqual(["evidence_id", "url", "metric", "period", "checked_at"]);
    expect(Object.keys(s.properties.input_evidence.items.properties)).toEqual(["evidence_id", "input_ref", "note"]);
    expect(s.properties.input_evidence.items.properties.input_ref.pattern).toContain("app_courses");
  });
});

describe("A1 catalog prompt", () => {
  it("uses v7 and does not request open_questions", () => {
    const prompt = SEEDED_PROMPTS["a1-catalog-research"];
    expect(prompt.version).toBe("v7");
    expect(prompt.system).not.toContain("open_questions");
    expect(prompt.system).toContain("ít nhất một truy vấn nhắm đúng locale hoặc thị trường của audience");
    expect(prompt.system).toContain("input_ref = app_courses");
  });
});

describe("acceptCatalogResearch", () => {
  it("accepts a complete record without open_questions", () => {
    const r = acceptCatalogResearch(research(), CTX);
    expect(r).toEqual({ ok: true, summary: "8/8 tiêu chí có mức, 1 bằng chứng web, 2 bằng chứng input, evidence_ok." });
  });

  it("ignores legacy open_questions when validating and carrying prior research", () => {
    const legacy = {
      ...research({
        status: "needs_more_sources",
        shared: [
          crit("trend", { level: null, evidence_ids: [], confidence: "low", missing_data: "không có số liệu tại locale" }),
          crit("demand"),
          crit("ai_feasibility"),
          crit("maintainability"),
        ],
      }),
      open_questions: [{ question: "câu hỏi cũ", impact: "", blocking: false, action: "" }],
    };

    expect(acceptCatalogResearch(legacy, CTX).ok).toBe(true);
    expect(catalogResearchGap(1, legacy)).toEqual({
      previous_research: legacy,
      research_gap: { round: 1, missing: ["trend: không có số liệu tại locale"] },
    });
  });

  // First course of a new group: other_courses is [] in the input, and citing it is the evidence of the gap.
  it("accepts catalog_gap citing the other_courses of a group that has no other course", () => {
    const output = research({
      by_group: [{
        group_kind: "ecosystem",
        criteria: [
          crit("corelia_fit", { level: 4, evidence_ids: ["i1"] }),
          crit("catalog_gap", { level: 5, evidence_ids: ["i2"] }),
        ],
      }],
      input_evidence: [
        { evidence_id: "i1", input_ref: "groups.ecosystem.corelia_direction", note: "định hướng của nhóm" },
        { evidence_id: "i2", input_ref: "groups.ecosystem.other_courses", note: "nhóm chưa có khóa nào khác" },
      ],
    });
    expect(acceptCatalogResearch(output, { today: TODAY, groupKinds: ["ecosystem"] })).toMatchObject({ ok: true });
  });

  it("accepts web evidence dated yesterday (response finished after midnight UTC)", () => {
    const o = research();
    o.web_evidence[0].checked_at = "2026-10-22";
    expect(acceptCatalogResearch(o, CTX).ok).toBe(true);
  });

  it("rejects web evidence from another day or without a date", () => {
    for (const day of ["2026-10-21", "2026-10-24", ""]) {
      const o = research();
      o.web_evidence[0].checked_at = day;
      expect(reason(o)).toContain("không phải ngày chạy");
    }
  });

  it("requires url on web evidence", () => {
    const noUrl = research();
    noUrl.web_evidence[0].url = " ";
    expect(reason(noUrl)).toContain("(web) thiếu url");
  });

  it("requires input_ref on input evidence", () => {
    const noRef = research();
    noRef.input_evidence[0].input_ref = "";
    expect(reason(noRef)).toContain("(input) thiếu input_ref");
  });

  it("input_ref supports app_courses and only groups from the input", () => {
    for (const ref of ["groups.skill.audience", "groups.role.other_courses", "groups.skill.paths", "groups.skill.corelia_direction"]) {
      const o = research();
      o.input_evidence[0].input_ref = ref;
      expect(acceptCatalogResearch(o, CTX).ok, ref).toBe(true);
    }
    const unknownGroup = research();
    unknownGroup.input_evidence[0].input_ref = "groups.ecosystem.audience";
    expect(reason(unknownGroup)).toContain("trỏ tới nhóm ecosystem không có trong đầu vào");
    const appCourses = research();
    appCourses.input_evidence.push({ evidence_id: "i3", input_ref: "app_courses", note: "khóa đã publish" });
    expect(acceptCatalogResearch(appCourses, CTX).ok).toBe(true);
    expect(acceptCatalogResearch(appCourses, { ...CTX, hasAppCourses: false }).ok).toBe(false);
    for (const ref of ["groups.skill.locale", "groups.skill.audience.x", "groups.skill", "course.title", "skill.audience"]) {
      const o = research();
      o.input_evidence[0].input_ref = ref;
      expect(reason(o), ref).toContain("phải có dạng groups.<group_kind>");
    }
  });

  it("evidence_id is unique across both arrays, and not empty", () => {
    const dup = research();
    dup.web_evidence.push({ ...dup.web_evidence[0] });
    expect(reason(dup)).toContain("evidence_id w1 bị trùng");
    const across = research();
    across.input_evidence[0].evidence_id = "w1";
    expect(reason(across)).toContain("evidence_id w1 bị trùng");
    const empty = research();
    empty.web_evidence[0].evidence_id = "";
    expect(reason(empty)).toContain("evidence_id trống");
  });

  it("requires exactly the four shared criteria, each once", () => {
    const missing = research();
    missing.shared.pop();
    expect(reason(missing)).toContain("shared thiếu maintainability");
    const dup = research();
    dup.shared[3] = crit("trend");
    expect(reason(dup)).toContain('shared có "trend" nhiều lần');
    expect(reason(dup)).toContain("shared thiếu maintainability");
    const extra = research();
    extra.shared.push(crit("corelia_fit"));
    expect(reason(extra)).toContain('shared có "corelia_fit" không thuộc đầu vào');
  });

  it("requires exactly the group_kind of the input in by_group", () => {
    const missing = research();
    missing.by_group.pop();
    expect(reason(missing)).toContain("by_group thiếu role");
    const extra = research();
    extra.by_group.push({ group_kind: "ecosystem", criteria: extra.by_group[0].criteria });
    expect(reason(extra)).toContain('by_group có "ecosystem" không thuộc đầu vào');
    const dup = research();
    dup.by_group[1].group_kind = "skill";
    expect(reason(dup)).toContain('by_group có "skill" nhiều lần');
  });

  it("requires corelia_fit and catalog_gap in every group", () => {
    const o = research();
    o.by_group[1].criteria.pop();
    expect(reason(o)).toContain("by_group.role thiếu catalog_gap");
    const wrong = research();
    wrong.by_group[0].criteria[1] = crit("trend", { evidence_ids: ["i1"] });
    expect(reason(wrong)).toContain('by_group.skill có "trend" không thuộc đầu vào');
  });

  it("level null needs missing_data and confidence low", () => {
    const noReason = research();
    noReason.shared[0] = crit("trend", { level: null, evidence_ids: [], confidence: "low" });
    expect(reason(noReason)).toContain("shared/trend: level null nhưng missing_data trống");
    const notLow = research();
    notLow.shared[0] = crit("trend", { level: null, evidence_ids: [], confidence: "medium", missing_data: "đã tìm, không có" });
    expect(reason(notLow)).toContain("level null thì confidence phải là low");
  });

  it("a level with missing_data is rejected (missing_data non-empty only when level is null)", () => {
    const o = research();
    o.shared[2] = crit("ai_feasibility", { missing_data: "thiếu dữ liệu địa phương" });
    expect(reason(o)).toContain("shared/ai_feasibility: có missing_data nhưng level khác null");
  });

  it("level must be an integer in 1-5 and carry evidence_ids that exist", () => {
    for (const level of [0, 6, 2.5]) {
      const o = research();
      o.shared[1] = crit("demand", { level });
      expect(reason(o)).toContain("ngoài khoảng 1–5");
    }
    const none = research();
    none.shared[1] = crit("demand", { evidence_ids: [] });
    expect(reason(none)).toContain("có level nhưng không có evidence_ids");
    const unknown = research();
    unknown.shared[1] = crit("demand", { evidence_ids: ["w1", "w9"] });
    expect(reason(unknown)).toContain("evidence_id w9 không có trong web_evidence hoặc input_evidence");
  });

  it("shared criteria cite web evidence only", () => {
    const o = research();
    o.shared[3] = crit("maintainability", { evidence_ids: ["w1", "i1"] });
    expect(reason(o)).toContain("shared/maintainability: tiêu chí chung chỉ được dẫn bằng chứng web");
  });

  it("group criteria with a level cite at least one input evidence; web may be added", () => {
    const o = research();
    o.by_group[0].criteria[0] = crit("corelia_fit", { evidence_ids: ["w1"] });
    expect(reason(o)).toContain("by_group.skill/corelia_fit: cần ít nhất một bằng chứng input");
    // input + web is fine (catalog_gap in the fixture)
    expect(acceptCatalogResearch(research(), CTX).ok).toBe(true);
  });

  it("a group criterion without a level needs no input evidence", () => {
    const o = research();
    o.by_group[0].criteria[1] = crit("catalog_gap", { level: null, evidence_ids: [], confidence: "low", missing_data: "không đọc được danh sách" });
    expect(acceptCatalogResearch(o, CTX).ok).toBe(true);
  });

  it("accepts a record without trend, and the status is computed by code (D2), not taken from the model", () => {
    const o = research({ status: "evidence_ok" });
    o.shared[0] = crit("trend", { level: null, evidence_ids: [], confidence: "low", missing_data: "không có số liệu trong kỳ" });
    const r = acceptCatalogResearch(o, CTX);
    expect(r).toEqual({ ok: true, summary: "7/8 tiêu chí có mức, 1 bằng chứng web, 2 bằng chứng input, needs_more_sources." });
    expect(catalogStatus(o)).toBe("needs_more_sources");
    expect(catalogGap(o)).toEqual(["trend: không có số liệu trong kỳ"]);
  });

  it("missing ai_feasibility or a group criterion does not block scoring; the model's needs_more_sources is only a signal", () => {
    const o = research({ status: "needs_more_sources" });
    o.shared[2] = crit("ai_feasibility", { level: null, evidence_ids: [], confidence: "low", missing_data: "x" });
    expect(catalogStatus(o)).toBe("evidence_ok");
    expect(catalogGap(o)).toEqual([]);
  });

  it("lists at most five problems", () => {
    const o = research();
    o.web_evidence[0].checked_at = "";
    o.input_evidence.forEach((e) => (e.input_ref = "x"));
    o.shared[0] = crit("trend", { evidence_ids: ["zz"] });
    o.shared[1] = crit("demand", { evidence_ids: ["yy"] });
    o.shared[2] = crit("ai_feasibility", { evidence_ids: ["xx"] });
    expect(reason(o)).toMatch(/\(\+\d+\)$/);
  });
});

describe("catalog input", () => {
  const rows = (over: Partial<CatalogRows> = {}): CatalogRows => ({
    courseId: "c1",
    course: { title: "Rust cơ bản", level: "beginner", audience: "Dev mới", corelia_direction: "Kỹ năng lõi", content_locale: "vi", research_period_days: 120 },
    paths: [
      { group_kind: "skill", title: "Rust" },
      { group_kind: "skill", title: "Systems" },
      { group_kind: "ecosystem", title: "Solana" },
    ],
    neighbours: [
      { group_kind: "skill", id: "c1", title: "Rust cơ bản", level: "beginner", status: "idea" },
      { group_kind: "skill", id: "c2", title: "Go", level: null, status: "published" },
      { group_kind: "skill", id: "c2", title: "Go", level: null, status: "published" },
      { group_kind: "ecosystem", id: "c3", title: "Anchor", level: "advanced", status: "queued" },
    ],
    ...over,
  });

  it("builds one group per Type of the course, with its paths and the other courses once each", () => {
    const base = assembleCatalogBase(rows());
    expect(base.groups.map((g) => g.group_kind)).toEqual(["skill", "ecosystem"]);
    expect(base.groups[0]).toEqual({
      group_kind: "skill",
      audience: "Dev mới",
      corelia_direction: "Kỹ năng lõi",
      locale: "vi",
      paths: ["Rust", "Systems"],
      other_courses: [{ title: "Go", level: null, status: "published" }],
    });
    expect(base.groups[1]).toMatchObject({ audience: "Dev mới", corelia_direction: "Kỹ năng lõi", locale: "vi" });
    expect(base.groups[1].other_courses).toEqual([{ title: "Anchor", level: "advanced", status: "queued" }]);
  });

  it("passes the scope note of the course to the model input", () => {
    const base = assembleCatalogBase(rows({ course: { ...rows().course, scope_note: "E0382, E0499" } }));
    expect(buildCatalogInput(base, "2026-10-27", null, null).course).toEqual({ title: "Rust cơ bản", level: "beginner", scope_note: "E0382, E0499" });
  });

  it("uses the research period and content locale of the course for every group", () => {
    const base = assembleCatalogBase(rows({ course: { ...rows().course, content_locale: "en", research_period_days: 30 } }));
    expect(base.research_period_days).toBe(30);
    expect(base.groups.map((g) => g.locale)).toEqual(["en", "en"]);
  });

  it("refuses a course without a path, and a course without audience or direction", () => {
    expect(() => assembleCatalogBase(rows({ paths: [] }))).toThrowError(CatalogInputError);
    try {
      assembleCatalogBase(rows({ paths: [] }));
    } catch (e) {
      expect((e as CatalogInputError).code).toBe("course_has_no_path");
    }
    for (const missing of [{ audience: null }, { corelia_direction: null }]) {
      try {
        assembleCatalogBase(rows({ course: { ...rows().course, ...missing } }));
        throw new Error("expected scope_missing");
      } catch (e) {
        expect((e as CatalogInputError).code).toBe("scope_missing");
      }
    }
  });

  it("first round input has no previous_research, research_gap or previous_attempt", () => {
    const input = buildCatalogInput(assembleCatalogBase(rows()), TODAY, null, null);
    expect(Object.keys(input).sort()).toEqual(["app_courses", "course", "groups", "platform_formats", "research_period_days", "today"]);
    expect(input.today).toBe(TODAY);
    expect(input.app_courses).toMatchObject({ items: [], limit: 30, truncated: false });
  });

  it("caps the published app catalog, fields and outcomes after deduping by id", () => {
    const candidates = Array.from({ length: 32 }, (_, index) => ({
      id: `id-${index}`,
      updated_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      slug: "s".repeat(100),
      level: "beginner",
      title: "t".repeat(200),
      short_description: "d".repeat(300),
      course_type: "c".repeat(60),
      learning_outcomes: Array.from({ length: 6 }, () => "o".repeat(140)),
    }));
    const bounded = boundAppCourses([...candidates, { ...candidates[0], title: "duplicate" }]);
    expect(bounded.items).toHaveLength(30);
    expect(bounded.truncated).toBe(true);
    expect(bounded.items[0].title.length).toBe(160);
    expect(bounded.items[0].slug.length).toBe(80);
    expect(bounded.items[0].short_description.length).toBe(280);
    expect(bounded.items[0].course_type.length).toBe(48);
    expect(bounded.items[0].learning_outcomes).toHaveLength(4);
    expect(bounded.items[0].learning_outcomes[0].length).toBe(120);
    expect(bounded.items[0].learning_outcomes_truncated).toBe(true);
  });

  it("a research round carries the previous record and the gap; a retry carries the rejection", () => {
    const prev = research();
    prev.shared[1] = crit("demand", { level: null, evidence_ids: [], confidence: "low", missing_data: "không có tin tuyển" });
    const gap = catalogResearchGap(1, prev);
    expect(gap).toEqual({ previous_research: prev, research_gap: { round: 1, missing: ["demand: không có tin tuyển"] } });
    const input = buildCatalogInput(assembleCatalogBase(rows()), TODAY, gap, { attempt: 1, reason: "thiếu url" });
    expect(input.research_gap).toEqual({ round: 1, missing: ["demand: không có tin tuyển"] });
    expect(input.previous_research).toBe(prev);
    expect(input.previous_attempt).toEqual({ attempt: 1, rejected_because: "thiếu url" });
  });

  it("no gap when nothing was accepted yet or the accepted record has trend and demand", () => {
    expect(catalogResearchGap(0, null)).toBeNull();
    expect(catalogResearchGap(1, research())).toBeNull();
  });
});

describe("planCatalogJob", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const startedAt = "2026-10-23T11:00:00Z";
  const gen = (attempt: number, status: CatalogGeneration["status"], over: Partial<CatalogGeneration> = {}): CatalogGeneration => ({
    id: `g${attempt}`,
    attempt,
    status,
    provider_request_id: status === "submitting" ? null : `resp_${attempt}`,
    failure_kind: null,
    error: null,
    created_at: "2026-10-23T11:59:00Z",
    ...over,
  });
  const failed = (attempt: number, kind: "transport" | "provider" | "rejected", error = "lỗi") =>
    gen(attempt, "failed", { failure_kind: kind, error, provider_request_id: kind === "transport" ? null : `resp_${attempt}` });
  const plan = (generations: CatalogGeneration[], latestResult: Parameters<typeof planCatalogJob>[0]["latestResult"] = null, at = startedAt) =>
    planCatalogJob({ generations, startedAt: at, now, latestResult });
  const needsMore = { status: "needs_more_sources" as const, missing: ["trend: không có số liệu"] };

  it("submits the first attempt, waits on a fresh submit, expires a stale one, polls a submitted one", () => {
    expect(plan([])).toEqual({ kind: "submit", attempt: 0, parentId: null });
    expect(plan([gen(0, "submitting")])).toEqual({ kind: "wait" });
    expect(plan([gen(0, "submitting", { created_at: new Date(now - SUBMIT_STALE_MS - 1).toISOString() })])).toEqual({ kind: "expire_submitting", generationId: "g0" });
    expect(plan([gen(0, "submitted")])).toEqual({ kind: "poll", generationId: "g0", requestId: "resp_0" });
  });

  it("finishes evidence_ok after an accepted record with trend and demand", () => {
    expect(plan([gen(0, "completed")], { status: "evidence_ok", missing: [] })).toEqual({ kind: "finish", status: "evidence_ok", reason: "" });
  });

  it("researches again while trend or demand is missing, within the round limit", () => {
    expect(plan([gen(0, "completed")], needsMore)).toEqual({ kind: "submit", attempt: 1, parentId: "g0" });
    expect(plan([gen(0, "completed"), gen(1, "completed")], needsMore)).toEqual({ kind: "submit", attempt: 2, parentId: "g1" });
  });

  it("ends needs_more_sources with the missing items once the rounds are used up", () => {
    const done = Array.from({ length: MAX_CATALOG_RESEARCH_ROUNDS + 1 }, (_, i) => gen(i, "completed"));
    const action = plan(done, needsMore);
    expect(action).toMatchObject({ kind: "finish", status: "needs_more_sources" });
    expect((action as { reason: string }).reason).toContain("trend: không có số liệu");
  });

  it("a record that reaches evidence_ok in the last round still ends evidence_ok", () => {
    const done = Array.from({ length: MAX_CATALOG_RESEARCH_ROUNDS + 1 }, (_, i) => gen(i, "completed"));
    expect(plan(done, { status: "evidence_ok", missing: [] })).toMatchObject({ kind: "finish", status: "evidence_ok" });
  });

  it("retries a rejected attempt once, then fails the job with the reason", () => {
    expect(plan([failed(0, "rejected", "thiếu url")])).toEqual({ kind: "submit", attempt: 1, parentId: "g0" });
    expect(plan([failed(0, "rejected"), failed(1, "rejected", "vẫn thiếu url")])).toEqual({ kind: "finish", status: "failed", reason: "vẫn thiếu url" });
  });

  it("technical failures do not use the model's attempts, but have their own limit", () => {
    const transport = Array.from({ length: MAX_TRANSPORT_FAILURES - 1 }, (_, i) => failed(i, "transport"));
    expect(plan(transport)).toMatchObject({ kind: "submit", attempt: MAX_TRANSPORT_FAILURES - 1 });
    const all = Array.from({ length: MAX_TRANSPORT_FAILURES }, (_, i) => failed(i, "provider", "no capacity"));
    expect(plan(all)).toEqual({ kind: "finish", status: "failed", reason: "no capacity" });
    // one rejected + one provider failure: the model still has an attempt left
    expect(plan([failed(0, "rejected"), failed(1, "provider")])).toMatchObject({ kind: "submit", attempt: 2 });
  });

  it("the retry budget restarts after an accepted round", () => {
    const rows = [gen(0, "completed"), failed(1, "rejected")];
    expect(failuresOfRound(rows)).toEqual({ model: 1, transport: 0 });
    expect(plan([...rows, gen(2, "completed")], needsMore)).toEqual({ kind: "submit", attempt: 3, parentId: "g2" });
    expect(plan([gen(0, "completed"), failed(1, "rejected")])).toEqual({ kind: "submit", attempt: 2, parentId: "g1" });
    expect(plan([gen(0, "completed"), failed(1, "rejected"), failed(2, "rejected", "hết lượt")])).toEqual({ kind: "finish", status: "failed", reason: "hết lượt" });
  });

  it("fails a job older than 24 hours, and one whose accepted result cannot be read", () => {
    expect(plan([gen(0, "submitted")], null, "2026-10-21T00:00:00Z")).toMatchObject({ kind: "finish", status: "failed" });
    expect(plan([gen(0, "completed")], null)).toMatchObject({ kind: "finish", status: "failed" });
  });
});

describe("catalog job cost", () => {
  const usage = (input: number, output: number, calls: number) => ({ input_tokens: input, output_tokens: output, web_search_calls: calls });

  it("prices tokens by the serving model and every web_search call at $0.01", () => {
    // 1M input at $0.10 + 1M output at $0.50 + 100 calls at $0.01
    expect(generationCostUsd({ model_id: "gpt-6-luna", usage: usage(1_000_000, 1_000_000, 100) })).toBeCloseTo(0.1 + 0.5 + 1, 6);
    expect(generationCostUsd({ model_id: "gpt-6.1-sol", usage: usage(1_000_000, 1_000_000, 0) })).toBeCloseTo(12, 6);
    expect(generationCostUsd({ model_id: "gpt-6-luna-2026-10-01", usage: usage(1_000_000, 0, 0) })).toBeCloseTo(0.1, 6);
  });

  it("prices an unknown model as the most expensive listed one", () => {
    expect(generationCostUsd({ model_id: "gpt-9", usage: usage(1_000_000, 0, 0) })).toBeCloseTo(10, 6);
    expect(generationCostUsd({ model_id: null, usage: usage(1_000_000, 0, 0) })).toBeCloseTo(10, 6);
  });

  it("costs nothing without usage, and ignores a missing call count (rows from before it was recorded)", () => {
    expect(generationCostUsd({ model_id: "gpt-6-luna", usage: null })).toBe(0);
    expect(generationCostUsd({ model_id: "gpt-6-luna", usage: { input_tokens: 1_000_000, output_tokens: 0 } })).toBeCloseTo(0.1, 6);
  });

  it("matches the measured Rust job: four attempts, 45 calls, about $0.51 at the upper bound", () => {
    const attempts = [[110823, 15658, 13], [79732, 9750, 9], [91339, 9727, 11], [104827, 10726, 12]];
    const total = catalogJobCostUsd(attempts.map(([i, o, c]) => ({ model_id: "gpt-6-luna", usage: usage(i, o, c) })));
    expect(total).toBeCloseTo(0.0616 + 0.45, 3);
  });
});

describe("planCatalogJob cost-independent structural limits", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const gen = (attempt: number, status: CatalogGeneration["status"], over: Partial<CatalogGeneration> = {}): CatalogGeneration => ({
    id: `g${attempt}`,
    attempt,
    status,
    provider_request_id: `resp_${attempt}`,
    failure_kind: status === "failed" ? "rejected" : null,
    error: status === "failed" ? "bị từ chối" : null,
    created_at: "2026-10-23T11:59:00Z",
    model_id: "gpt-6-luna",
    ...over,
  });
  const plan = (
    generations: CatalogGeneration[],
    latestResult: Parameters<typeof planCatalogJob>[0]["latestResult"] = null,
    startedAt = "2026-10-23T11:00:00Z",
  ) => planCatalogJob({ generations, startedAt, now, latestResult });
  const veryHighUsage = { input_tokens: 1_000_000_000, output_tokens: 1_000_000_000, web_search_calls: 1_000_000 };
  const needsMore = { status: "needs_more_sources" as const, missing: ["trend: x"] };

  it("submits the first attempt, retry, and next round despite already high generation usage", () => {
    expect(plan([])).toEqual({ kind: "submit", attempt: 0, parentId: null });
    expect(plan([gen(0, "failed", { usage: veryHighUsage })])).toEqual({ kind: "submit", attempt: 1, parentId: "g0" });
    expect(plan([gen(0, "completed", { usage: veryHighUsage })], needsMore)).toEqual({ kind: "submit", attempt: 1, parentId: "g0" });
  });

  it("ends needs_more_sources after the configured research rounds despite high usage", () => {
    const done = Array.from({ length: MAX_CATALOG_RESEARCH_ROUNDS + 1 }, (_, i) => gen(i, "completed", { usage: veryHighUsage }));
    expect(plan(done, needsMore)).toMatchObject({ kind: "finish", status: "needs_more_sources" });
  });

  it("fails after the retry limit despite high usage", () => {
    expect(plan([
      gen(0, "failed", { usage: veryHighUsage }),
      gen(1, "failed", { usage: veryHighUsage }),
    ])).toMatchObject({ kind: "finish", status: "failed" });
  });

  it("fails after 24 hours regardless of high usage", () => {
    const action = plan([gen(0, "submitted", { usage: veryHighUsage })], null, "2026-10-21T00:00:00Z");
    expect(action).toMatchObject({ kind: "finish", status: "failed" });
  });
});

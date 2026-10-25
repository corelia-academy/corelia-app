import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import { PROMPTS } from "./prompts.ts";
import { STEP_SPECS, type RunContext } from "./steps.ts";
import {
  CATALOG_RESEARCH_METRIC_MAX_CHARS,
  loadCatalogResearchForBrief,
  projectCatalogResearchForBrief,
} from "./catalog_research_brief.ts";

const evidence = (evidence_id: string, metric: string) => ({
  evidence_id,
  url: `https://example.test/${evidence_id}`,
  metric,
  period: "2026",
  checked_at: "2026-10-24",
});

const rawResearch = {
  status: "evidence_ok",
  shared: [
    { criterion: "maintainability", level: 3, evidence_ids: ["web-b"], confidence: "medium", missing_data: "", conflicts: "maintainability conflict" },
    { criterion: "trend", level: 4, evidence_ids: ["web-a"], confidence: "high", missing_data: "", conflicts: "" },
    { criterion: "demand", level: 2, evidence_ids: ["input-a"], confidence: "low", missing_data: "", conflicts: "" },
    { criterion: "ai_feasibility", level: 4, evidence_ids: ["web-a"], confidence: "medium", missing_data: "", conflicts: "" },
  ],
  by_group: [
    { group_kind: "role", criteria: [
      { criterion: "catalog_gap", level: 2, evidence_ids: ["input-a"], confidence: "low", missing_data: "", conflicts: "" },
      { criterion: "corelia_fit", level: 4, evidence_ids: ["web-b", "input-a"], confidence: "high", missing_data: "", conflicts: "" },
    ] },
    { group_kind: "ecosystem", criteria: [
      { criterion: "corelia_fit", level: 4, evidence_ids: ["input-a"], confidence: "high", missing_data: "", conflicts: "" },
      { criterion: "catalog_gap", level: 3, evidence_ids: ["web-a"], confidence: "medium", missing_data: "", conflicts: "" },
    ] },
    { group_kind: "skill", criteria: [
      { criterion: "catalog_gap", level: 3, evidence_ids: ["web-b"], confidence: "medium", missing_data: "", conflicts: "" },
      { criterion: "corelia_fit", level: 4, evidence_ids: ["input-a"], confidence: "high", missing_data: "", conflicts: "" },
    ] },
  ],
  web_evidence: [evidence("web-b", "measure B"), evidence("web-a", "measure A")],
  input_evidence: [{ evidence_id: "input-a", input_ref: "groups.skill.paths", note: "private input evidence" }],
};

function briefInput(catalogResearch?: RunContext["catalogResearch"]) {
  const ctx: RunContext = {
    course: { title: "Solana", level: "beginner" },
    paths: [{ track: "skill", title: "Blockchain" }, { track: "ecosystem", title: "Solana" }],
    scopes: [],
    outputs: {},
    today: "2026-10-24",
    revision: null,
    catalogResearch,
  };
  return STEP_SPECS.brief!.buildInput(ctx) as Record<string, unknown>;
}

describe("A1 catalog research in the A2 brief", () => {
  it("projects only brief fields, web sources, and groups on the course path in stable order", () => {
    const projected = projectCatalogResearchForBrief(rawResearch, ["ecosystem", "skill"]);
    const input = briefInput(projected);
    expect(input.catalog_research).toEqual({
      shared: [
        { criterion: "trend", level: 4, confidence: "high", conflicts: "", sources: [{ url: "https://example.test/web-a", metric: "measure A", period: "2026" }] },
        { criterion: "demand", level: 2, confidence: "low", conflicts: "", sources: [] },
        { criterion: "ai_feasibility", level: 4, confidence: "medium", conflicts: "", sources: [{ url: "https://example.test/web-a", metric: "measure A", period: "2026" }] },
        { criterion: "maintainability", level: 3, confidence: "medium", conflicts: "maintainability conflict", sources: [{ url: "https://example.test/web-b", metric: "measure B", period: "2026" }] },
      ],
      by_group: [
        { group_kind: "skill", criteria: [
          { criterion: "corelia_fit", level: 4, confidence: "high", conflicts: "", sources: [] },
          { criterion: "catalog_gap", level: 3, confidence: "medium", conflicts: "", sources: [{ url: "https://example.test/web-b", metric: "measure B", period: "2026" }] },
        ] },
        { group_kind: "ecosystem", criteria: [
          { criterion: "corelia_fit", level: 4, confidence: "high", conflicts: "", sources: [] },
          { criterion: "catalog_gap", level: 3, confidence: "medium", conflicts: "", sources: [{ url: "https://example.test/web-a", metric: "measure A", period: "2026" }] },
        ] },
      ],
    });
    expect(JSON.stringify(input.catalog_research)).not.toContain("input-a");
    expect(JSON.stringify(input.catalog_research)).not.toContain("web_evidence");
    expect(JSON.stringify(input.catalog_research)).not.toContain("checked_at");
  });

  it("omits the field for legacy runs and bounds unusually long metrics", () => {
    expect(briefInput(null)).not.toHaveProperty("catalog_research");
    const longMetric = "x".repeat(CATALOG_RESEARCH_METRIC_MAX_CHARS + 50);
    const projected = projectCatalogResearchForBrief({
      ...rawResearch,
      web_evidence: [evidence("web-a", longMetric), evidence("web-b", "short")],
    }, ["skill"]);
    const trendSource = projected.shared.find((item) => item.criterion === "trend")!.sources[0];
    expect(trendSource.metric).toHaveLength(CATALOG_RESEARCH_METRIC_MAX_CHARS);
    expect(trendSource.metric.endsWith("…")).toBe(true);
  });

  it("loads the last completed attempt for the run-pinned job on every brief attempt", async () => {
    const jobId = "92e72c11-b0d7-4e50-a00a-6336eaceef17";
    const filters: unknown[][] = [];
    const orders: unknown[][] = [];
    const query: Record<string, any> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn((...args: unknown[]) => { filters.push(args); return query; });
    query.order = vi.fn((...args: unknown[]) => { orders.push(args); return query; });
    query.limit = vi.fn(() => query);
    query.maybeSingle = vi.fn().mockResolvedValue({ data: { attempt: 1, output: rawResearch }, error: null });
    const db = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    const attempt0 = await loadCatalogResearchForBrief(db, jobId, ["skill"]);
    const attempt1 = await loadCatalogResearchForBrief(db, jobId, ["skill"]);
    expect(attempt0).toEqual(attempt1);
    expect(filters.filter(([field]) => field === "catalog_job_id")).toEqual([
      ["catalog_job_id", jobId], ["catalog_job_id", jobId],
    ]);
    expect(orders).toEqual([["attempt", { ascending: false }], ["attempt", { ascending: false }]]);
  });

  it("uses prompt version v5, describes source-based version evidence, and keeps the A2 brief output contract unchanged", () => {
    expect(PROMPTS["a2-brief"].version).toBe("v5");
    expect(PROMPTS["a2-brief"].system).toContain("sẽ theo tài liệu chính thức hiện hành mà bước research đọc được");
    expect(PROMPTS["a2-brief"].system).toContain("brief không hứa bộ phiên bản tương thích được chốt");
    expect(PROMPTS["a2-brief"].system).toContain("không chép URL A1 vào brief");
    expect(PROMPTS["a2-brief"].system).toContain("mọi suy luận từ A1 phải ghi vào assumptions");
    expect(STEP_SPECS.brief!.schema).toBeDefined();
  });

  it("keeps A5 and A6 package-version decisions bounded by research evidence", () => {
    expect(PROMPTS["a5-lesson"].version).toBe("v10");
    expect(PROMPTS["a5-lesson"].system).toContain("tool_versions của research chỉ ghi mức tối thiểu hoặc phiên bản theo nguồn");
    expect(PROMPTS["a5-lesson"].system).toContain("nếu chỉ nêu mức tối thiểu, ghi rõ đó là mức tối thiểu và để lệnh không ghim phiên bản");
    expect(PROMPTS["a5-lesson"].system).toContain("Không tự suy ra phiên bản.");
    expect(PROMPTS["a5-lesson"].system).toContain("open_questions blocking = false ghi phiên bản chưa xác minh");

    expect(PROMPTS["a6-lesson-review"].version).toBe("v7");
    expect(PROMPTS["a6-lesson-review"].system).toContain("KHÔNG phải lỗi blocking nếu tool_versions chỉ nêu mức tối thiểu (chưa chốt bộ phiên bản tương thích)");
    expect(PROMPTS["a6-lesson-review"].system).toContain("lesson nêu phiên bản hoặc mức tối thiểu không có trong tool_versions hay nguồn đã đọc của lesson");
    expect(PROMPTS["a6-lesson-review"].system).toContain("khẳng định bộ phiên bản tương thích đã được xác minh/khóa khi research không nói vậy");
    expect(PROMPTS["a6-lesson-review"].system).toContain("thiếu bước cài đặt/cấu hình cho công cụ cụ thể mà brief.tools yêu cầu");
  });
});

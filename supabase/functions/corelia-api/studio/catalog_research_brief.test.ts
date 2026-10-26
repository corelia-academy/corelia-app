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

  it("uses prompt version v6 and selects one enabled code language for the course", () => {
    expect(PROMPTS["a2-brief"].version).toBe("v6");
    expect(PROMPTS["a2-brief"].system).toContain("sẽ theo tài liệu chính thức hiện hành mà bước research đọc được");
    expect(PROMPTS["a2-brief"].system).toContain("brief không hứa bộ phiên bản tương thích được chốt");
    expect(PROMPTS["a2-brief"].system).toContain("không chép URL A1 vào brief");
    expect(PROMPTS["a2-brief"].system).toContain("mọi suy luận từ A1 phải ghi vào assumptions");
    expect(PROMPTS["a2-brief"].system).toContain("code_language: chọn đúng một ID trong code_languages");
    expect(PROMPTS["a2-brief"].system).toContain("Solana/Anchor → rust");
    expect(STEP_SPECS.brief!.schema).toBeDefined();
  });

  it("keeps A5 and A6 package-version decisions bounded by research evidence", () => {
    expect(PROMPTS["a5-lesson"].version).toBe("v15");
    expect(PROMPTS["a5-lesson"].system).toContain("tool_versions của research chỉ ghi mức tối thiểu hoặc phiên bản theo nguồn");
    expect(PROMPTS["a5-lesson"].system).toContain("nếu chỉ nêu mức tối thiểu, ghi rõ đó là mức tối thiểu và để lệnh không ghim phiên bản");
    expect(PROMPTS["a5-lesson"].system).toContain("Không tự suy ra phiên bản.");
    expect(PROMPTS["a5-lesson"].system).toContain("open_questions blocking = false ghi phiên bản chưa xác minh");

    expect(PROMPTS["a6-lesson-review"].version).toBe("v12");
    expect(PROMPTS["a6-lesson-review"].system).toContain("KHÔNG phải lỗi blocking nếu tool_versions chỉ nêu mức tối thiểu (chưa chốt bộ phiên bản tương thích)");
    expect(PROMPTS["a6-lesson-review"].system).toContain("lesson nêu phiên bản hoặc mức tối thiểu không có trong tool_versions hay nguồn đã đọc của lesson");
    expect(PROMPTS["a6-lesson-review"].system).toContain("khẳng định bộ phiên bản tương thích đã được xác minh/khóa khi research không nói vậy");
    expect(PROMPTS["a6-lesson-review"].system).toContain("thiếu bước cài đặt/cấu hình cho công cụ cụ thể mà brief.tools yêu cầu");
  });

  it("keeps AI courses knowledge-only and limits video recommendations to research evidence", () => {
    const a2 = PROMPTS["a2-research"];
    const a3 = PROMPTS["a3-curriculum"];
    const a4 = PROMPTS["a4-curriculum-review"];
    const a5 = PROMPTS["a5-lesson"];
    const a6 = PROMPTS["a6-lesson-review"];

    expect(a3.version).toBe("v14");
    expect(a4.version).toBe("v10");
    expect(a5.version).toBe("v15");
    expect(a6.version).toBe("v12");
    expect(a2.version).toBe("v11");
    expect(a2.system).toContain("videos là mảng có thể rỗng");
    expect(a2.system).toContain("evidence_source_ids không rỗng");
    expect(a2.system).toContain("thiếu video không phải lý do needs_research");

    for (const prompt of [a3, a4, a5, a6]) {
      expect(prompt.system).toContain("Nguyên tắc chỉ truyền thụ kiến thức");
    }

    expect(a3.system).toContain("Dùng đúng stack_choice trong research_brief cho toàn khóa");
    expect(a3.system).toContain("Nếu research cũ thiếu stack_choice, không tự chọn thay A2");
    expect(a3.system).toContain("check_lesson_ids");
    expect(a3.system).toContain("Chỉ lập lesson code_exercise khi brief.code_language khác null");
    expect(a3.system).toContain("Không tạo lesson type video");
    expect(a3.system).toContain("bỏ qua video vẫn phải hiểu đủ lesson");
    expect(a4.system).toContain("báo blocking; không báo blocking vì curriculum thiếu các nhiệm vụ như vậy");
    expect(a4.system).toContain("Báo blocking nếu curriculum có lesson type video");
    expect(a4.system).toContain("outcome chỉ được dạy khi người học phải xem/hiểu video tùy chọn");
    expect(a5.system).toContain("Bước cài công cụ brief đòi và lệnh khớp research vẫn có trong bài như nội dung minh họa");
    expect(a5.system).toContain("suggested_videos là mảng video ID");
    expect(a5.system).toContain("tối đa 2");
    expect(a5.system).toContain("code sẽ dựng resources xem thêm");
    expect(a5.system).toContain("không đặt link YouTube trong text/markdown hoặc resources");
    expect(a5.system).toContain("Khối video chỉ dùng khi curriculum đã lưu sẵn lesson.type = video");
    expect(a5.system).toContain("không dùng web_search để tìm video");
    expect(a5.system).toContain("không đưa video vào completion_rule hay checklist");
    expect(a5.system).toContain("Nội dung video không phải bằng chứng");
    expect(a5.system).toContain("code_language_guide nhận trong đầu vào");
    expect(a5.system).toContain("Quy tắc gợi ý code");
    expect(a5.system).toContain("không dán đoạn mã giải và không dùng code block");
    expect(a6.system).toContain("Chỉ review các outcome_ids của lesson đang review");
    expect(a6.system).toContain("Không blocking vì thiếu nhiệm vụ yêu cầu người học thao tác ngoài Corelia");
    expect(a6.system).toContain("thiếu cảnh báo an toàn cần có");
    expect(a6.system).toContain("dùng công cụ khác selected của cùng tool_type là lỗi blocking");
    expect(a6.system).toContain("unverified bắt đầu bằng “research_gap:”");
    expect(a6.system).toContain("không dùng video làm bằng chứng");
    expect(a6.system).toContain("không đánh giá nội dung video");
    expect(a6.system).toContain("phải xem/hiểu video tùy chọn mới nắm được outcome");
    expect(a6.system).toContain("thiếu bước cài đặt/cấu hình cho công cụ cụ thể mà brief.tools yêu cầu");
    expect(a6.system).toContain("Mã theo code_language chưa được biên dịch hay chạy");
    expect(a6.system).toContain("Blocking nếu gợi ý lộ đáp án hoặc đoạn mã giải");
  });
});

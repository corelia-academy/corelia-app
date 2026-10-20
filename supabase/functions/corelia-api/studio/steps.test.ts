import { describe, expect, it } from "vitest";

import { readResponse } from "./openai.ts";
import { PROMPTS } from "./prompts.ts";
import {
  acceptCurriculum,
  acceptResearch,
  agentKeyEnv,
  MAX_RUN_MS,
  planRun,
  STEP_ORDER,
  STEP_OWNER,
  STEP_SPECS,
  SUBMIT_STALE_MS,
  type GenerationState,
  type StepKey,
  type StepState,
} from "./steps.ts";

const now = Date.parse("2026-10-18T12:00:00Z");
const startedAt = new Date(now - 60_000).toISOString();

function steps(done: StepKey[], current?: StepState): Partial<Record<StepKey, StepState>> {
  const out: Partial<Record<StepKey, StepState>> = {};
  for (const k of STEP_ORDER) out[k] = done.includes(k) ? "done" : "pending";
  const first = STEP_ORDER.find((k) => !done.includes(k));
  if (first && current) out[first] = current;
  return out;
}

function gen(over: Partial<GenerationState>): GenerationState {
  return {
    id: "g1",
    attempt: 0,
    agent_role: "A2",
    status: "submitted",
    provider_request_id: "resp_1",
    error: null,
    created_at: new Date(now - 30_000).toISOString(),
    ...over,
  };
}

describe("studio planRun", () => {
  it("submits the first attempt of the first pending step", () => {
    expect(planRun({ steps: steps([]), latest: null, startedAt, now })).toEqual({
      step: "brief",
      action: { kind: "submit", attempt: 0, parentId: null },
    });
  });

  it("polls a submitted generation", () => {
    expect(planRun({ steps: steps(["brief"], "active"), latest: gen({}), startedAt, now }).action)
      .toEqual({ kind: "poll", generationId: "g1", requestId: "resp_1" });
  });

  it("waits on a fresh claim and expires a stale one", () => {
    const fresh = gen({ status: "submitting", provider_request_id: null });
    expect(planRun({ steps: steps([], "active"), latest: fresh, startedAt, now }).action.kind).toBe("wait");
    const stale = gen({ status: "submitting", provider_request_id: null, created_at: new Date(now - SUBMIT_STALE_MS - 1).toISOString() });
    expect(planRun({ steps: steps([], "active"), latest: stale, startedAt, now }).action)
      .toEqual({ kind: "expire_submitting", generationId: "g1" });
  });

  it("retries a failed attempt, then ends the run as a draft", () => {
    expect(planRun({ steps: steps([], "active"), latest: gen({ status: "failed", error: "x" }), startedAt, now }).action)
      .toEqual({ kind: "submit", attempt: 1, parentId: "g1" });
    expect(planRun({ steps: steps([], "active"), latest: gen({ status: "failed", attempt: 1, error: "bad json" }), startedAt, now }).action)
      .toEqual({ kind: "finish", status: "draft_failed", reason: "Bước Chuẩn bị brief: bad json" });
  });

  it("marks the step done when its generation completed but the step was not updated", () => {
    expect(planRun({ steps: steps([], "active"), latest: gen({ status: "completed" }), startedAt, now }).action)
      .toEqual({ kind: "mark_done", generationId: "g1" });
  });

  it("ends the run at a step that has no implementation", () => {
    expect(planRun({ steps: steps(["brief", "research", "curriculum"]), latest: null, startedAt, now })).toEqual({
      step: "curriculum_review",
      action: { kind: "finish", status: "draft_failed", reason: "Bước Kiểm tra curriculum (agent A4) chưa được triển khai." },
    });
    const allAgentSteps = ["brief", "research", "curriculum", "curriculum_review", "lessons", "lesson_review"] as StepKey[];
    expect(planRun({ steps: steps(allAgentSteps), latest: null, startedAt, now }).action)
      .toEqual({ kind: "finish", status: "draft_failed", reason: "Bước Kiểm tra cấu trúc (code) chưa được triển khai." });
  });

  it("ends a run older than the time limit", () => {
    const old = new Date(now - MAX_RUN_MS - 1).toISOString();
    expect(planRun({ steps: steps([]), latest: null, startedAt: old, now }).action)
      .toEqual({ kind: "finish", status: "draft_failed", reason: "Lượt chạy vượt quá 24 giờ." });
  });

  it("publishes when every step is done", () => {
    expect(planRun({ steps: steps([...STEP_ORDER]), latest: null, startedAt, now }).action.kind).toBe("finish");
  });
});

describe("studio step owners", () => {
  it("runs each implemented step with the prompt of the agent that owns it", () => {
    for (const [step, spec] of Object.entries(STEP_SPECS)) {
      expect(PROMPTS[spec!.prompt].role).toBe(STEP_OWNER[step as StepKey]);
      expect(spec!.maxOutputTokens).toBeGreaterThan(0);
    }
  });

  it("places the six agents and keeps code steps without an agent", () => {
    expect(STEP_ORDER.map((k) => STEP_OWNER[k])).toEqual(["A2", "A2", "A3", "A4", "A5", "A6", "code", "code", "code"]);
    expect(agentKeyEnv("A1")).toBe("CORELIA_STUDIO_A1_CATALOG_RESEARCH_OPENAI_API_KEY");
    expect(agentKeyEnv("A4")).toBe("CORELIA_STUDIO_A4_CURRICULUM_REVIEW_OPENAI_API_KEY");
  });
});

describe("studio acceptance", () => {
  const today = "2026-10-20";
  const research = {
    status: "ready",
    prerequisites: [{ prerequisite: "biến và hàm", remedial_source_ids: ["s1"] }],
    topics: [{ topic: "ownership", source_ids: ["s1", "s2"], key_points: [{ point: "p", source_ids: ["s1"] }] }],
    sources: [
      { source_id: "s1", authority: "official", access: "read", checked_at: today },
      { source_id: "s2", authority: "supplementary", access: "read", checked_at: "2026-10-19" },
      { source_id: "s3", authority: "official", access: "unreachable", checked_at: "" },
    ],
    misconceptions: [{ topic: "ownership", source_ids: ["s1"] }],
    open_questions: [],
  };
  const topic = (over: object) => ({ ...research, topics: [{ ...research.topics[0], ...over }] });

  it("accepts research whose topics, prerequisites and misconceptions rest on sources read on the run date", () => {
    expect(acceptResearch(research, today)).toEqual({ ok: true, summary: "1 chủ đề, 1 ý chính, 1 lỗi hiểu sai, 2 nguồn đã đọc." });
  });

  it("rejects unknown or unread sources, community-only topics and uncited key points", () => {
    expect(acceptResearch(topic({ source_ids: ["s9"] }), today).ok).toBe(false);
    expect(acceptResearch(topic({ source_ids: ["s1", "s3"] }), today).ok).toBe(false);
    expect(acceptResearch(topic({ source_ids: ["s2"], key_points: [{ point: "p", source_ids: ["s2"] }] }), today))
      .toEqual({ ok: false, reason: "Research chưa đạt: ownership: không có nguồn chính thức" });
    expect(acceptResearch(topic({ key_points: [] }), today).ok).toBe(false);
    expect(acceptResearch(topic({ key_points: [{ point: "p", source_ids: [] }] }), today).ok).toBe(false);
    expect(acceptResearch({ ...research, status: "needs_research", open_questions: [{ question: "q", blocking: true }] }, today))
      .toEqual({ ok: false, reason: "Thiếu bằng chứng: q" });
  });

  it("rejects a read source not checked on the run date", () => {
    const stale = { ...research, sources: [{ ...research.sources[0], checked_at: "2025-01-01" }, research.sources[1]] };
    expect(acceptResearch(stale, today))
      .toEqual({ ok: false, reason: "Research chưa đạt: nguồn s1: ngày kiểm tra 2025-01-01 không phải ngày chạy" });
  });

  it("rejects prerequisites without remedial sources and uncited misconceptions", () => {
    expect(acceptResearch({ ...research, prerequisites: [{ prerequisite: "Git", remedial_source_ids: [] }] }, today).ok).toBe(false);
    expect(acceptResearch({ ...research, misconceptions: [{ topic: "ownership", source_ids: ["s3"] }] }, today).ok).toBe(false);
  });

  const lesson = (id: string, over: object = {}) => ({
    id,
    type: "article",
    purpose: "explanation",
    required: true,
    outcome_ids: ["o1"],
    pass_threshold: null,
    review_lesson_ids: [] as string[],
    source_ids: ["s1"],
    ...over,
  });
  const quiz = (id: string, over: object = {}) => lesson(id, { type: "quiz", pass_threshold: 80, review_lesson_ids: ["l1"], ...over });
  const curriculum = {
    status: "draft",
    missing: [],
    outcomes: [{ id: "o1", check_lesson_ids: ["q1"] }, { id: "o2", check_lesson_ids: ["q9"] }],
    modules: [
      {
        id: "m1",
        lessons: [
          quiz("d1", { purpose: "diagnostic", required: false, outcome_ids: [], pass_threshold: null, review_lesson_ids: ["p1"] }),
          lesson("p1", { purpose: "remedial", required: false, outcome_ids: [] }),
          lesson("l1"),
          quiz("q1", { purpose: "guided_practice" }),
        ],
      },
      {
        id: "m2",
        lessons: [
          lesson("l2", { outcome_ids: ["o2"], purpose: "worked_example" }),
          quiz("r1", { purpose: "retrieval", outcome_ids: ["o1"] }),
          quiz("q9", { purpose: "final_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["l1", "l2"] }),
        ],
      },
    ],
  };
  const sources = new Set(["s1"]);
  const withModules = (modules: object[]) => ({ ...curriculum, modules });
  const reason = (output: unknown) => {
    const result = acceptCurriculum(output, sources);
    return result.ok ? "" : result.reason;
  };

  it("accepts a curriculum with diagnosis, retrieval, a final check and quiz thresholds", () => {
    expect(acceptCurriculum(curriculum, sources)).toEqual({ ok: true, summary: "2 module, 7 lesson, 2 outcome." });
  });

  it("keeps diagnostic and remedial lessons optional and without a gating threshold", () => {
    const [m1, m2] = curriculum.modules;
    const [d1, p1, l1, q1] = m1.lessons;
    const swap = (first: object, second: object) => withModules([{ ...m1, lessons: [first, second, l1, q1] }, m2]);
    expect(reason(swap({ ...d1, required: true }, p1))).toContain("lesson d1 (diagnostic) phải là optional");
    expect(reason(swap({ ...d1, pass_threshold: 60 }, p1))).toContain("lesson d1 (diagnostic) không được có ngưỡng pass");
    expect(reason(swap(d1, { ...p1, required: true }))).toContain("lesson p1 (remedial) phải là optional");
    expect(reason(swap(d1, { ...p1, purpose: "explanation" }))).toContain("lesson p1 có outcome không hợp lệ");
  });

  it("rejects unknown sources, unchecked outcomes and duplicate ids", () => {
    expect(acceptCurriculum(curriculum, new Set(["s2"])).ok).toBe(false);
    expect(acceptCurriculum({ ...curriculum, outcomes: [{ id: "o1", check_lesson_ids: [] }, curriculum.outcomes[1]] }, sources).ok).toBe(false);
    const dup = withModules([{ ...curriculum.modules[0], id: "l1" }, curriculum.modules[1]]);
    expect(acceptCurriculum(dup, sources).ok).toBe(false);
  });

  it("requires quiz thresholds and review lessons, and no threshold elsewhere", () => {
    const [m1, m2] = curriculum.modules;
    const [d1, p1, l1, q1] = m1.lessons;
    const first = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(first(d1, p1, l1, quiz("q1", { pass_threshold: null })))).toContain("quiz q1 thiếu ngưỡng pass");
    expect(reason(first(d1, p1, l1, quiz("q1", { review_lesson_ids: [] })))).toContain("quiz q1 không có lesson để ôn khi sai");
    expect(reason(first(d1, p1, lesson("l1", { pass_threshold: 70 }), q1))).toContain("lesson l1 không phải quiz nhưng có ngưỡng pass");
  });

  it("requires a diagnostic start, a covering final check and retrieval of an earlier module", () => {
    const [m1, m2] = curriculum.modules;
    expect(reason(withModules([{ ...m1, lessons: m1.lessons.slice(1) }, m2]))).toContain("module đầu không có lesson chẩn đoán");
    expect(reason(withModules([m1, { ...m2, lessons: m2.lessons.slice(0, 2) }]))).toContain("module cuối không có quiz tổng hợp bắt buộc");
    expect(reason(withModules([m1, { ...m2, lessons: [m2.lessons[0], m2.lessons[1], quiz("q9", { purpose: "final_check" })] }])))
      .toContain("quiz tổng hợp không phủ mọi outcome");
    expect(reason(withModules([m1, { ...m2, lessons: [m2.lessons[0], m2.lessons[2]] }]))).toContain("không có lesson ôn lại outcome");
  });
});

describe("studio openai readResponse", () => {
  it("maps provider statuses", () => {
    expect(readResponse({ status: "in_progress" })).toEqual({ state: "running" });
    expect(readResponse({
      status: "completed",
      model: "gpt-6-luna",
      output: [{ type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text: "{}" }] }],
      usage: { total_tokens: 3 },
    })).toEqual({ state: "completed", model: "gpt-6-luna", text: "{}", usage: { total_tokens: 3 } });
    expect(readResponse({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }))
      .toEqual({ state: "failed", error: "incomplete: max_output_tokens" });
    expect(readResponse({ status: "cancelled" }).state).toBe("failed");
  });
});

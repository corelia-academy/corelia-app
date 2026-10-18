import { describe, expect, it } from "vitest";

import { readResponse } from "./openai.ts";
import {
  acceptCurriculum,
  acceptResearch,
  MAX_RUN_MS,
  planRun,
  STEP_ORDER,
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
      action: { kind: "finish", status: "draft_failed", reason: "Bước Kiểm tra curriculum chưa được triển khai." },
    });
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

describe("studio acceptance", () => {
  const research = {
    status: "ready",
    topics: [{ topic: "ownership", source_ids: ["s1", "s2"], key_points: [{ point: "p", source_ids: ["s1"] }] }],
    sources: [
      { source_id: "s1", authority: "official", access: "read" },
      { source_id: "s2", authority: "supplementary", access: "read" },
      { source_id: "s3", authority: "official", access: "unreachable" },
    ],
    open_questions: [],
  };
  const topic = (over: object) => ({ ...research, topics: [{ ...research.topics[0], ...over }] });

  it("accepts research whose topics rest on a read official source and cited key points", () => {
    expect(acceptResearch(research)).toEqual({ ok: true, summary: "1 chủ đề, 1 ý chính, 2 nguồn đã đọc." });
  });

  it("rejects unknown or unread sources, community-only topics and uncited key points", () => {
    expect(acceptResearch(topic({ source_ids: ["s9"] })).ok).toBe(false);
    expect(acceptResearch(topic({ source_ids: ["s1", "s3"] })).ok).toBe(false);
    expect(acceptResearch(topic({ source_ids: ["s2"], key_points: [{ point: "p", source_ids: ["s2"] }] })))
      .toEqual({ ok: false, reason: "Research chưa đạt: ownership: không có nguồn chính thức" });
    expect(acceptResearch(topic({ key_points: [] })).ok).toBe(false);
    expect(acceptResearch(topic({ key_points: [{ point: "p", source_ids: [] }] })).ok).toBe(false);
    expect(acceptResearch({ ...research, status: "needs_research", open_questions: [{ question: "q", blocking: true }] }))
      .toEqual({ ok: false, reason: "Thiếu bằng chứng: q" });
  });

  const curriculum = {
    status: "draft",
    missing: [],
    outcomes: [{ id: "o1", check_lesson_ids: ["l2"] }],
    modules: [{
      id: "m1",
      lessons: [
        { id: "l1", outcome_ids: ["o1"], source_ids: ["s1"] },
        { id: "l2", outcome_ids: ["o1"], source_ids: ["s1"] },
      ],
    }],
  };

  it("accepts a curriculum whose outcomes are checked and lessons cite research sources", () => {
    expect(acceptCurriculum(curriculum, new Set(["s1"])).ok).toBe(true);
  });

  it("rejects unknown sources, unchecked outcomes and duplicate ids", () => {
    expect(acceptCurriculum(curriculum, new Set(["s2"])).ok).toBe(false);
    expect(acceptCurriculum({ ...curriculum, outcomes: [{ id: "o1", check_lesson_ids: [] }] }, new Set(["s1"])).ok).toBe(false);
    const dup = { ...curriculum, modules: [{ id: "l1", lessons: curriculum.modules[0].lessons }] };
    expect(acceptCurriculum(dup, new Set(["s1"])).ok).toBe(false);
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

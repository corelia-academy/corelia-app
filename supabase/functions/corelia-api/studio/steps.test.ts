import { describe, expect, it } from "vitest";

import { readResponse } from "./openai.ts";
import { PROMPTS } from "./prompts.ts";
import {
  acceptCurriculum,
  acceptCurriculumReview,
  buildProgress,
  MAX_RESEARCH_REQUESTS,
  researchGap,
  researchRequest,
  curriculumRevision,
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

  it("runs every step: the model steps by their spec, the code steps by the runtime", () => {
    for (const step of STEP_ORDER) {
      const done = STEP_ORDER.slice(0, STEP_ORDER.indexOf(step));
      const { action } = planRun({ steps: steps(done), latest: null, startedAt, now, lessons: { ids: [], rows: [], blocking: {} } });
      expect(action.kind, step).not.toBe("finish");
    }
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

describe("studio curriculum review loop", () => {
  const issue = (location: string, severity: string) => ({ location, problem: `lỗi ${location}`, principle: "p", fix: "f", severity });
  const review = (verdict: string, issues: ReturnType<typeof issue>[] = [], needs_research: string[] = []) => ({
    verdict,
    issues,
    needs_research,
    summary: "s",
  });
  const lesson = (id: string) => ({ id, type: "article", purpose: "explanation" });
  const curriculum = {
    outcomes: [{ id: "o1" }],
    modules: [{ id: "m1", lessons: [lesson("l1"), lesson("l2")] }],
  };

  // Steps as the handler leaves them: curriculum done and review active after a review was accepted.
  const afterReview = steps(["brief", "research", "curriculum"], "active");
  const progress = (reviews: number, curricula: number, blocking: string[] | null, firstAttempt = 0) => ({ firstAttempt, curricula, reviews, blocking });

  it("passes a review with no blocking item and one with only minor issues", () => {
    for (const out of [review("pass"), review("pass", [issue("l1", "minor")])]) {
      const p = buildProgress([{ step_key: "curriculum", attempt: 0, status: "completed" }, { step_key: "curriculum_review", attempt: 0, status: "completed" }], "curriculum_review", out);
      expect(planRun({ steps: afterReview, latest: gen({ status: "completed", attempt: 0 }), startedAt, now, progress: p }).action)
        .toEqual({ kind: "mark_done", generationId: "g1" });
    }
  });

  it("reopens the curriculum when the first review has blocking items", () => {
    const blocking = ["l1: lỗi l1", "thiếu nguồn: borrow checker"];
    expect(planRun({ steps: afterReview, latest: gen({ status: "completed" }), startedAt, now, progress: progress(1, 1, blocking) }).action)
      .toEqual({ kind: "reopen", round: 1, blocking: 2 });
  });

  it("writes the revision after the reopen, then reviews it as a new attempt", () => {
    const reopened = steps(["brief", "research"], "active");
    expect(planRun({ steps: reopened, latest: gen({ status: "completed", attempt: 0 }), startedAt, now, progress: progress(1, 1, null) }))
      .toEqual({ step: "curriculum", action: { kind: "submit", attempt: 1, parentId: "g1" } });
    const revised = steps(["brief", "research", "curriculum"]);
    expect(planRun({ steps: revised, latest: gen({ status: "completed", attempt: 0 }), startedAt, now, progress: progress(1, 2, [], 1) }))
      .toEqual({ step: "curriculum_review", action: { kind: "submit", attempt: 1, parentId: null } });
  });

  it("ends the run when the second review still has blocking items", () => {
    const action = planRun({ steps: afterReview, latest: gen({ status: "completed", attempt: 1 }), startedAt, now, progress: progress(2, 2, ["l2: lỗi l2"], 2) }).action;
    expect(action).toEqual({
      kind: "finish",
      status: "draft_failed",
      reason: "Bước Kiểm tra curriculum: còn lỗi blocking sau 2 vòng: l2: lỗi l2",
    });
  });

  it("counts the retry budget per round, not across reopens", () => {
    const reopened = steps(["brief", "research"], "active");
    // Curriculum attempt 0 accepted, revision attempt 1 rejected: one more try in this round.
    expect(planRun({ steps: reopened, latest: gen({ status: "failed", attempt: 1, error: "x" }), startedAt, now, progress: progress(1, 1, null, 1) }).action)
      .toEqual({ kind: "submit", attempt: 2, parentId: "g1" });
    expect(planRun({ steps: reopened, latest: gen({ status: "failed", attempt: 2, error: "x" }), startedAt, now, progress: progress(1, 1, null, 1) }).action.kind)
      .toBe("finish");
  });

  it("derives the loop state from accepted generations only", () => {
    const rows = [
      { step_key: "curriculum", attempt: 0, status: "completed", provider_request_id: "r0" },
      { step_key: "curriculum_review", attempt: 0, status: "completed", provider_request_id: "r1" },
      { step_key: "curriculum", attempt: 1, status: "failed", provider_request_id: "r2" },
      { step_key: "curriculum", attempt: 2, status: "completed", provider_request_id: "r3" },
      // After the accepted attempt 2: one rejected answer and one request that never reached the provider.
      { step_key: "curriculum", attempt: 3, status: "failed", provider_request_id: "r4" },
      { step_key: "curriculum", attempt: 4, status: "failed", provider_request_id: null },
    ];
    expect(buildProgress(rows, "curriculum", null)).toEqual({
      firstAttempt: 3,
      curricula: 2,
      reviews: 1,
      blocking: null,
      failures: { model: 1, transport: 1 },
      researches: 0,
      researchRequests: 0,
      missing: null,
    });
    expect(buildProgress(rows, "curriculum_review", review("needs_fix", [issue("l1", "blocking")]))).toMatchObject({ firstAttempt: 1, blocking: ["l1: lỗi l1"] });
  });

  it("gives A3 the review only while the curriculum waits for its revision", () => {
    const bad = review("needs_fix", [issue("l1", "blocking"), issue("l2", "minor")], ["tokio"]);
    expect(curriculumRevision({ curricula: 1, reviews: 1 }, bad)).toEqual({ round: 1, issues: bad.issues, needs_research: ["tokio"] });
    expect(curriculumRevision({ curricula: 2, reviews: 1 }, bad)).toBeNull();
    expect(curriculumRevision({ curricula: 1, reviews: 1 }, review("pass", [issue("l1", "minor")]))).toBeNull();
    expect(curriculumRevision({ curricula: 1, reviews: 0 }, null)).toBeNull();
    const ctx = { course: { title: "t", level: null }, paths: [], scopes: [], outputs: { curriculum }, today: "2026-10-20" };
    const input = STEP_SPECS.curriculum!.buildInput({ ...ctx, revision: { round: 1, issues: bad.issues, needs_research: ["tokio"] } });
    expect(input).toMatchObject({ previous_curriculum: curriculum, review: { round: 1 } });
    expect(STEP_SPECS.curriculum!.buildInput({ ...ctx, revision: null })).not.toHaveProperty("review");
  });

  it("accepts consistent verdicts and rejects contradictions or unknown locations", () => {
    expect(acceptCurriculumReview(review("pass", [issue("l1", "minor")]), curriculum))
      .toEqual({ ok: true, summary: "pass, 0 lỗi blocking, 1 minor." });
    expect(acceptCurriculumReview(review("needs_fix", [issue("o1", "blocking")], ["x"]), curriculum))
      .toEqual({ ok: true, summary: "needs_fix, 2 lỗi blocking, 0 minor." });
    expect(acceptCurriculumReview(review("needs_fix", [], ["x"]), curriculum).ok).toBe(true);
    for (const bad of [
      review("pass", [issue("l1", "blocking")]),
      review("pass", [], ["x"]),
      review("needs_fix", [issue("l1", "minor")]),
      review("needs_fix"),
      review("pass", [issue("l9", "minor")]),
    ]) {
      expect(acceptCurriculumReview(bad, curriculum).ok).toBe(false);
    }
  });
});

describe("studio curriculum asks for more research", () => {
  const askRow = (attempt: number, outcome: string | null = "needs_research") => ({ step_key: "curriculum", attempt, status: "completed", provider_request_id: `r${attempt}`, outcome });
  const researchRow = (attempt: number) => ({ step_key: "research", attempt, status: "completed", provider_request_id: `q${attempt}`, outcome: "ready" });
  const progress = (over: object) => ({ firstAttempt: 1, curricula: 0, reviews: 0, blocking: null, researches: 1, researchRequests: 1, missing: ["mẫu on-chain"], ...over });
  const plan = (done: StepKey[], latest: GenerationState | null, p: object) => planRun({ steps: steps(done, "active"), latest, startedAt, now, progress: progress(p) });

  it("treats needs_research with a missing list as an outcome, not a rejection", () => {
    expect(acceptCurriculum({ status: "needs_research", missing: ["a", "b"] }, new Set())).toEqual({ ok: true, summary: "cần thêm nghiên cứu: a; b" });
    expect(acceptCurriculum({ status: "needs_research", missing: [] }, new Set()).ok).toBe(false);
    expect(researchRequest({ status: "needs_research", missing: ["a"] })).toEqual(["a"]);
    expect(researchRequest({ status: "draft", missing: [] })).toBeNull();
  });

  it("counts requests apart from curricula, and ends a round at the request", () => {
    const rows = [researchRow(0), askRow(0), askRow(1, "draft"), { ...askRow(2, "draft"), status: "failed" }];
    expect(buildProgress(rows, "curriculum", null)).toMatchObject({ curricula: 1, researchRequests: 1, researches: 1, firstAttempt: 2 });
    expect(buildProgress([askRow(0)], "curriculum", null, { status: "needs_research", missing: ["x"] })).toMatchObject({ missing: ["x"] });
  });

  it("reopens the research on the first request, then writes the curriculum again once it is redone", () => {
    const asked = gen({ status: "completed", attempt: 0, agent_role: "A3" });
    // curriculum asked: reopen research
    expect(plan(["brief", "research"], asked, {}).action).toEqual({ kind: "reopen_research", round: 1, missing: ["mẫu on-chain"] });
    // research reopened: A2 runs again as a new attempt, keeping the old brief as its parent
    const brief = gen({ status: "completed", attempt: 0, agent_role: "A2" });
    expect(plan(["brief"], brief, { missing: null })).toEqual({ step: "research", action: { kind: "submit", attempt: 1, parentId: "g1" } });
    // research redone: the step is done
    const redone = gen({ status: "completed", attempt: 1, agent_role: "A2" });
    expect(plan(["brief"], redone, { researches: 2, missing: null }).action).toEqual({ kind: "mark_done", generationId: "g1" });
    // back at the curriculum: the old request does not count as done, a new attempt is written
    expect(plan(["brief", "research"], asked, { researches: 2 }).action).toEqual({ kind: "submit", attempt: 1, parentId: null });
  });

  it("fails the run when the curriculum asks a second time, listing what is missing", () => {
    expect(MAX_RESEARCH_REQUESTS).toBe(2);
    const asked = gen({ status: "completed", attempt: 1, agent_role: "A3" });
    expect(plan(["brief", "research"], asked, { researchRequests: 2, researches: 2, missing: ["mẫu on-chain", "kiểm tra đầu vào"] }).action).toEqual({
      kind: "finish",
      status: "draft_failed",
      reason: "Bước Curriculum: vẫn cần thêm nghiên cứu sau 2 vòng: mẫu on-chain; kiểm tra đầu vào",
    });
  });

  it("keeps the retry budget of each round: a rejected answer after the request does not use up the next round", () => {
    const rows = [researchRow(0), askRow(0), { ...askRow(1, "draft"), status: "failed" }];
    const p = buildProgress(rows, "curriculum", null);
    const failed = gen({ status: "failed", attempt: 1, error: "x", provider_request_id: "r1", agent_role: "A3" });
    expect(planRun({ steps: steps(["brief", "research"], "active"), latest: failed, startedAt, now, progress: p }).action).toEqual({ kind: "submit", attempt: 2, parentId: "g1" });
    const failedTwice = buildProgress([...rows, { ...askRow(2, "draft"), status: "failed" }], "curriculum", null);
    expect(planRun({ steps: steps(["brief", "research"], "active"), latest: { ...failed, attempt: 2 }, startedAt, now, progress: failedTwice }).action.kind).toBe("finish");
  });

  it("tells A2 what to add only while the research has not been redone", () => {
    const ask = { status: "needs_research", missing: ["a"] };
    expect(researchGap({ researches: 1, requests: 1 }, ask)).toEqual({ round: 1, missing: ["a"], requested_by: "curriculum" });
    expect(researchGap({ researches: 2, requests: 1 }, ask)).toBeNull();
    expect(researchGap({ researches: 1, requests: 0 }, null)).toBeNull();
    const ctx = { course: { title: "t", level: null }, paths: [], scopes: [], outputs: { brief: { b: 1 }, research: { r: 1 } }, today: "2026-10-22", revision: null };
    const input = STEP_SPECS.research!.buildInput({ ...ctx, researchGap: { round: 1, missing: ["a"], requested_by: "curriculum" } });
    expect(input).toMatchObject({ research_gap: { round: 1, missing: ["a"], requested_by: "curriculum" }, previous_research: { r: 1 } });
    expect(STEP_SPECS.research!.buildInput(ctx)).not.toHaveProperty("research_gap");
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
    outcome_ids: ["o1"],
    prerequisite_lesson_ids: [] as string[],
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
          lesson("d1", { type: "practice", purpose: "diagnostic", outcome_ids: [] }),
          lesson("l1", { prerequisite_lesson_ids: ["d1"] }),
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
    expect(acceptCurriculum(curriculum, sources)).toEqual({ ok: true, summary: "2 module, 6 lesson, 2 outcome." });
  });

  it("makes the diagnostic a self-check practice without a threshold, and orders prerequisites", () => {
    const [m1, m2] = curriculum.modules;
    const [d1, l1, q1] = m1.lessons;
    const first = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(first({ ...d1, type: "article" }, l1, q1))).toContain("lesson d1 (diagnostic) phải là practice");
    expect(reason(first({ ...d1, pass_threshold: 60 }, l1, q1))).toContain("lesson d1 không phải quiz nhưng có ngưỡng pass");
    expect(reason(first({ ...d1, outcome_ids: ["o9"] }, l1, q1))).toContain("lesson d1 có outcome không hợp lệ");
    expect(reason(first(d1, lesson("l1", { prerequisite_lesson_ids: ["q1"] }), q1))).toContain("lesson l1: prerequisite q1 đứng sau");
    expect(reason(first(d1, lesson("l1", { prerequisite_lesson_ids: ["ghost"] }), q1))).toContain("prerequisite_lesson_ids không hợp lệ (ghost)");
    expect(reason(first(d1, lesson("l1", { prerequisite_lesson_ids: ["l1"] }), q1))).toContain("không hợp lệ (l1)");
  });

  it("rejects unknown sources, unchecked outcomes and duplicate ids", () => {
    expect(acceptCurriculum(curriculum, new Set(["s2"])).ok).toBe(false);
    expect(acceptCurriculum({ ...curriculum, outcomes: [{ id: "o1", check_lesson_ids: [] }, curriculum.outcomes[1]] }, sources).ok).toBe(false);
    const dup = withModules([{ ...curriculum.modules[0], id: "l1" }, curriculum.modules[1]]);
    expect(acceptCurriculum(dup, sources).ok).toBe(false);
  });

  it("requires quiz thresholds and review lessons, and no threshold elsewhere", () => {
    const [m1, m2] = curriculum.modules;
    const [d1, l1, q1] = m1.lessons;
    const first = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(first(d1, l1, quiz("q1", { pass_threshold: null })))).toContain("quiz q1 thiếu ngưỡng pass");
    expect(reason(first(d1, l1, quiz("q1", { review_lesson_ids: [] })))).toContain("quiz q1 không có lesson để ôn khi sai");
    expect(reason(first(d1, lesson("l1", { pass_threshold: 70 }), q1))).toContain("lesson l1 không phải quiz nhưng có ngưỡng pass");
  });

  it("requires a diagnostic start, a covering final check and retrieval of an earlier module", () => {
    const [m1, m2] = curriculum.modules;
    expect(reason(withModules([{ ...m1, lessons: m1.lessons.slice(1) }, m2]))).toContain("module đầu không có lesson chẩn đoán");
    expect(reason(withModules([m1, { ...m2, lessons: m2.lessons.slice(0, 2) }]))).toContain("module cuối không có quiz tổng hợp");
    expect(reason(withModules([m1, { ...m2, lessons: [m2.lessons[0], m2.lessons[1], quiz("q9", { purpose: "final_check" })] }])))
      .toContain("chưa phủ outcome");
    expect(reason(withModules([m1, { ...m2, lessons: [m2.lessons[0], m2.lessons[2]] }]))).toContain("không có lesson ôn lại outcome");
  });

  it("lets code_exercise and practice final checks cover outcomes the summary quiz cannot check", () => {
    const [m1, m2] = curriculum.modules;
    const finals = [
      quiz("q9", { purpose: "final_check", outcome_ids: ["o2"], review_lesson_ids: ["l2"] }),
      lesson("c9", { type: "code_exercise", purpose: "final_check", outcome_ids: ["o1"] }),
    ];
    const outcomes = [{ id: "o1", check_lesson_ids: ["q1", "c9"] }, curriculum.outcomes[1]];
    expect(acceptCurriculum({ ...curriculum, outcomes, modules: [m1, { ...m2, lessons: [m2.lessons[0], m2.lessons[1], ...finals] }] }, sources).ok)
      .toBe(true);
    // Without the summary quiz the final check is incomplete even when the other lessons cover everything.
    const noQuiz = [lesson("c9", { type: "code_exercise", purpose: "final_check", outcome_ids: ["o1", "o2"] })];
    expect(reason({ ...curriculum, outcomes, modules: [m1, { ...m2, lessons: [m2.lessons[0], m2.lessons[1], ...noQuiz] }] }))
      .toContain("module cuối không có quiz tổng hợp");
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
    })).toEqual({ state: "completed", model: "gpt-6-luna", text: "{}", usage: { total_tokens: 3, web_search_calls: 1 } });
    // Running out of output budget is a verdict on the model's answer: a rejected attempt.
    expect(readResponse({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }))
      .toEqual({ state: "failed", cause: "rejected", error: "incomplete: max_output_tokens" });
    // Tokens spent on an unfinished response are still billed, so usage and model are kept.
    expect(readResponse({
      status: "incomplete",
      model: "gpt-6-luna",
      usage: { total_tokens: 9 },
      incomplete_details: { reason: "max_output_tokens" },
    })).toEqual({ state: "failed", cause: "rejected", error: "incomplete: max_output_tokens", model: "gpt-6-luna", usage: { total_tokens: 9, web_search_calls: 0 } });
    // A request the provider failed after accepting it says nothing about the model's answer.
    expect(readResponse({ status: "failed", model: "gpt-6-luna", usage: { total_tokens: 2 }, error: { message: "boom" } }))
      .toEqual({ state: "failed", cause: "provider", error: "failed: boom", model: "gpt-6-luna", usage: { total_tokens: 2, web_search_calls: 0 } });
    expect(readResponse({ status: "cancelled" })).toMatchObject({ state: "failed", cause: "provider" });
  });
});

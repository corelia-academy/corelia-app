import { describe, expect, it } from "vitest";

import { readResponse } from "./openai.ts";
import { SEEDED_PROMPTS } from "./prompt_seed_test_helper.ts";
import { A4_REVIEW_CRITERIA } from "./review_policy.ts";
import { AI_CURRICULUM_FORMATS, AI_CURRICULUM_FORMAT_GUIDE, PLATFORM_FORMATS, PLATFORM_FORMAT_GUIDE } from "./formats.ts";
import { ENABLED_CODE_LANGUAGES, PREPARED_CODE_LANGUAGES, resolveCodeLanguage } from "./lesson_ports.ts";
import {
  acceptBrief,
  acceptCurriculum,
  acceptCurriculumReview,
  LESSON_PURPOSES,
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
  stepAgent,
  SUBMIT_STALE_MS,
  type GenerationState,
  type StepKey,
  type StepState,
} from "./steps.ts";

const now = Date.parse("2026-10-18T12:00:00Z");
const startedAt = new Date(now - 60_000).toISOString();

function steps(done: StepKey[], current?: StepState): Partial<Record<StepKey, StepState>> {
  const out: Partial<Record<StepKey, StepState>> = {};
  for (const k of STEP_ORDER) out[k] = k === "catalog_research" || done.includes(k) ? "done" : "pending";
  const first = STEP_ORDER.find((k) => out[k] !== "done");
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
  it("waits for the separate A1 job before submitting the first run-owned step", () => {
    const beforeA1 = steps([]);
    beforeA1.catalog_research = "pending";
    expect(planRun({ steps: beforeA1, latest: null, startedAt, now, catalogResearch: { status: "running" } }))
      .toEqual({ step: "catalog_research", action: { kind: "wait" } });
    expect(planRun({ steps: steps([]), latest: null, startedAt, now })).toEqual({
      step: "brief",
      action: { kind: "submit", attempt: 0, parentId: null },
    });
  });

  it.each(["evidence_ok", "needs_more_sources"] as const)("treats the successful A1 status %s as step 0 done", (status) => {
    const beforeA1 = steps([]);
    beforeA1.catalog_research = "pending";
    expect(planRun({ steps: beforeA1, latest: null, startedAt, now, catalogResearch: { status } }))
      .toEqual({ step: "catalog_research", action: { kind: "mark_done" } });
  });

  it("fails the run when the pinned A1 job failed infrastructure", () => {
    const beforeA1 = steps([]);
    beforeA1.catalog_research = "pending";
    expect(planRun({ steps: beforeA1, latest: null, startedAt, now, catalogResearch: { status: "failed", reason: "provider unavailable" } }).action)
      .toEqual({ kind: "finish", status: "draft_failed", reason: "Bước Nghiên cứu Catalog thất bại: provider unavailable" });
  });

  it("skips step 0 on a run created before the column was introduced", () => {
    const legacy = steps(["brief"]);
    delete legacy.catalog_research;
    expect(planRun({ steps: legacy, latest: gen({}), startedAt, now })).toMatchObject({ step: "research" });
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
      const inputSteps = steps(done);
      if (step === "catalog_research") inputSteps.catalog_research = "pending";
      const { action } = planRun({ steps: inputSteps, latest: null, startedAt, now, catalogResearch: { status: "running" }, lessons: { ids: [], rows: [], blocking: {} } });
      expect(action.kind, step).not.toBe("finish");
    }
  });

  it("ends a run older than the time limit", () => {
    const old = new Date(now - MAX_RUN_MS - 1).toISOString();
    expect(planRun({ steps: steps([]), latest: null, startedAt: old, now }).action)
      .toEqual({ kind: "finish", status: "draft_failed", reason: "Lượt chạy vượt quá 48 giờ." });
  });

  it("publishes when every step is done", () => {
    expect(planRun({ steps: steps([...STEP_ORDER]), latest: null, startedAt, now }).action.kind).toBe("finish");
  });
});

describe("studio brief code language", () => {
  it("offers only publish-enabled languages plus null in A2's strict output schema and input", () => {
    const schema = STEP_SPECS.brief!.schema as { properties: Record<string, { enum?: unknown[] }> };
    expect(schema.properties.code_language.enum).toEqual([...ENABLED_CODE_LANGUAGES, null]);
    expect(schema.properties.code_language.enum).not.toContain("solidity");
    expect(schema.properties.code_language.enum).not.toContain("move");

    const input = STEP_SPECS.brief!.buildInput({ course: { title: "Solana", level: "beginner" }, paths: [], scopes: [], catalogResearch: null } as never);
    expect(input.code_languages).toEqual(ENABLED_CODE_LANGUAGES);
  });

  it("keeps old briefs on Rust, allows explicit null, and rejects prepared languages for publish", () => {
    expect(acceptBrief({ status: "ready", open_questions: [] })).toEqual({ ok: true, summary: "brief sẵn sàng." });
    expect(resolveCodeLanguage(undefined)).toBe("rust");
    expect(acceptBrief({ status: "ready", open_questions: [], code_language: null }).ok).toBe(true);
    expect(resolveCodeLanguage(null)).toBeNull();
    for (const language of PREPARED_CODE_LANGUAGES) {
      expect(acceptBrief({ status: "ready", open_questions: [], code_language: language }))
        .toMatchObject({ ok: false, reason: expect.stringContaining("chưa hỗ trợ publish") });
    }
    expect(acceptBrief({ status: "ready", open_questions: [], code_language: "cobol" }))
      .toMatchObject({ ok: false, reason: expect.stringContaining("chưa hỗ trợ publish") });
  });

  it("normalizes a saved brief without code_language to Rust for A3 and A4", () => {
    for (const step of ["curriculum", "curriculum_review"] as const) {
      const input = STEP_SPECS[step]!.buildInput({ outputs: { brief: { locale: "vi" }, research: {}, curriculum: {} }, revision: null } as never) as Record<string, any>;
      expect(input.brief.code_language).toBe("rust");
    }
  });
});

describe("studio curriculum review loop", () => {
  const issue = (location: string, severity: string) => ({
    location,
    problem: `lỗi ${location}`,
    category: severity === "blocking" ? "wrong_answer" : "style_or_wording",
    principle: "p",
    fix: "f",
    severity,
  });
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

  it("recomputes verdicts from the allow-list and still rejects unknown locations", () => {
    expect(acceptCurriculumReview(review("pass", [issue("l1", "minor")]), curriculum))
      .toMatchObject({ ok: true, summary: "pass, 0 lỗi blocking, 1 minor.", normalizedOutput: { verdict: "pass" } });
    expect(acceptCurriculumReview(review("pass", [issue("o1", "blocking")], ["x"]), curriculum))
      .toMatchObject({ ok: true, summary: "needs_fix, 2 lỗi blocking, 0 minor.", normalizedOutput: { verdict: "needs_fix" } });
    expect(acceptCurriculumReview(review("needs_fix", [], ["x"]), curriculum))
      .toMatchObject({ ok: true, summary: "needs_fix, 1 lỗi blocking, 0 minor.", normalizedOutput: { verdict: "needs_fix" } });
    expect(acceptCurriculumReview(review("needs_fix"), curriculum))
      .toMatchObject({ ok: true, summary: "pass, 0 lỗi blocking, 0 minor.", normalizedOutput: { verdict: "pass" } });

    const outsideAllowList = { ...issue("m1", "blocking"), category: "missing_practice" };
    expect(acceptCurriculumReview(review("needs_fix", [outsideAllowList]), curriculum))
      .toMatchObject({ ok: true, summary: expect.stringContaining("pass, 0 lỗi blocking, 1 minor."), normalizedOutput: { verdict: "pass", issues: [{ severity: "minor", category: "missing_practice" }] } });

    const { category: _category, ...legacyIssue } = issue("l1", "blocking");
    expect(acceptCurriculumReview(review("needs_fix", [legacyIssue]), curriculum))
      .toMatchObject({ ok: true, summary: expect.stringContaining("pass, 0 lỗi blocking, 1 minor"), normalizedOutput: { verdict: "pass", issues: [{ severity: "minor", category: "other" }] } });

    expect(acceptCurriculumReview(review("pass", [issue("l9", "minor")]), curriculum).ok).toBe(false);
  });

  it("normalizes A4 check evidence without changing the issue-derived verdict", () => {
    const blocking = { ...issue("l1", "blocking"), criterion: "prerequisites" };
    const checks = [
      { criterion: "outcome_activity_assessment_alignment", result: "ok", basis: "Matched activity and assessment", refs: ["l1"] },
      { criterion: "practice_and_feedback", result: "ok", basis: "Checked feedback", refs: ["missing"] },
      { criterion: "prerequisites", result: "ok", basis: "Checked order", refs: ["l1"] },
      { criterion: "review_and_application", result: "issue", basis: "Claim without issue", refs: ["l1"] },
      { result: "ok", basis: "Missing criterion", refs: ["l1"] },
    ];
    const withChecks = acceptCurriculumReview({ ...review("pass", [blocking]), checks }, curriculum);
    const withoutChecks = acceptCurriculumReview(review("pass", [blocking]), curriculum);
    expect(withChecks).toMatchObject({ ok: true, summary: "needs_fix, 1 lỗi blocking, 0 minor." });
    expect(withChecks).toMatchObject({ normalizedOutput: { verdict: "needs_fix" } });
    const normalized = (withChecks as { normalizedOutput: { checks: { criterion: string; result: string; basis: string; refs: string[] }[] } }).normalizedOutput.checks;
    expect(normalized.find((check) => check.criterion === "outcome_activity_assessment_alignment")).toMatchObject({ result: "ok" });
    expect(normalized.find((check) => check.criterion === "practice_and_feedback")).toMatchObject({ result: "unverified", refs: [] });
    expect(normalized.find((check) => check.criterion === "prerequisites")).toMatchObject({ result: "issue" });
    expect(normalized.find((check) => check.criterion === "review_and_application")).toMatchObject({ result: "unverified" });
    expect(normalized.find((check) => check.criterion === "sources_by_topic")).toMatchObject({ result: "unverified", basis: "không được báo cáo" });
    expect(normalized).toHaveLength(A4_REVIEW_CRITERIA.length);
    expect((withoutChecks as { normalizedOutput: { verdict: string } }).normalizedOutput.verdict).toBe(
      (withChecks as { normalizedOutput: { verdict: string } }).normalizedOutput.verdict,
    );
  });

  it("does not require practice beyond the diagnostic and passes an A4 complaint about missing practice", () => {
    const noOptionalPractice = curriculum;
    const missingPractice = { ...issue("m1", "blocking"), category: "missing_practice" };
    expect(acceptCurriculumReview(review("needs_fix", [missingPractice]), noOptionalPractice))
      .toMatchObject({ ok: true, summary: expect.stringContaining("pass, 0 lỗi blocking, 1 minor."), normalizedOutput: { verdict: "pass" } });
  });

  it("puts curriculum purpose in A4 input and requires review issue categories in its schema", () => {
    const optional = { ...lesson("oh"), purpose: "optional_hands_on", type: "practice" };
    const input = STEP_SPECS.curriculum_review!.buildInput({ outputs: { curriculum: { ...curriculum, modules: [{ id: "m1", lessons: [optional] }] } } } as never) as Record<string, any>;
    expect(input.curriculum.modules[0].lessons[0].purpose).toBe("optional_hands_on");
    const schema = STEP_SPECS.curriculum_review!.schema as any;
    expect(schema.properties.issues.items.properties.category.enum).toContain("optional_made_mandatory");
    expect(schema.properties.issues.items.properties.criterion.enum).toEqual([...A4_REVIEW_CRITERIA]);
    expect(schema.properties.checks.items.properties.criterion.enum).toEqual([...A4_REVIEW_CRITERIA]);
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

  it("passes the accepted stack_choice unchanged to A3", () => {
    const stack_choice = { tools: [{ tool_type: "package_manager", selected: "pnpm", source_ids: ["s1"] }] };
    const input = STEP_SPECS.curriculum!.buildInput({
      course: { title: "t", level: null },
      paths: [],
      scopes: [],
      outputs: { brief: { b: 1 }, research: { stack_choice } },
      today: "2026-10-22",
    });
    expect((input.research_brief as Record<string, unknown>).stack_choice).toBe(stack_choice);
  });
});

describe("studio step owners", () => {
  it("runs each implemented step with the prompt of the agent that owns it", () => {
    for (const [step, spec] of Object.entries(STEP_SPECS)) {
      expect(SEEDED_PROMPTS[spec!.prompt].role).toBe(STEP_OWNER[step as StepKey]);
      expect(stepAgent(step as StepKey)).toMatchObject({ role: STEP_OWNER[step as StepKey], promptKey: spec!.prompt });
      expect(spec!.maxOutputTokens).toBeGreaterThan(0);
    }
  });

  it("places the six agents and keeps code steps without an agent", () => {
    expect(STEP_ORDER.map((k) => STEP_OWNER[k])).toEqual(["catalog_job", "A2", "A2", "A3", "A4", "A5", "A6", "code", "code", "code"]);
    expect(agentKeyEnv("A1")).toBe("CORELIA_STUDIO_A1_CATALOG_RESEARCH_OPENAI_API_KEY");
    expect(agentKeyEnv("A4")).toBe("CORELIA_STUDIO_A4_CURRICULUM_REVIEW_OPENAI_API_KEY");
  });
});

describe("A2 research prompt", () => {
  it("uses v13, records the course stack decision, and does not block research on unverified package versions", () => {
    const prompt = SEEDED_PROMPTS["a2-research"];
    expect(prompt.version).toBe("v13");
    expect(prompt.system).toContain("needs_research CHỈ khi một chủ đề cốt lõi trong phạm vi của brief");
    expect(prompt.system).toContain("KHÔNG phải lý do needs_research");
    expect(prompt.system).toContain("trả status: ready");
    expect(prompt.system).toContain("open_questions với blocking = false");
    expect(prompt.system).toContain("blocking = false chỉ có nghĩa khi status = ready");
    expect(prompt.system).toContain("không dùng needs_research cho phiên bản gói");
    expect(prompt.system).toContain("cài đặt/cấu hình công cụ chạy ngoài Corelia không phải chủ đề cốt lõi");
    expect(prompt.system).toContain("Cài đặt/cấu hình công cụ chạy ngoài Corelia không bắt buộc có nguồn");
    expect(prompt.system).not.toContain("trả needs_research; nêu tên công cụ");
    expect(prompt.system).not.toContain("gap cốt lõi");
    expect(prompt.system).toContain("chỉ dùng source_id có trong sources của chính bản này với access = read");
    expect(prompt.system).toContain("dùng basis = context_rule với source_ids []");
    expect(prompt.system).toContain("stack_choice là quyết định stack duy nhất cho toàn khóa");
    expect(prompt.system).toContain("basis = source_recommended");
    expect(prompt.system).toContain("basis = context_rule");
    expect(prompt.system).toContain("Không dùng needs_research chỉ vì nguồn không khuyến nghị một lựa chọn stack");
    expect(prompt.system).toContain("Nếu không có công cụ nào như vậy, trả stack_choice.tools = []");
    expect(prompt.system).toContain("có từ hai phương án trở lên để chọn");
    expect(prompt.system).toContain("công cụ không có phương án thay thế hoặc nằm ngoài phạm vi khóa không cần mục");
    const schema = STEP_SPECS.research!.schema as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required).toContain("stack_choice");
    expect(schema.properties).toHaveProperty("stack_choice");
    expect(schema.required).toContain("videos");
    expect(schema.properties).toHaveProperty("videos");
    expect(prompt.system).toContain("videos là mảng có thể rỗng");
    expect(prompt.system).toContain("Với mỗi topic, chủ động tìm video YouTube");
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
    videos: [],
    stack_choice: {
      tools: [{
        tool_type: "package_manager",
        selected: "pnpm",
        alternatives_considered: ["npm", "yarn"],
        basis: "source_recommended",
        reason: "Nguồn chính thức đã đọc khuyến nghị pnpm.",
        source_ids: ["s1"],
      }],
    },
    misconceptions: [{ topic: "ownership", source_ids: ["s1"] }],
    open_questions: [],
  };
  const topic = (over: object) => ({ ...research, topics: [{ ...research.topics[0], ...over }] });

  it("accepts research whose topics, prerequisites and misconceptions rest on sources read on the run date", () => {
    expect(acceptResearch(research, today)).toEqual({ ok: true, summary: "1 chủ đề, 1 ý chính, 1 lỗi hiểu sai, 2 nguồn đã đọc." });
  });

  it("accepts evidence-backed video candidates and treats legacy missing videos as an empty list", () => {
    const candidate = {
      topic: "ownership",
      url: "https://youtu.be/aaaaaaaaaaa",
      title: "Giải thích ownership",
      channel: "Rust Education",
      channel_basis: "Trang giới thiệu kênh đã đọc mô tả nội dung giáo dục Rust.",
      evidence_source_ids: ["s1"],
    };
    expect(acceptResearch({ ...research, videos: [candidate] }, today).ok).toBe(true);
    expect(acceptResearch({
      ...research,
      videos: [{ ...candidate, evidence_source_ids: ["s2"] }],
    }, today).ok).toBe(true);
    const { videos: _videos, ...legacy } = research;
    expect(acceptResearch(legacy, today).ok).toBe(true);
    expect(acceptResearch({
      ...research,
      topics: research.topics.map((topic) => ({ ...topic, topic: ` ${topic.topic} ` })),
      videos: [{ ...candidate, topic: ` ${candidate.topic} ` }],
    }, today).ok).toBe(true);
  });

  it("rejects video candidates without read evidence, a parsed URL, a unique ID and a research topic", () => {
    const candidate = {
      topic: "ownership",
      url: "https://youtu.be/aaaaaaaaaaa",
      title: "Giải thích ownership",
      channel: "Rust Education",
      channel_basis: "Trang giới thiệu kênh đã đọc mô tả nội dung giáo dục Rust.",
      evidence_source_ids: ["s1"],
    };
    expect(acceptResearch({ ...research, videos: [{ ...candidate, evidence_source_ids: [] }] }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("evidence_source_ids phải có ít nhất một ID nguồn đã đọc") });
    expect(acceptResearch({ ...research, videos: [{ ...candidate, evidence_source_ids: ["s3"] }] }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("evidence_source_ids phải trỏ tới nguồn access = read") });
    expect(acceptResearch({ ...research, videos: [{ ...candidate, url: "https://example.com/video" }] }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("url không phải link YouTube hợp lệ") });
    expect(acceptResearch({ ...research, videos: [candidate, { ...candidate, url: "https://youtube.com/watch?v=aaaaaaaaaaa" }] }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("trùng video ID") });
    expect(acceptResearch({ ...research, videos: [{ ...candidate, topic: "not in research" }] }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("topic không có trong research") });
  });

  it("accepts ready research with no stack tools to choose", () => {
    expect(acceptResearch({ ...research, stack_choice: { tools: [] } }, today))
      .toEqual({ ok: true, summary: "1 chủ đề, 1 ý chính, 1 lỗi hiểu sai, 2 nguồn đã đọc." });
  });

  it("accepts a context_rule choice with a reason and no invented source IDs", () => {
    const contextual = {
      ...research,
      stack_choice: {
        tools: [{
          ...research.stack_choice.tools[0],
          basis: "context_rule",
          reason: "Khóa nhập môn: phù hợp môi trường đã cài và cần ít bước thêm.",
          source_ids: [],
        }],
      },
    };
    expect(acceptResearch(contextual, today).ok).toBe(true);
    expect(acceptResearch({
      ...contextual,
      stack_choice: { tools: [{ ...contextual.stack_choice.tools[0], source_ids: ["not-read"] }] },
    }, today)).toMatchObject({ ok: false, reason: expect.stringContaining("source_ids phải trỏ tới nguồn đã đọc") });
  });

  it("rejects missing stack_choice and invalid recommendation metadata", () => {
    expect(acceptResearch({ ...research, stack_choice: undefined }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("thiếu stack_choice") });
    expect(acceptResearch({ ...research, stack_choice: { tools: "pnpm" } }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("stack_choice.tools phải là danh sách") });
    expect(acceptResearch({
      ...research,
      stack_choice: { tools: [{ ...research.stack_choice.tools[0], basis: "guess" }] },
    }, today)).toMatchObject({ ok: false, reason: expect.stringContaining("basis phải là source_recommended hoặc context_rule") });
    expect(acceptResearch({
      ...research,
      stack_choice: { tools: [{ ...research.stack_choice.tools[0], source_ids: [] }] },
    }, today)).toMatchObject({ ok: false, reason: expect.stringContaining("source_recommended cần source_ids") });
    expect(acceptResearch({
      ...research,
      stack_choice: { tools: [{ ...research.stack_choice.tools[0], source_ids: undefined }] },
    }, today)).toMatchObject({ ok: false, reason: expect.stringContaining("source_ids phải là danh sách ID nguồn") });
    const supplementalRecommendation = {
      ...research,
      sources: research.sources.map((source) => source.source_id === "s2" ? { ...source, checked_at: today } : source),
      stack_choice: { tools: [{ ...research.stack_choice.tools[0], source_ids: ["s2"] }] },
    };
    expect(acceptResearch(supplementalRecommendation, today).ok).toBe(true);
    expect(acceptResearch({
      ...research,
      stack_choice: { tools: [{ ...research.stack_choice.tools[0], alternatives_considered: [] }] },
    }, today)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("alternatives_considered cần ít nhất một phương án thay thế"),
    });
    expect(acceptResearch({
      ...research,
      stack_choice: { tools: [research.stack_choice.tools[0], research.stack_choice.tools[0]] },
    }, today)).toMatchObject({ ok: false, reason: expect.stringContaining("trùng tool_type") });
  });

  it("accepts ready research with an unblocked open question", () => {
    const question = { question: "Phiên bản package chưa xác minh", impact: "Không ảnh hưởng nội dung đã có nguồn", blocking: false, action: "Ghi rõ nguồn không truy cập được" };
    expect(acceptResearch({ ...research, open_questions: [question] }, today))
      .toEqual({ ok: true, summary: "1 chủ đề, 1 ý chính, 1 lỗi hiểu sai, 2 nguồn đã đọc." });
  });

  it("returns the evidence gap for needs_research before validating stack_choice", () => {
    const question = { question: "Phiên bản package chưa xác minh", blocking: false };
    expect(acceptResearch({ ...research, status: "needs_research", stack_choice: undefined, open_questions: [question] }, today))
      .toEqual({ ok: false, reason: "Thiếu bằng chứng: Phiên bản package chưa xác minh" });
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
    expect(acceptCurriculum(curriculum, sources)).toEqual({
      ok: true,
      summary: "2 module, 6 lesson, 2 outcome.",
      codeChecks: [
        { id: "curriculum.lesson_rules", passed: 6, total: 6 },
        { id: "curriculum.outcome_refs", passed: 8, total: 8 },
        { id: "curriculum.source_refs", passed: 6, total: 6 },
        { id: "curriculum.dependencies", passed: 5, total: 5 },
        { id: "curriculum.quiz_rules", passed: 3, total: 3 },
        { id: "curriculum.final_coverage", passed: 2, total: 2 },
      ],
    });
    expect(LESSON_PURPOSES).toContain("optional_hands_on");
    expect(acceptCurriculum(curriculum, sources, null).ok).toBe(true);
    expect(acceptCurriculumReview({
      verdict: "needs_fix",
      issues: [{ location: "m1", problem: "Thiếu lesson thực hành tự nguyện.", category: "missing_practice", principle: "p", fix: "f", severity: "blocking" }],
      needs_research: [],
      summary: "s",
    }, curriculum)).toMatchObject({ ok: true, normalizedOutput: { verdict: "pass", issues: [{ severity: "minor" }] } });
    const withCodeExercise = withModules([
      { ...curriculum.modules[0], lessons: [...curriculum.modules[0].lessons, lesson("code", { type: "code_exercise" })] },
      curriculum.modules[1],
    ]);
    expect(acceptCurriculum(withCodeExercise, sources, null))
      .toMatchObject({ ok: false, reason: expect.stringContaining("brief.code_language = null") });
  });

  it("rejects video lessons in new curricula even when research has a matching candidate", () => {
    const [m1, m2] = curriculum.modules;
    const videoCurriculum = withModules([
      { ...m1, lessons: [m1.lessons[0], { ...m1.lessons[1], type: "video" }, m1.lessons[2]] },
      m2,
    ]);
    expect(acceptCurriculum(videoCurriculum, sources))
      .toMatchObject({ ok: false, reason: expect.stringContaining("type video không còn được hỗ trợ") });
  });

  it("offers no video format to new A3/A4 curricula while preserving the app's original formats", () => {
    expect(PLATFORM_FORMATS).toContain("video");
    expect(PLATFORM_FORMAT_GUIDE).toHaveProperty("video");
    expect(AI_CURRICULUM_FORMATS).not.toContain("video");
    expect(AI_CURRICULUM_FORMAT_GUIDE).not.toHaveProperty("video");

    const schema = STEP_SPECS.curriculum!.schema as any;
    expect(schema.properties.modules.items.properties.lessons.items.properties.type.enum).toEqual([...AI_CURRICULUM_FORMATS]);
    for (const key of ["curriculum", "curriculum_review"] as const) {
      const input = STEP_SPECS[key]!.buildInput({ outputs: { brief: {}, research: {}, curriculum: {} }, revision: null } as never) as Record<string, any>;
      expect(input.platform_formats).not.toHaveProperty("video");
    }
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

  it("accepts a valid optional hands-on leaf and rejects its curriculum violations", () => {
    const [m1, m2] = curriculum.modules;
    const [d1, l1, q1] = m1.lessons;
    const optional = lesson("oh", { type: "practice", purpose: "optional_hands_on", outcome_ids: ["o1"] });
    const withOptional = (...firstLessons: object[]) => withModules([{ ...m1, lessons: firstLessons }, m2]);
    expect(acceptCurriculum(withOptional(d1, l1, q1, optional), sources).ok).toBe(true);

    const secondOptional = lesson("oh2", { type: "practice", purpose: "optional_hands_on", outcome_ids: ["o1"] });
    expect(reason(withOptional(d1, l1, q1, optional, secondOptional))).toContain("có hơn một lesson optional_hands_on");
    expect(reason(withOptional(d1, l1, optional, q1))).toContain("phải ở cuối module");
    expect(reason(withOptional(d1, l1, q1, { ...optional, type: "article" }))).toContain("phải là practice");
    expect(reason(withOptional(d1, l1, q1, { ...optional, pass_threshold: 50 }))).toContain("lesson oh không phải quiz nhưng có ngưỡng pass");
    expect(reason(withOptional(d1, { ...l1, prerequisite_lesson_ids: ["oh"] }, q1, optional)))
      .toContain("không được phụ thuộc vào optional_hands_on oh");

    const listedAsChecker = { ...curriculum, outcomes: [{ ...curriculum.outcomes[0], check_lesson_ids: ["q1", "oh"] }, curriculum.outcomes[1]] };
    expect(reason({ ...listedAsChecker, modules: [{ ...m1, lessons: [d1, l1, q1, optional] }, m2] }))
      .toContain("outcome o1 không có lesson kiểm tra hợp lệ");
    const onlyOptionalChecksOutcome = { ...curriculum, outcomes: [{ ...curriculum.outcomes[0], check_lesson_ids: ["oh"] }, curriculum.outcomes[1]] };
    expect(reason({ ...onlyOptionalChecksOutcome, modules: [{ ...m1, lessons: [d1, l1, q1, optional] }, m2] }))
      .toContain("outcome o1 của lesson oh phải được lesson khác kiểm tra");
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

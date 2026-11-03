import { describe, expect, it } from "vitest";

import { readResponse } from "./openai.ts";
import { SEEDED_PROMPTS } from "./prompt_seed_test_helper.ts";
import { A4_REVIEW_CRITERIA } from "./review_policy.ts";
import { AI_CURRICULUM_FORMATS, AI_CURRICULUM_FORMAT_GUIDE, PLATFORM_FORMATS, PLATFORM_FORMAT_GUIDE } from "./formats.ts";
import { ENABLED_CODE_LANGUAGES, PREPARED_CODE_LANGUAGES, resolveCodeLanguage } from "./lesson_ports.ts";
import { journeyProblems, type LessonRecord } from "./checks.ts";
import { withKnowledge } from "./lesson_fixtures.ts";
import { curriculumStaleReason, recapCarriers, STALE_KNOWLEDGE_MESSAGE } from "./lessons.ts";
import { MIN_QUIZ_QUESTIONS, minQuizQuestions } from "./lesson_types.ts";
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

/** acceptCurriculum for fixtures that leave the knowledge fields out. The field rules have their own tests with acceptCurriculum directly. */
const acceptK = (c: unknown, ...rest: unknown[]) =>
  (acceptCurriculum as (...args: unknown[]) => ReturnType<typeof acceptCurriculum>)(withKnowledge(c as never), ...rest);

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

  it("V-30: requires non-empty canonical English title in brief, allows explicit null code_language, and rejects prepared languages", () => {
    // Brief thiếu title hoặc title rỗng bị từ chối
    expect(acceptBrief({ status: "ready", open_questions: [] })).toEqual({
      ok: false,
      reason: "Brief thiếu tiêu đề tiếng Anh chuẩn tắc (title).",
    });
    expect(acceptBrief({ status: "ready", open_questions: [], title: "" })).toEqual({
      ok: false,
      reason: "Brief thiếu tiêu đề tiếng Anh chuẩn tắc (title).",
    });
    expect(acceptBrief({ status: "ready", open_questions: [], title: "   " })).toEqual({
      ok: false,
      reason: "Brief thiếu tiêu đề tiếng Anh chuẩn tắc (title).",
    });

    // Brief có title hợp lệ
    const validBrief = { status: "ready", open_questions: [], title: "Rust for Web3" };
    expect(acceptBrief(validBrief)).toEqual({ ok: true, summary: "brief sẵn sàng." });

    // The content language comes from the course, not from the model.
    expect(acceptBrief({ ...validBrief, locale: "vi" }, "vi")).toEqual({ ok: true, summary: "brief sẵn sàng." });
    expect(acceptBrief({ ...validBrief, locale: "vi-VN", topic: "x" }, "vi"))
      .toEqual({ ok: true, summary: "brief sẵn sàng. Ngôn ngữ nội dung đặt theo khóa (vi).", normalizedOutput: { status: "ready", open_questions: [], title: "Rust for Web3", locale: "vi", topic: "x" } });
    expect(acceptBrief({ ...validBrief, status: "needs_input", open_questions: ["q"], locale: "vi-VN" }, "vi").ok).toBe(false);

    expect(resolveCodeLanguage(undefined)).toBe("rust");
    expect(acceptBrief({ ...validBrief, code_language: null })).toMatchObject({ ok: false, reason: expect.stringContaining("code_language = null") });
    expect(acceptBrief({ status: "ready", open_questions: [], title: "Web3 concepts", topic: "Blockchain basics", code_language: null }).ok).toBe(true);
    expect(resolveCodeLanguage(null)).toBeNull();

    for (const language of PREPARED_CODE_LANGUAGES) {
      expect(acceptBrief({ ...validBrief, code_language: language }))
        .toMatchObject({ ok: false, reason: expect.stringContaining("chưa hỗ trợ publish") });
    }
    expect(acceptBrief({ ...validBrief, code_language: "cobol" }))
      .toMatchObject({ ok: false, reason: expect.stringContaining("chưa hỗ trợ publish") });
  });

  it("V-30: STEP_SPECS.brief.buildInput does not include source_locale", () => {
    const input = STEP_SPECS.brief!.buildInput({ course: { title: "Solana", level: "beginner" }, paths: [], scopes: [], catalogResearch: null } as never);
    expect((input as any).source_locale).toBeUndefined();
  });

  it("normalizes a saved brief without code_language to Rust for A3 and A4", () => {
    for (const step of ["curriculum", "curriculum_review"] as const) {
      const input = STEP_SPECS[step]!.buildInput({ outputs: { brief: { locale: "vi" }, research: {}, curriculum: {} }, revision: null } as never) as Record<string, any>;
      expect(input.brief.code_language).toBe("rust");
    }
  });
});

describe("studio brief language vs code_language null", () => {
  it("rejects code_language null when the title or topic names an enabled language", () => {
    expect(acceptBrief({ status: "ready", open_questions: [], title: "Rust ownership", code_language: null }))
      .toMatchObject({ ok: false, reason: expect.stringContaining('đặt code_language = "rust"') });
    expect(acceptBrief({ status: "ready", open_questions: [], title: "Web3 concepts", topic: "Learn C++ basics", code_language: null }).ok).toBe(false);
    expect(acceptBrief({ status: "ready", open_questions: [], title: "Rustic cooking", code_language: null }).ok).toBe(true);
  });
});

describe("studio quiz minimum by lesson purpose", () => {
  it("keeps legacy warm_up at 1 and quick_check at 2 while other quizzes use 5", () => {
    expect(minQuizQuestions("warm_up")).toBe(1);
    expect(minQuizQuestions("quick_check")).toBe(2);
    expect(minQuizQuestions("final_check")).toBe(MIN_QUIZ_QUESTIONS);
    expect(minQuizQuestions("retrieval")).toBe(MIN_QUIZ_QUESTIONS);
    expect(minQuizQuestions(undefined)).toBe(MIN_QUIZ_QUESTIONS);
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
    expect(acceptK({ status: "needs_research", missing: ["a", "b"] }, new Set())).toEqual({ ok: true, summary: "cần thêm nghiên cứu: a; b" });
    expect(acceptK({ status: "needs_research", missing: [] }, new Set()).ok).toBe(false);
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

  it("places the seven agents and keeps code steps without an agent", () => {
    expect(STEP_ORDER.map((k) => STEP_OWNER[k])).toEqual(["catalog_job", "A2", "A2", "A3", "A4", "A5", "A6", "code", "code", "A7", "code"]);
    expect(agentKeyEnv("A1")).toBe("CORELIA_STUDIO_A1_CATALOG_RESEARCH_OPENAI_API_KEY");
    expect(agentKeyEnv("A4")).toBe("CORELIA_STUDIO_A4_CURRICULUM_REVIEW_OPENAI_API_KEY");
    expect(agentKeyEnv("A7")).toBe("CORELIA_STUDIO_A7_TRANSLATE_OPENAI_API_KEY");
  });
});

describe("A2 research prompt", () => {
  it("uses v16, records the course stack decision, and does not block research on unverified package versions", () => {
    const prompt = SEEDED_PROMPTS["a2-research"];
    expect(prompt.version).toBe("v16");
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
      channel: "Let's Get Rusty",
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

  it("drops invalid video candidates instead of rejecting the research", () => {
    const candidate = {
      topic: "ownership",
      url: "https://youtu.be/aaaaaaaaaaa",
      title: "Giải thích ownership",
      channel: "Let's Get Rusty",
      channel_basis: "Trang giới thiệu kênh đã đọc mô tả nội dung giáo dục Rust.",
      evidence_source_ids: ["s1"],
    };
    const invalid = [
      [{ ...candidate, evidence_source_ids: [] }, "evidence_source_ids phải có ít nhất một ID nguồn đã đọc"],
      [{ ...candidate, evidence_source_ids: ["s3"] }, "evidence_source_ids phải trỏ tới nguồn access = read"],
      [{ ...candidate, url: "https://example.com/video" }, "url không phải link YouTube hợp lệ"],
      [{ ...candidate, topic: "not in research" }, "topic không có trong research"],
      [{ ...candidate, channel: "Unknown Channel" }, "không thuộc danh sách kênh cho phép"],
    ] as const;
    for (const [bad, problem] of invalid) {
      const result = acceptResearch({ ...research, videos: [bad] }, today);
      expect(result).toMatchObject({ ok: true, summary: expect.stringContaining(problem), normalizedOutput: { videos: [] } });
    }

    const duplicate = { ...candidate, url: "https://youtube.com/watch?v=aaaaaaaaaaa" };
    const other = { ...candidate, url: "https://youtu.be/bbbbbbbbbbb" };
    const mixed = acceptResearch({ ...research, videos: [candidate, duplicate, other] }, today);
    expect(mixed).toMatchObject({ ok: true, summary: expect.stringContaining("trùng video ID") });
    expect((mixed as { normalizedOutput: { videos: unknown[] } }).normalizedOutput.videos).toEqual([candidate, other]);
    expect(acceptResearch({ ...research, videos: "not a list" }, today))
      .toMatchObject({ ok: true, normalizedOutput: { videos: [] } });
  });

  it("still rejects research whose required content is invalid when videos are also invalid", () => {
    const badVideo = { topic: "ownership", url: "https://example.com/video" };
    expect(acceptResearch({ ...research, topics: [], videos: [badVideo] }, today))
      .toMatchObject({ ok: false, reason: expect.stringContaining("không có chủ đề") });
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

  it("rejects uncited misconceptions", () => {
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
  const code = (id: string, purpose: string, over: object = {}) => lesson(id, { type: "code_exercise", purpose, code_mode: "edit", ...over });
  // The first teaching lesson embeds its opening situation; module 2 quick_check recalls o1 from module 1.
  const curriculum = {
    status: "draft",
    missing: [],
    outcomes: [{ id: "o1", check_lesson_ids: ["q1"] }, { id: "o2", check_lesson_ids: ["q2", "q9"] }],
    modules: [
      {
        id: "m1",
        lessons: [
          lesson("w1"),
          lesson("l1"),
          quiz("q1", { purpose: "quick_check" }),
          code("g1", "guided_practice"),
          code("i1", "independent_practice"),
        ],
      },
      {
        id: "m2",
        lessons: [
          lesson("w2", { purpose: "worked_example", outcome_ids: ["o2"] }),
          lesson("l2", { purpose: "worked_example", outcome_ids: ["o2"] }),
          quiz("q2", { purpose: "quick_check", outcome_ids: ["o1", "o2"] }),
          code("g2", "guided_practice", { outcome_ids: ["o2"] }),
          code("i2", "independent_practice", { outcome_ids: ["o2"] }),
          quiz("q9", { purpose: "final_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["l1", "l2"] }),
        ],
      },
    ],
  };
  // Course without code: each module replaces Luyện/Ghép code exercises with one scenario quiz.
  const noCodeCurriculum = {
    ...curriculum,
    modules: [
      {
        id: "m1",
        lessons: [
          lesson("w1"),
          lesson("l1"),
          quiz("q1", { purpose: "quick_check", review_lesson_ids: ["l1"] }),
          quiz("i1q", { purpose: "independent_practice", outcome_ids: ["o1"], review_lesson_ids: ["l1"] }),
        ],
      },
      {
        id: "m2",
        lessons: [
          lesson("w2", { purpose: "worked_example", outcome_ids: ["o2"] }),
          lesson("l2", { outcome_ids: ["o2"] }),
          quiz("q2", { purpose: "quick_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["l1"] }),
          quiz("i2q", { purpose: "independent_practice", outcome_ids: ["o2"], review_lesson_ids: ["l2"] }),
          quiz("q9", { purpose: "final_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["l1", "l2"] }),
        ],
      },
    ],
  };
  const sources = new Set(["s1"]);
  const withModules = (modules: object[]) => ({ ...curriculum, modules });
  const reason = (output: unknown) => {
    const result = acceptK(output, sources);
    return result.ok ? "" : result.reason;
  };
  const [m1, m2] = curriculum.modules;
  const [w1, l1, q1, g1, i1] = m1.lessons;
  const [w2, l2, q2, g2, i2, q9] = m2.lessons;

  it("accepts a curriculum with the opening embedded in the first teaching lesson", () => {
    const res = acceptK(curriculum, sources);
    expect(res.ok).toBe(true);
    expect(res.summary).toBe("2 module, 11 lesson, 2 outcome.");
    expect(LESSON_PURPOSES).toEqual(expect.arrayContaining(["optional_hands_on", "warm_up", "quick_check"]));
    const purposeEnum = (STEP_SPECS.curriculum!.schema as any).properties.modules.items.properties.lessons.items.properties.purpose.enum;
    expect(purposeEnum).not.toContain("warm_up");
    expect(acceptCurriculumReview({
      verdict: "needs_fix",
      issues: [{ location: "m1", problem: "Thiếu lesson thực hành tự nguyện.", category: "missing_practice", principle: "p", fix: "f", severity: "blocking" }],
      needs_research: [],
      summary: "s",
    }, curriculum)).toMatchObject({ ok: true, normalizedOutput: { verdict: "pass", issues: [{ severity: "minor" }] } });
  });

  it("requires code_language when code steps exist, and accepts a course without code steps", () => {
    expect(acceptK(curriculum, sources, null))
      .toMatchObject({ ok: false, reason: expect.stringContaining("brief.code_language = null") });
    expect(acceptK(noCodeCurriculum, sources, null).ok).toBe(true);
    expect(reason(withModules([{ ...m1, lessons: [w1, l1, q1, g1, i1] }, m2]))).toBe("");
    const minimalCodeCurriculum = withModules([
      { id: "m1", lessons: [l1, q1, g1, i1] },
      m2,
    ]);
    expect(acceptK(minimalCodeCurriculum, sources, "rust").ok).toBe(true);
    const minimalNoCode = withModules([
      { id: "m1", lessons: [l1, q1, quiz("i1q", { purpose: "independent_practice", outcome_ids: ["o1"], review_lesson_ids: ["l1"] })] },
      { id: "m2", lessons: [l2, quiz("q2", { purpose: "quick_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["l1"] }), quiz("i2q", { purpose: "independent_practice", outcome_ids: ["o2"], review_lesson_ids: ["l2"] }), q9] },
    ]);
    expect(acceptK(minimalNoCode, sources, null).ok).toBe(true);
  });

  it("requires fill or edit on each code_exercise and null on every other lesson", () => {
    const withLessons = (lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(withLessons([w1, l1, q1, { ...g1, code_mode: undefined }, i1]))).toContain("thiếu code_mode");
    expect(reason(withLessons([w1, l1, q1, { ...g1, code_mode: "two_stage" }, i1]))).toContain("thiếu code_mode");
    expect(reason(withLessons([w1, l1, { ...q1, code_mode: "edit" }, g1, i1]))).toContain("phải có code_mode null");
    expect(reason(withLessons([w1, l1, q1, { ...g1, code_mode: "fill" }, { ...i1, code_mode: "edit" }]))).toBe("");
  });

  it("rejects code steps in a course without code", () => {
    const withCode = {
      ...noCodeCurriculum,
      modules: [noCodeCurriculum.modules[0], { ...noCodeCurriculum.modules[1], lessons: [...noCodeCurriculum.modules[1].lessons, code("g9", "guided_practice", { outcome_ids: ["o2"] })] }],
    };
    expect(acceptK(withCode, sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("brief.code_language = null") });
  });

  it("accepts video lessons with explanation purpose in new curricula and rejects invalid purpose", () => {
    const videoModule = (purpose: string) => ({
      ...m1,
      lessons: [w1, { ...lesson("v1"), type: "video", purpose, pass_threshold: null }, quiz("q1", { purpose: "quick_check", review_lesson_ids: ["v1"] }), g1, i1],
    });
    const m2Video = { ...m2, lessons: m2.lessons.map((l) => (l.id === "q2" ? { ...l, review_lesson_ids: ["v1"] } : l.id === "q9" ? { ...l, review_lesson_ids: ["v1", "l2"] } : l)) };
    expect(acceptK(withModules([videoModule("explanation"), m2Video]), sources).ok).toBe(true);
    expect(acceptK(withModules([videoModule("practice")]), sources))
      .toMatchObject({ ok: false, reason: expect.stringContaining("chỉ được mang purpose explanation") });
  });

  it("provides allowed_channels from channels.ts to A2 research and A3 curriculum inputs", () => {
    const researchInput = STEP_SPECS.research!.buildInput({ outputs: { brief: {} }, today: "2026-11-01" } as never) as any;
    expect(researchInput.allowed_channels).toHaveLength(17);
    const researchNames = researchInput.allowed_channels.map((c: any) => c.name);
    expect(researchNames).toContain("freeCodeCamp.org");
    expect(researchNames).toContain("Let's Get Rusty");
    expect(researchNames).toContain("CNCF [Cloud Native Computing Foundation]");

    const curriculumInput = STEP_SPECS.curriculum!.buildInput({ outputs: { brief: {}, research: {} } } as never) as any;
    expect(curriculumInput.allowed_channels).toHaveLength(17);
    const curriculumNames = curriculumInput.allowed_channels.map((c: any) => c.name);
    expect(curriculumNames).toContain("freeCodeCamp.org");
    expect(curriculumNames).toContain("Let's Get Rusty");
  });

  it("rejects video lesson when research has no matching video candidate and accepts when present", () => {
    const videoLessonCurriculum = withModules([
      { ...m1, lessons: [w1, { ...lesson("v1"), type: "video", purpose: "explanation", pass_threshold: null }, quiz("q1", { purpose: "quick_check", review_lesson_ids: ["v1"] }), g1, i1] },
      { ...m2, lessons: m2.lessons.map((l) => (l.id === "q2" ? { ...l, review_lesson_ids: ["v1"] } : l.id === "q9" ? { ...l, review_lesson_ids: ["v1", "l2"] } : l)) },
    ]);
    const mockResearchWithVideo = {
      topics: [{ topic: "t1", source_ids: ["s1"], key_points: [] }],
      sources: [{ source_id: "s1", access: "read" }],
      videos: [
        { topic: "t1", url: "https://youtu.be/bbbbbbbbbbb", title: "Vid", channel: "Let's Get Rusty", channel_basis: "Official", evidence_source_ids: ["s1"] },
      ],
    } as any;

    expect(acceptK(videoLessonCurriculum, sources, "rust", mockResearchWithVideo).ok).toBe(true);

    const mockResearchNoVideo = {
      topics: [{ topic: "t1", source_ids: ["s1"], key_points: [] }],
      sources: [{ source_id: "s1", access: "read" }],
      videos: [],
    } as any;

    const res = acceptK(videoLessonCurriculum, sources, "rust", mockResearchNoVideo);
    expect(res.ok).toBe(false);
    expect((res as any).reason).toContain('Lesson video "v1" không có video ứng viên phù hợp trong research');
    expect((res as any).reason).toContain("hãy đổi sang article");
  });

  it("offers video format to new A3/A4 curricula with explanation purpose", () => {
    expect(PLATFORM_FORMATS).toContain("video");
    expect(PLATFORM_FORMAT_GUIDE).toHaveProperty("video");
    expect(AI_CURRICULUM_FORMATS).toContain("video");
    expect(AI_CURRICULUM_FORMAT_GUIDE).toHaveProperty("video");

    const schema = STEP_SPECS.curriculum!.schema as any;
    expect(schema.properties.modules.items.properties.lessons.items.properties.type.enum).toEqual([...AI_CURRICULUM_FORMATS]);
    for (const key of ["curriculum", "curriculum_review"] as const) {
      const input = STEP_SPECS[key]!.buildInput({ outputs: { brief: {}, research: {}, curriculum: {} }, revision: null } as never) as Record<string, any>;
      expect(input.platform_formats).toHaveProperty("video");
    }
  });

  it("rejects diagnostic lesson and orders prerequisites", () => {
    const first = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(first(lesson("d1", { type: "practice", purpose: "diagnostic" as any }), w1, l1, q1, g1, i1))).toContain("phải có purpose optional_hands_on");
    expect(reason(first(w1, lesson("l1", { prerequisite_lesson_ids: ["q1"] }), q1, g1, i1))).toContain("lesson l1: prerequisite q1 đứng sau");
    expect(reason(first(w1, lesson("l1", { prerequisite_lesson_ids: ["ghost"] }), q1, g1, i1))).toContain("prerequisite_lesson_ids không hợp lệ (ghost)");
    expect(reason(first(w1, lesson("l1", { prerequisite_lesson_ids: ["l1"] }), q1, g1, i1))).toContain("không hợp lệ (l1)");
  });

  it("accepts a valid optional hands-on leaf and rejects its curriculum violations", () => {
    const optional = lesson("oh", { type: "practice", purpose: "optional_hands_on", outcome_ids: ["o1"] });
    const withOptional = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(acceptK(withOptional(w1, l1, q1, g1, i1, optional), sources).ok).toBe(true);

    const secondOptional = lesson("oh2", { type: "practice", purpose: "optional_hands_on", outcome_ids: ["o1"] });
    expect(reason(withOptional(w1, l1, q1, g1, i1, optional, secondOptional))).toContain("có hơn một lesson optional_hands_on");
    expect(reason(withOptional(w1, l1, optional, q1, g1, i1))).toContain("phải ở cuối module");
    expect(reason(withOptional(w1, l1, q1, g1, i1, { ...optional, type: "article" }))).toContain("phải là practice");
    expect(reason(withOptional(w1, l1, q1, g1, i1, { ...optional, pass_threshold: 50 }))).toContain("lesson oh không phải quiz nhưng có ngưỡng pass");
    expect(reason(withOptional({ ...w1, prerequisite_lesson_ids: ["oh"] }, l1, q1, g1, i1, optional)))
      .toContain("không được phụ thuộc vào optional_hands_on oh");

    const listedAsChecker = { ...curriculum, outcomes: [{ ...curriculum.outcomes[0], check_lesson_ids: ["q1", "oh"] }, curriculum.outcomes[1]] };
    expect(reason({ ...listedAsChecker, modules: [{ ...m1, lessons: [w1, l1, q1, g1, i1, optional] }, m2] }))
      .toContain("check_lesson_ids không được chứa practice");
    const onlyOptionalChecksOutcome = { ...curriculum, outcomes: [{ ...curriculum.outcomes[0], check_lesson_ids: ["oh"] }, curriculum.outcomes[1]] };
    expect(reason({ ...onlyOptionalChecksOutcome, modules: [{ ...m1, lessons: [w1, l1, q1, g1, i1, optional] }, m2] }))
      .toContain("check_lesson_ids không được chứa practice");
  });

  it("rejects unknown sources, unchecked outcomes and duplicate ids", () => {
    expect(acceptK(curriculum, new Set(["s2"])).ok).toBe(false);
    expect(acceptK({ ...curriculum, outcomes: [{ id: "o1", check_lesson_ids: [] }, curriculum.outcomes[1]] }, sources).ok).toBe(false);
    const dup = withModules([{ ...m1, id: "l1" }, m2]);
    expect(acceptK(dup, sources).ok).toBe(false);
  });

  it("validates lesson source_ids distinguishing empty and unknown sources, including fallback topic sources", () => {
    const first = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(first(w1, { ...l1, source_ids: [] }, q1, g1, i1))).toContain("lesson l1 thiếu source_ids");
    expect(reason(first(w1, { ...l1, source_ids: ["not_found_source"] }, q1, g1, i1)))
      .toContain("lesson l1 có source_id không có trong research (not_found_source)");
    expect(acceptK(curriculum, sources).ok).toBe(true);

    const topicSources = new Set(["topic_s1", "topic_s2"]);
    const withTopicSources = withModules([
      { id: "m1", lessons: m1.lessons.map((l) => ({ ...l, source_ids: ["topic_s1", "topic_s2"] })) },
      { id: "m2", lessons: m2.lessons.map((l) => ({ ...l, source_ids: ["topic_s2"] })) },
    ]);
    expect(acceptK(withTopicSources, topicSources).ok).toBe(true);
  });

  it("requires quiz thresholds and review lessons, and no threshold elsewhere", () => {
    const first = (...lessons: object[]) => withModules([{ ...m1, lessons }, m2]);
    expect(reason(first(w1, l1, quiz("q1", { purpose: "quick_check", pass_threshold: null }), g1, i1))).toContain("quiz q1 thiếu ngưỡng pass");
    expect(reason(first(w1, l1, quiz("q1", { purpose: "quick_check", review_lesson_ids: [] }), g1, i1))).toContain("quiz q1 không có lesson để ôn khi sai");
    expect(reason(first(w1, lesson("l1", { pass_threshold: 70 }), q1, g1, i1))).toContain("lesson l1 không phải quiz nhưng có ngưỡng pass");
  });

  it("rejects a separate warm_up lesson while preserving legacy quiz validation", () => {
    const legacyWarmUp = quiz("w1", { purpose: "warm_up", review_lesson_ids: [] });
    expect(reason(withModules([{ ...m1, lessons: [legacyWarmUp, l1, q1, g1, i1] }, m2]))).toContain("không tạo lesson riêng warm_up");
    expect(minQuizQuestions("warm_up")).toBe(1);
  });

  it("requires a covering final check and a recall of an earlier module", () => {
    expect(reason(withModules([m1, { ...m2, lessons: [w2, l2, q2, g2, i2] }]))).toContain("module cuối không có quiz tổng hợp");
    expect(reason(withModules([m1, { ...m2, lessons: [w2, l2, q2, g2, i2, quiz("q9", { purpose: "final_check", outcome_ids: ["o2"], review_lesson_ids: ["l2"] })] }])))
      .toContain("chưa phủ outcome o1");
    expect(reason(withModules([m1, { ...m2, lessons: [w2, l2, g2, i2, q9] }]))).toContain("không có lesson ôn lại outcome của module trước");
  });

  it("counts code_exercise final checks toward outcome coverage, and still needs a summary quiz", () => {
    const withCodeFinal = withModules([m1, { ...m2, lessons: [w2, l2, q2, g2, i2, code("c9", "final_check", { outcome_ids: ["o1", "o2"] })] }]);
    expect(reason(withCodeFinal)).toContain("module cuối không có quiz tổng hợp");
    expect(reason(withCodeFinal)).not.toContain("chưa phủ outcome");
  });

  const quizReviewLaterCurriculum = withModules([{ ...m1, lessons: [w1, l1, quiz("q1", { purpose: "quick_check", review_lesson_ids: ["l2"] }), g1, i1] }, m2]);
  const outcomeWithoutTeachingCurriculum = withModules([{ ...m1, lessons: [lesson("w1", { outcome_ids: ["o2"] }), lesson("l1", { purpose: "guided_practice" }), q1, g1, i1] }, m2]);
  const checksBeforeTeachingCurriculum = withModules([{ ...m1, lessons: [lesson("w1", { outcome_ids: ["o2"] }), quiz("q1", { purpose: "quick_check", outcome_ids: ["o1"], review_lesson_ids: ["w1"] }), lesson("l1", { outcome_ids: ["o1"] }), g1, i1] }, m2]);
  const optionalOutcomeCurriculum = withModules([
    { ...m1, lessons: [lesson("w1", { outcome_ids: ["o2"] }), lesson("l1", { purpose: "guided_practice" }), q1, g1, lesson("oh", { type: "practice", purpose: "optional_hands_on", outcome_ids: ["o1"] })] },
    m2,
  ]);
  const selfCheckOnlyCurriculum = {
    ...curriculum,
    outcomes: [{ id: "o1", check_lesson_ids: ["l1"] }, curriculum.outcomes[1]],
    modules: [{ ...m1, lessons: [lesson("w1", { outcome_ids: ["o2"] }), lesson("l1", { outcome_ids: ["o1"] }), quiz("q1", { purpose: "quick_check", outcome_ids: ["o2"] }), g1, i1] }, m2],
  };

  it("enforces journey order rules: quizzes require review lessons to precede them", () => {
    expect(reason(quizReviewLaterCurriculum)).toContain("quiz q1: lesson ôn l2 không đứng trước quiz");
  });

  it("enforces journey teaching rules: each outcome requires teaching lessons (explanation/worked_example)", () => {
    expect(reason(outcomeWithoutTeachingCurriculum)).toContain("outcome o1: không có lesson dạy");
  });

  it("enforces journey check ordering: at least one check lesson must follow a teaching lesson", () => {
    expect(reason(checksBeforeTeachingCurriculum)).toContain("outcome o1: không lesson kiểm tra nào đứng sau lesson dạy");
  });

  it("does not count optional_hands_on as teaching lessons for outcomes", () => {
    expect(reason(optionalOutcomeCurriculum)).toContain("outcome o1: không có lesson dạy");
  });

  it("falls back to empty codeChecks in curriculum_review step when acceptCurriculum fails", () => {
    const invalidCurriculum = { ...curriculum, outcomes: [] };
    const reviewResult = STEP_SPECS.curriculum_review!.accept(
      { verdict: "pass", issues: [], needs_research: [] },
      { outputs: { brief: { code_language: "rust" }, research: { topics: [], prerequisites: [] }, curriculum: invalidCurriculum } } as any,
    );
    expect(reviewResult.ok).toBe(true);
    expect(reviewResult.codeChecks).toEqual([]);
  });

  it("keeps the accepted legacy warm_up curriculum valid for A4 only when its A3 prompt predates v25", () => {
    const legacyCurriculum = {
      ...curriculum,
      modules: [
        { ...m1, lessons: [quiz("w1", { purpose: "warm_up", review_lesson_ids: [] }), l1, q1, g1, i1] },
        m2,
      ],
    };
    const review = { verdict: "pass", issues: [], needs_research: [] };
    const context = (curriculumPromptVersion?: string | null) => ({
      outputs: {
        brief: { code_language: "rust" },
        research: { sources: [{ source_id: "s1", access: "read" }], topics: [], prerequisites: [] },
        curriculum: withKnowledge(legacyCurriculum),
      },
      ...(curriculumPromptVersion === undefined ? {} : { curriculumPromptVersion }),
    });

    for (const version of ["a3-curriculum@v24", null, undefined]) {
      const legacyResult = STEP_SPECS.curriculum_review!.accept(review, context(version) as any);
      expect(legacyResult.codeChecks?.length).toBeGreaterThan(0);
    }
    for (const version of ["a3-curriculum@v25", "a3-curriculum@v26"]) {
      const currentResult = STEP_SPECS.curriculum_review!.accept(review, context(version) as any);
      expect(currentResult.codeChecks).toEqual([]);
    }
  });

  it("contract test: verifies acceptCurriculum and journeyProblems stay strictly synchronized across >= 5 test cases", () => {
    const extractJourneyOrderProblems = (c: unknown) =>
      journeyProblems(c, {}).filter((p) =>
        p.includes("không có lesson dạy") ||
        p.includes("không có lesson kiểm tra") ||
        p.includes("không lesson kiểm tra nào đứng sau lesson dạy") ||
        p.includes("không đứng trước quiz")
      );

    const contractCases = [
      {
        name: "1. curriculum hợp lệ",
        curriculum,
        expectedAcceptOk: true,
        expectedAcceptProblem: null,
        expectedJourneyProblem: null,
      },
      {
        name: "2. quiz có lesson ôn đứng sau quiz",
        curriculum: quizReviewLaterCurriculum,
        expectedAcceptOk: false,
        expectedAcceptProblem: "quiz q1: lesson ôn l2 không đứng trước quiz",
        expectedJourneyProblem: "lesson ôn l2 không đứng trước quiz",
      },
      {
        name: "3. outcome không có lesson dạy",
        curriculum: outcomeWithoutTeachingCurriculum,
        expectedAcceptOk: false,
        expectedAcceptProblem: "outcome o1: không có lesson dạy",
        expectedJourneyProblem: "outcome o1: không có lesson dạy",
      },
      {
        name: "4. mọi lesson kiểm tra đứng trước lesson dạy",
        curriculum: checksBeforeTeachingCurriculum,
        expectedAcceptOk: false,
        expectedAcceptProblem: "outcome o1: không lesson kiểm tra nào đứng sau lesson dạy",
        expectedJourneyProblem: "outcome o1: không lesson kiểm tra nào đứng sau lesson dạy",
      },
      {
        name: "5. optional_hands_on mang outcome không được tính là lesson dạy",
        curriculum: optionalOutcomeCurriculum,
        expectedAcceptOk: false,
        expectedAcceptProblem: "outcome o1: không có lesson dạy",
        expectedJourneyProblem: "outcome o1: không có lesson dạy",
      },
      {
        name: "6. lesson tự kiểm tra chính nó nhưng không có bài kiểm tra đứng sau",
        curriculum: selfCheckOnlyCurriculum,
        expectedAcceptOk: false,
        expectedAcceptProblem: "outcome o1: không lesson kiểm tra nào đứng sau lesson dạy",
        expectedJourneyProblem: "outcome o1: không lesson kiểm tra nào đứng sau lesson dạy",
      },
    ];

    for (const tc of contractCases) {
      const acceptResult = acceptK(tc.curriculum, sources);
      expect(acceptResult.ok, `[acceptCurriculum ${tc.name}]`).toBe(tc.expectedAcceptOk);
      if (!tc.expectedAcceptOk && tc.expectedAcceptProblem) {
        expect(acceptResult.ok ? "" : acceptResult.reason, `[acceptCurriculum reason ${tc.name}]`).toContain(tc.expectedAcceptProblem);
      }

      const journeyOrderProblems = extractJourneyOrderProblems(tc.curriculum);
      if (tc.expectedJourneyProblem === null) {
        expect(journeyOrderProblems, `[journeyProblems ${tc.name}]`).toEqual([]);
      } else {
        expect(
          journeyOrderProblems.some((p) => p.includes(tc.expectedJourneyProblem!)),
          `[journeyProblems problem ${tc.name}: expected "${tc.expectedJourneyProblem}", got ${JSON.stringify(journeyOrderProblems)}]`
        ).toBe(true);
      }
    }
  });

  it("rejects a module without a quick_check quiz", () => {
    const noQuizModule = {
      id: "m-no-quiz",
      lessons: [
        lesson("w3"),
        lesson("art1", { purpose: "explanation" }),
        quiz("scenario", { purpose: "independent_practice", outcome_ids: ["o1"], review_lesson_ids: ["l1"] }),
        lesson("art2", { purpose: "worked_example" }),
      ],
    };
    const c = withModules([noCodeCurriculum.modules[0], noQuizModule]);
    expect(acceptK(c, sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("module m-no-quiz: cần đúng 1 bài quick_check") });
  });

  it("rejects a module without teaching lessons, even when it has quizzes", () => {
    const reviewOnly = {
      id: "m-review-only",
      lessons: [quiz("q3", { purpose: "quick_check", review_lesson_ids: ["l1"] }), quiz("i3", { purpose: "independent_practice", review_lesson_ids: ["l1"] }), g1, i1],
    };
    expect(reason(withModules([m1, m2, reviewOnly]))).toContain("module m-review-only: bài đầu module phải là explanation/worked_example");
  });

  it("rejects retrieval that is not a quiz", () => {
    const badRetrieval = lesson("r1_bad", { type: "article", purpose: "retrieval", outcome_ids: ["o1"] });
    const c = withModules([m1, { ...m2, lessons: [w2, badRetrieval, q9] }]);
    expect(reason(c)).toContain("module m2: dùng purpose retrieval");
  });

  it("rejects practice with purpose other than optional_hands_on (B-04)", () => {
    const badPractice = lesson("p1", { type: "practice", purpose: "guided_practice" as any });
    const c = withModules([{ ...m1, lessons: [w1, l1, q1, g1, i1, badPractice] }, m2]);
    expect(reason(c)).toContain("phải có purpose optional_hands_on");
  });

  it("requires the first lesson in a module to teach and embed the opening situation", () => {
    expect(reason(withModules([{ ...m1, lessons: [quiz("first-quiz", { purpose: "quick_check" }), l1, q1, g1, i1] }, m2]))).toContain("module m1: bài đầu module phải là explanation/worked_example");
  });

  it("rejects a module outside 3-6 lessons", () => {
    expect(reason(withModules([{ ...m1, lessons: [w1, l1] }, m2]))).toContain("module m1: có 2 bài; cần 3-6 bài");
  });

  it("requires exactly one quick_check after a teaching lesson in every module", () => {
    const twoChecks = { ...m1, lessons: [w1, l1, quiz("q1x", { purpose: "quick_check", review_lesson_ids: ["l1"] }), quiz("q1y", { purpose: "quick_check", review_lesson_ids: ["l1"] }), g1, i1] };
    expect(reason(withModules([twoChecks, m2]))).toContain("module m1: cần đúng 1 bài quick_check");
    expect(reason(withModules([{ ...m1, lessons: [quiz("legacy-warmup", { purpose: "warm_up", review_lesson_ids: [] }), q1, l1, g1, i1] }, m2]))).toContain("module m1: thiếu bài dạy");
  });

  it("requires each later module's quick_check to recall a lesson of an earlier module", () => {
    const noRecall = { ...m2, lessons: [w2, l2, { ...q2, review_lesson_ids: ["l2"] }, g2, i2, q9] };
    expect(reason(withModules([m1, noRecall]))).toContain("module m2: quick_check của module sau phải kiểm một kiến thức của module trước");
  });

  it("requires guided_practice then independent_practice after quick_check in a course with code", () => {
    expect(reason(withModules([m1, { ...m2, lessons: [w2, l2, q2, i2, g2, q9] }])))
      .toContain("module m2: thứ tự phải là quick_check → guided_practice → independent_practice");
    expect(reason(withModules([{ ...m1, lessons: [w1, l1, q1, g1] }, m2])))
      .toContain("module m1: khóa có code: cần đúng 1 bài Luyện (guided_practice) và 1 bài Ghép (independent_practice)");
    expect(reason(withModules([{ ...m1, lessons: [w1, l1, q1, quiz("g1q", { purpose: "guided_practice" }), i1] }, m2])))
      .toContain("bước Luyện và Ghép phải là code_exercise");
  });

  it("refuses retrieval inside a module and final_check outside the last lesson of the last module", () => {
    expect(reason(withModules([{ ...m1, lessons: [w1, l1, q1, quiz("r0", { purpose: "retrieval", review_lesson_ids: ["l1"] }), g1, i1] }, m2])))
      .toContain("module m1: dùng purpose retrieval");
    expect(reason(withModules([{ ...m1, lessons: [w1, l1, q1, quiz("f1", { purpose: "final_check", review_lesson_ids: ["l1"] }), g1, i1] }, m2])))
      .toContain("final_check chỉ được là bài cuối của module cuối");
  });

  it("requires exactly one no-code Ghép scenario quiz after quick_check", () => {
    expect(acceptK(noCodeCurriculum, sources, null).ok).toBe(true);
    const [m1NoCode, m2NoCode] = noCodeCurriculum.modules;
    const missingScenario = { ...m1NoCode, lessons: m1NoCode.lessons.filter((l) => l.purpose !== "independent_practice") };
    expect(acceptK(withModules([missingScenario, m2NoCode]), sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("cần đúng 1 quiz tình huống Ghép") });
    const duplicateScenario = { ...m1NoCode, lessons: [...m1NoCode.lessons, quiz("i1q2", { purpose: "independent_practice", outcome_ids: ["o1"], review_lesson_ids: ["l1"] })] };
    expect(acceptK(withModules([duplicateScenario, m2NoCode]), sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("cần đúng 1 quiz tình huống Ghép") });
    const scenarioBeforeQuick = { ...m1NoCode, lessons: [m1NoCode.lessons[0], m1NoCode.lessons[1], m1NoCode.lessons[3], m1NoCode.lessons[2]] };
    expect(acceptK(withModules([scenarioBeforeQuick, m2NoCode]), sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("bước Ghép phải là quiz tình huống đứng sau quick_check") });
    const standaloneWarmUp = { ...m1NoCode, lessons: [quiz("w1x", { purpose: "warm_up", review_lesson_ids: [] }), ...m1NoCode.lessons] };
    expect(acceptK(withModules([standaloneWarmUp, m2NoCode]), sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("không tạo lesson riêng warm_up") });
    const guidedNoCode = { ...m2NoCode, lessons: [m2NoCode.lessons[0], m2NoCode.lessons[1], m2NoCode.lessons[2], quiz("g2q", { purpose: "guided_practice", review_lesson_ids: ["l2"] }), m2NoCode.lessons[4]] };
    expect(acceptK(withModules([noCodeCurriculum.modules[0], guidedNoCode]), sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("khóa không có code nhưng có bước Luyện") });
  });

  it("does not treat a legacy warm_up quiz as a valid new module opener", () => {
    const legacyWarmUp = quiz("legacy-warmup", { purpose: "warm_up", review_lesson_ids: [] });
    const withWarmUp = withModules([{ ...m1, lessons: [legacyWarmUp, l1, q1, g1, i1] }, m2]);
    expect(reason(withWarmUp)).toContain("module m1: không tạo lesson riêng warm_up");
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

describe("studio curriculum knowledge chain, rhythm and recap placement (A3 v27)", () => {
  const sources = new Set(["s1"]);
  // Fields are written out in full here: these tests check the rules, not the fixture helper.
  const lesson = (id: string, over: object = {}) => ({
    id,
    title: id,
    description: "d",
    type: "article",
    purpose: "explanation",
    code_mode: null,
    outcome_ids: ["o1"],
    prerequisites: [],
    prerequisite_lesson_ids: [],
    completion_rule: "c",
    pass_threshold: null,
    review_lesson_ids: [],
    source_ids: ["s1"],
    new_knowledge: `${id} teaches one new idea`,
    opening_question: `What happens in ${id}?`,
    next_question: "What comes next?",
    ...over,
  });
  const quiz = (id: string, over: object = {}) => lesson(id, { type: "quiz", pass_threshold: 80, ...over });
  // A valid no-code, two-module course: each module teaches, checks with a quiz, and the course ends with a final check.
  const valid = () => ({
    status: "draft",
    missing: [],
    outcomes: [{ id: "o1", check_lesson_ids: ["q1"] }, { id: "o2", check_lesson_ids: ["q2", "q9"] }],
    modules: [
      {
        id: "m1",
        recap: "After this module you can explain idea one.",
        lessons: [
          lesson("w1", { next_question: "What does q1 check?" }),
          quiz("q1", { purpose: "quick_check", review_lesson_ids: ["w1"], next_question: "What does i1q check?" }),
          quiz("i1q", { purpose: "independent_practice", review_lesson_ids: ["w1"], next_question: "What does w2 teach?" }),
        ],
      },
      {
        id: "m2",
        recap: "After this module you can explain idea two.",
        lessons: [
          lesson("w2", { purpose: "worked_example", outcome_ids: ["o2"], next_question: "What does q2 check?" }),
          quiz("q2", { purpose: "quick_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["w1"], next_question: "What does i2q check?" }),
          quiz("i2q", { purpose: "independent_practice", outcome_ids: ["o2"], review_lesson_ids: ["w2"], next_question: "What does q9 check?" }),
          quiz("q9", { purpose: "final_check", outcome_ids: ["o1", "o2"], review_lesson_ids: ["w1", "w2"], next_question: null }),
        ],
      },
    ],
  });
  const withLesson = (id: string, over: object) => {
    const c = valid();
    c.modules = c.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === id ? { ...l, ...over } : l)) }));
    return c;
  };

  it("accepts a valid course with the knowledge fields", () => {
    expect(acceptCurriculum(valid(), sources, null).ok).toBe(true);
  });

  it("requires new_knowledge, opening_question and a module recap on every lesson and module", () => {
    expect(acceptCurriculum(withLesson("w1", { new_knowledge: " " }), sources, null))
      .toMatchObject({ ok: false, reason: expect.stringContaining("lesson w1: new_knowledge phải là chuỗi không rỗng") });
    expect(acceptCurriculum(withLesson("q2", { opening_question: "" }), sources, null))
      .toMatchObject({ ok: false, reason: expect.stringContaining("lesson q2: opening_question") });
    const noRecap = valid();
    noRecap.modules[1] = { ...noRecap.modules[1], recap: "" };
    expect(acceptCurriculum(noRecap, sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("module m2: recap") });
  });

  it("allows next_question null only at the end of the course or for optional_hands_on", () => {
    expect(acceptCurriculum(withLesson("w1", { next_question: null }), sources, null))
      .toMatchObject({ ok: false, reason: expect.stringContaining("lesson w1: next_question chỉ được null") });
    expect(acceptCurriculum(withLesson("q9", { next_question: "Anything?" }), sources, null))
      .toMatchObject({ ok: false, reason: expect.stringContaining("bài cuối khóa phải có next_question = null") });
    // An optional hands-on lesson closes its module and may end without a question.
    const withOptional = valid();
    withOptional.modules[0].lessons.push(lesson("p1", { type: "practice", purpose: "optional_hands_on", pass_threshold: null, next_question: null, outcome_ids: ["o1"] }));
    expect(acceptCurriculum(withOptional, sources, null).ok).toBe(true);
  });

  it("refuses more than two article/video lessons in a row inside a module", () => {
    const c = valid();
    c.modules[0].lessons = [lesson("w1"), lesson("a2"), lesson("a3"), quiz("q1", { purpose: "quick_check", review_lesson_ids: ["w1"] }), quiz("i1q", { purpose: "independent_practice", review_lesson_ids: ["w1"] })];
    expect(acceptCurriculum(c, sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("hơn 2 bài liên tiếp dạng article/video tại a3") });
  });

  it("refuses more than two teaching lessons before a quiz or code exercise", () => {
    const c = valid();
    c.modules[0].lessons = [lesson("w1"), lesson("a2"), lesson("a3", { purpose: "worked_example" }), quiz("q1", { purpose: "quick_check", review_lesson_ids: ["w1"] }), quiz("i1q", { purpose: "independent_practice", review_lesson_ids: ["w1"] })];
    // A teaching lesson is an article or a video, so a run of three also breaks the reading rule; both name the lesson.
    expect(acceptCurriculum(c, sources, null)).toMatchObject({ ok: false, reason: expect.stringContaining("hơn 2 bài dạy liên tiếp trước quiz hoặc code_exercise tại a3") });
  });

  it("places a module recap at the closing of a module that ends with prose, or at the opening of the next module after a quiz", () => {
    const c = {
      modules: [
        { id: "a", recap: "ra", lessons: [lesson("x1", { purpose: "explanation" }), quiz("x2", { purpose: "quick_check" })] },
        { id: "b", recap: "rb", lessons: [lesson("y1", { purpose: "explanation" }), quiz("y2", { purpose: "final_check" })] },
      ],
    };
    const placements = recapCarriers(c);
    // Module a ends with a quiz: its recap opens the first teaching lesson of module b.
    // Module b is the last: its recap closes in its last prose lesson before the final check, y1.
    expect(placements.get("y1")).toEqual([
      { module_id: "a", placement: "opening", text: "ra" },
      { module_id: "b", placement: "closing", text: "rb" },
    ]);
    expect(placements.has("x1")).toBe(false);
    expect(placements.has("x2")).toBe(false);
    // A module that ends with prose closes in that prose; optional_hands_on is not the closing lesson.
    const prose = { modules: [{ id: "a", recap: "ra", lessons: [lesson("x1"), lesson("p1", { type: "practice", purpose: "optional_hands_on", pass_threshold: null })] }] };
    expect(recapCarriers(prose).get("x1")).toEqual([{ module_id: "a", placement: "closing", text: "ra" }]);
    expect(recapCarriers(prose).has("p1")).toBe(false);
  });

  it("treats a curriculum without the knowledge fields as stale, with the message the run shows", () => {
    const old = {
      status: "draft",
      missing: [],
      outcomes: [{ id: "o1", check_lesson_ids: ["q1"] }],
      modules: [{ id: "m1", lessons: [{ id: "w1", type: "article", purpose: "explanation" }] }],
    };
    expect(curriculumStaleReason(old)).toBe(STALE_KNOWLEDGE_MESSAGE);
    expect(curriculumStaleReason(valid())).toBeNull();
    // A curriculum with the fields but a code lesson from before code_mode is stale too.
    const noMode = valid();
    noMode.modules[1].lessons.push(lesson("c1", { type: "code_exercise", purpose: "independent_practice", code_mode: undefined }));
    expect(curriculumStaleReason(noMode)).toContain("Bài code \"c1\" của khóa này được lập trước khi có code_mode");
  });
});

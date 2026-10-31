import { describe, expect, it } from "vitest";

import { journeyProblems, linkProblems, structureProblems, type LessonRecord } from "./checks.ts";
import { MAX_LESSON_REVIEWS, planLessons, type LessonGeneration, type LessonStep } from "./lesson_flow.ts";
import { MAX_TRANSPORT_FAILURES } from "./retry.ts";
import { article, base, ctx, curriculum, editCode, fillCode, lesson, now, question } from "./lesson_fixtures.ts";
import { getCodeLanguageAdapter } from "./lesson_ports.ts";
import { acceptLessonReview, LESSON_REVIEW_SCHEMA, resolvePath } from "./lesson_review.ts";
import { lessonReviewEventPayload } from "./handlers.ts";
import { inputBlocks } from "./openai.ts";
import { A6_REVIEW_CRITERIA } from "./review_policy.ts";
import { buildLessonInput, buildLessonReviewInput, LESSON_SHARED_KEYS, lessonRefs, lessonRevision, lessonTools, reviewBlocking, toLessonDraft, TransientError, type LessonContext } from "./lessons.ts";
import { planRun, STEP_ORDER, STEP_SPECS, SUBMIT_STALE_MS, type RunContext, type StepKey } from "./steps.ts";

// ---- loop planning -----------------------------------------------------------------------------

const ids = ["a", "b", "c", "d"];
let seq = 0;
function gen(lesson: string, step: LessonStep, attempt: number, status: LessonGeneration["status"], over: Partial<LessonGeneration> = {}): LessonGeneration {
  return {
    id: `${step[0]}-${lesson}-${attempt}-${seq++}`,
    step_key: step,
    lesson_id: lesson,
    attempt,
    agent_role: step === "lessons" ? "A5" : "A6",
    status,
    // A failed row is a rejected answer by default; pass provider_request_id: null for a transport failure.
    provider_request_id: status === "submitting" ? null : "resp",
    error: status === "failed" ? `lỗi ${lesson}${attempt}` : null,
    created_at: new Date(now - 1000).toISOString(),
    ...over,
  };
}
const draft = (l: string, attempt = 0, status: LessonGeneration["status"] = "completed") => gen(l, "lessons", attempt, status);
const review = (l: string, attempt = 0, status: LessonGeneration["status"] = "completed") => gen(l, "lesson_review", attempt, status);

const plan = (rows: LessonGeneration[], blocking: Record<string, string[]> = {}, limit = 3) =>
  planLessons({ lessonIds: ids, rows, blocking, now, maxAttempts: { lessons: 2, lesson_review: 2 }, submitStaleMs: SUBMIT_STALE_MS, limit });
const kinds = (p: ReturnType<typeof plan>) => p.actions.map((a) => `${a.lessonId}:${a.kind === "submit" ? `${a.step}#${a.attempt}` : a.kind}`);

describe("studio lesson loop: planning", () => {
  it("starts drafts in curriculum order, at most `limit` actions per tick", () => {
    expect(kinds(plan([]))).toEqual(["a:lessons#0", "b:lessons#0", "c:lessons#0"]);
  });

  it("sends an accepted draft to review, and a passed review ends the lesson", () => {
    expect(kinds(plan([draft("a")], {}, 1))).toEqual(["a:lesson_review#0"]);
    const done = plan([draft("a"), review("a")], { a: [] });
    expect(kinds(done)[0]).toBe("b:lessons#0");
  });

  it("rewrites only the lesson whose review has blocking items, keeping the draft as parent", () => {
    const d = draft("a");
    const p = plan([d, review("a")], { a: ["lesson.title: sai"] }, 1);
    expect(p.actions).toEqual([{ lessonId: "a", kind: "submit", step: "lessons", attempt: 1, parentId: d.id, previousError: null }]);
    // minor-only review (no blocking items) does not rewrite
    expect(kinds(plan([d, review("a")], { a: [] }, 1))).toEqual(["b:lessons#0"]);
  });

  it("reviews the rewrite as a new attempt of the review step", () => {
    const rows = [draft("a"), review("a"), draft("a", 1)];
    expect(plan(rows, { a: ["x: y"] }, 1).actions).toEqual([{ lessonId: "a", kind: "submit", step: "lesson_review", attempt: 1, parentId: null, previousError: null }]);
  });

  it("interleaves lessons: one in review, one being rewritten, one passed, one new", () => {
    const rows = [
      draft("a"), review("a"), // passed
      draft("b"), review("b"), // blocking
      draft("c"), review("c", 0, "submitted"), // in review
    ];
    const p = plan(rows, { a: [], b: ["l: lỗi"] });
    expect(kinds(p)).toEqual(["c:poll", "b:lessons#1", "d:lessons#0"]);
  });

  it("fails a lesson that still has blocking items after the second review, listing them", () => {
    const rows = [draft("a"), review("a"), draft("a", 1), review("a", 1)];
    expect(MAX_LESSON_REVIEWS).toBe(2);
    const p = plan(rows, { a: ["lesson.title: sai", "questions[0]: sai"] });
    expect(p.exhausted).toEqual([{ lessonId: "a", reason: "còn lỗi blocking sau 2 lần review: lesson.title: sai; questions[0]: sai" }]);
    expect(p.outcome).toBe("failed");
    expect(p.actions).toEqual([]);
  });

  it("does not spend the model's attempts on requests that never reached the provider", () => {
    const transport = (attempt: number) => gen("a", "lessons", attempt, "failed", { provider_request_id: null });
    const others = ["b", "c", "d"].map((l) => draft(l));
    // Two transport failures leave both model attempts: the lesson is retried, the run goes on.
    const retried = plan([transport(0), transport(1), ...others]);
    expect(retried.exhausted).toEqual([]);
    expect(retried.actions.map((a) => `${a.lessonId}:${a.kind}`)).toContain("a:submit");
    // A lasting outage still ends: MAX_TRANSPORT_FAILURES in one round exhausts the lesson.
    const outage = plan([...Array.from({ length: MAX_TRANSPORT_FAILURES }, (_, i) => transport(i)), ...others]);
    expect(outage.exhausted.map((e) => e.lessonId)).toEqual(["a"]);
  });

  it("counts a provider failure after the request was accepted as infrastructure, not as the model's attempt", () => {
    const others = ["b", "c", "d"].map((l) => draft(l));
    // Accepted by the provider (it has a request id) and then failed by it, e.g. no flex capacity.
    const provider = (attempt: number) => gen("a", "lessons", attempt, "failed", { failure_kind: "provider" });
    const rejected = (attempt: number) => gen("a", "lessons", attempt, "failed", { failure_kind: "rejected" });
    expect(plan([provider(0), provider(1), ...others]).exhausted).toEqual([]);
    // Two refused answers use both model attempts.
    expect(plan([rejected(0), rejected(1), ...others]).exhausted.map((e) => e.lessonId)).toEqual(["a"]);
  });

  it("counts the retry budget per round: a rejected rewrite does not use up the reviews or earlier attempts", () => {
    const base_ = [draft("a"), review("a")];
    const blocking = { a: ["x: y"] };
    // rewrite attempt 1 rejected -> attempt 2 allowed, with the rejection as feedback
    const failed1 = draft("a", 1, "failed");
    const retry = plan([...base_, failed1], blocking, 1).actions[0];
    expect(retry).toEqual({ lessonId: "a", kind: "submit", step: "lessons", attempt: 2, parentId: failed1.id, previousError: "lỗi a1" });
    // attempt 2 rejected too -> the lesson is out of attempts (budget 2 counted from attempt 1)
    const p = plan([...base_, failed1, draft("a", 2, "failed")], blocking);
    expect(p.exhausted[0]).toMatchObject({ lessonId: "a", reason: "lỗi a2" });
    // a rejected review is retried without touching the draft
    const badReview = review("a", 0, "failed");
    expect(plan([draft("a"), badReview], {}, 1).actions[0]).toMatchObject({ kind: "submit", step: "lesson_review", attempt: 1, parentId: badReview.id });
  });

  it("keeps reading lessons in flight after one is out of options, then fails with the list", () => {
    const dead = [draft("a", 0, "failed"), draft("a", 1, "failed")];
    const during = plan([...dead, draft("b"), review("b", 0, "submitted")]);
    expect(during.outcome).toBe("continue");
    expect(kinds(during)).toEqual(["b:poll"]);
    const after = plan([...dead, draft("b"), review("b"), draft("c", 0, "failed"), draft("c", 1, "failed")], { b: [] });
    expect(after.outcome).toBe("failed");
    expect(after.exhausted.map((e) => e.lessonId)).toEqual(["a", "c"]);
  });

  it("waits on a fresh claim, expires a stale one and is done when every lesson passed", () => {
    expect(kinds(plan([draft("a", 0, "submitting")], {}, 5)).includes("a:expire_submitting")).toBe(false);
    const stale = gen("a", "lessons", 0, "submitting", { created_at: new Date(now - SUBMIT_STALE_MS - 1).toISOString() });
    expect(kinds(plan([stale], {}, 5))[0]).toBe("a:expire_submitting");
    const rows = ids.flatMap((l) => [draft(l), review(l)]);
    const done = plan(rows, Object.fromEntries(ids.map((l) => [l, []])));
    expect(done.outcome).toBe("done");
    expect(done.actions).toEqual([]);
  });

  it("treats a review whose result cannot be read as a failure instead of passing the lesson", () => {
    expect(plan([draft("a"), review("a")]).exhausted).toEqual([{ lessonId: "a", reason: "không đọc được kết quả review" }]);
  });

  it("drives both steps from planRun and finishes them one after the other", () => {
    const steps = (done: StepKey[]) => Object.fromEntries(STEP_ORDER.map((k) => [k, done.includes(k) ? "done" : "pending"])) as never;
    const upTo = ["catalog_research", "brief", "research", "curriculum", "curriculum_review"] as StepKey[];
    const rows = ids.flatMap((l) => [draft(l), review(l)]);
    const lessons = { ids, rows, blocking: Object.fromEntries(ids.map((l) => [l, [] as string[]])) };
    const input = { latest: null, startedAt: new Date(now - 1000).toISOString(), now, lessons };
    expect(planRun({ ...input, steps: steps(upTo) }).action.kind).toBe("mark_done");
    expect(planRun({ ...input, steps: steps([...upTo, "lessons"]) })).toMatchObject({ step: "lesson_review", action: { kind: "mark_done" } });
    const dead = { ...lessons, rows: [draft("a", 0, "failed"), draft("a", 1, "failed")], blocking: {} };
    expect(planRun({ ...input, steps: steps(upTo), lessons: dead }).action).toMatchObject({ kind: "finish", status: "draft_failed", reason: "Bước Tạo lesson: 1 lesson không đạt: a (lỗi a1)" });
    expect(planRun({ ...input, steps: steps(upTo), lessons: undefined }).action.kind).toBe("finish");
  });

  it("runs structure_check, journey_test and publish as code steps", () => {
    const steps = (done: StepKey[]) => Object.fromEntries(STEP_ORDER.map((k) => [k, done.includes(k) ? "done" : "pending"])) as never;
    const upTo = ["catalog_research", "brief", "research", "curriculum", "curriculum_review", "lessons", "lesson_review"] as StepKey[];
    const input = { latest: null, startedAt: new Date(now - 1000).toISOString(), now };
    expect(planRun({ ...input, steps: steps(upTo) })).toEqual({ step: "structure_check", action: { kind: "check", check: "structure_check" } });
    expect(planRun({ ...input, steps: steps([...upTo, "structure_check"]) }).action).toEqual({ kind: "check", check: "journey_test" });
    expect(planRun({ ...input, steps: steps([...upTo, "structure_check", "journey_test"]) })).toEqual({ step: "publish", action: { kind: "publish" } });
  });
});

// ---- review feedback and A6 acceptance ----------------------------------------------------------

const issue = (location: string, severity = "blocking", over: object = {}) => ({
  location,
  problem: "sai",
  fix: "sửa",
  category: severity === "blocking" ? "wrong_answer" : "style_or_wording",
  severity,
  verified_by: "source",
  ...over,
});
const verdictOf = (verdict: string, issues: object[] = [], unverified: string[] = []) => ({ verdict, issues, unverified, summary: "s" });

const quizOutput = { ...base, quiz: { questions: [question(), question()] } };
const codeOutput = { ...base, code: editCode, source_ids: ["s1", "s2"] };

// Reduced field sample from run c284b778; source IDs, package facts, and question states are retained.
const c284ResearchSample = {
  sources: [
    { source_id: "S05", title: "Solana wallet integration with Next.js and @solana/kit", url: "https://solana.com/docs/frontend/nextjs-solana", access: "read" },
    { source_id: "S07", title: "Installation — Next.js", url: "https://nextjs.org/docs/pages/getting-started/installation", access: "read" },
  ],
  topics: [],
  tool_versions: [
    { tool: "Node.js", version: "Minimum 20.9; source lists 24.22.1 LTS, without a locked Node choice.", source_ids: ["S07", "S22"] },
    { tool: "@solana/kit", version: "Guide recommends 8.3+; releases list 8.5.0; older tutorial says 7+.", source_ids: ["S08", "S09", "S05"] },
    { tool: "@solana/kit-plugin-rpc", version: "Guide recommends 0.19+; older tutorial says 0.13+.", source_ids: ["S08", "S05"] },
    { tool: "@solana/kit-plugin-wallet", version: "Guide recommends 0.20+; older tutorial says 0.14+.", source_ids: ["S08", "S05"] },
    { tool: "@solana/react", version: "Guide recommends 8+; older tutorial says 7+.", source_ids: ["S08", "S05"] },
  ],
  stack_choice: {
    tools: [{
      tool_type: "package_manager",
      selected: "npm",
      alternatives_considered: ["pnpm", "yarn"],
      basis: "source_recommended",
      reason: "The official course setup guide uses npm.",
      source_ids: ["S05"],
    }],
  },
  misconceptions: [],
  open_questions: [
    { question: "Exact compatible package versions are unverified; npm package pages returned 403.", impact: "Compatibility and reproducibility remain unresolved.", blocking: false, action: "Check registry metadata and peer dependencies." },
    { question: "Choose create-next-app or create-solana-dapp for the sample project.", impact: "This affects presentation, not evidence for connection or transfer steps.", blocking: false, action: "Read official setup docs before recommending create-solana-dapp." },
  ],
};
const c284CurriculumSample = {
  outcomes: [{ id: "o1", text: "Làm được thiết lập project." }],
  modules: [
    {
      id: "m2",
      title: "Kết nối",
      description: "",
      lessons: [
        lesson("m2_setup_explain", "article", { purpose: "explanation", source_ids: ["S05", "S07"] }),
        lesson("m2_node_only", "article", { purpose: "explanation", source_ids: ["S07"] }),
      ],
    },
    {
      id: "m1",
      title: "Nền tảng",
      description: "",
      lessons: [lesson("m1_diagnostic_js", "article", { purpose: "diagnostic", source_ids: ["S15", "S16"] })],
    },
  ],
};
function c284Context(lessonId: string, research = c284ResearchSample): RunContext {
  const sourceIds = lessonId === "m1_diagnostic_js" ? ["S15", "S16"] : lessonId === "m2_node_only" ? ["S07"] : ["S05", "S07"];
  return {
    ...ctx,
    outputs: { ...ctx.outputs, brief: { locale: "vi" }, research, curriculum: c284CurriculumSample },
    lesson: { drafts: 1, reviews: 0, draft: { ...base, source_ids: sourceIds, article }, review: null },
  };
}

function withLesson(lesson: LessonContext | null, id = "l-quiz"): [RunContext, string] {
  return [{ ...ctx, lesson }, id];
}

describe("studio lesson loop: research version handoff", () => {
  it("passes c284b778 package evidence and unresolved nonblocking questions to A5 and A6", () => {
    const writer = buildLessonInput(c284Context("m2_setup_explain"), "m2_setup_explain");
    const reviewer = buildLessonReviewInput(c284Context("m2_setup_explain"), "m2_setup_explain");
    const writerResearch = writer.research as Record<string, any>;
    const reviewerResearch = reviewer.research as Record<string, any>;

    for (const research of [writerResearch, reviewerResearch]) {
      expect(research.tool_versions).toEqual(c284ResearchSample.tool_versions);
      expect(research.stack_choice).toEqual(c284ResearchSample.stack_choice);
      expect(research.open_questions).toEqual(c284ResearchSample.open_questions);
      expect(research.open_questions.every((q: { blocking: boolean }) => !q.blocking)).toBe(true);
    }
  });

  it("gives the round 2 reviewer the issues of round 1 and nothing in round 1", () => {
    const first = buildLessonReviewInput(c284Context("m2_setup_explain"), "m2_setup_explain");
    expect(first.review_round).toBe(1);
    expect(first).not.toHaveProperty("previous_review");

    const issue = { location: "lesson.description_markdown", criterion: "factual_accuracy_by_sources", problem: "sai", fix: "sửa", category: "factual_inaccuracy", severity: "blocking", verified_by: "reasoning" };
    const second = buildLessonReviewInput(
      { ...c284Context("m2_setup_explain"), lesson: { ...c284Context("m2_setup_explain").lesson!, drafts: 2, reviews: 1, review: { verdict: "needs_fix", issues: [issue] } } },
      "m2_setup_explain",
    );
    expect(second.review_round).toBe(2);
    expect(second.previous_review).toMatchObject({ round: 1, issues: [{ location: "lesson.description_markdown", severity: "blocking", problem: "sai" }] });
  });

  it("starts the A5 and A6 input with the keys shared by every lesson of the run, in the same order", () => {
    for (const lessonId of ["m2_setup_explain", "m1_diagnostic_js"]) {
      const writer = buildLessonInput(c284Context(lessonId), lessonId);
      const reviewer = buildLessonReviewInput(c284Context(lessonId), lessonId);
      for (const input of [writer, reviewer]) {
        const keys = Object.keys(input).filter((k) => input[k] !== undefined);
        expect(keys.slice(0, LESSON_SHARED_KEYS.filter((k) => k in input).length)).toEqual(LESSON_SHARED_KEYS.filter((k) => k in input));
        expect(keys).toContain("lesson");
      }
      const [writerShared] = inputBlocks(writer, LESSON_SHARED_KEYS);
      const [reviewerShared] = inputBlocks(reviewer, LESSON_SHARED_KEYS);
      expect(writerShared).toBe(reviewerShared);
    }
  });

  it("filters versions without lesson-source overlap and omits blocking questions for both agents", () => {
    const researchWithBlocking = {
      ...c284ResearchSample,
      open_questions: [
        ...c284ResearchSample.open_questions,
        { ...c284ResearchSample.open_questions[0], blocking: true, question: "synthetic blocking sentinel" },
      ],
    };
    const writer = buildLessonInput(c284Context("m2_node_only", researchWithBlocking), "m2_node_only");
    const reviewer = buildLessonReviewInput(c284Context("m2_node_only", researchWithBlocking), "m2_node_only");
    for (const input of [writer, reviewer]) {
      const research = input.research as Record<string, any>;
      expect(research.tool_versions).toEqual([c284ResearchSample.tool_versions[0]]);
      expect(research.stack_choice).toEqual(c284ResearchSample.stack_choice);
      expect(research.open_questions).toEqual(c284ResearchSample.open_questions);
      expect(research.open_questions.some((q: { question: string }) => q.question === "synthetic blocking sentinel")).toBe(false);
    }

    const noVersionCtx = c284Context("m1_diagnostic_js", researchWithBlocking);
    for (const input of [
      buildLessonInput(noVersionCtx, "m1_diagnostic_js"),
      buildLessonReviewInput(noVersionCtx, "m1_diagnostic_js"),
    ]) {
      expect((input.research as Record<string, any>).tool_versions).toEqual([]);
    }
  });

  it("keeps legacy research without stack_choice readable for resumed lesson inputs", () => {
    const legacyResearch = { ...c284ResearchSample, stack_choice: undefined };
    const oldContext = c284Context("m2_node_only", legacyResearch);
    const writer = buildLessonInput(oldContext, "m2_node_only");
    const reviewer = buildLessonReviewInput(oldContext, "m2_node_only");

    expect(writer.research).not.toHaveProperty("stack_choice");
    expect(reviewer.research).not.toHaveProperty("stack_choice");
  });

  it("passes the course code language and only its guide to A5 and A6, defaulting legacy briefs to Rust", () => {
    const selectedContext = {
      ...ctx,
      outputs: { ...ctx.outputs, brief: { locale: "vi", code_language: "python" } },
    } as RunContext;
    const pythonGuide = getCodeLanguageAdapter("python")!.guide;
    const rustGuide = getCodeLanguageAdapter("rust")!.guide;
    const writer = buildLessonInput(selectedContext, "l-code") as Record<string, any>;
    expect(writer).toMatchObject({ code_language: "python", code_language_guide: pythonGuide });
    expect(writer.code_language_guide).not.toBe(rustGuide);

    const reviewContext = {
      ...selectedContext,
      lesson: { drafts: 1, reviews: 0, draft: { ...base, code: editCode }, review: null },
    } as RunContext;
    const reviewer = buildLessonReviewInput(reviewContext, "l-code") as Record<string, any>;
    expect(reviewer).toMatchObject({ code_language: "python", code_language_guide: pythonGuide });
    expect(reviewer.code_language_guide).not.toBe(rustGuide);
    expect(reviewer.checks_already_run.join(" ")).toContain("code_language=python");
    expect(reviewer.checks_already_run.join(" ")).toContain("Đã kiểm lộ đáp án");

    const legacyContext = { ...ctx, outputs: { ...ctx.outputs, brief: { locale: "vi" } } } as RunContext;
    expect(buildLessonInput(legacyContext, "l-code")).toMatchObject({ code_language: "rust", code_language_guide: rustGuide });
  });

  it("passes only source-matched video candidates to A5/A6 and gives A5 no video search tool", () => {
    const candidates = [
      { topic: "t1", url: "https://youtu.be/aaaaaaaaaaa", title: "Topic one", channel: "Rust Education", channel_basis: "Read channel evidence.", evidence_source_ids: ["s1"] },
      { topic: "t2", url: "https://youtu.be/bbbbbbbbbbb", title: "Topic two", channel: "Rust Education", channel_basis: "Read channel evidence.", evidence_source_ids: ["s2"] },
    ];
    const topics = (ctx.outputs.research as { topics: { topic: string }[] }).topics
      .map((topic) => ({ ...topic, topic: ` ${topic.topic} ` }));
    const research = { ...ctx.outputs.research, topics, videos: candidates };
    const lessonContext = {
      ...ctx,
      outputs: { ...ctx.outputs, research },
      lesson: { drafts: 1, reviews: 0, draft: { ...base, article }, review: null },
    };
    const writer = buildLessonInput(lessonContext, "l-art");
    const reviewer = buildLessonReviewInput(lessonContext, "l-art");
    // The ID the writer must answer with is given, not left to be read out of the URL.
    expect((writer.research as Record<string, any>).videos).toEqual([{ ...candidates[0], video_id: "aaaaaaaaaaa" }]);
    expect((reviewer.research as Record<string, any>).videos).toEqual([{ ...candidates[0], video_id: "aaaaaaaaaaa" }]);
    expect((buildLessonInput(lessonContext, "l-vid").research as Record<string, any>).videos).toEqual([{ ...candidates[1], video_id: "bbbbbbbbbbb" }]);
    expect(buildLessonInput(lessonContext, "l-vid")).toMatchObject({ lesson: { id: "l-vid", type: "video" } });
    expect(lessonTools("l-vid", lessonContext)).toBeUndefined();

    const { videos: _videos, ...legacyResearch } = research;
    const legacyContext = { ...lessonContext, outputs: { ...lessonContext.outputs, research: legacyResearch } };
    expect((buildLessonInput(legacyContext, "l-vid").research as Record<string, any>).videos).toEqual([]);
  });
});

describe("studio lesson loop: review input and acceptance", () => {
  it("resolves field paths of the lesson draft", () => {
    const draft = toLessonDraft(lessonRefs(curriculum).find((r) => r.lesson.id === "l-quiz")!, quizOutput as never, "vi");
    expect(resolvePath(draft, "lesson.title")).toBe("Tiêu đề");
    expect(resolvePath(draft, "questions[1].options[2]")).toEqual({ id: "c", text: "C" });
    expect(resolvePath(draft, "questions[2]")).toBeUndefined();
    expect(resolvePath(draft, "lesson.description_markdown")).toBeUndefined();
    expect(resolvePath(draft, "lesson.nope")).toBeUndefined();
    expect(resolvePath(draft, "questions[x]")).toBeUndefined();
    expect(resolvePath(draft, "")).toBeUndefined();
  });

  it("recomputes the A6 verdict, accepts legacy issues without category, and rejects bad locations", () => {
    const [c, id] = withLesson({ drafts: 1, reviews: 0, draft: quizOutput, review: null });
    const accept = (out: object) => acceptLessonReview(out, c, id);
    expect(accept(verdictOf("pass", [issue("lesson.title", "minor")]))).toMatchObject({
      ok: true,
      summary: "pass, 0 lỗi blocking, 1 minor.",
      normalizedOutput: { verdict: "pass" },
    });
    expect(accept(verdictOf("pass", [issue("questions[0].explanation")], ["mã chưa biên dịch"]))).toMatchObject({
      ok: true,
      summary: "needs_fix, 1 lỗi blocking, 0 minor.",
      normalizedOutput: { verdict: "needs_fix" },
    });
    expect(accept(verdictOf("needs_fix", [issue("lesson.title", "minor")]))).toMatchObject({
      ok: true,
      summary: "pass, 0 lỗi blocking, 1 minor.",
      normalizedOutput: { verdict: "pass" },
    });
    expect(accept(verdictOf("needs_fix"))).toMatchObject({ ok: true, normalizedOutput: { verdict: "pass" } });

    const outsideAllowList = issue("lesson.title", "blocking", { category: "missing_installation_steps" });
    expect(accept(verdictOf("needs_fix", [outsideAllowList]))).toMatchObject({
      ok: true,
      summary: expect.stringContaining("pass, 0 lỗi blocking, 1 minor"),
      normalizedOutput: { verdict: "pass", issues: [{ severity: "minor", category: "missing_installation_steps" }] },
    });
    const { category: _category, ...legacyIssue } = issue("lesson.title");
    expect(accept(verdictOf("needs_fix", [legacyIssue]))).toMatchObject({
      ok: true,
      summary: expect.stringContaining("pass, 0 lỗi blocking, 1 minor"),
      normalizedOutput: { verdict: "pass", issues: [{ severity: "minor", category: "other" }] },
    });

    expect(accept(verdictOf("pass", [issue("questions[7]", "minor")])).ok).toBe(false);
    expect(accept(verdictOf("needs_fix", [issue("lesson.title", "blocking", { problem: " " })])).ok).toBe(false);
    expect((LESSON_REVIEW_SCHEMA.properties.issues as any).items.properties.category.enum).toContain("optional_made_mandatory");
  });

  it("normalizes A6 evidence, resolves refs against lesson_draft, and keeps verdict issue-driven", () => {
    const [c, id] = withLesson({ drafts: 1, reviews: 0, draft: quizOutput, review: null });
    const issueWithCriterion = issue("lesson.title", "blocking", { criterion: "lesson_sequence" });
    const checks = [
      { criterion: "factual_accuracy_by_sources", result: "ok", basis: "Compared to cited source", refs: ["lesson.title"], verified_by: "source" },
      { criterion: "tool_versions", result: "ok", basis: "Reasoning only", refs: ["lesson.title"], verified_by: "reasoning" },
      { criterion: "outcome_and_level_fit", result: "ok", basis: "Invalid field", refs: ["lesson.not_a_field"], verified_by: "tool" },
      { criterion: "lesson_sequence", result: "ok", basis: "Context checked", refs: ["lesson.title"], verified_by: "source" },
      { criterion: "quiz_answers", result: "issue", basis: "No matching issue", refs: ["questions[0].question"], verified_by: "tool" },
      { result: "ok", basis: "Missing criterion", refs: ["lesson.title"], verified_by: "source" },
    ];
    const withChecks = acceptLessonReview({ ...verdictOf("pass", [issueWithCriterion]), checks }, c, id);
    const withoutChecks = acceptLessonReview(verdictOf("pass", [issueWithCriterion]), c, id);
    expect(withChecks).toMatchObject({ ok: true, summary: "needs_fix, 1 lỗi blocking, 0 minor." });
    const normalized = (withChecks as { normalizedOutput: { checks: { criterion: string; result: string; basis: string; refs: string[]; verified_by?: string }[] } }).normalizedOutput.checks;
    expect(normalized.find((check) => check.criterion === "factual_accuracy_by_sources")).toMatchObject({ result: "ok" });
    expect(normalized.find((check) => check.criterion === "tool_versions")).toMatchObject({ result: "ok", verified_by: "reasoning" });
    expect(normalized.find((check) => check.criterion === "outcome_and_level_fit")).toMatchObject({ result: "unverified", refs: [] });
    expect(normalized.find((check) => check.criterion === "lesson_sequence")).toMatchObject({ result: "issue" });
    expect(normalized.find((check) => check.criterion === "quiz_answers")).toMatchObject({ result: "unverified" });
    expect(normalized.find((check) => check.criterion === "diagrams")).toMatchObject({ result: "unverified", basis: "không được báo cáo" });
    expect(normalized).toHaveLength(A6_REVIEW_CRITERIA.length);
    expect((withChecks as { codeChecks: string[] }).codeChecks.join(" ")).toContain("CHƯA kiểm tra đáp án");
    expect((withoutChecks as { normalizedOutput: { verdict: string } }).normalizedOutput.verdict).toBe(
      (withChecks as { normalizedOutput: { verdict: string } }).normalizedOutput.verdict,
    );
    expect((LESSON_REVIEW_SCHEMA.properties.issues as any).items.properties.criterion.enum).toEqual([...A6_REVIEW_CRITERIA]);
    expect((LESSON_REVIEW_SCHEMA.properties.checks as any).items.properties.criterion.enum).toEqual([...A6_REVIEW_CRITERIA]);
  });

  it("does not block a missing optional install guide but blocks installing written as mandatory", () => {
    const optionalDraft = {
      ...base,
      article: { description_markdown: "Tự thực hành (không bắt buộc): cài công cụ rồi xem kết quả.", diagrams: [] },
    };
    const [optionalContext, optionalId] = withLesson({ drafts: 1, reviews: 0, draft: optionalDraft, review: null }, "l-art");
    const missingOptionalSteps = issue("lesson.description_markdown", "blocking", {
      problem: "Thiếu bước cài đặt tự nguyện.",
      category: "missing_installation_steps",
    });
    expect(acceptLessonReview(verdictOf("needs_fix", [missingOptionalSteps]), optionalContext, optionalId)).toMatchObject({
      ok: true,
      summary: expect.stringContaining("pass, 0 lỗi blocking, 1 minor"),
      normalizedOutput: { verdict: "pass", issues: [{ severity: "minor", category: "missing_installation_steps" }] },
    });

    const mandatoryDraft = {
      ...base,
      article: { description_markdown: "Bắt buộc cài công cụ trước khi học tiếp.", diagrams: [] },
    };
    const [mandatoryContext, mandatoryId] = withLesson({ drafts: 1, reviews: 0, draft: mandatoryDraft, review: null }, "l-art");
    const mandatoryInstall = issue("lesson.description_markdown", "blocking", {
      problem: "Bước cài đặt tự nguyện bị viết thành điều kiện bắt buộc.",
      category: "optional_made_mandatory",
    });
    expect(acceptLessonReview(verdictOf("pass", [mandatoryInstall]), mandatoryContext, mandatoryId)).toMatchObject({
      ok: true,
      summary: "needs_fix, 1 lỗi blocking, 0 minor.",
      normalizedOutput: { verdict: "needs_fix", issues: [{ severity: "blocking", category: "optional_made_mandatory" }] },
    });
  });

  it("gives the writer the review and the previous draft only while the draft waits for a rewrite", () => {
    const bad = verdictOf("needs_fix", [issue("questions[0].explanation"), issue("lesson.title", "minor")]);
    const waiting: LessonContext = { drafts: 1, reviews: 1, draft: quizOutput, review: bad };
    expect(lessonRevision(waiting)).toEqual({ round: 1, issues: bad.issues });
    expect(lessonRevision({ ...waiting, drafts: 2 })).toBeNull(); // rewritten, waits for its review
    expect(lessonRevision({ ...waiting, review: verdictOf("pass", [issue("lesson.title", "minor")]) })).toBeNull();
    expect(lessonRevision(null)).toBeNull();
    expect(reviewBlocking(bad)).toEqual(["questions[0].explanation: sai"]);
    const [c, id] = withLesson(waiting);
    expect(buildLessonInput(c, id)).toMatchObject({ previous_draft: quizOutput, review: { round: 1 } });
    expect(buildLessonInput({ ...c, lesson: null }, id)).not.toHaveProperty("review");
  });

  it("gives the reviewer the lesson as the app stores it and what the code already checked", () => {
    const [c, id] = withLesson({ drafts: 1, reviews: 0, draft: quizOutput, review: null });
    const input = buildLessonReviewInput(c, id) as Record<string, any>;
    expect(input.review_round).toBe(1);
    expect(input.lesson_draft.lesson).toMatchObject({ id: "l-quiz", lesson_format: "quiz", quiz_config: { passing_ratio: 0.7 } });
    expect(input.lesson_draft.questions).toHaveLength(2);
    expect(input.checks_already_run.join(" ")).toContain("CHƯA kiểm tra đáp án");
    const [code] = withLesson({ drafts: 1, reviews: 1, draft: codeOutput, review: verdictOf("pass") }, "l-code");
    expect(buildLessonReviewInput(code, "l-code")).toMatchObject({ review_round: 2 });
    expect((buildLessonReviewInput(code, "l-code").checks_already_run as string[]).join(" ")).toContain("CHƯA biên dịch");
    expect(() => buildLessonReviewInput({ ...ctx, lesson: null }, "l-quiz")).toThrow();
  });

  it("shows system-built supplemental video resources to A6", () => {
    const draft = { ...base, article, suggested_videos: ["aaaaaaaaaaa"] };
    const [c, id] = withLesson({ drafts: 1, reviews: 0, draft, review: null }, "l-art");
    const input = buildLessonReviewInput(c, id) as Record<string, any>;
    expect(input.lesson_draft.lesson.resources).toContainEqual({
      title: "Video: Worked example for t1 — Rust Education",
      url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    });
    expect(input.checks_already_run.join(" ")).toContain("suggested video thuộc ứng viên lesson");
  });

  it("has a reviewer spec without web search and with a strict schema", () => {
    const spec = STEP_SPECS.lesson_review!;
    // The reviewer checks against the sources the research step already read.
    expect(spec.lessonTools!("l-art", ctx)).toBeUndefined();
    expect(spec.maxAttempts).toBe(2);
    expect((spec.schema as { required: string[] }).required).toEqual(["verdict", "issues", "checks", "unverified", "summary"]);
  });
});

// ---- structure_check and journey_test -----------------------------------------------------------

const prov = { model_id: "gpt-6-luna", prompt_version: "a5-lesson@v15" };
const outputs: Record<string, object> = {
  "l-art": { ...base, article },
  "l-quiz": quizOutput,
  "l-code": codeOutput,
  "l-prac": { ...base, practice: { description_markdown: "Làm.", mode: "instruction", checklist_items: [] } },
  "l-vid": { ...base, source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 0, end_seconds: 0 } },
};
function records(over: Partial<Record<string, object>> = {}): Record<string, LessonRecord> {
  return Object.fromEntries(lessonRefs(curriculum).map((r) => [
    r.lesson.id,
    { draft: toLessonDraft(r, (over[r.lesson.id] ?? outputs[r.lesson.id]) as never, "vi", ctx.outputs.research as never), written: prov, reviewed: prov },
  ]));
}
const research = ctx.outputs.research;
const withOutcomes = (outcomes: unknown[], lessonOver: Record<string, object> = {}) => ({
  ...curriculum,
  outcomes,
  modules: curriculum.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l, ...(lessonOver[l.id] ?? {}) })) })),
});

describe("studio structure_check", () => {
  it("passes complete, valid lessons", () => {
    expect(structureProblems(curriculum, research, records())).toEqual([]);
  });

  it("records passing and failing grouped structure checks without changing failures", () => {
    const validChecks: { id: string; passed: number; total: number }[] = [];
    expect(structureProblems(curriculum, research, records(), validChecks)).toEqual([]);
    expect(validChecks.map((check) => check.id)).toEqual([
      "structure.curriculum_match",
      "structure.review_refs",
      "structure.prerequisite_refs",
      "structure.accepted_lessons",
      "structure.lesson_rules",
    ]);
    expect(validChecks.find((check) => check.id === "structure.curriculum_match")).toMatchObject({ passed: 5, total: 5 });

    const broken = records();
    delete broken["l-code"];
    broken["l-art"].draft.lesson.title = " ";
    const dangling = withOutcomes([], { "l-quiz": { review_lesson_ids: ["l-ghost"], prerequisite_lesson_ids: ["l-ghost"] } });
    const evidence: { id: string; passed: number; total: number; failed_refs?: string[] }[] = [];
    const problems = structureProblems(dangling, research, broken, evidence);
    expect(problems).toContain("l-code: chưa có lesson được nhận");
    expect(evidence.find((check) => check.id === "structure.review_refs")).toMatchObject({ passed: 0, total: 1, failed_refs: ["l-quiz->l-ghost"] });
    expect(evidence.find((check) => check.id === "structure.prerequisite_refs")).toMatchObject({ passed: 0, total: 1 });
    expect(evidence.find((check) => check.id === "structure.accepted_lessons")).toMatchObject({ passed: 4, total: 5 });
    expect(evidence.find((check) => check.id === "structure.lesson_rules")).toMatchObject({ passed: 3, total: 5 });
  });

  it("lists missing and extra lessons", () => {
    const all = records();
    delete all["l-code"];
    const extra = { ...all, "l-zzz": all["l-art"] };
    const problems = structureProblems(curriculum, research, extra);
    expect(problems).toContain("l-code: chưa có lesson được nhận");
    expect(problems).toContain("lesson thừa không có trong curriculum: l-zzz");
  });

  it("finds lessons that break the app's publish rules", () => {
    const all = records();
    all["l-art"].draft.lesson.title = " ";
    all["l-quiz"].draft.questions[0].correct_index = 9;
    all["l-code"].draft.lesson.code_exercise_config!.reference_solution = "fn nope() {}";
    all["l-vid"].draft.lesson.youtube_url = "https://example.com/v";
    const problems = structureProblems(curriculum, research, all).join("\n");
    expect(problems).toContain("l-art: title: title_required");
    expect(problems).toContain("l-quiz: câu 1: invalid_correct_index");
    expect(problems).toContain("l-code: code_exercise_config: solution_failed");
    expect(problems).toContain("l-vid: youtube_url: youtube_required");
  });

  it("checks references: review lessons, resource sources, source ids, diagrams", () => {
    const all = records();
    all["l-art"].draft.lesson.resources = [{ title: "x", url: "https://elsewhere.dev/" }];
    all["l-art"].draft.lesson.description_markdown = "Không có ảnh.";
    all["l-art"].draft.source_ids = ["s9"];
    const dangling = withOutcomes([], { "l-quiz": { review_lesson_ids: ["l-ghost"] } });
    const problems = structureProblems(dangling, research, all).join("\n");
    expect(problems).toContain("l-quiz: review_lesson_ids trỏ tới lesson không có (l-ghost)");
    expect(problems).toContain("l-art: resource https://elsewhere.dev/ không thuộc nguồn đã đọc");
    expect(problems).toContain("không được tham chiếu trong markdown");
    expect(problems).toContain("l-art: source_id s9 ngoài curriculum");
  });

  it("accepts only code-built candidate video resources under each lesson", () => {
    const all = records({
      "l-art": { ...base, article, suggested_videos: ["aaaaaaaaaaa"] },
    });
    expect(all["l-art"].draft.lesson.resources).toContainEqual({
      title: "Video: Worked example for t1 — Rust Education",
      url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    });
    expect(structureProblems(curriculum, research, all)).toEqual([]);

    all["l-art"].draft.lesson.resources![0].url = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
    expect(structureProblems(curriculum, research, all).join("\n"))
      .toContain("resource https://www.youtube.com/watch?v=bbbbbbbbbbb không phải video xem thêm hợp lệ của lesson");
  });

  it("requires provenance for both the writer and the reviewer", () => {
    const all = records();
    all["l-art"].written = { model_id: "", prompt_version: "x" };
    all["l-quiz"].reviewed = null;
    const problems = structureProblems(curriculum, research, all);
    expect(problems).toContain("l-art: thiếu model_id/prompt_version của bản viết");
    expect(problems).toContain("l-quiz: chưa có review được nhận (model_id/prompt_version)");
  });
});

describe("studio structure_check: links", () => {
  const withLinks = () => {
    const all = records();
    all["l-art"].draft.lesson.resources = [{ title: "Book", url: "https://doc.rust-lang.org/book/" }];
    return all;
  };
  const answer = (status: (url: string, method: string) => number): typeof fetch =>
    ((url: string, init?: RequestInit) => {
      const target = String(url);
      const code = status(target, init?.method ?? "GET");
      const body = target.includes("oembed") && code === 200 ? JSON.stringify({ author_name: "Rust Education" }) : "";
      return Promise.resolve(new Response(body, { status: code }));
    }) as unknown as typeof fetch;

  it("passes when resources and the video answer", async () => {
    expect(await linkProblems(withLinks(), answer(() => 200))).toEqual([]);
  });

  it("records link counts and bot-restricted links as accepted warnings", async () => {
    const restricted: string[] = [];
    const evidence: { id: string; passed: number; total: number; warning_refs?: string[] }[] = [];
    expect(await linkProblems(withLinks(), answer((url) => url.includes("oembed") ? 200 : 403), restricted, evidence)).toEqual([]);
    expect(evidence[0].id).toBe("structure.links");
    expect(evidence[0].passed).toBe(evidence[0].total);
    expect(evidence[0].warning_refs?.length).toBeGreaterThan(0);
    expect(restricted.length).toBeGreaterThan(0);
  });

  it("does not make a generic HTTP request to a suggested YouTube watch page", async () => {
    const all = withLinks();
    const url = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
    all["l-art"].draft.lesson.resources!.push({ title: "Video: Topic one — Rust Education", url });
    const requested: string[] = [];
    const fetcher = ((target: string) => {
      requested.push(target);
      return Promise.resolve(new Response(JSON.stringify({ author_name: "Rust Education" }), { status: 200 }));
    }) as unknown as typeof fetch;
    expect(await linkProblems(all, fetcher)).toEqual([]);
    expect(requested).not.toContain(url);
    expect(requested.some((target) => target.includes("/oembed"))).toBe(true);
  });

  it("reports a missing page or video", async () => {
    const problems = await linkProblems(withLinks(), answer((url) => (url.includes("oembed") ? 404 : url.includes("rust-lang") ? 404 : 200)));
    expect(problems).toEqual(["l-art: resource https://doc.rust-lang.org/book/ không truy cập được", "l-vid: video dQw4w9WgXcQ không truy cập được"]);
  });

  it("falls back to GET when HEAD is refused, and does not count a bot block as a missing page", async () => {
    expect(await linkProblems(withLinks(), answer((_u, method) => (method === "HEAD" ? 405 : 200)))).toEqual([]);
    expect(await linkProblems(withLinks(), answer((url) => (url.includes("oembed") ? 200 : 403)))).toEqual([]);
  });

  it("defers when the only obstacle is a server error or no network", async () => {
    await expect(linkProblems(withLinks(), answer(() => 503))).rejects.toBeInstanceOf(TransientError);
    await expect(linkProblems(withLinks(), (() => Promise.reject(new Error("offline"))) as typeof fetch)).rejects.toBeInstanceOf(TransientError);
    // a definite miss is reported even when something else is temporarily down
    const mixed = answer((url) => (url.includes("oembed") ? 404 : 503));
    await expect(linkProblems(withLinks(), mixed)).resolves.toEqual(["l-vid: video dQw4w9WgXcQ không truy cập được"]);
  });
});

describe("studio journey_test", () => {
  const good = withOutcomes([{ id: "o1", text: "x", check_lesson_ids: ["l-quiz"] }]);

  it("passes a curriculum whose outcomes are taught, then checked by a later quiz", () => {
    expect(journeyProblems(good, records())).toEqual([]);
  });

  it("records grouped journey checks for valid and broken lesson groups", () => {
    const validChecks: { id: string; passed: number; total: number }[] = [];
    expect(journeyProblems(good, records(), validChecks)).toEqual([]);
    expect(validChecks.map((check) => check.id)).toEqual([
      "journey.outcome_order",
      "journey.lesson_order",
      "journey.accepted_lessons",
      "journey.quiz_thresholds",
      "journey.code_exercises",
      "journey.practice_no_submission",
    ]);

    const all = records();
    all["l-quiz"].draft.questions[0].correct_index = 9;
    all["l-code"].draft.lesson.code_exercise_config!.file.starter_source = all["l-code"].draft.lesson.code_exercise_config!.reference_solution;
    all["l-prac"].draft.lesson.practice_config = { mode: "instruction", requires_review: true };
    const brokenChecks: { id: string; passed: number; total: number; failed_refs?: string[] }[] = [];
    expect(journeyProblems(good, all, brokenChecks)).toContain("l-prac: practice có bài nộp hoặc chờ chấm");
    expect(brokenChecks.find((check) => check.id === "journey.quiz_thresholds")).toMatchObject({ passed: 0, total: 1, failed_refs: ["l-quiz"] });
    expect(brokenChecks.find((check) => check.id === "journey.code_exercises")).toMatchObject({ passed: 0, total: 1, failed_refs: ["l-code"] });
    expect(brokenChecks.find((check) => check.id === "journey.practice_no_submission")).toMatchObject({ passed: 0, total: 1, failed_refs: ["l-prac"] });
  });

  it("checks that every outcome is taught and checked by a later lesson of any checking format", () => {
    const early = withOutcomes([{ id: "o1", text: "x", check_lesson_ids: ["l-quiz"] }], { "l-art": { outcome_ids: [] }, "l-code": { outcome_ids: ["o1"] } });
    // taught only by l-code, which comes after the quiz
    expect(journeyProblems(early, records())).toContain("outcome o1: không lesson kiểm tra nào đứng sau lesson dạy");
    expect(journeyProblems(withOutcomes([{ id: "o1", text: "x", check_lesson_ids: [] }]), records())).toContain("outcome o1: không có lesson kiểm tra");
    expect(journeyProblems(withOutcomes([{ id: "o9", text: "x", check_lesson_ids: ["l-quiz"] }]), records())).toContain("outcome o9: không có lesson dạy");
  });

  it("counts explanation and worked_example lessons as teaching even when they are also listed as checks", () => {
    // Practice-only outcome: worked example, guided and final practice are all check lessons, as A3 lists them.
    const practiceOnly = withOutcomes([{ id: "o1", text: "x", check_lesson_ids: ["l-code", "l-prac"] }], {
      "l-art": { outcome_ids: [] },
      "l-code": { outcome_ids: ["o1"], purpose: "worked_example" },
      "l-prac": { outcome_ids: ["o1"], purpose: "guided_practice" },
    });
    expect(journeyProblems(practiceOnly, records()).filter((p) => p.startsWith("outcome o1"))).toEqual([]);
    // Practice alone does not teach: without an explanation or worked example the outcome is untaught.
    const untaught = withOutcomes([{ id: "o1", text: "x", check_lesson_ids: ["l-prac"] }], {
      "l-art": { outcome_ids: [] },
      "l-quiz": { outcome_ids: [] },
      "l-code": { outcome_ids: [] },
      "l-prac": { outcome_ids: ["o1"], purpose: "guided_practice" },
      "l-vid": { outcome_ids: [] },
    });
    expect(journeyProblems(untaught, records())).toContain("outcome o1: không có lesson dạy");
  });

  it("checks the order of review lessons and prerequisites", () => {
    const quizReview = withOutcomes([], { "l-quiz": { review_lesson_ids: ["l-code"] } });
    expect(journeyProblems(quizReview, records())).toContain("l-quiz: lesson ôn l-code không đứng trước quiz");
    const prereq = withOutcomes([], { "l-art": { prerequisite_lesson_ids: ["l-code"] }, "l-prac": { prerequisite_lesson_ids: ["l-art"] } });
    const problems = journeyProblems(prereq, records());
    expect(problems).toContain("l-art: prerequisite l-code không đứng trước");
    expect(problems.filter((p) => p.startsWith("l-prac"))).toEqual([]);
  });

  it("plays the quizzes and exercises", () => {
    const all = records();
    all["l-quiz"].draft.questions[0].correct_index = 9;
    expect(journeyProblems(good, all)).toContain("l-quiz: trả lời đúng hết vẫn không đạt ngưỡng 0.7");
    const solved = records({ "l-code": { ...codeOutput, code: { ...editCode, starter_source: editCode.reference_solution } } });
    expect(journeyProblems(good, solved)).toContain("l-code: starter_source đã đạt mọi test bắt buộc");
    const brokenCode = records({ "l-code": { ...codeOutput, code: { ...fillCode, reference_solution: "let x = 5;" } } });
    expect(journeyProblems(good, brokenCode).join("\n")).toContain("l-code: code: solution_failed");
    const lowRatio = records();
    lowRatio["l-quiz"].draft.lesson.quiz_config = { passing_ratio: 0, allow_retry: true };
    expect(journeyProblems(good, lowRatio)).toContain("l-quiz: ngưỡng 0 ngoài (0.01, 1]");
  });

  it("rejects practice that needs a submission", () => {
    const all = records();
    all["l-prac"].draft.lesson.practice_config = { mode: "instruction", requires_review: true };
    expect(journeyProblems(good, all)).toContain("l-prac: practice có bài nộp hoặc chờ chấm");
    (all["l-prac"].draft.lesson.practice_config as { mode: string }).mode = "submission";
    expect(journeyProblems(good, all).join("\n")).toContain("cần bài nộp");
  });

  it("reports a lesson with no accepted draft", () => {
    const all = records();
    delete all["l-vid"];
    expect(journeyProblems(good, all)).toContain("l-vid: chưa có lesson được nhận");
  });

  it("builds lesson_review event payload matching normalizedOutput and handles downgraded issues", () => {
    const passNorm = {
      verdict: "pass",
      issues: [],
      checks: [{ criterion: "lesson_sequence", result: "ok", verified_by: "source" }],
    };
    const p1 = lessonReviewEventPayload(passNorm, ["code check 1"], "lesson-1");
    expect(p1).toEqual({
      checks: passNorm.checks,
      code_checks: ["code check 1"],
      lesson_id: "lesson-1",
      verdict: "pass",
      blocking: 0,
      minor: 0,
      blocking_categories: [],
    });

    const failNorm = {
      verdict: "needs_fix",
      issues: [
        { severity: "blocking", category: "wrong_facts_or_definitions" },
        { severity: "blocking", category: "prerequisite_missing" },
        { severity: "blocking", category: "code_reference_broken" },
        { severity: "blocking", category: "unsupported_platform_format" },
        { severity: "minor", category: "spelling" },
      ],
      checks: [],
    };
    const p2 = lessonReviewEventPayload(failNorm, [], "lesson-2");
    expect(p2.verdict).toBe("needs_fix");
    expect(p2.blocking).toBe(4);
    expect(p2.minor).toBe(1);
    expect(p2.blocking_categories).toHaveLength(3);
    expect(p2.blocking_categories).toEqual([
      "wrong_facts_or_definitions",
      "prerequisite_missing",
      "code_reference_broken",
    ]);

    const [c, id] = withLesson({ drafts: 1, reviews: 0, draft: quizOutput, review: null }, "l-quiz");
    const rawOutput = {
      verdict: "needs_fix",
      issues: [
        {
          location: "lesson.title",
          problem: "Custom issue outside allow-list",
          fix: "fix it",
          criterion: "lesson_sequence",
          category: "custom_unknown_category",
          severity: "blocking",
          verified_by: "source",
        },
      ],
      checks: [],
      unverified: [],
      summary: "Review summary",
    };
    const acceptance = acceptLessonReview(rawOutput, c, id);
    expect(acceptance.ok).toBe(true);
    const p3 = lessonReviewEventPayload(acceptance.normalizedOutput, acceptance.codeChecks, id);
    expect(p3.verdict).toBe("pass");
    expect(p3.blocking).toBe(0);
    expect(p3.minor).toBe(1);
    expect(p3.blocking_categories).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { planLessons, type LessonGeneration, type LessonStep } from "./lesson_flow.ts";
import { SUBMIT_STALE_MS } from "./steps.ts";

// A resumed run holds copies of accepted generations (attempt 0, completed) and nothing for the lessons
// to redo, so the lesson planner needs no special case.
describe("studio resume: planning on a resumed run", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const copy = (lesson: string, step: LessonStep): LessonGeneration => ({
    id: `copy-${step}-${lesson}`,
    step_key: step,
    lesson_id: lesson,
    attempt: 0,
    agent_role: step === "lessons" ? "A5" : "A6",
    status: "completed",
    provider_request_id: `resume:${lesson}`,
    error: null,
    created_at: new Date(now - 1000).toISOString(),
  });
  const plan = (rows: LessonGeneration[], blocking: Record<string, string[]>) =>
    planLessons({ lessonIds: ["done", "unreviewed", "redo"], rows, blocking, now, maxAttempts: { lessons: 2, lesson_review: 2 }, submitStaleMs: SUBMIT_STALE_MS, limit: 5 });

  it("keeps done lessons, reviews a kept draft and redoes the rest with a fresh budget", () => {
    const rows = [copy("done", "lessons"), copy("done", "lesson_review"), copy("unreviewed", "lessons")];
    const p = plan(rows, { done: [] });
    expect(p.actions).toEqual([
      { lessonId: "unreviewed", kind: "submit", step: "lesson_review", attempt: 0, parentId: null, previousError: null },
      { lessonId: "redo", kind: "submit", step: "lessons", attempt: 0, parentId: null, previousError: null },
    ]);
    expect(p.outcome).toBe("continue");
  });

  it("is done at once when every lesson was copied", () => {
    const ids = ["done", "unreviewed", "redo"];
    const rows = ids.flatMap((l) => [copy(l, "lessons"), copy(l, "lesson_review")]);
    expect(plan(rows, { done: [], unreviewed: [], redo: [] }).outcome).toBe("done");
  });
});

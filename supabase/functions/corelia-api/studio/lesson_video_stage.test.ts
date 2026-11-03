import { describe, expect, it } from "vitest";
import { isFallbackRow, planLessons, videoStage, type LessonGeneration, type VideoPlan } from "./lesson_flow.ts";
import { VIDEO_SEGMENT_MAX_ATTEMPTS } from "./video_segment.ts";

const now = Date.parse("2026-11-03T12:00:00Z");
const SUBMIT_STALE_MS = 10 * 60 * 1000;
const A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
const segment = { video_url: A, mode: "segment", start_seconds: 10, end_seconds: 200, key_points: ["one", "two", "three"] };

const row = (lessonId: string, step: LessonGeneration["step_key"], attempt: number, status: LessonGeneration["status"], extra: Partial<LessonGeneration> = {}): LessonGeneration =>
  ({
    id: `${lessonId}-${step}-${attempt}`,
    attempt,
    agent_role: step === "lesson_video" ? "A8" : "A5",
    status,
    provider_request_id: status === "submitting" ? null : `req-${lessonId}-${step}-${attempt}`,
    failure_kind: null,
    error: null,
    created_at: new Date(now - 1000).toISOString(),
    lesson_id: lessonId,
    step_key: step,
    ...extra,
  }) as LessonGeneration;
const accepted = (lessonId: string, attempt: number) => row(lessonId, "lesson_video", attempt, "completed", { output: { accepted: true, segment } as never });
const rejected = (lessonId: string, attempt: number) => row(lessonId, "lesson_video", attempt, "completed", { output: { accepted: false, reason: "không khớp outcome của bài" } as never });
const transport = (lessonId: string, attempt: number) => row(lessonId, "lesson_video", attempt, "failed", { failure_kind: "transport", error: "Gemini không trả lời trong thời gian cho phép" });
const fallbackRow = (lessonId: string, attempt: number, reason: string) => row(lessonId, "lesson_video", attempt, "failed", { failure_kind: "rejected", error: reason });

const video = (offered: Record<string, string[]>, over: Partial<VideoPlan> = {}): VideoPlan => ({ offered, geminiConfigured: true, maxAttempts: 2, ...over });
const plan = (ids: string[], rows: LessonGeneration[], videoPlan: VideoPlan, limit = 3) =>
  planLessons({ lessonIds: ids, rows, blocking: {}, now, maxAttempts: { lessons: 2, lesson_review: 2 }, submitStaleMs: SUBMIT_STALE_MS, limit, video: videoPlan });

describe("studio video stage planning (A8)", () => {
  it("asks A8 for the first offered candidate of a video lesson, and starts one call per tick", () => {
    const p = plan(["v1", "v2"], [], video({ v1: [A, B], v2: [B] }));
    const videoSubmits = p.actions.filter((a) => a.kind === "submit" && a.step === "lesson_video");
    expect(videoSubmits).toEqual([{ lessonId: "v1", kind: "submit", step: "lesson_video", attempt: 0, parentId: null, previousError: null, video: { url: A, candidateIndex: 0 } }]);
    expect(p.actions.some((a) => a.lessonId === "v2")).toBe(false);
  });

  it("moves to the next candidate after a call that gave no segment", () => {
    const p = plan(["v1"], [rejected("v1", 0)], video({ v1: [A, B] }));
    expect(p.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lesson_video", attempt: 1, video: { url: B, candidateIndex: 1 } })]);
  });

  it("writes the draft from an accepted segment, not from the video stage", () => {
    const p = plan(["v1"], [accepted("v1", 0)], video({ v1: [A, B] }));
    expect(p.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lessons", attempt: 0 })]);
  });

  it("records a fallback when no candidate gives a segment, and then writes the lesson as an article", () => {
    const first = plan(["v1"], [rejected("v1", 0), rejected("v1", 1)], video({ v1: [A, B] }));
    expect(first.actions).toEqual([expect.objectContaining({ kind: "record_fallback", reason: "không đoạn nào trong 2 video đạt" })]);
    const after = plan(["v1"], [rejected("v1", 0), rejected("v1", 1), fallbackRow("v1", 2, "không đoạn nào trong 2 video đạt")], video({ v1: [A, B] }));
    expect(after.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lessons", attempt: 0 })]);
  });

  it("records a fallback without calling A8 when the Gemini key is not configured", () => {
    const p = plan(["v1"], [], video({ v1: [A] }, { geminiConfigured: false }));
    expect(p.actions).toEqual([expect.objectContaining({ kind: "record_fallback", reason: "chưa cấu hình Gemini" })]);
  });

  it("records a fallback when no research video of the lesson can be embedded", () => {
    const p = plan(["v1"], [], video({ v1: [] }));
    expect(p.actions).toEqual([expect.objectContaining({ kind: "record_fallback", reason: "không có video ứng viên dùng được" })]);
  });

  it("retries a transport failure on the same candidate, and falls back once the failures use up the budget", () => {
    const retry = plan(["v1"], [transport("v1", 0)], video({ v1: [A, B] }));
    expect(retry.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lesson_video", attempt: 1, parentId: "v1-lesson_video-0", video: { url: A, candidateIndex: 0 } })]);
    const many = Array.from({ length: VIDEO_SEGMENT_MAX_ATTEMPTS }, (_, i) => transport("v1", i));
    const spent = plan(["v1"], many, video({ v1: [A, B] }));
    expect(spent.actions).toEqual([expect.objectContaining({ kind: "record_fallback", reason: "Gemini không trả lời trong thời gian cho phép" })]);
  });

  it("expires a stale call and waits for a fresh one", () => {
    const stale = row("v1", "lesson_video", 0, "submitting", { created_at: new Date(now - SUBMIT_STALE_MS - 1000).toISOString() });
    expect(plan(["v1"], [stale], video({ v1: [A] })).actions).toEqual([expect.objectContaining({ kind: "expire_submitting", generationId: "v1-lesson_video-0" })]);
    const fresh = row("v1", "lesson_video", 0, "submitting");
    expect(plan(["v1"], [fresh], video({ v1: [A] })).actions).toEqual([]);
  });

  it("keeps a recorded fallback for good: a later key or candidate does not reopen the stage", () => {
    const p = plan(["v1"], [fallbackRow("v1", 0, "chưa cấu hình Gemini")], video({ v1: [A] }));
    expect(p.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lessons", attempt: 0 })]);
    expect(isFallbackRow(fallbackRow("v1", 0, "x"))).toBe(true);
  });

  it("gives the stage verdict as data: segment, fallback, or the next submit", () => {
    expect(videoStage([accepted("v1", 0)], [A], { geminiConfigured: true, maxAttempts: 2 }, now, SUBMIT_STALE_MS)).toEqual({ kind: "segment", segment });
    expect(videoStage([], [A], { geminiConfigured: true, maxAttempts: 2 }, now, SUBMIT_STALE_MS)).toEqual({
      kind: "submit", attempt: 0, parentId: null, previousError: null, url: A, candidateIndex: 0,
    });
  });

  it("does not ask A8 again for a lesson that already has a completed draft, as in a resumed run", () => {
    const draft = row("v1", "lessons", 0, "completed", { output: { lesson: "ok" } as never });
    // The copied video rows of a resumed run: a transport failure is not copied, so only the judged candidate is here.
    const resumed = plan(["v1"], [rejected("v1", 0), draft], video({ v1: [A, B] }));
    expect(resumed.actions.some((a) => a.step === "lesson_video")).toBe(false);
    expect(resumed.actions.some((a) => a.kind === "record_fallback")).toBe(false);
    // A legacy lesson with a draft and no video rows at all: the stage is not started either.
    const legacy = plan(["v1"], [draft], video({ v1: [A, B] }));
    expect(legacy.actions.some((a) => a.step === "lesson_video")).toBe(false);
  });

  it("moves to the next candidate when Gemini refuses a video, and falls back when every candidate is refused", () => {
    const refused = (lessonId: string, attempt: number, status: number) =>
      row(lessonId, "lesson_video", attempt, "completed", { output: { accepted: false, reason: `Gemini từ chối video này (HTTP ${status})`, refused_http: status } as never });
    const next = plan(["v1"], [refused("v1", 0, 400)], video({ v1: [A, B] }));
    expect(next.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lesson_video", attempt: 1, video: { url: B, candidateIndex: 1 } })]);
    const none = plan(["v1"], [refused("v1", 0, 400), refused("v1", 1, 404)], video({ v1: [A, B] }));
    expect(none.actions).toEqual([expect.objectContaining({ kind: "record_fallback", reason: "không đoạn nào trong 2 video đạt" })]);
  });

  it("gives a candidate maxAttempts failed calls in all, provider errors included, before the stage falls back", () => {
    const keyError = (attempt: number) =>
      row("v1", "lesson_video", attempt, "failed", { failure_kind: "provider", error: "Gemini HTTP 403 (khóa hoặc quyền truy cập)" });
    const once = plan(["v1"], [keyError(0)], video({ v1: [A, B] }));
    expect(once.actions).toEqual([expect.objectContaining({ kind: "submit", step: "lesson_video", attempt: 1, video: { url: A, candidateIndex: 0 } })]);
    const twice = plan(["v1"], [keyError(0), keyError(1)], video({ v1: [A, B] }));
    expect(twice.actions).toEqual([expect.objectContaining({ kind: "record_fallback", reason: "Gemini HTTP 403 (khóa hoặc quyền truy cập)" })]);
  });
});

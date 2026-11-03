// Planning of the lessons / lesson_review pair. Every lesson goes through its own loop
//   draft (A5) -> review (A6) -> [blocking items: rewrite -> review] -> done
// and the loops of different lessons interleave. A video lesson first goes through the video stage
// (A8): one candidate at a time, and at most one Gemini call per tick. When the stage ends with no usable
// segment, the lesson is written as an article. Pure: the handler executes the actions.
// Counting is from accepted generations, like the curriculum loop: every accepted review
// consumes one accepted draft.

import type { GenerationState } from "./steps.ts";
import { canRetry, roundFailures, type AttemptRow, type RoundFailures } from "./retry.ts";
import type { ChosenVideoSegment } from "./video_segment.ts";

export type LessonStep = "lessons" | "lesson_review" | "lesson_video";

/** A review is the verdict on one accepted draft; at most this many per lesson. */
export const MAX_LESSON_REVIEWS = 2;
/** One more round when the last review raised a blocking item the author has not been told about yet. */
export const MAX_LESSON_REVIEWS_LATE = 3;
export const LESSONS_PER_TICK = 3;

export type LessonGeneration = GenerationState & { step_key: LessonStep; lesson_id: string; output?: unknown };

export type LessonAction =
  | {
      lessonId: string;
      kind: "submit";
      step: LessonStep;
      attempt: number;
      parentId: string | null;
      previousError: string | null;
      /** Only for the video stage: the video A8 is asked about, and its place among the offered candidates. */
      video?: { url: string; candidateIndex: number };
    }
  | { lessonId: string; kind: "poll"; step: LessonStep; generation: GenerationState }
  | { lessonId: string; kind: "expire_submitting"; step: LessonStep; generationId: string }
  /** The video stage ended without a segment: the fallback is recorded, so the lesson is an article from now on. */
  | { lessonId: string; kind: "record_fallback"; reason: string };

export interface LessonsPlan {
  actions: LessonAction[];
  outcome: "continue" | "done" | "failed";
  /** Lessons that cannot go on, with the reason. */
  exhausted: { lessonId: string; reason: string }[];
  /** Any accepted generation of the lessons, for the mark_done action. */
  lastGenerationId: string;
}

/** What the video stage needs from the run: the URLs offered per video lesson, the key, and the budget. */
export interface VideoPlan {
  /** Every video lesson, with the URLs offered to A8 for it (at most the candidate limit, in order). */
  offered: Record<string, string[]>;
  /** False when the Gemini key is not configured: each video lesson is then written as an article. */
  geminiConfigured: boolean;
  /** Failed calls allowed in a row for one candidate, before the video stage falls back. */
  maxAttempts: number;
}

type Flow =
  | { kind: "done" }
  | { kind: "wait" }
  | { kind: "act"; action: LessonAction; inflight: boolean; video: boolean }
  | { kind: "exhausted"; reason: string };

interface Track {
  latest: LessonGeneration | null;
  accepted: number;
  /** Attempt number this round's retry budget counts from (after the last accepted attempt). */
  firstAttempt: number;
  failures: RoundFailures;
}

function track(rows: LessonGeneration[], step: LessonStep): Track {
  const mine = rows.filter((r) => r.step_key === step).sort((a, b) => a.attempt - b.attempt);
  const accepted = mine.filter((r) => r.status === "completed");
  const firstAttempt = accepted.length ? accepted[accepted.length - 1].attempt + 1 : 0;
  return {
    latest: mine.at(-1) ?? null,
    accepted: accepted.length,
    firstAttempt,
    failures: roundFailures(mine, firstAttempt),
  };
}

/** The accepted answer of one A8 call: a segment A5 can write from. */
export function acceptedSegment(output: unknown): ChosenVideoSegment | null {
  const o = output as { accepted?: unknown; segment?: ChosenVideoSegment } | null;
  return o && o.accepted === true && o.segment ? o.segment : null;
}

/** A fallback row: the video stage ended without a segment. Written once, so the state is in the database. */
export function isFallbackRow(r: { output?: unknown; status: string; failure_kind?: string | null; step_key: string }): boolean {
  return r.step_key === "lesson_video" && r.status === "failed" && r.failure_kind === "rejected";
}

export type VideoStage =
  | { kind: "segment"; segment: ChosenVideoSegment }
  | { kind: "fallback"; reason: string; recorded: boolean }
  | { kind: "submit"; attempt: number; parentId: string | null; previousError: string | null; url: string; candidateIndex: number }
  | { kind: "expire"; generationId: string }
  | { kind: "wait" };

/**
 * Where a video lesson stands in the video stage, from its A8 rows (step_key lesson_video). A candidate
 * is judged once: by a completed call (accepted or not) or by a call that A8 refused as unusable. A
 * transport or provider failure is retried on the same candidate within canRetry's limits. The stage
 * ends with a segment, or falls back to an article when no candidate is usable or the calls keep failing.
 */
export function videoStage(
  rows: LessonGeneration[],
  offered: string[],
  plan: { geminiConfigured: boolean; maxAttempts: number },
  now: number,
  submitStaleMs: number,
): VideoStage {
  const mine = rows.filter((r) => r.step_key === "lesson_video").sort((a, b) => a.attempt - b.attempt);
  // A recorded fallback ends the stage for good; nothing else is asked again.
  const fallback = mine.find(isFallbackRow);
  if (fallback) return { kind: "fallback", reason: fallback.error ?? "không có đoạn video dùng được", recorded: true };
  const fail = (reason: string): VideoStage => ({ kind: "fallback", reason, recorded: false });
  if (!plan.geminiConfigured) return fail("chưa cấu hình Gemini");
  if (offered.length === 0) return fail("không có video ứng viên dùng được");
  const accepted = mine.find((r) => r.status === "completed" && acceptedSegment(r.output) !== null);
  if (accepted) return { kind: "segment", segment: acceptedSegment(accepted.output)! };
  // A candidate is judged once, by a completed call. A failed call is not a judgement: it is retried.
  const judged = mine.filter((r) => r.status === "completed");
  if (judged.length >= offered.length) return fail(`không đoạn nào trong ${offered.length} video đạt`);
  const latest = mine.at(-1);
  const candidateIndex = judged.length;
  if (!latest) return { kind: "submit", attempt: 0, parentId: null, previousError: null, url: offered[candidateIndex], candidateIndex };
  if (latest.status === "submitting") {
    return now - Date.parse(latest.created_at) > submitStaleMs ? { kind: "expire", generationId: latest.id } : { kind: "wait" };
  }
  if (latest.status === "failed") {
    // Failures since the last judged call count against this candidate only.
    const lastJudged = judged.at(-1)?.attempt ?? -1;
    const since = mine.filter((r) => r.attempt > lastJudged);
    const budget = roundFailures(since as AttemptRow[], lastJudged + 1);
    if (!canRetry(budget, plan.maxAttempts)) return fail(latest.error ?? "Gemini không trả lời được");
    return { kind: "submit", attempt: latest.attempt + 1, parentId: latest.id, previousError: latest.error, url: offered[candidateIndex], candidateIndex };
  }
  // The newest call was judged, and an offered candidate is still unjudged.
  return { kind: "submit", attempt: latest.attempt + 1, parentId: null, previousError: null, url: offered[candidateIndex], candidateIndex };
}

export function planLessons(input: {
  lessonIds: string[];
  rows: LessonGeneration[];
  /** Blocking items of the newest accepted review of each lesson that has one. */
  blocking: Record<string, string[]>;
  /** Lessons whose newest review has a blocking location that the review before it did not flag. */
  unseenBlocking?: Record<string, boolean>;
  now: number;
  maxAttempts: Record<"lessons" | "lesson_review", number>;
  submitStaleMs: number;
  limit: number;
  video?: VideoPlan;
}): LessonsPlan {
  const inflight: LessonAction[] = [];
  const submits: LessonAction[] = [];
  const exhausted: LessonsPlan["exhausted"] = [];
  let waiting = 0;
  let done = 0;
  let videoSubmitted = false;

  for (const lessonId of input.lessonIds) {
    const rows = input.rows.filter((r) => r.lesson_id === lessonId);
    const flow = lessonFlow(lessonId, rows, input);
    if (flow.kind === "done") done++;
    else if (flow.kind === "exhausted") exhausted.push({ lessonId, reason: flow.reason });
    else if (flow.kind === "wait") waiting++;
    else if (flow.inflight) {
      waiting++;
      inflight.push(flow.action);
    } else if (flow.video) {
      // At most one Gemini call per tick: the other video lessons wait for a later tick.
      if (videoSubmitted) waiting++;
      else {
        videoSubmitted = true;
        submits.push(flow.action);
      }
    } else submits.push(flow.action);
  }
  // In-flight work is read first (results and usage must be recorded); nothing new starts once a lesson is out of options.
  const actions = [...inflight, ...(exhausted.length > 0 ? [] : submits)].slice(0, input.limit);
  const accepted = input.rows.filter((r) => r.status === "completed" && r.step_key !== "lesson_video");
  return {
    actions,
    outcome: done === input.lessonIds.length ? "done" : exhausted.length > 0 && waiting === 0 ? "failed" : "continue",
    exhausted,
    lastGenerationId: accepted.at(-1)?.id ?? "",
  };
}

function lessonFlow(
  lessonId: string,
  rows: LessonGeneration[],
  input: Pick<Parameters<typeof planLessons>[0], "blocking" | "unseenBlocking" | "now" | "maxAttempts" | "submitStaleMs" | "video">,
): Flow {
  // The video stage comes first for a video lesson; a fallback or a segment lets the lesson go on to its draft.
  const offered = input.video?.offered[lessonId];
  if (offered && input.video) {
    const stage = videoStage(rows, offered, input.video, input.now, input.submitStaleMs);
    if (stage.kind === "fallback" && !stage.recorded) {
      return { kind: "act", inflight: false, video: false, action: { lessonId, kind: "record_fallback", reason: stage.reason } };
    }
    if (stage.kind === "wait") return { kind: "wait" };
    if (stage.kind === "expire") {
      return { kind: "act", inflight: true, video: false, action: { lessonId, kind: "expire_submitting", step: "lesson_video", generationId: stage.generationId } };
    }
    if (stage.kind === "submit") {
      return {
        kind: "act",
        inflight: false,
        video: true,
        action: {
          lessonId,
          kind: "submit",
          step: "lesson_video",
          attempt: stage.attempt,
          parentId: stage.parentId,
          previousError: stage.previousError,
          video: { url: stage.url, candidateIndex: stage.candidateIndex },
        },
      };
    }
  }

  const drafts = track(rows, "lessons");
  const reviews = track(rows, "lesson_review");

  // Reads the newest generation of a step that is not accepted: in flight, or failed and maybe retried.
  const unfinished = (t: Track, step: LessonStep): Flow => {
    const g = t.latest!;
    switch (g.status) {
      case "submitted":
        return { kind: "act", inflight: true, video: false, action: { lessonId, kind: "poll", step, generation: g } };
      case "submitting":
        return input.now - Date.parse(g.created_at) > input.submitStaleMs
          ? { kind: "act", inflight: true, video: false, action: { lessonId, kind: "expire_submitting", step, generationId: g.id } }
          : { kind: "wait" };
      case "failed":
        return canRetry(t.failures, input.maxAttempts[step as "lessons" | "lesson_review"])
          ? { kind: "act", inflight: false, video: false, action: { lessonId, kind: "submit", step, attempt: g.attempt + 1, parentId: g.id, previousError: g.error } }
          : { kind: "exhausted", reason: g.error ?? "thất bại" };
      default:
        throw new Error(`unexpected status ${g.status}`);
    }
  };

  if (!drafts.latest) {
    return { kind: "act", inflight: false, video: false, action: { lessonId, kind: "submit", step: "lessons", attempt: 0, parentId: null, previousError: null } };
  }
  if (drafts.latest.status !== "completed") return unfinished(drafts, "lessons");

  // The newest draft is accepted.
  if (reviews.accepted < drafts.accepted) {
    if (!reviews.latest || reviews.latest.status === "completed") {
      const attempt = reviews.latest ? reviews.latest.attempt + 1 : 0;
      return { kind: "act", inflight: false, video: false, action: { lessonId, kind: "submit", step: "lesson_review", attempt, parentId: null, previousError: null } };
    }
    return unfinished(reviews, "lesson_review");
  }

  // The newest draft has been reviewed.
  const items = input.blocking[lessonId];
  if (!items) return { kind: "exhausted", reason: "không đọc được kết quả review" };
  if (items.length === 0) return { kind: "done" };
  // A blocking item that first appears in the last allowed review has had no rewrite: the author is
  // told about it once more, so a miss of the earlier review does not fail the lesson.
  const limit = input.unseenBlocking?.[lessonId] ? MAX_LESSON_REVIEWS_LATE : MAX_LESSON_REVIEWS;
  if (reviews.accepted >= limit) {
    return { kind: "exhausted", reason: `còn lỗi blocking sau ${reviews.accepted} lần review: ${items.slice(0, 3).join("; ")}${items.length > 3 ? ` (+${items.length - 3})` : ""}` };
  }
  // Rewrite only this lesson; the review is the feedback (the handler adds it to the input).
  return {
    kind: "act",
    inflight: false,
    video: false,
    action: { lessonId, kind: "submit", step: "lessons", attempt: drafts.latest.attempt + 1, parentId: drafts.latest.id, previousError: null },
  };
}

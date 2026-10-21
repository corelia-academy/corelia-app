// Planning of the lessons / lesson_review pair. Every lesson goes through its own loop
//   draft (A5) -> review (A6) -> [blocking items: rewrite -> review] -> done
// and the loops of different lessons interleave. Pure: the handler executes the actions.
// Counting is from accepted generations, like the curriculum loop: every accepted review
// consumes one accepted draft.

import type { GenerationState } from "./steps.ts";
import { canRetry, roundFailures, type RoundFailures } from "./retry.ts";

export type LessonStep = "lessons" | "lesson_review";

/** A review is the verdict on one accepted draft; at most this many per lesson. */
export const MAX_LESSON_REVIEWS = 2;
export const LESSONS_PER_TICK = 3;

export type LessonGeneration = GenerationState & { step_key: LessonStep; lesson_id: string };

export type LessonAction =
  | { lessonId: string; kind: "submit"; step: LessonStep; attempt: number; parentId: string | null; previousError: string | null }
  | { lessonId: string; kind: "poll"; step: LessonStep; generation: GenerationState }
  | { lessonId: string; kind: "expire_submitting"; step: LessonStep; generationId: string };

export interface LessonsPlan {
  actions: LessonAction[];
  outcome: "continue" | "done" | "failed";
  /** Lessons that cannot go on, with the reason. */
  exhausted: { lessonId: string; reason: string }[];
  /** Any accepted generation of the lessons, for the mark_done action. */
  lastGenerationId: string;
}

type Flow =
  | { kind: "done" }
  | { kind: "wait" }
  | { kind: "act"; action: LessonAction; inflight: boolean }
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

export function planLessons(input: {
  lessonIds: string[];
  rows: LessonGeneration[];
  /** Blocking items of the newest accepted review of each lesson that has one. */
  blocking: Record<string, string[]>;
  now: number;
  maxAttempts: Record<LessonStep, number>;
  submitStaleMs: number;
  limit: number;
}): LessonsPlan {
  const inflight: LessonAction[] = [];
  const submits: LessonAction[] = [];
  const exhausted: LessonsPlan["exhausted"] = [];
  let waiting = 0;
  let done = 0;

  for (const lessonId of input.lessonIds) {
    const rows = input.rows.filter((r) => r.lesson_id === lessonId);
    const flow = lessonFlow(lessonId, rows, input);
    if (flow.kind === "done") done++;
    else if (flow.kind === "exhausted") exhausted.push({ lessonId, reason: flow.reason });
    else if (flow.kind === "wait") waiting++;
    else if (flow.inflight) {
      waiting++;
      inflight.push(flow.action);
    } else submits.push(flow.action);
  }
  // In-flight work is read first (results and usage must be recorded); nothing new starts once a lesson is out of options.
  const actions = [...inflight, ...(exhausted.length > 0 ? [] : submits)].slice(0, input.limit);
  const accepted = input.rows.filter((r) => r.status === "completed");
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
  input: Pick<Parameters<typeof planLessons>[0], "blocking" | "now" | "maxAttempts" | "submitStaleMs">,
): Flow {
  const drafts = track(rows, "lessons");
  const reviews = track(rows, "lesson_review");

  // Reads the newest generation of a step that is not accepted: in flight, or failed and maybe retried.
  const unfinished = (t: Track, step: LessonStep): Flow => {
    const g = t.latest!;
    switch (g.status) {
      case "submitted":
        return { kind: "act", inflight: true, action: { lessonId, kind: "poll", step, generation: g } };
      case "submitting":
        return input.now - Date.parse(g.created_at) > input.submitStaleMs
          ? { kind: "act", inflight: true, action: { lessonId, kind: "expire_submitting", step, generationId: g.id } }
          : { kind: "wait" };
      case "failed":
        return canRetry(t.failures, input.maxAttempts[step])
          ? { kind: "act", inflight: false, action: { lessonId, kind: "submit", step, attempt: g.attempt + 1, parentId: g.id, previousError: g.error } }
          : { kind: "exhausted", reason: g.error ?? "thất bại" };
      default:
        throw new Error(`unexpected status ${g.status}`);
    }
  };

  if (!drafts.latest) {
    return { kind: "act", inflight: false, action: { lessonId, kind: "submit", step: "lessons", attempt: 0, parentId: null, previousError: null } };
  }
  if (drafts.latest.status !== "completed") return unfinished(drafts, "lessons");

  // The newest draft is accepted.
  if (reviews.accepted < drafts.accepted) {
    if (!reviews.latest || reviews.latest.status === "completed") {
      const attempt = reviews.latest ? reviews.latest.attempt + 1 : 0;
      return { kind: "act", inflight: false, action: { lessonId, kind: "submit", step: "lesson_review", attempt, parentId: null, previousError: null } };
    }
    return unfinished(reviews, "lesson_review");
  }

  // The newest draft has been reviewed.
  const items = input.blocking[lessonId];
  if (!items) return { kind: "exhausted", reason: "không đọc được kết quả review" };
  if (items.length === 0) return { kind: "done" };
  if (reviews.accepted >= MAX_LESSON_REVIEWS) {
    return { kind: "exhausted", reason: `còn lỗi blocking sau ${reviews.accepted} lần review: ${items.slice(0, 3).join("; ")}${items.length > 3 ? ` (+${items.length - 3})` : ""}` };
  }
  // Rewrite only this lesson; the review is the feedback (the handler adds it to the input).
  return {
    kind: "act",
    inflight: false,
    action: { lessonId, kind: "submit", step: "lessons", attempt: drafts.latest.attempt + 1, parentId: drafts.latest.id, previousError: null },
  };
}

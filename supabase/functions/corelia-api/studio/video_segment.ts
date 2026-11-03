// Step A8 (video segment), the rules only: which part of a research video teaches a video lesson's
// outcome. The model call and the lesson flow are separate; this module decides from the model's
// answer whether a segment can be used, and checks that the lesson's video block uses exactly it.
// Pure: no network, no database.

import { getYoutubeVideoId } from "./lesson_ports.ts";

/** Longest segment (mode "segment") a lesson may cut from a video, in seconds. */
export const VIDEO_SEGMENT_MAX_SECONDS = 900;
/** Longest whole video (mode "whole") a lesson may play, in seconds. */
export const VIDEO_WHOLE_MAX_SECONDS = 1200;
/** Candidates given to A8 for one lesson; research may list more, the lesson only ever sees these. */
export const VIDEO_SEGMENT_CANDIDATE_LIMIT = 2;
export const VIDEO_KEY_POINTS_MIN = 3;
export const VIDEO_KEY_POINTS_MAX = 5;

/** One candidate as A8 answers it, for one video URL it was given. */
export interface VideoSegmentCandidate {
  video_url: string;
  fits: boolean;
  mode: "segment" | "whole";
  start_seconds: number;
  end_seconds: number;
  /** True when the part only makes sense after watching earlier parts of the video. */
  needs_prior_context: boolean;
  /** 3–5 points the segment teaches, in English. */
  key_points: string[];
  reason: string;
}

/** The segment a lesson is written from. `end_seconds` is never 0 here: a whole video is given its real end. */
export interface ChosenVideoSegment {
  video_url: string;
  mode: "segment" | "whole";
  start_seconds: number;
  end_seconds: number;
  key_points: string[];
}

export type VideoSegmentChoice =
  | { ok: true; segment: ChosenVideoSegment; rejected: string[] }
  | { ok: false; reason: string; rejected: string[] };

function isWholeSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Why one candidate cannot be used, or null when it can. `durationSeconds` is the video's real length
 * when it is known; without it the end cannot be checked against the video and that check is skipped.
 */
export function candidateProblem(
  candidate: VideoSegmentCandidate,
  durationSeconds: number | undefined,
): string | null {
  if (candidate.fits !== true) return "không khớp outcome của bài";
  if (candidate.needs_prior_context === true) return "cần xem phần trước của video mới hiểu";
  if (!isWholeSeconds(candidate.start_seconds) || !isWholeSeconds(candidate.end_seconds)) return "mốc thời gian không phải số nguyên không âm";
  if (candidate.end_seconds <= candidate.start_seconds) return "mốc kết thúc không lớn hơn mốc bắt đầu";
  if (durationSeconds !== undefined && candidate.end_seconds > durationSeconds) return `mốc kết thúc ${candidate.end_seconds}s vượt độ dài video ${durationSeconds}s`;
  const length = candidate.end_seconds - candidate.start_seconds;
  if (candidate.mode === "whole") {
    if (candidate.start_seconds !== 0) return "mode whole phải bắt đầu từ 0";
    if (length > VIDEO_WHOLE_MAX_SECONDS) return `video whole dài ${length}s, vượt ${VIDEO_WHOLE_MAX_SECONDS}s`;
  } else if (candidate.mode === "segment") {
    if (length > VIDEO_SEGMENT_MAX_SECONDS) return `đoạn dài ${length}s, vượt ${VIDEO_SEGMENT_MAX_SECONDS}s`;
  } else {
    return "mode phải là segment hoặc whole";
  }
  const points = Array.isArray(candidate.key_points) ? candidate.key_points.filter((p) => typeof p === "string" && p.trim().length > 0) : [];
  if (points.length < VIDEO_KEY_POINTS_MIN || points.length > VIDEO_KEY_POINTS_MAX) {
    return `cần ${VIDEO_KEY_POINTS_MIN}–${VIDEO_KEY_POINTS_MAX} ý chính, có ${points.length}`;
  }
  return null;
}

/**
 * The first candidate that passes every rule, in the order A8 gave them. Only URLs the lesson was
 * offered count: an answer about any other video is rejected, not used. `durations` maps a video URL to
 * its known length in seconds.
 */
export function chooseVideoSegment(
  candidates: VideoSegmentCandidate[],
  offeredUrls: string[],
  durations: Record<string, number> = {},
): VideoSegmentChoice {
  const offered = new Set(offeredUrls.slice(0, VIDEO_SEGMENT_CANDIDATE_LIMIT));
  const rejected: string[] = [];
  for (const candidate of candidates) {
    if (!offered.has(candidate.video_url)) {
      rejected.push(`${candidate.video_url}: không phải video được đưa cho A8`);
      continue;
    }
    const problem = candidateProblem(candidate, durations[candidate.video_url]);
    if (problem) {
      rejected.push(`${candidate.video_url}: ${problem}`);
      continue;
    }
    return {
      ok: true,
      rejected,
      segment: {
        video_url: candidate.video_url,
        mode: candidate.mode,
        start_seconds: candidate.start_seconds,
        end_seconds: candidate.end_seconds,
        key_points: candidate.key_points.map((p) => p.trim()).filter((p) => p.length > 0),
      },
    };
  }
  const reason = rejected.length > 0
    ? `không video nào đạt: ${rejected.join("; ")}`
    : "A8 không trả ứng viên nào";
  return { ok: false, reason, rejected };
}

/**
 * The video block A5 wrote must use exactly the chosen segment: same video, same start and end.
 * Returns the problem, or null when it matches. The lesson's video is never trimmed or changed by code.
 */
export function videoBlockMismatch(
  block: { youtube_url: string; start_seconds: number; end_seconds: number },
  segment: ChosenVideoSegment,
): string | null {
  const wanted = getYoutubeVideoId(segment.video_url);
  const got = getYoutubeVideoId(block.youtube_url);
  if (!wanted || !got || wanted !== got) return `video ${got ?? block.youtube_url} không phải đoạn A8 đã chọn (${wanted ?? segment.video_url})`;
  if (block.start_seconds !== segment.start_seconds) return `start_seconds ${block.start_seconds} phải bằng ${segment.start_seconds} của đoạn A8 đã chọn`;
  if (block.end_seconds !== segment.end_seconds) return `end_seconds ${block.end_seconds} phải bằng ${segment.end_seconds} của đoạn A8 đã chọn`;
  return null;
}

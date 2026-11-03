import { describe, expect, it } from "vitest";
import {
  candidateProblem,
  judgeCandidate,
  VIDEO_SEGMENT_MAX_SECONDS,
  VIDEO_WHOLE_MAX_SECONDS,
  videoBlockMismatch,
  type VideoSegmentCandidate,
} from "./video_segment.ts";

const A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
const points = ["What a borrow is", "Why a move ends the first binding", "How to read the error"];

const candidate = (over: Partial<VideoSegmentCandidate> = {}): VideoSegmentCandidate => ({
  video_url: A,
  fits: true,
  mode: "segment",
  start_seconds: 120,
  end_seconds: 480,
  needs_prior_context: false,
  key_points: points,
  reason: "covers the outcome",
  ...over,
});

describe("studio video segment rules (A8)", () => {
  it("accepts a candidate that passes every rule, and returns the segment with the offered URL", () => {
    const j = judgeCandidate(candidate({ mode: "whole", start_seconds: 0, end_seconds: 300 }), A);
    expect(j).toEqual({
      accepted: true,
      segment: { video_url: A, mode: "whole", start_seconds: 0, end_seconds: 300, key_points: points },
    });
  });

  it("refuses an answer about a different video than the one A8 was given", () => {
    expect(judgeCandidate(candidate({ video_url: B }), A)).toEqual({
      accepted: false,
      reason: "A8 trả lời về một video khác video được đưa",
    });
  });

  it("refuses a candidate that does not fit the outcome, with the reason A8 gave the rule", () => {
    expect(judgeCandidate(candidate({ fits: false }), A)).toEqual({ accepted: false, reason: "không khớp outcome của bài" });
  });

  it("refuses a segment that needs earlier parts of the video", () => {
    expect(candidateProblem(candidate({ needs_prior_context: true }), undefined)).toBe("cần xem phần trước của video mới hiểu");
  });

  it("refuses a segment longer than the segment cap, and a whole video longer than the whole cap", () => {
    expect(candidateProblem(candidate({ end_seconds: 120 + VIDEO_SEGMENT_MAX_SECONDS }), undefined)).toBeNull();
    expect(candidateProblem(candidate({ end_seconds: 120 + VIDEO_SEGMENT_MAX_SECONDS + 1 }), undefined)).toContain(`vượt ${VIDEO_SEGMENT_MAX_SECONDS}s`);
    expect(candidateProblem(candidate({ mode: "whole", start_seconds: 0, end_seconds: VIDEO_WHOLE_MAX_SECONDS }), undefined)).toBeNull();
    expect(candidateProblem(candidate({ mode: "whole", start_seconds: 0, end_seconds: VIDEO_WHOLE_MAX_SECONDS + 1 }), undefined)).toContain(`vượt ${VIDEO_WHOLE_MAX_SECONDS}s`);
  });

  it("refuses a whole video that does not start at zero", () => {
    expect(candidateProblem(candidate({ mode: "whole", start_seconds: 30, end_seconds: 300 }), undefined)).toBe("mode whole phải bắt đầu từ 0");
  });

  it("refuses an empty or reversed range and non-integer seconds", () => {
    expect(candidateProblem(candidate({ start_seconds: 300, end_seconds: 300 }), undefined)).toBe("mốc kết thúc không lớn hơn mốc bắt đầu");
    expect(candidateProblem(candidate({ start_seconds: 400, end_seconds: 300 }), undefined)).toBe("mốc kết thúc không lớn hơn mốc bắt đầu");
    expect(candidateProblem(candidate({ start_seconds: 1.5 }), undefined)).toBe("mốc thời gian không phải số nguyên không âm");
    expect(candidateProblem(candidate({ start_seconds: -1 }), undefined)).toBe("mốc thời gian không phải số nguyên không âm");
  });

  it("refuses an end past the known length of the video, and skips that check when the length is unknown", () => {
    expect(candidateProblem(candidate({ end_seconds: 480 }), 400)).toBe("mốc kết thúc 480s vượt độ dài video 400s");
    expect(candidateProblem(candidate({ end_seconds: 480 }), undefined)).toBeNull();
    expect(judgeCandidate(candidate({ end_seconds: 480 }), A, 400)).toEqual({ accepted: false, reason: "mốc kết thúc 480s vượt độ dài video 400s" });
  });

  it("needs three to five non-empty key points", () => {
    expect(candidateProblem(candidate({ key_points: ["a", "b"] }), undefined)).toBe("cần 3–5 ý chính, có 2");
    expect(candidateProblem(candidate({ key_points: ["a", "b", "c", "d", "e", "f"] }), undefined)).toBe("cần 3–5 ý chính, có 6");
    expect(candidateProblem(candidate({ key_points: ["a", "b", "  "] }), undefined)).toBe("cần 3–5 ý chính, có 2");
  });

  it("checks that the lesson video block is exactly the chosen segment", () => {
    const segment = { video_url: A, mode: "segment" as const, start_seconds: 120, end_seconds: 480, key_points: points };
    expect(videoBlockMismatch({ youtube_url: "https://youtu.be/aaaaaaaaaaa", start_seconds: 120, end_seconds: 480 }, segment)).toBeNull();
    expect(videoBlockMismatch({ youtube_url: B, start_seconds: 120, end_seconds: 480 }, segment)).toContain("không phải đoạn A8 đã chọn");
    expect(videoBlockMismatch({ youtube_url: A, start_seconds: 0, end_seconds: 480 }, segment)).toContain("start_seconds 0 phải bằng 120");
    expect(videoBlockMismatch({ youtube_url: A, start_seconds: 120, end_seconds: 0 }, segment)).toContain("end_seconds 0 phải bằng 480");
  });
});

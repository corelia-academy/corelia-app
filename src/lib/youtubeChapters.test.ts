import { describe, expect, it } from "vitest";

import {
  buildSegmentsFromChapterStarts,
  parseChaptersFromDescription,
  parseTimestampLabelToSeconds,
} from "./youtubeChapters";

describe("parseTimestampLabelToSeconds", () => {
  it("parses MM:SS", () => {
    expect(parseTimestampLabelToSeconds("0:00")).toBe(0);
    expect(parseTimestampLabelToSeconds("45:30")).toBe(45 * 60 + 30);
  });

  it("parses H:MM:SS", () => {
    expect(parseTimestampLabelToSeconds("1:30:00")).toBe(3600 + 30 * 60);
    expect(parseTimestampLabelToSeconds("0:05:10")).toBe(5 * 60 + 10);
  });

  it("returns null for invalid", () => {
    expect(parseTimestampLabelToSeconds("")).toBeNull();
    expect(parseTimestampLabelToSeconds("abc")).toBeNull();
  });
});

describe("parseChaptersFromDescription", () => {
  it("extracts timestamp lines", () => {
    const desc = `Intro text\n0:00 Start here\n15:30 Middle\n1:00:00 End chapter`;
    const chapters = parseChaptersFromDescription(desc, 4000);
    expect(chapters.map((c) => c.startSeconds)).toEqual([0, 930, 3600]);
    expect(chapters[1].title).toBe("Middle");
  });

  it("dedupes same start", () => {
    const desc = "0:00 A\n0:00 B";
    const chapters = parseChaptersFromDescription(desc, 100);
    expect(chapters).toHaveLength(1);
  });
});

describe("buildSegmentsFromChapterStarts", () => {
  it("sets end to next start or video end", () => {
    const segs = buildSegmentsFromChapterStarts(
      [
        { title: "A", startSeconds: 0 },
        { title: "B", startSeconds: 100 },
      ],
      500,
    );
    expect(segs).toEqual([
      { title: "A", startSeconds: 0, endSeconds: 100 },
      { title: "B", startSeconds: 100, endSeconds: 500 },
    ]);
  });
});

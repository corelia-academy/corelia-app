import { describe, expect, it } from "vitest";
import {
  getDetailedLessonCounts,
  getLessonFormat,
  isActivityLesson,
  isArticleLesson,
  isLessonPublishedForLearners,
} from "./lessonFormat";

describe("lessonFormat", () => {
  it("respects explicit lesson_format", () => {
    expect(getLessonFormat({ lesson_format: "article", youtube_url: "https://youtu.be/x" })).toBe(
      "article",
    );
  });

  it("infers article from markdown without video", () => {
    expect(
      isArticleLesson({
        description_markdown: "## Hello",
      }),
    ).toBe(true);
    expect(isLessonPublishedForLearners({ description_markdown: "Text" })).toBe(true);
  });

  it("uses video-first fallback and treats whitespace-only legacy content as empty", () => {
    expect(getLessonFormat({})).toBe("video");
    expect(getLessonFormat({ youtube_url: "https://youtu.be/example", description_markdown: "Text" })).toBe("video");
    expect(getLessonFormat({ short_description: "Summary" })).toBe("article");
    expect(getLessonFormat({ youtube_url: " \n\t", description_markdown: " \n\t" })).toBe("video");
  });

  it("uses explicit publication even when a practice lesson has no legacy markdown", () => {
    expect(isLessonPublishedForLearners({ lesson_format: "practice", published: true })).toBe(true);
    expect(isLessonPublishedForLearners({ lesson_format: "article", published: false, description_markdown: "Ready content" })).toBe(false);
    expect(isLessonPublishedForLearners({ lesson_format: "quiz", published: true, archived_at: "2026-09-11T00:00:00Z" })).toBe(false);
    expect(isLessonPublishedForLearners({ lesson_format: "practice" })).toBe(false);
  });

  it("identifies quiz and practice as activities, not roadmap content", () => {
    expect(isActivityLesson({ lesson_format: "quiz" })).toBe(true);
    expect(isActivityLesson({ lesson_format: "practice" })).toBe(true);
    expect(isActivityLesson({ lesson_format: "video" })).toBe(false);
    expect(isActivityLesson({ description_markdown: "## Article" })).toBe(false);
  });

  it("counts every resolved lesson format, including legacy inferred formats", () => {
    expect(
      getDetailedLessonCounts([
        { lesson_format: "video" },
        { description_markdown: "## Article" },
        { lesson_format: "quiz" },
        { lesson_format: "practice" },
        { lesson_format: "code_exercise" },
        { youtube_url: "https://youtu.be/example" },
      ]),
    ).toEqual({
      videoCount: 2,
      articleCount: 1,
      quizCount: 1,
      practiceCount: 1,
      codeCount: 1,
      totalCount: 6,
    });
  });
});

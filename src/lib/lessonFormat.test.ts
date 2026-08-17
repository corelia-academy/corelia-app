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
        { youtube_url: "https://youtu.be/example" },
      ]),
    ).toEqual({
      videoCount: 2,
      articleCount: 1,
      quizCount: 1,
      practiceCount: 1,
      totalCount: 5,
    });
  });
});

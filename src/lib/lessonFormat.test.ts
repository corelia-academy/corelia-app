import { describe, expect, it } from "vitest";
import {
  getLessonFormat,
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
});

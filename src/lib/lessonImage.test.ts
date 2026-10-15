import { describe, expect, it } from "vitest";
import { isValidLessonImage } from "./lessonImage";

describe("isValidLessonImage", () => {
  it("accepts supported types within 5 MB", () => {
    expect(isValidLessonImage({ type: "image/webp", size: 1024 })).toBe(true);
  });
  it("rejects svg, oversized and empty files", () => {
    expect(isValidLessonImage({ type: "image/svg+xml", size: 1024 })).toBe(false);
    expect(isValidLessonImage({ type: "image/png", size: 6 * 1024 * 1024 })).toBe(false);
    expect(isValidLessonImage({ type: "image/png", size: 0 })).toBe(false);
  });
});

import { lessonImageRef, parseLessonImageRef } from "./lessonImage";

describe("lesson image refs", () => {
  it("round-trips a ref to its storage path", () => {
    const ref = lessonImageRef("c1", "a-b.png");
    expect(parseLessonImageRef(ref)).toEqual({ courseId: "c1", file: "a-b.png", path: "course-thumbnails/c1/lessons/a-b.png" });
  });
  it("rejects traversal and foreign urls", () => {
    expect(parseLessonImageRef("/lesson-image/c1/../x.png")).toBeNull();
    expect(parseLessonImageRef("https://example.com/a.png")).toBeNull();
    expect(parseLessonImageRef(undefined)).toBeNull();
  });
});

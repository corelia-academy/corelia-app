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

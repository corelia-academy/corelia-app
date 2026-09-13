import { describe, expect, it } from "vitest";
import type { CourseLesson } from "@/types/courses";
import { validateLesson } from "./validation";
import { isLessonDraftForLearners, isVideoLessonUpdating } from "@/lib/lessonFormat";

const lesson = {
  id: "video",
  section_id: "section",
  order: 0,
  title: "Video lesson",
  lesson_format: "video",
  youtube_url: "",
  youtube_start_seconds: 0,
  duration_seconds: 0,
  published: true,
} as CourseLesson;

describe("published video being updated", () => {
  it("accepts an empty URL without turning the lesson back into a draft", () => {
    expect(validateLesson(lesson)).not.toContainEqual(expect.objectContaining({ code: "youtube_required" }));
    expect(isVideoLessonUpdating(lesson)).toBe(true);
    expect(isLessonDraftForLearners(lesson)).toBe(false);
  });

  it("still rejects a supplied malformed URL", () => {
    expect(validateLesson({ ...lesson, youtube_url: "not-a-video" })).toContainEqual(
      expect.objectContaining({ field: "youtube_url", code: "youtube_required" }),
    );
  });
});

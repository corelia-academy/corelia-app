import { describe, expect, it, vi } from "vitest";
import type { CourseLesson } from "@/types/courses";

vi.mock("@/lib/coreliaEdgeApi", () => ({
  coreliaEdgeUrl: (name: string) => name,
  supabaseFunctionHeaders: () => ({}),
}));

vi.mock("@/lib/lessonEmbedding", () => ({
  triggerLessonEmbeddingInBackground: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import { applyCourseLessonLocaleContent } from "./courses";

const masterVideoLesson: CourseLesson = {
  id: "lesson-1",
  section_id: "section-1",
  title: "Master video lesson",
  lesson_format: "video",
  youtube_url: "https://youtu.be/eFYRrBsumi0",
  youtube_start_seconds: 15,
  youtube_end_seconds: 45,
  duration_seconds: 30,
  order: 0,
};

describe("applyCourseLessonLocaleContent", () => {
  it("keeps the master video settings when a locale URL is empty", () => {
    const result = applyCourseLessonLocaleContent(masterVideoLesson, {
      locale: "en",
      title: "English title",
      youtube_url: "   ",
      youtube_start_seconds: 1,
      youtube_end_seconds: 2,
    });

    expect(result.title).toBe("English title");
    expect(result.youtube_url).toBe(masterVideoLesson.youtube_url);
    expect(result.youtube_start_seconds).toBe(15);
    expect(result.youtube_end_seconds).toBe(45);
  });

  it("keeps the master video settings when a locale URL is malformed", () => {
    const result = applyCourseLessonLocaleContent(masterVideoLesson, {
      locale: "en",
      title: "English title",
      youtube_url: "not-a-youtube-url",
      youtube_start_seconds: 1,
      youtube_end_seconds: 2,
    });

    expect(result.youtube_url).toBe(masterVideoLesson.youtube_url);
    expect(result.youtube_start_seconds).toBe(15);
    expect(result.youtube_end_seconds).toBe(45);
  });

  it("uses a valid locale video URL and its segment overrides", () => {
    const result = applyCourseLessonLocaleContent(masterVideoLesson, {
      locale: "en",
      title: "English title",
      youtube_url: " https://youtu.be/dQw4w9WgXcQ ",
      youtube_start_seconds: 5,
      youtube_end_seconds: 20,
    });

    expect(result.youtube_url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(result.youtube_start_seconds).toBe(5);
    expect(result.youtube_end_seconds).toBe(20);
  });
});

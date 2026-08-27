import { describe, expect, it, vi } from "vitest";

vi.mock("./coreliaEdgeApi", () => ({
  supabaseFunctionHeaders: () => ({}),
}));

vi.mock("./supabase", () => ({
  supabase: {},
}));

import {
  serializeGenerateDescriptionRequest,
  type GenerateDescriptionRequest,
} from "./descriptionGenerator";
import { normalizeYoutubeVideoId } from "./youtubeVideoId";

describe("generate-description request contract", () => {
  it("serializes a Career Track translation with careerTrackId and without courseId", () => {
    const request = {
      action: "translate",
      type: "course",
      targetField: "description",
      locale: "en",
      sourceLocale: "vi",
      bundleKind: "course_info",
      sourceBundle: { title: "Lộ trình", description: "Mô tả" },
      careerTrackId: "career-track-123",
    } satisfies GenerateDescriptionRequest;

    const serialized = JSON.parse(serializeGenerateDescriptionRequest(request)) as Record<
      string,
      unknown
    >;

    expect(serialized.careerTrackId).toBe("career-track-123");
    expect(serialized).not.toHaveProperty("courseId");
  });

  it("rejects invalid Career Track and course resource combinations at compile time", () => {
    // @ts-expect-error Career Track requests require action: "translate".
    const missingTranslateAction: GenerateDescriptionRequest = {
      type: "course",
      targetField: "description",
      locale: "en",
      bundleKind: "course_info",
      careerTrackId: "career-track-123",
    };

    // @ts-expect-error Career Track requests cannot include a course resource ID.
    const careerTrackWithCourseId: GenerateDescriptionRequest = {
      action: "translate",
      type: "course",
      targetField: "description",
      locale: "en",
      bundleKind: "course_info",
      careerTrackId: "career-track-123",
      courseId: "course-123",
    };

    // @ts-expect-error Non-Career-Track course requests cannot include careerTrackId.
    const courseRequestWithCareerTrackId: GenerateDescriptionRequest = {
      action: "generate",
      type: "course",
      targetField: "description",
      locale: "en",
      careerTrackId: "career-track-123",
    };

    expect([
      missingTranslateAction,
      careerTrackWithCourseId,
      courseRequestWithCareerTrackId,
    ]).toHaveLength(3);
  });
});

describe("normalizeYoutubeVideoId", () => {
  it("accepts a raw video id", () => {
    expect(normalizeYoutubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from watch URLs", () => {
    expect(normalizeYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts from youtu.be URLs", () => {
    expect(normalizeYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from embed and shorts URLs", () => {
    expect(normalizeYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(normalizeYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("returns null for invalid input", () => {
    expect(normalizeYoutubeVideoId("not-a-youtube-link")).toBeNull();
  });
});

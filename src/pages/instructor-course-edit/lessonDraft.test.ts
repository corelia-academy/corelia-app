import { expect, it } from "vitest";
import { lessonDraftPatch, type LessonDraft } from "./lessonDraft";

const english: LessonDraft = {
  title: "", shortDescription: "", markdown: "", resources: [], youtubeUrl: "",
  videoPrimaryLocale: "vi", hasSubtitle: false, subtitleLocales: [],
  practiceSourceLessonId: "", practiceSourceLessonIds: [],
  startLabel: "0:00", endLabel: "", useSourceVideo: true,
};

it("does not save a preloaded empty translation or shared video metadata", () => {
  expect(lessonDraftPatch(english, english, false)).toEqual({});
  expect(lessonDraftPatch({ ...english, title: "English" }, english, false)).toEqual({ title: "English" });
});

it("keeps an explicit EN video and its segment together, and clears the override when choosing the source", () => {
  const override = { ...english, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", useSourceVideo: false, startLabel: "0:05", endLabel: "0:20" };
  expect(lessonDraftPatch(override, english, false)).toEqual({ youtube_url: override.youtubeUrl, youtube_start_seconds: 5, youtube_end_seconds: 20 });
  expect(lessonDraftPatch({ ...override, useSourceVideo: true }, override, false)).toEqual({ youtube_url: "", youtube_start_seconds: 0, youtube_end_seconds: null });
});

it("preserves other translation fields while clearing a field explicitly", () => {
  const saved = { ...english, title: "English", markdown: "Description", resources: [{ title: "Resource", url: "https://example.com" }] };
  expect(lessonDraftPatch({ ...saved, markdown: "" }, saved, false)).toEqual({ description_markdown: "" });
  expect(saved.markdown).toBe("Description");
});

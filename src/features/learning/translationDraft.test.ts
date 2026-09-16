import { expect, it } from "vitest";
import { changedLessonLocales, changedLocaleFields, translationVideoIssues } from "./translationDraft";
import type { CourseLesson } from "@/types/courses";

const master: CourseLesson = { id: "lesson", section_id: "section", title: "Tiếng Việt", lesson_format: "video", youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: 40, youtube_end_seconds: 50, duration_seconds: 10, order: 0 };

it("omits untouched locales and preserves explicit clearing without copying source fields", () => {
  const saved = { en: { title: "English", description_markdown: "Existing", resources: [{ title: "Link", url: "https://example.com" }] } };
  expect(changedLessonLocales(saved, saved)).toEqual({});
  expect(changedLessonLocales({ en: { ...saved.en, title: "" } }, saved)).toEqual({ en: { title: "" } });
  expect(changedLessonLocales({ en: { description_markdown: "New translation" } }, {})).toEqual({ en: { description_markdown: "New translation" } });
  expect(changedLocaleFields({ title: "", description: "" }, { title: "", description: "" })).toEqual({});
});

it("validates only explicit video overrides in their locale and does not inherit source segments", () => {
  expect(translationVideoIssues(master, { en: { youtube_url: "", youtube_end_seconds: -1 } }, "vi")).toEqual([]);
  expect(translationVideoIssues(master, { en: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_end_seconds: 10 } }, "vi")).toEqual([]);
  expect(translationVideoIssues(master, { en: { youtube_url: "broken" } }, "vi")).toEqual([{ lessonId: "lesson", locale: "en", field: "youtube_url", code: "youtube_required" }]);
  expect(translationVideoIssues(master, { en: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: 20, youtube_end_seconds: 10 } }, "vi")).toEqual([{ lessonId: "lesson", locale: "en", field: "youtube_end_seconds", code: "invalid_segment" }]);
});

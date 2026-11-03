import { expect, it } from "vitest";
import { normalizeCodeLocale } from "./locale";
import { normalizeVideoLocale } from "../learning/videoLocale";

it("recovers valid copy by stable ID without mutating malformed source", () => {
  const raw = { instructions: 12, hints: ["Keep", null], blank_feedback: { a: "Keep A", b: {} }, test_copy: { first: { description: "Keep test", hint: [], failure_message: "Retry" }, broken: null } };
  const before = structuredClone(raw);
  expect(normalizeCodeLocale(raw)).toEqual({ invalid: true, value: { hints: ["Keep"], blank_feedback: { a: "Keep A" }, test_copy: { first: { description: "Keep test", failure_message: "Retry" } } } });
  expect(raw).toEqual(before);
  expect(normalizeCodeLocale({ hints: {} }).invalid).toBe(true);
  expect(normalizeCodeLocale(null)).toEqual({ invalid: true, value: {} });
  expect(normalizeCodeLocale(undefined)).toEqual({ invalid: false, value: {} });
});
it("keeps valid translation and subtitle metadata unchanged", () => {
  const copy = { instructions: "Read", hints: [], blank_feedback: { blank: "Try" }, test_copy: { test: { description: "Description", hint: "Hint" } } };
  expect(normalizeCodeLocale(copy)).toEqual({ invalid: false, value: copy });
  const video = { has_subtitle: false, subtitle_locales: ["vi", "en"] as Array<"vi" | "en">, video_primary_locale: "vi" as const };
  expect(normalizeVideoLocale(video)).toEqual({ invalid: false, value: video });
  expect(normalizeVideoLocale({ has_subtitle: "false", subtitle_locales: ["vi", 1, "fr"], video_primary_locale: {} } as never)).toEqual({ invalid: true, value: { subtitle_locales: ["vi"] } });
});

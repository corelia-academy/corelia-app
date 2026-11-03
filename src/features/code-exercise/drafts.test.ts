// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { readCodeDraft, saveCodeDraft } from "./drafts";
import { MAX_SOURCE_BYTES } from "./evaluate";
import type { CodeExerciseDraft } from "./types";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
const updated_at = "2026-09-11T12:00:00Z";

it.each([null, [], "mut", { mode: "fill", answers: "mut", updated_at }, { mode: "fill", answers: ["mut"], updated_at }, { mode: "fill", answers: { a: 1 }, updated_at }, { mode: "fill", answers: { a: "first\nsecond" }, updated_at }])("rejects malformed draft %j", value => {
  localStorage.setItem("draft", JSON.stringify(value));
  expect(readCodeDraft("draft")).toBeNull();
});

it.each(["x".repeat(MAX_SOURCE_BYTES), "\u0000".repeat(MAX_SOURCE_BYTES), "é".repeat(MAX_SOURCE_BYTES / 2)])("round trips a 64 KiB source regardless of JSON escaping", source => {
  const draft: CodeExerciseDraft = { mode: "edit", source, updated_at };
  expect(saveCodeDraft("draft", draft)).toBe(true);
  expect(readCodeDraft("draft")).toEqual(draft);
});

it("rejects over-limit UTF-8 source on read and save", () => {
  const draft: CodeExerciseDraft = { mode: "edit", source: "é".repeat(MAX_SOURCE_BYTES / 2) + "x", updated_at };
  expect(saveCodeDraft("draft", draft)).toBe(false);
  localStorage.setItem("draft", JSON.stringify(draft));
  expect(readCodeDraft("draft")).toBeNull();
});

it("only restores fields belonging to the active mode", () => {
  localStorage.setItem("draft", JSON.stringify({ mode: "fill", answers: { mutable: "mut" }, source: "stale source", unrelated: true, updated_at }));
  expect(readCodeDraft("draft")).toEqual({ mode: "fill", answers: { mutable: "mut" }, updated_at });
});

it("tolerates blocked storage on read and write", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Denied"); }, setItem: () => { throw new Error("Full"); } });
  expect(readCodeDraft("draft")).toBeNull();
  expect(saveCodeDraft("draft", { mode: "edit", source: "fn main() {}", updated_at })).toBe(false);
});

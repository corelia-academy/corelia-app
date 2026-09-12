// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCodeConfig, validateCodeConfig, withCodeRevision } from "./config";
import { evaluateCodeExercise, normalizeSource } from "./evaluate";
import { parseMarkers, reconstructSource } from "./markers";
import { codeDraftKey, readCodeDraft, saveCodeDraft } from "./drafts";

describe("code exercise engine", () => {
  it("preserves surrounding source and adjacent markers", () => {
    expect(reconstructSource("{{blank:a}}{{blank:b}}!", { a: "α", b: "β" })).toBe("αβ!");
    expect(parseMarkers("no blanks")).toEqual([{ type: "source", value: "no blanks" }]);
  });
  it.each(["{{blank:a}}{{blank:a}}", "{{blank:A}}", "{{blank:a}", "{{blank:}}", "{{nested}}"])("rejects invalid markers: %s", source => expect(() => parseMarkers(source)).toThrow());
  it("normalizes only line boundaries and trailing whitespace", () => {
    expect(normalizeSource("\r\nfn main() {  \r\n  x();\t\r\n}\r\n")).toBe("fn main() {\n  x();\n}");
    expect(normalizeSource("a  b")).not.toBe(normalizeSource("a b"));
  });
  it("fills with matching options and rejects multiline answers", () => {
    const c = defaultCodeConfig();
    expect(evaluateCodeExercise(c, { answers: { mutable: " mut " } }).passed).toBe(true);
    expect(evaluateCodeExercise(c, { answers: { mutable: "MUT" } }).passed).toBe(false);
    expect(evaluateCodeExercise(c, { answers: { mutable: "mut\n" } }).passed).toBe(false);
  });
  it("requires only required text tests", () => {
    const c = defaultCodeConfig("edit");
    c.tests!.push({ id: "optional", type: "contains", required: false, value: "missing", description: "Optional" });
    expect(evaluateCodeExercise(c, { source: c.reference_solution }).passed).toBe(true);
    expect(evaluateCodeExercise(c, { source: c.file.starter_source }).passed).toBe(false);
  });
  it("validates the actual fill reference solution, not just an accepted answer", () => {
    const c = defaultCodeConfig();
    expect(validateCodeConfig(c, true)).toEqual([]);
    expect(validateCodeConfig({ ...c, reference_solution: "let wrong count = 0;" }, true)).toContain("solution_failed");
    expect(validateCodeConfig({ ...c, reference_solution: "wrong surroundings" }, true)).toContain("solution_failed");
  });
  it("allows structurally valid draft with failing solution", () => {
    const c = { ...defaultCodeConfig("edit"), reference_solution: "not yet" };
    expect(validateCodeConfig(c)).toEqual([]);
    expect(validateCodeConfig(c, true)).toContain("solution_failed");
  });
  it("rejects an empty required test list and oversize source", () => {
    expect(validateCodeConfig({ ...defaultCodeConfig("edit"), tests: [] })).toContain("required_test_missing");
    expect(() => evaluateCodeExercise(defaultCodeConfig("edit"), { source: "💻".repeat(17000) })).toThrow("source_too_large");
  });
  it("only changes revision for machine configuration", () => {
    const c = defaultCodeConfig("edit");
    expect(withCodeRevision(c, { ...c, hints: ["new hint"] }).revision).toBe(1);
    expect(withCodeRevision(c, { ...c, reference_solution: "new solution" }).revision).toBe(2);
  });
});
describe("local draft isolation", () => {
  beforeEach(() => localStorage.clear());
  it("isolates identity, course, lesson and revision", () => {
    const key = codeDraftKey("u", "c", "l", 1);
    expect(saveCodeDraft(key, { mode: "edit", source: "Rust", updated_at: "now" })).toBe(true);
    expect(readCodeDraft(key)?.mode).toBe("edit");
    for (const other of [codeDraftKey("v","c","l",1),codeDraftKey("u","d","l",1),codeDraftKey("u","c","m",1),codeDraftKey("u","c","l",2)]) expect(readCodeDraft(other)).toBeNull();
  });
  it("tolerates corrupt or unavailable storage", () => {
    localStorage.setItem("bad", "{"); expect(readCodeDraft("bad")).toBeNull();
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(saveCodeDraft("key", { mode: "edit", source: "x", updated_at: "now" })).toBe(false);
    spy.mockRestore();
  });
});

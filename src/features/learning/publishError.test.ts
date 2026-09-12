import { describe, expect, it } from "vitest";
import { learningSaveError, learningMutationIssues } from "./publishError";

const t = (key: string, options?: Record<string, unknown>) => ({
  "learning.saveError": "Save failed",
  "learning.validation.invalid_final_artifact_mapping": "Update final assignment fields",
  "learning.validation.title_required": "Enter a title",
}[key] ?? String(options?.defaultValue ?? key));

describe("publication errors from deferred writes", () => {
  it("identifies the affected lesson when course settings invalidate its artifacts", () => {
    expect(learningSaveError({ message: "LESSON_NOT_PUBLISHABLE: practice-1: invalid_final_artifact_mapping" }, t, [{ id: "practice-1", title: "Prepare demo" }])).toBe("Prepare demo: Update final assignment fields");
  });
  it("translates direct lesson errors and preserves unrelated failures", () => {
    expect(learningSaveError(new Error("LESSON_NOT_PUBLISHABLE: title_required,title_required"), t)).toBe("Enter a title");
    expect(learningSaveError(new Error("Network unavailable"), t)).toBe("Network unavailable");
    expect(learningSaveError(null, t)).toBe("Save failed");
  });
  it("does not show raw unknown validation codes or guess an unknown lesson title", () => {
    expect(learningSaveError(new Error("LESSON_NOT_PUBLISHABLE: missing-id: future_rule"), t)).toBe("Save failed");
  });
});


it("keeps server locations for the current lesson and ignores unrelated/invalid details", () => {
  const issue = { lessonId: "lesson", panel: "content", locale: "en", field: "resource-0-url", fieldPath: ["resources", 0, "url"], code: "resource_url_invalid" };
  expect(learningMutationIssues({ details: JSON.stringify({ issues: [issue, null, { ...issue, lessonId: "another" }, { ...issue, field: 42 }] }) }, "lesson")).toEqual([issue]);
  expect(learningMutationIssues(new Error("Offline"), "lesson")).toEqual([]);
  expect(learningMutationIssues({ details: "Postgres diagnostic text" }, "lesson")).toEqual([]);
  expect(learningMutationIssues({ details: '{"issues":{}}' }, "lesson")).toEqual([]);
});

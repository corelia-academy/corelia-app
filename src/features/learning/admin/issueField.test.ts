import { expect, it } from "vitest";
import { issueField } from "./issueField";
import { defaultCodeConfig } from "@/features/code-exercise/config";
import type { CourseLesson } from "@/types/courses";
const lesson: CourseLesson = { id: "l", section_id: "s", title: "Lesson", order: 0, duration_seconds: 0 };
it("refines reference and later checklist/step errors instead of focusing mode", () => {
  const practice = { ...lesson, practice_config: { mode: "checklist" as const, checklist_items: [{ id: "a", label: "Valid" }, { id: "b", label: "" }] } };
  const resolve = (code: string) => issueField({ field: "practice_config", code }, practice);
  expect(resolve("invalid_related_project")).toBe("practice-related_project_id");
  expect(resolve("invalid_related_hackathon")).toBe("practice-related_hackathon_id");
  expect(resolve("invalid_checklist")).toBe("practice-checklist-1");
  expect(issueField({ field: "practice_config", code: "invalid_steps" }, { ...lesson, practice_config: { mode: "guided_project", project_steps: [{ id: "step", title: "Title", order: 0, verification: "artifact_required", artifact_fields: [] }] } })).toBe("practice-step-artifacts-0");
});
it("locates the faulty source, reference, blank and rule value", () => {
  const config = defaultCodeConfig("edit");
  const resolve = (code: string) => issueField({ field: "code_exercise_config", code }, { ...lesson, code_exercise_config: config });
  config.reference_solution = "";
  expect(resolve("source_required")).toBe("code-reference");
  config.file.starter_source = "x".repeat(65537);
  expect(resolve("source_too_large")).toBe("code-starter");
  expect(resolve("solution_failed")).toBe("code-reference");
  config.tests = [{ id: "bad", type: "contains", description: "Rule", value: "", required: true }];
  expect(resolve("invalid_test_rule")).toBe("code-test-0-value");
  const fill = defaultCodeConfig("fill");
  fill.blanks![0].accepted_answers = [""];
  expect(issueField({ field: "code_exercise_config", code: "invalid_blank" }, { ...lesson, code_exercise_config: fill })).toBe("code-blank-0");
});
it("keeps exact existing locations and malformed recovery boundaries", () => {
  expect(issueField({ field: "resource-2-url", code: "resource_url_invalid" }, lesson)).toBe("resource-2-url");
  expect(issueField({ field: "practice_config", code: "invalid_config" }, { ...lesson, practice_config: [] as never })).toBe("practice_config");
});

import { expect, it } from "vitest";
import type { CourseLesson } from "@/types/courses";
import { validatePracticeFinalMapping } from "./validation";

it.each(["submission", "guided_project"] as const)("requires a course final assignment for %s", mode => {
  const lesson = { id: "practice", lesson_format: "practice", practice_config: { mode } } as CourseLesson;
  expect(validatePracticeFinalMapping(lesson, { final_assignment_title: " " })).toEqual([{ lessonId: "practice", field: "practice_config", code: "final_assignment_required" }]);
});

it("requires every practice artifact in the course final fields and accepts a superset", () => {
  const lesson = { id: "practice", lesson_format: "practice", practice_config: { mode: "submission", submission_fields: ["github_url", "notes"] } } as CourseLesson;
  expect(validatePracticeFinalMapping(lesson, { final_assignment_title: "Project", final_assignment_fields: ["github_url"] })).toEqual([{ lessonId: "practice", field: "practice_config", code: "invalid_final_artifact_mapping" }]);
  expect(validatePracticeFinalMapping(lesson, { final_assignment_title: "Project", final_assignment_fields: ["github_url", "notes", "demo_url"] })).toEqual([]);
});

it("does not impose a final assignment on an instruction-only lesson", () => {
  expect(validatePracticeFinalMapping({ id: "practice", lesson_format: "practice", practice_config: { mode: "instruction" } } as CourseLesson, {})).toEqual([]);
});

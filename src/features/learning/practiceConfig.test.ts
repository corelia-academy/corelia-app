import { expect, it } from "vitest";
import { isPracticeConfig } from "./practiceConfig";
import { validateLesson } from "./validation";
import type { CourseLesson } from "@/types/courses";

it.each([
  { mode: "checklist", checklist_items: {} },
  { mode: "checklist", checklist_items: [null] },
  { mode: "checklist", checklist_items: [{ id: "item", label: 42 }] },
  { mode: "guided_project", project_steps: [{ id: "step", title: "Step", order: 0, verification: "artifact_required", artifact_fields: {} }] },
  { mode: "submission", submission_fields: "github_url" },
  { mode: ["instruction"] },
  { mode: "instruction", related_project_id: 42 },
  { mode: "instruction", revision: "2" },
])("reports malformed legacy practice without throwing: %j", config => {
  expect(isPracticeConfig(config)).toBe(false);
  const lesson = { id: "legacy", title: "Legacy", description_markdown: "Read", lesson_format: "practice", practice_config: config } as unknown as CourseLesson;
  expect(validateLesson(lesson)).toContainEqual({ lessonId: "legacy", field: "practice_config", code: "invalid_config" });
});

it("allows incomplete structured drafts while publication reports missing checklist content", () => {
  const config = { mode: "checklist", checklist_items: [{ id: "item", label: "" }] } as const;
  expect(isPracticeConfig(config)).toBe(true);
  expect(validateLesson({ id: "draft", title: "Draft", description_markdown: "Read", lesson_format: "practice", practice_config: config } as unknown as CourseLesson)).toContainEqual({ lessonId: "draft", field: "practice_config", code: "invalid_checklist" });
});

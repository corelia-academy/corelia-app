import type { CourseLesson } from "@/types/courses";
import type { PublishValidationIssue } from "../types";
import { isPracticeConfig } from "../practiceConfig";
import { isCodeConfigShape } from "@/features/code-exercise/configShape";
import { MAX_SOURCE_BYTES, sourceBytes } from "@/features/code-exercise/evaluate";

/** Refine legacy aggregate server locations against the current editable draft. */
export function issueField(issue: PublishValidationIssue, lesson: CourseLesson): string {
  const code = issue.code;
  const practice = lesson.practice_config;
  if (issue.field === "practice_config" && isPracticeConfig(practice)) {
    if (code === "invalid_related_project") return "practice-related_project_id";
    if (code === "invalid_related_hackathon") return "practice-related_hackathon_id";
    if (code === "invalid_checklist") {
      const index = practice.checklist_items?.findIndex(item => !item.label.trim()) ?? -1;
      return index >= 0 ? `practice-checklist-${index}` : "practice-add-item";
    }
    if (code === "invalid_steps" || code === "invalid_artifact_mapping") {
      const index = practice.project_steps?.findIndex(step => !step.title.trim() || (step.verification === "artifact_required" && (!step.artifact_fields?.length || step.artifact_fields.some(field => !practice.submission_fields?.includes(field))))) ?? -1;
      return index < 0 ? "practice-add-item" : !practice.project_steps![index].title.trim() ? `practice-step-${index}` : `practice-step-artifacts-${index}`;
    }
    if (["invalid_final_artifact_mapping", "invalid_artifact"].includes(code)) return "practice-submission-fields";
  }
  const config = lesson.code_exercise_config;
  if (issue.field === "code_exercise_config" && isCodeConfigShape(config)) {
    if (code === "invalid_file") return "code-file";
    if (["solution_failed", "unresolved_solution"].includes(code)) return "code-reference";
    if (["invalid_markers", "invalid_blanks"].includes(code)) return "code-starter";
    if (["source_required", "source_too_large"].includes(code)) {
      const badStarter = !config.file.starter_source.trim() || sourceBytes(config.file.starter_source) > MAX_SOURCE_BYTES;
      return badStarter ? "code-starter" : "code-reference";
    }
    if (code === "invalid_hints") return "code-hints";
    if (code === "invalid_blank" && config.mode === "fill") {
      const index = config.blanks.findIndex(blank => !blank.accepted_answers.length || blank.accepted_answers.some(answer => !answer.trim() || /[\r\n]/.test(answer)));
      return index >= 0 ? `code-blank-${index}` : "code-starter";
    }
    if (code === "required_test_missing") return "code-add-test";
    if (["invalid_test", "invalid_test_rule", "invalid_test_source"].includes(code)) {
      const index = config.tests?.findIndex(test => test.type === "source_equals" ? !test.accepted_sources.length || test.accepted_sources.some(source => !source.trim() || sourceBytes(source) > MAX_SOURCE_BYTES) : !test.value) ?? -1;
      if (index < 0) return "code-add-test";
      const test = config.tests![index];
      if (test.type === "source_equals") {
        const sourceIndex = test.accepted_sources.findIndex(source => !source.trim() || sourceBytes(source) > MAX_SOURCE_BYTES);
        return sourceIndex >= 0 ? `code-test-${index}-source-${sourceIndex}` : `code-test-${index}-add-source`;
      }
      return `code-test-${index}-value`;
    }
  }
  return issue.field;
}

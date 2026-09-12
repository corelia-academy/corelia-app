import { isQuizConfigShape } from "./quizShape";
import { normalizeLessonCopy } from "./lessonCopy";
import { normalizeCodeLocale } from "@/features/code-exercise/locale";
import { normalizeVideoLocale } from "./videoLocale";
export { isLessonResourceList, validateLessonResources } from "./resourceValidation";
import { validateCodeConfig } from "@/features/code-exercise/config";
import type { Course, CourseLesson } from "@/types/courses";
import { getYoutubeVideoId } from "@/types/courses";
import { getLessonFormat } from "@/lib/lessonFormat";
import { ARTIFACT_FIELDS, type ArtifactField, type PublishValidationIssue } from "./types";
import { isPracticeConfig } from "./practiceConfig";
export function validArtifact(field: ArtifactField, value: string): boolean {
  if (!value.trim()) return false;
  if (!field.endsWith("_url")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
}

export function validatePracticeFinalMapping(lesson: CourseLesson, course: Pick<Course, "final_assignment_title" | "final_assignment_fields">): PublishValidationIssue[] {
  const config = lesson.practice_config;
  if (getLessonFormat(lesson) !== "practice" || !isPracticeConfig(config)) return [];
  const fields = config.submission_fields ?? [];
  const requiresFinal = config.mode === "submission" || config.mode === "guided_project" || fields.length > 0;
  const issue = (code: string): PublishValidationIssue[] => [{ lessonId: lesson.id, field: "practice_config", code }];
  if (requiresFinal && !course.final_assignment_title?.trim()) return issue("final_assignment_required");
  if (fields.some(field => !course.final_assignment_fields?.includes(field))) return issue("invalid_final_artifact_mapping");
  return [];
}

export function validateLesson(lesson: CourseLesson): PublishValidationIssue[] {
  const codes: Array<[string, string]> = [];
  if (typeof lesson.title !== "string" || !lesson.title.trim()) codes.push(["title", "title_required"]);
  if (normalizeLessonCopy(lesson).invalid || normalizeCodeLocale(lesson.code_exercise_locale).invalid || normalizeVideoLocale(lesson).invalid) codes.push(["locale_copy", "invalid_locale_copy"]);
  if (lesson.lesson_format != null && !["article", "video", "quiz", "practice", "code_exercise"].includes(lesson.lesson_format)) codes.push(["lesson_format", "invalid_format"]);
  const format = getLessonFormat(lesson);
  if (format === "video") {
    if (!getYoutubeVideoId(typeof lesson.youtube_url === "string" ? lesson.youtube_url : "")) codes.push(["youtube_url", "youtube_required"]);
    const start = lesson.youtube_start_seconds ?? 0;
    const end = lesson.youtube_end_seconds;
    if (typeof start !== "number" || !Number.isFinite(start) || start < 0 ||
      (end != null && (typeof end !== "number" || !Number.isFinite(end) || end <= start))) codes.push(["youtube_end_seconds", "invalid_segment"]);
  } else if (format === "code_exercise") {
    for (const code of validateCodeConfig(lesson.code_exercise_config, true)) codes.push(["code_exercise_config", code]);
  } else if (format === "quiz") {
    if (!isQuizConfigShape(lesson.quiz_config)) codes.push(["quiz_config", "invalid_config"]);
    else {
      const ratio = lesson.quiz_config?.passing_ratio ?? 0.7;
      if (!(ratio >= 0.01 && ratio <= 1)) codes.push(["quiz_config", "invalid_threshold"]);
    }
  } else if ((typeof lesson.description_markdown !== "string" || !lesson.description_markdown.trim())) codes.push(["description_markdown", "content_required"]);
  if (format === "practice") {
    const c = lesson.practice_config;
    if (c != null && !isPracticeConfig(c)) {
      codes.push(["practice_config", "invalid_config"]);
      return codes.map(([field, code]) => ({ lessonId: lesson.id, field, code }));
    }
    if (c?.requires_review) codes.push(["practice_config", "course_review_only"]);
    if (c?.mode === "checklist" && (!c.checklist_items?.length || c.checklist_items.some(i => !i.id || !i.label.trim()) || new Set(c.checklist_items.map(i => i.id)).size !== c.checklist_items.length)) codes.push(["practice_config", "invalid_checklist"]);
    if (c?.mode === "guided_project" && (!c.project_steps?.length || new Set(c.project_steps.map(s => s.id)).size !== c.project_steps.length || c.project_steps.some(s => !s.id || !s.title.trim() || !["self_check", "artifact_required"].includes(s.verification) || (s.verification === "artifact_required" && (!s.artifact_fields?.length || s.artifact_fields.some(f => !c.submission_fields?.includes(f))))))) codes.push(["practice_config", "invalid_steps"]);
    if (c?.submission_fields?.some(f => !ARTIFACT_FIELDS.includes(f))) codes.push(["practice_config", "invalid_artifact"]);
  }
  return codes.map(([field, code]) => ({ lessonId: lesson.id, field, code }));
}

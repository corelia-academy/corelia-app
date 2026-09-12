import type { CourseLesson } from "@/types/courses";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Both lesson writes and course settings can fail deferred publication checks. */
export function learningSaveError(error: unknown, t: Translate, lessons: Pick<CourseLesson, "id" | "title">[] = [], fallback = t("learning.saveError")): string {
  const message = error instanceof Error ? error.message :
    error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;
  const match = /^LESSON_NOT_PUBLISHABLE:\s*(?:([^:]+):\s*)?([a-z_]+(?:\s*,\s*[a-z_]+)*)$/.exec(message);
  if (!match) return message;
  const details = [...new Set(match[2].split(",").map(code => code.trim()))]
    .map(code => t(`learning.validation.${code}`, { defaultValue: fallback })).join(" · ");
  const title = lessons.find(lesson => lesson.id === match[1]?.trim())?.title;
  return title ? `${title}: ${details}` : details;
}

/** Accept only the location contract; ordinary Postgres/network details stay opaque. */
export function learningMutationIssues(error: unknown, lessonId: string): import("./types").PublishValidationIssue[] {
  if (!error || typeof error !== "object" || !("details" in error) || typeof error.details !== "string") return [];
  let payload: unknown;
  try { payload = JSON.parse(error.details); } catch { return []; }
  if (!payload || typeof payload !== "object" || !("issues" in payload) || !Array.isArray(payload.issues)) return [];
  return payload.issues.flatMap((issue: unknown) => {
    if (!issue || typeof issue !== "object" || !("lessonId" in issue) || issue.lessonId !== lessonId || !("code" in issue) || typeof issue.code !== "string" || !("field" in issue) || typeof issue.field !== "string") return [];
    const location: import("./types").PublishValidationIssue = { lessonId, code: issue.code, field: issue.field };
    if ("locale" in issue && (issue.locale === "vi" || issue.locale === "en")) location.locale = issue.locale;
    if ("panel" in issue && (issue.panel === "info" || issue.panel === "content" || issue.panel === "assignments")) location.panel = issue.panel;
    if ("fieldPath" in issue && Array.isArray(issue.fieldPath) && issue.fieldPath.every(part => typeof part === "string" || (typeof part === "number" && Number.isSafeInteger(part) && part >= 0))) location.fieldPath = issue.fieldPath;
    return [location];
  });
}

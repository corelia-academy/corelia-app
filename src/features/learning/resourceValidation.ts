import type { LessonResource, SupportedCourseLocale } from "@/types/courses";
import type { PublishValidationIssue } from "./types";

export function isLessonResourceList(value: unknown): value is LessonResource[] {
  return Array.isArray(value) && value.every(item => item !== null && typeof item === "object" &&
    typeof item.title === "string" && typeof item.url === "string");
}

export function validateLessonResources(resources: unknown, lessonId: string, locale: SupportedCourseLocale, published: boolean): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  if (!isLessonResourceList(resources)) return [{ lessonId, locale, field: "resources", code: "invalid_resources" }];
  resources.forEach((resource, index) => {
    if (published && !resource.title.trim()) issues.push({ lessonId, locale, field: `resource-${index}-title`, code: "resource_title_required" });
    let validUrl = !published && resource.url === "";
    if (!validUrl) {
      try {
        const url = new URL(resource.url);
        validUrl = /^https?:\/\/\S+$/.test(resource.url) && ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
      } catch { /* Report below; drafts may leave URL empty but cannot store malformed URLs. */ }
    }
    if (!validUrl) issues.push({ lessonId, locale, field: `resource-${index}-url`, code: "resource_url_invalid" });
  });
  return issues;
}

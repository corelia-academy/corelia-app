import { visibleCourseResources } from "@/features/courses/courseResources";
import type { CourseLesson, CourseResource, CourseResourceIcon, CourseSection } from "@/types/courses";

export interface ResourceGroup {
  id: string;
  title: string;
  items: CourseResource[];
}

export function resourceIconForUrl(url: string): CourseResourceIcon {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "github.com" ? "github" : "link";
  } catch {
    return "link";
  }
}

/** Links grouped by section; a duplicate URL stays in the first section it appears in; sections without links are dropped. */
export function groupResourcesBySection(
  groups: { section: Pick<CourseSection, "id" | "title">; lessons: Pick<CourseLesson, "resources">[] }[],
): ResourceGroup[] {
  const seen = new Set<string>();
  const result: ResourceGroup[] = [];
  for (const { section, lessons } of groups) {
    const items: CourseResource[] = [];
    for (const lesson of lessons) {
      for (const resource of visibleCourseResources(lesson.resources)) {
        if (seen.has(resource.url)) continue;
        seen.add(resource.url);
        items.push({ ...resource, icon: resource.icon ?? resourceIconForUrl(resource.url) });
      }
    }
    if (items.length) result.push({ id: section.id, title: section.title, items });
  }
  return result;
}

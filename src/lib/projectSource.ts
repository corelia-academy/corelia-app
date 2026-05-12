import type { ProjectSourceType } from "@/types/projects";

/** i18n keys under `common` namespace */
export function projectSourceLabelKey(
  sourceType: ProjectSourceType,
): "projects.sourceHackathon" | "projects.sourceCourse" | "projects.sourceShowcase" {
  switch (sourceType) {
    case "contest":
      return "projects.sourceHackathon";
    case "course":
      return "projects.sourceCourse";
    default:
      return "projects.sourceShowcase";
  }
}

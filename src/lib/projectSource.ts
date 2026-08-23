import type { ProjectSourceType } from "@/types/projects";

/** Accept both values while historical contest-linked projects are retained. */
export function isHackathonProjectSource(sourceType: ProjectSourceType): boolean {
  return sourceType === "hackathon" || sourceType === "contest";
}

/** i18n keys under `common` namespace */
export function projectSourceLabelKey(
  sourceType: ProjectSourceType,
): "projects.sourceHackathon" | "projects.sourceCourse" | "projects.sourceShowcase" {
  switch (sourceType) {
    case "contest":
    case "hackathon":
      return "projects.sourceHackathon";
    case "course":
      return "projects.sourceCourse";
    default:
      return "projects.sourceShowcase";
  }
}

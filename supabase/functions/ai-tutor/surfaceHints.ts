export type SurfaceHint =
  | "home"
  | "courses"
  | "career"
  | "hackathons"
  | "projects"
  | "achievements"
  | "search"
  | "profile"
  | "account"
  | "default"
  | "lesson";

export function getSurfaceHint(contextData: Record<string, unknown>): SurfaceHint | null {
  const hint = typeof contextData.surfaceHint === "string" ? contextData.surfaceHint.trim() : "";
  switch (hint) {
    case "home":
    case "courses":
    case "career":
    case "hackathons":
    case "projects":
    case "achievements":
    case "search":
    case "profile":
    case "account":
    case "default":
    case "lesson":
      return hint;
    default:
      return null;
  }
}

export function getActivitySurfaceHint(
  contextData: Record<string, unknown>,
): "projects" | "hackathons" | null {
  const hint = getSurfaceHint(contextData);
  if (hint === "projects" || hint === "hackathons") return hint;
  return null;
}

export function getDiscoverySurfaceHint(
  contextData: Record<string, unknown>,
): "search" | "courses" | null {
  const hint = getSurfaceHint(contextData);
  if (hint === "search" || hint === "courses") return hint;
  return null;
}

export function isProjectsActivitySurface(contextData: Record<string, unknown>): boolean {
  return getActivitySurfaceHint(contextData) === "projects";
}

export function isSearchDiscoverySurface(contextData: Record<string, unknown>): boolean {
  return getDiscoverySurfaceHint(contextData) === "search";
}

import type { CourseResourceIcon } from "@/types/courses";

export function resourceIconForUrl(url: string): CourseResourceIcon {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "github.com" ? "github" : "link";
  } catch {
    return "link";
  }
}

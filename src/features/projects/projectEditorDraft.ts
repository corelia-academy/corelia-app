import type { Project } from "@/types/projects";
import type { ProjectMediaItem } from "./ProjectMediaEditor";

export type ProjectDraft = {
  title: string; slug: string; summary: string;
  description: string; progress: string; pitchVideo: string;
  demo: string; repo: string; slide: string; video: string;
  logo: ProjectMediaItem | null; screenshots: ProjectMediaItem[];
  visibility: Project["visibility"];
  tracks: string[]; sectors: string[]; tech: string[];
};

export function projectDraft(project?: Project | null): ProjectDraft {
  return {
    title: project?.title ?? "", slug: project?.slug ?? "", summary: project?.summary ?? "",
    description: project?.description ?? "", progress: project?.progress ?? "", pitchVideo: project?.pitch_video_url ?? "",
    demo: project?.demo_url ?? "", repo: project?.repo_url ?? "",
    slide: project?.slide_url ?? "", video: project?.video_url ?? "",
    logo: project?.logo_path && project.logo_url ? { path: project.logo_path, url: project.logo_url } : null,
    screenshots: (project?.screenshot_paths ?? []).map((path, index) => ({ path, url: project?.screenshot_urls?.[index] ?? "" })).filter(item => item.url),
    visibility: project?.visibility ?? "public",
    tracks: project?.hackathon_track_ids ?? [], sectors: project?.hackathon_sector_ids ?? [], tech: project?.hackathon_tech_stack_ids ?? [],
  };
}

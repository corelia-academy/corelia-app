import type { Project, ProjectContent, ProjectLocales } from "@/types/projects";
import type { ProjectMediaItem } from "./ProjectMediaEditor";

export type ProjectDraft = {
  primaryLocale: "vi" | "en";
  locales: ProjectLocales;
  title: string; slug: string; summary: string;
  description: string; progress: string; pitchVideo: string;
  demo: string; repo: string; slide: string; video: string;
  logo: ProjectMediaItem | null; screenshots: ProjectMediaItem[];
  visibility: Project["visibility"];
  tracks: string[]; sectors: string[]; tech: string[];
};

export function projectDraft(project?: Project | null, uiLocale = "vi"): ProjectDraft {
  const primary = project ? project.i18n?.primary_content_locale ?? "vi" : uiLocale.startsWith("en") ? "en" : "vi";
  const localized = project?.content_locales?.[primary];
  return {
    primaryLocale: primary,
    locales: Object.fromEntries(Object.entries(project?.content_locales ?? {}).map(([locale, value]) => [locale, { title: value.title ?? "", summary: value.summary ?? "", description: value.description ?? "", progress: value.progress ?? "" }])),
    title: localized?.title?.trim() ? localized.title : project?.title ?? "", slug: project?.slug ?? "", summary: localized?.summary?.trim() ? localized.summary : project?.summary ?? "",
    description: localized?.description?.trim() ? localized.description : project?.description ?? "", progress: localized?.progress?.trim() ? localized.progress : project?.progress ?? "", pitchVideo: project?.pitch_video_url ?? "",
    demo: project?.demo_url ?? "", repo: project?.repo_url ?? "",
    slide: project?.slide_url ?? "", video: project?.video_url ?? "",
    logo: project?.logo_path && project.logo_url ? { path: project.logo_path, url: project.logo_url } : null,
    screenshots: (project?.screenshot_paths ?? []).map((path, index) => ({ path, url: project?.screenshot_urls?.[index] ?? "" })).filter(item => item.url),
    visibility: project?.visibility ?? "public",
    tracks: project?.hackathon_track_ids ?? [], sectors: project?.hackathon_sector_ids ?? [], tech: project?.hackathon_tech_stack_ids ?? [],
  };
}

export function primaryProjectContent(draft: ProjectDraft): ProjectContent {
  return { title: draft.title, summary: draft.summary, description: draft.description, progress: draft.progress };
}
export function contentForLocale(draft: ProjectDraft, locale: "vi" | "en"): ProjectContent {
  return locale === draft.primaryLocale ? primaryProjectContent(draft) : { title: "", summary: "", description: "", progress: "", ...draft.locales[locale] };
}
export function projectLocalePayload(draft: ProjectDraft) {
  return { primary_content_locale: draft.primaryLocale, locales: { ...draft.locales, [draft.primaryLocale]: primaryProjectContent(draft) } };
}
export function changePrimaryLocale(draft: ProjectDraft, locale: "vi" | "en"): ProjectDraft {
  return { ...draft, ...contentForLocale(draft, locale), primaryLocale: locale, locales: { ...draft.locales, [draft.primaryLocale]: primaryProjectContent(draft) } };
}

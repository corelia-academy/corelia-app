export type ProjectVisibility = "public" | "unlisted" | "private";
/** `contest` is legacy compatibility; new hackathon-linked projects use `hackathon`. */
export type ProjectSourceType = "standalone" | "contest" | "hackathon" | "course";

export interface Project {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  summary: string | null;
  demo_url: string | null;
  repo_url: string | null;
  slide_url: string | null;
  video_url: string | null;
  logo_path: string | null;
  screenshot_paths: string[];
  /** Short-lived client-resolved URLs for private Storage objects. */
  logo_url?: string | null;
  screenshot_urls?: string[];
  visibility: ProjectVisibility;
  source_type: ProjectSourceType;
  source_id: string | null;
  source_submission_id: string | null;
  hackathon_track_ids: string[];
  hackathon_sector_ids: string[];
  hackathon_tech_stack_ids: string[];
  /** Denormalized count from project_hearts (server-maintained). */
  like_count?: number;
  /** Denormalized count from follows (server-maintained). */
  follower_count?: number;
  /** Text-only content localization config */
  i18n?: import("@/types/entityLocales").EntityI18nConfig;
  created_at: string;
  updated_at: string;
}

/** Rows synced from contest submissions — safe for public listing under projects RLS. */
export type ContestLinkedShowcaseProject = Pick<
  Project,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "demo_url"
  | "repo_url"
  | "slide_url"
  | "video_url"
  | "logo_path"
  | "screenshot_paths"
  | "logo_url"
  | "screenshot_urls"
  | "owner_id"
  | "source_submission_id"
  | "updated_at"
  | "like_count"
  | "created_at"
  | "hackathon_track_ids"
  | "hackathon_sector_ids"
  | "hackathon_tech_stack_ids"
>;

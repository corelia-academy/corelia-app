export type ProjectVisibility = "public" | "unlisted" | "private";
export type ProjectSourceType = "standalone" | "contest" | "course";

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  summary: string | null;
  demo_url: string | null;
  repo_url: string | null;
  slide_url: string | null;
  screenshot_url: string | null;
  cover_image_url: string | null;
  video_url: string | null;
  visibility: ProjectVisibility;
  source_type: ProjectSourceType;
  source_id: string | null;
  source_submission_id: string | null;
  /** Denormalized count from project_hearts (server-maintained). */
  like_count?: number;
  /** Denormalized count from follows (server-maintained). */
  follower_count?: number;
  /** Derived count from project_comments for public gallery/detail UI. */
  comment_count?: number;
  /** Text-only content localization config */
  i18n?: import("@/types/entityLocales").EntityI18nConfig;
  created_at: string;
  updated_at: string;
}

/** Rows synced from contest submissions — safe for public listing under projects RLS. */
export type ContestLinkedShowcaseProject = Pick<
  Project,
  | "id"
  | "title"
  | "summary"
  | "demo_url"
  | "repo_url"
  | "slide_url"
  | "screenshot_url"
  | "cover_image_url"
  | "video_url"
  | "owner_id"
  | "source_submission_id"
  | "updated_at"
  | "like_count"
>;

export interface ProjectComment {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectCommentWithAuthor extends ProjectComment {
  author_username: string | null;
  author_full_name: string | null;
}

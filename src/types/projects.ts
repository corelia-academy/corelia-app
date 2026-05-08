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
  visibility: ProjectVisibility;
  source_type: ProjectSourceType;
  source_id: string | null;
  source_submission_id: string | null;
  created_at: string;
  updated_at: string;
}


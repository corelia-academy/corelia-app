import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import type { ProjectSourceType, ProjectVisibility } from "@/types/projects";

export type ProjectSaveInput = {
  project_id: string;
  slug: string;
  title: string;
  summary?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  slide_url?: string | null;
  video_url?: string | null;
  logo_path?: string | null;
  screenshot_paths?: string[];
  visibility?: ProjectVisibility;
  source_type?: ProjectSourceType;
  source_id?: string | null;
  track_ids?: string[];
  sector_ids?: string[];
  tech_stack_ids?: string[];
  removed_media_paths?: string[];
};

export type ProjectSaveResult = {
  project_id: string;
  submission_id: string | null;
  project_slug: string;
};

async function authenticatedRequest(op: string, init: RequestInit): Promise<Response> {
  const url = coreliaEdgeUrl(op);
  if (!url) throw new Error("edge_url_not_configured");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("unauthenticated");
  return fetch(url, {
    ...init,
    headers: {
      ...supabaseFunctionHeaders(session.access_token),
      ...(init.headers ?? {}),
    },
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `http_error:${response.status}`);
  return payload as T;
}

export async function saveProject(input: ProjectSaveInput): Promise<ProjectSaveResult> {
  const response = await authenticatedRequest("projects.save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseResponse<{ project?: ProjectSaveResult }>(response);
  if (!payload.project?.project_id) throw new Error("invalid_response:project_save");
  return payload.project;
}

export async function saveProjectLocale(
  projectId: string,
  locale: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await authenticatedRequest("projects.save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "locale", project_id: projectId, locale, data }),
  });
  await parseResponse(response);
}

export async function saveProjectI18n(projectId: string, i18n: unknown): Promise<void> {
  const response = await authenticatedRequest("projects.save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "i18n", project_id: projectId, i18n }),
  });
  await parseResponse(response);
}

export type ProjectMediaUploadResult = { path: string; signed_url: string };

export async function uploadProjectMedia(
  projectId: string,
  kind: "logo" | "screenshot",
  file: File,
): Promise<ProjectMediaUploadResult> {
  const body = new FormData();
  body.set("project_id", projectId);
  body.set("kind", kind);
  body.set("file", file);
  const response = await authenticatedRequest("projects.media.upload", { method: "POST", body });
  return parseResponse<ProjectMediaUploadResult>(response);
}

export async function deleteProjectMedia(projectId: string, path: string): Promise<void> {
  const response = await authenticatedRequest("projects.media.delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, path }),
  });
  await parseResponse(response);
}

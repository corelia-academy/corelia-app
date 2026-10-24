import { supabase } from "@/lib/supabase";

export const PROJECT_REPORT_REASONS = ["spam", "harassment", "sexual", "violence", "hate", "illegal", "plagiarism", "other"] as const;
export type ProjectReportReason = (typeof PROJECT_REPORT_REASONS)[number];
export const PROJECT_REPORT_NOTE_MAX = 500;

export type ReportedProject = {
  project_id: string;
  slug: string;
  title: string;
  visibility: "public" | "unlisted" | "private";
  blocked: boolean;
  owner_id: string;
  source_id: string | null;
  source_type: string;
  open_reports: number;
  reasons: ProjectReportReason[];
  latest_report_at: string;
  notes: string[] | null;
};

/** Report a visible project. Reporting again while a report is open is a no-op. */
export async function reportProject(projectId: string, reason: ProjectReportReason, note: string): Promise<void> {
  const { error } = await supabase.rpc("report_project", {
    p_project_id: projectId,
    p_reason: reason,
    p_note: note.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export const REPORTED_PROJECTS_PAGE_SIZE = 20;

export async function listReportedProjects(page: number): Promise<ReportedProject[]> {
  const { data, error } = await supabase.rpc("list_reported_projects", {
    p_limit: REPORTED_PROJECTS_PAGE_SIZE,
    p_offset: page * REPORTED_PROJECTS_PAGE_SIZE,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReportedProject[]).map(row => ({ ...row, open_reports: Number(row.open_reports) }));
}

export async function resolveProjectReports(projectId: string, status: "dismissed" | "actioned"): Promise<void> {
  const { error } = await supabase.rpc("resolve_project_reports", { p_project_id: projectId, p_status: status });
  if (error) throw new Error(error.message);
}

export type DashboardPinnedProgramType =
  | "course"
  | "contest"
  | "offline_course";

export interface DashboardPinnedProgram {
  id: string;
  type: DashboardPinnedProgramType;
  ref_id: string;
  badge?: string | null;
  title_override?: string | null;
  description_override?: string | null;
  cta_label?: string | null;
  active: boolean;
  order: number;
}

export interface HomeDashboardConfig {
  id: string;
  pinned_programs: DashboardPinnedProgram[];
  updated_at: string | null;
  updated_by: string | null;
}

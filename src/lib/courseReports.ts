import { supabase } from "@/lib/supabase";

export type CourseReportReason =
  | "copyright"
  | "spam"
  | "misleading"
  | "unsafe"
  | "other";

export interface SubmitCourseReportInput {
  courseId: string;
  reporterId: string;
  reason: CourseReportReason;
  details: string;
  contactEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export type CourseReportStatus = "open" | "reviewing" | "resolved" | "rejected";
export type CourseReportPriority = "low" | "normal" | "high" | "urgent";

export interface CourseReport {
  id: string;
  course_id: string;
  reporter_id: string;
  reason: CourseReportReason;
  details: string;
  contact_email: string | null;
  status: CourseReportStatus;
  priority: CourseReportPriority;
  reviewer_id: string | null;
  resolution_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export async function submitCourseReport(input: SubmitCourseReportInput): Promise<void> {
  const details = input.details.trim();
  if (details.length < 10) {
    throw new Error("Vui long mo ta report it nhat 10 ky tu.");
  }

  const { error } = await supabase.from("course_reports").insert({
    course_id: input.courseId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details,
    contact_email: input.contactEmail?.trim() || null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ban da gui report cho khoa hoc nay. Doi ngu Corelia se xem xet.");
    }
    if (error.message.toLowerCase().includes("own course")) {
      throw new Error("Ban khong the report khoa hoc cua chinh minh.");
    }
    if (error.message.toLowerCase().includes("limit exceeded")) {
      throw new Error("Ban da gui qua nhieu report. Vui long thu lai sau.");
    }
    throw new Error(error.message);
  }
}

export async function listCourseReports(filters?: {
  status?: CourseReportStatus | "all";
  reason?: CourseReportReason | "all";
}): Promise<CourseReport[]> {
  let query = supabase
    .from("course_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.reason && filters.reason !== "all") {
    query = query.eq("reason", filters.reason);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CourseReport[];
}

export async function updateCourseReport(
  reportId: string,
  patch: {
    status?: CourseReportStatus;
    priority?: CourseReportPriority;
    resolution_note?: string | null;
    reviewer_id?: string | null;
  },
): Promise<void> {
  const resolved = patch.status === "resolved" || patch.status === "rejected";
  const { error } = await supabase
    .from("course_reports")
    .update({
      ...patch,
      resolution_note: patch.resolution_note?.trim() || null,
      updated_at: new Date().toISOString(),
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}

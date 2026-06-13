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
  if (error) throw new Error(error.message);
}

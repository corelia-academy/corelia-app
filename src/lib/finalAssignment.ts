import type { ArtifactField } from "@/features/learning/types";
import { syncCourseCompletion } from "@/lib/courses";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { FinalAssignmentSubmission, FinalSubmissionStatus } from "@/types/courses";

export function latestSubmissionsByUser(submissions: FinalAssignmentSubmission[]): Record<string, FinalAssignmentSubmission> {
  const latest: Record<string, FinalAssignmentSubmission> = {};
  for (const submission of submissions) {
    const previous = latest[submission.user_id];
    const timestamp = Date.parse(submission.submitted_at);
    const previousTimestamp = previous ? Date.parse(previous.submitted_at) : -Infinity;
    if (!previous || timestamp > previousTimestamp || (timestamp === previousTimestamp && submission.id > previous.id)) {
      latest[submission.user_id] = submission;
    }
  }
  return latest;
}

function rowToSubmission(row: Record<string, unknown>): FinalAssignmentSubmission {
  if (!row || typeof row.id !== "string" || !row.id) throw new Error("INVALID_SUBMISSION_RESPONSE");
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    course_id: String(row.course_id),
    content: String(row.content ?? ""),
    // Retain an unavailable-attachment placeholder for malformed historical entries.
    file_urls: Array.isArray(row.file_urls) ? row.file_urls.map(value => typeof value === "string" ? value : "") : row.file_urls == null ? [] : [""],
    submitted_at: String(row.submitted_at),
    artifacts: (row.artifacts ?? {}) as Partial<Record<ArtifactField, string>>,
    status: row.status as FinalAssignmentSubmission["status"],
    reviewer_comment: (row.reviewer_comment as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
  };
}

export async function getSubmission(
  userId: string,
  courseId: string,
): Promise<FinalAssignmentSubmission | null> {
  const { data, error } = await supabase
    .from("final_assignment_submissions")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToSubmission(data as Record<string, unknown>);
}

export async function getSubmissionsForCourse(courseId: string): Promise<FinalAssignmentSubmission[]> {
  const { data, error } = await supabase
    .from("final_assignment_submissions")
    .select("*")
    .eq("course_id", courseId)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => rowToSubmission(d as Record<string, unknown>));
}

export async function submitFinalAssignment(
  courseId: string,
  content: string,
  fileUrls?: string[],
  viewer?: User | null,
  artifacts: Partial<Record<ArtifactField, string>> = {},
  requestId: string = crypto.randomUUID(),
): Promise<FinalAssignmentSubmission> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");

  const { data, error } = await supabase.rpc("learning_final_submit", {
    p_course: courseId, p_content: content, p_files: fileUrls ?? [], p_artifacts: artifacts, p_request: requestId,
  });
  if (error) throw new Error(error.message);
  return rowToSubmission(data as Record<string, unknown>);
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: FinalSubmissionStatus,
  reviewerComment?: string | null,
): Promise<FinalAssignmentSubmission> {
  const { data, error } = await supabase.rpc("learning_final_review", {
    p_submission: submissionId, p_status: status, p_comment: reviewerComment ?? null,
  });
  if (error) throw new Error(error.message);
  const reviewed = rowToSubmission(data as Record<string, unknown>);
  // Approval and completion are already committed by the trusted transaction.
  // Credential delivery is retryable and must not turn a successful review into a failure.
  if (status === "approved" && data) {
    void syncCourseCompletion(String(data.user_id), String(data.course_id)).catch(() => {
      console.warn("[learning] credential synchronization will need retry");
    });
  }
  return reviewed;
}

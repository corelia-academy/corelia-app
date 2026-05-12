import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { FinalAssignmentSubmission, FinalSubmissionStatus } from "@/types/courses";

function rowToSubmission(row: Record<string, unknown>): FinalAssignmentSubmission {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    course_id: String(row.course_id),
    content: String(row.content ?? ""),
    file_urls: (row.file_urls as string[] | undefined) ?? [],
    submitted_at: String(row.submitted_at),
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
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToSubmission(data as Record<string, unknown>);
}

export async function getSubmissionsForCourse(courseId: string): Promise<FinalAssignmentSubmission[]> {
  const { data, error } = await supabase
    .from("final_assignment_submissions")
    .select("*")
    .eq("course_id", courseId)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => rowToSubmission(d as Record<string, unknown>));
}

export async function submitFinalAssignment(
  courseId: string,
  content: string,
  fileUrls?: string[],
  viewer?: User | null,
): Promise<FinalAssignmentSubmission> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");

  const existing = await getSubmission(user.id, courseId);
  if (existing && existing.status !== "rejected") {
    throw new Error("Bạn đã nộp bài rồi. Chỉ có thể nộp lại khi bài bị từ chối.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const row = {
    id,
    user_id: user.id,
    course_id: courseId,
    content,
    file_urls: fileUrls ?? [],
    submitted_at: now,
    status: "pending" as const,
  };
  const { error } = await supabase.from("final_assignment_submissions").insert(row);
  if (error) throw new Error(error.message);
  return rowToSubmission(row as unknown as Record<string, unknown>);
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: FinalSubmissionStatus,
  reviewerComment?: string | null,
): Promise<void> {
  const { data, error: fe } = await supabase
    .from("final_assignment_submissions")
    .select("id")
    .eq("id", submissionId)
    .maybeSingle();
  if (fe || !data) throw new Error("Không tìm thấy bài nộp");

  const { error } = await supabase
    .from("final_assignment_submissions")
    .update({
      status,
      reviewer_comment: reviewerComment ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) throw new Error(error.message);
}

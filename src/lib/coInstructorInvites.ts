import { supabase } from "@/lib/supabase";
import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import type { CourseCoInstructorPermissions } from "@/types/courses";

export type CoInstructorInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

export interface CoInstructorInviteRow {
  id: string;
  course_id: string;
  invitee_user_id: string;
  invited_by: string;
  permissions: CourseCoInstructorPermissions;
  status: CoInstructorInviteStatus;
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateInviteResult {
  invite_id: string;
  token: string;
  expires_at: string;
  course_title: string;
}

/** Create a co-instructor invite (caller must be the course's main instructor). */
export async function createCoInstructorInvite(args: {
  courseId: string;
  inviteeUserId: string;
  permissions: CourseCoInstructorPermissions;
}): Promise<CreateInviteResult> {
  const { data, error } = await supabase.rpc(
    "create_course_co_instructor_invite",
    {
      p_course_id: args.courseId,
      p_invitee_user_id: args.inviteeUserId,
      p_permissions: args.permissions ?? {},
    },
  );
  if (error) throw new Error(error.message);
  return data as CreateInviteResult;
}

/** Trigger Resend email for an already-created invite. Token is consumed once. */
export async function sendCoInstructorInviteEmail(args: {
  inviteId: string;
  token: string;
}): Promise<{ ok: boolean; email_sent: boolean; reason?: string }> {
  return await callCoreliaApi("courses.coInstructorInvite.sendEmail", {
    invite_id: args.inviteId,
    token: args.token,
  });
}

/** Create invite + send email in one call. Returns `{ inviteId, emailSent }`. */
export async function inviteCoInstructor(args: {
  courseId: string;
  inviteeUserId: string;
  permissions: CourseCoInstructorPermissions;
}): Promise<{ inviteId: string; emailSent: boolean; reason?: string }> {
  const created = await createCoInstructorInvite(args);
  try {
    const r = await sendCoInstructorInviteEmail({
      inviteId: created.invite_id,
      token: created.token,
    });
    return { inviteId: created.invite_id, emailSent: r.email_sent, reason: r.reason };
  } catch (e) {
    // In-app notification already created by the RPC; surface email error softly.
    return {
      inviteId: created.invite_id,
      emailSent: false,
      reason: e instanceof Error ? e.message : "email_error",
    };
  }
}

/** Pending invites for a course (manager view). Empty array if none. */
export async function listPendingCoInstructorInvites(
  courseId: string,
): Promise<CoInstructorInviteRow[]> {
  const { data, error } = await supabase
    .from("course_co_instructor_invites")
    .select(
      "id, course_id, invitee_user_id, invited_by, permissions, status, expires_at, created_at, resolved_at",
    )
    .eq("course_id", courseId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoInstructorInviteRow[];
}

export async function revokeCoInstructorInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_course_co_instructor_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
}

export async function acceptCoInstructorInviteById(
  inviteId: string,
): Promise<{ ok: boolean; course_id: string }> {
  const { data, error } = await supabase.rpc(
    "accept_course_co_instructor_invite_by_id",
    { p_invite_id: inviteId },
  );
  if (error) throw new Error(error.message);
  return data as { ok: boolean; course_id: string };
}

export async function declineCoInstructorInviteById(
  inviteId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "decline_course_co_instructor_invite_by_id",
    { p_invite_id: inviteId },
  );
  if (error) throw new Error(error.message);
}

export async function acceptCoInstructorInviteByToken(
  token: string,
): Promise<{ ok: boolean; course_id: string }> {
  const { data, error } = await supabase.rpc(
    "accept_course_co_instructor_invite_by_token",
    { p_token: token },
  );
  if (error) throw new Error(error.message);
  return data as { ok: boolean; course_id: string };
}

export async function declineCoInstructorInviteByToken(
  token: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "decline_course_co_instructor_invite_by_token",
    { p_token: token },
  );
  if (error) throw new Error(error.message);
}

export interface CoInstructorInvitePreview {
  invite_id: string;
  course_id: string;
  course_title: string;
  invited_by: string;
  inviter_name: string;
  inviter_avatar: string | null;
  permissions: CourseCoInstructorPermissions;
  status: CoInstructorInviteStatus;
  expires_at: string;
  is_expired: boolean;
}

export async function peekCoInstructorInviteByToken(
  token: string,
): Promise<CoInstructorInvitePreview> {
  const { data, error } = await supabase.rpc(
    "peek_course_co_instructor_invite_by_token",
    { p_token: token },
  );
  if (error) throw new Error(error.message);
  return data as CoInstructorInvitePreview;
}

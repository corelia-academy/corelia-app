import { supabase } from "@/lib/supabase";

export type UserNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

export async function listMyNotifications(limit = 30): Promise<UserNotificationRow[]> {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id,user_id,type,payload,read_at,resolved_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as UserNotificationRow[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

export type AcceptProjectInviteRpcPayload = {
  ok?: boolean;
  project_id?: string;
};

export async function acceptProjectInviteById(
  inviteId: string,
): Promise<AcceptProjectInviteRpcPayload> {
  const { data, error } = await supabase.rpc("accept_project_collaboration_invite_by_id", {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as AcceptProjectInviteRpcPayload;
}

export async function declineProjectInviteById(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_project_collaboration_invite_by_id", {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
}

export async function acceptProjectInviteByToken(
  token: string,
): Promise<AcceptProjectInviteRpcPayload> {
  const { data, error } = await supabase.rpc("accept_project_collaboration_invite", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as AcceptProjectInviteRpcPayload;
}

export async function declineProjectInviteByToken(token: string): Promise<void> {
  const { error } = await supabase.rpc("decline_project_collaboration_invite", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
}

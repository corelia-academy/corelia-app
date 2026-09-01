import { supabase } from "@/lib/supabase";
import { fetchProjectInviteDisplayContextByProjectIds } from "@/lib/notificationInviteContext";

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

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ProjectInvitePreview = {
  id: string;
  project_id: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  expires_at: string;
  created_at?: string;
  project_title?: string | null;
  hackathon_href?: string | null;
};

export async function peekProjectInviteByToken(
  token: string,
  options?: { signal?: AbortSignal },
): Promise<ProjectInvitePreview> {
  const safeToken = (token ?? "").trim();
  if (!safeToken) throw new Error("invalid_token");

  const tokenHash = await sha256Hex(safeToken);
  let query = supabase
    .from("project_collaboration_invites")
    .select("id,project_id,status,expires_at,created_at,invitee_user_id")
    .eq("token_hash", tokenHash);

  if (options?.signal) {
    query = query.abortSignal(options.signal);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("invalid_token");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id ?? null;
  const currentEmail = session?.user?.email ?? "";

  if (data.invitee_user_id && currentUserId && data.invitee_user_id !== currentUserId) {
    throw new Error(`wrong_account:${currentEmail}`);
  }

  if (data.status !== "pending") {
    throw new Error(`not_actionable:${data.status}`);
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("expired");
  }

  let projectTitle: string | null = null;
  let hackathonHref: string | null = null;
  if (data.project_id) {
    try {
      const ctx = await fetchProjectInviteDisplayContextByProjectIds([data.project_id]);
      projectTitle = ctx[data.project_id]?.projectTitle ?? null;
      hackathonHref = ctx[data.project_id]?.hackathonHref ?? null;
    } catch {
      // non-critical preview context lookup
    }
  }

  return {
    id: data.id,
    project_id: data.project_id,
    status: data.status,
    expires_at: data.expires_at,
    created_at: data.created_at,
    project_title: projectTitle,
    hackathon_href: hackathonHref,
  };
}

import { supabase } from "@/lib/supabase";
import { contestSubmissionId } from "@/lib/hackathons";
import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import type { Project } from "@/types/projects";

export type ProjectCollaborationInviteRow = {
  id: string;
  project_id: string;
  invitee_user_id: string;
  invited_by: string;
  status: string;
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
};

export type ProjectCollaboratorRow = {
  project_id: string;
  user_id: string;
  role: string;
  show_in_portfolio: boolean;
  added_at: string;
};

export type MyProjectAccess = {
  is_owner: boolean;
  collaborator_role: string | null;
  show_in_portfolio: boolean | null;
};

export type MyProjectEntry = {
  project: Project;
  access: MyProjectAccess;
};

export async function fetchHackathonProjectForOwnerSubmission(
  hackathonId: string,
  ownerUserId: string,
): Promise<Project | null> {
  const submissionId = contestSubmissionId(hackathonId, ownerUserId);
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id,slug,owner_id,title,summary,demo_url,repo_url,slide_url,video_url,logo_path,screenshot_paths,visibility,source_type,source_id,source_submission_id,hackathon_track_ids,hackathon_sector_ids,hackathon_tech_stack_ids,created_at,updated_at",
    )
    .in("source_type", ["contest", "hackathon"])
    .eq("source_id", hackathonId)
    .eq("source_submission_id", submissionId)
    .eq("owner_id", ownerUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Project | null;
}

export async function listProjectCollaborators(
  projectId: string,
): Promise<ProjectCollaboratorRow[]> {
  const { data, error } = await supabase
    .from("project_collaborators")
    .select("project_id,user_id,role,show_in_portfolio,added_at")
    .eq("project_id", projectId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectCollaboratorRow[];
}

export type PublicProjectTeamMember = CollaborationProfileMini & { user_id: string };

export async function listPublicProjectTeam(projectId: string): Promise<PublicProjectTeamMember[]> {
  const { data: rows, error } = await supabase
    .from("project_collaborators")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("show_in_portfolio", true);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((row) => String(row.user_id));
  const profiles = await listCollaborationProfiles(ids);
  return ids.flatMap((id) => {
    const profile = profiles[id];
    return profile ? [{ user_id: id, ...profile }] : [];
  });
}

export async function listProjectCollaborationInvites(
  projectId: string,
): Promise<ProjectCollaborationInviteRow[]> {
  const { data, error } = await supabase
    .from("project_collaboration_invites")
    .select("id,project_id,invitee_user_id,invited_by,status,expires_at,created_at,resolved_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectCollaborationInviteRow[];
}

export type InvitableUserRow = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type CollaborationProfileMini = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url?: string | null;
};

export async function listCollaborationProfiles(
  userIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, CollaborationProfileMini>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};
  let request = supabase
    .from("public_profiles")
    .select("id,username,full_name,avatar_url")
    .in("id", ids);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    ((data ?? []) as CollaborationProfileMini[]).map((profile) => [profile.id, profile]),
  );
}

export async function listProjectTeamCandidates(input: {
  projectId: string;
  sourceType: string;
  sourceId?: string | null;
  search?: string;
  limit?: number;
}): Promise<InvitableUserRow[]> {
  const { data, error } = await supabase.rpc("list_project_team_candidates", {
    p_project_id: input.projectId,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId ?? null,
    p_search: input.search?.trim() ?? "",
    p_limit: input.limit ?? 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvitableUserRow[];
}

export async function listInvitableHackathonUsers(
  projectId: string,
  search: string,
  limit = 50,
): Promise<InvitableUserRow[]> {
  const { data, error } = await supabase.rpc("list_invitable_hackathon_users", {
    p_project_id: projectId,
    p_search: search.trim(),
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvitableUserRow[];
}

export type CreateInviteResult = {
  invite_id: string;
  token: string;
  expires_at: string;
};

export async function sendProjectCollaborationInviteEmail(args: {
  inviteId: string;
  token: string;
}): Promise<{ ok: boolean; email_sent: boolean; reason?: string }> {
  return await callCoreliaApi("projects.collaborationInvite.sendEmail", {
    invite_id: args.inviteId,
    token: args.token,
  });
}

export async function createProjectCollaborationInvite(
  projectId: string,
  inviteeUserId: string,
): Promise<CreateInviteResult> {
  const { data, error } = await supabase.rpc("create_project_collaboration_invite", {
    p_project_id: projectId,
    p_invitee_user_id: inviteeUserId,
  });
  if (error) throw new Error(error.message);
  const row = data as { invite_id?: string; token?: string; expires_at?: string } | null;
  if (!row?.invite_id || !row?.token) throw new Error("Invalid invite response");

  try {
    await sendProjectCollaborationInviteEmail({
      inviteId: row.invite_id,
      token: row.token,
    });
  } catch (emailErr) {
    // In-app notification already created by the RPC; surface email error softly
    console.warn("[projectCollaboration] send invite email failed", emailErr);
  }

  return {
    invite_id: row.invite_id,
    token: row.token,
    expires_at: row.expires_at ?? "",
  };
}

export async function revokeProjectCollaborationInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_project_collaboration_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
}

export async function removeProjectCollaborator(
  projectId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_project_collaborator", {
    p_project_id: projectId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function setMyProjectCollaborationVisibility(
  projectId: string,
  showInPortfolio: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_my_project_collaboration_visibility", {
    p_project_id: projectId,
    p_show_in_portfolio: showInPortfolio,
  });
  if (error) throw new Error(error.message);
}

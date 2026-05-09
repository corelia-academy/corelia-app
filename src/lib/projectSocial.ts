import { supabase } from "@/lib/supabase";
import type { ProjectCommentWithAuthor } from "@/types/projects";

export const PROJECT_COMMENT_MAX_LENGTH = 2000;

export async function getProjectCommentCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from("project_comments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listMyProjectHeartIds(projectIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return new Set();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("project_hearts")
    .select("project_id")
    .eq("user_id", user.id)
    .in("project_id", ids);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.project_id as string));
}

/** Returns true when the heart is active after the operation. */
export async function toggleProjectHeart(projectId: string): Promise<boolean> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("LOGIN_REQUIRED");

  const { data: existing, error: selErr } = await supabase
    .from("project_hearts")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);

  if (existing) {
    const { error: delErr } = await supabase
      .from("project_hearts")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (delErr) throw new Error(delErr.message);
    return false;
  }

  const { error: insErr } = await supabase.from("project_hearts").insert({
    project_id: projectId,
    user_id: user.id,
  });
  if (insErr) throw new Error(insErr.message);
  return true;
}

export async function listProjectCommentsWithAuthors(
  projectId: string,
  opts?: { limit?: number },
): Promise<ProjectCommentWithAuthor[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);

  const { data: rows, error } = await supabase
    .from("project_comments")
    .select("id,project_id,author_id,body,created_at,updated_at,deleted_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const comments = (rows ?? []) as Omit<ProjectCommentWithAuthor, "author_username" | "author_full_name">[];

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id).filter(Boolean)));
  const profileMap = new Map<string, { username: string | null; full_name: string | null }>();

  if (authorIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from("public_profiles")
      .select("id,username,full_name")
      .in("id", authorIds);
    if (pErr) throw new Error(pErr.message);
    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, {
        username: (p.username as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
      });
    }
  }

  return comments.map((c) => {
    const pr = profileMap.get(c.author_id);
    return {
      ...c,
      author_username: pr?.username ?? null,
      author_full_name: pr?.full_name ?? null,
    };
  });
}

export async function addProjectComment(projectId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("COMMENT_EMPTY");
  if (trimmed.length > PROJECT_COMMENT_MAX_LENGTH) throw new Error("COMMENT_TOO_LONG");

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("LOGIN_REQUIRED");

  const { error } = await supabase.from("project_comments").insert({
    project_id: projectId,
    author_id: user.id,
    body: trimmed,
  });
  if (error) throw new Error(error.message);
}

export async function softDeleteProjectComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("project_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw new Error(error.message);
}

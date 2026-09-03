import { supabase } from "@/lib/supabase";

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

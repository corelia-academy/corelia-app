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

/** Returns confirmed heart state and whether this action created an XP award. */
export async function toggleProjectHeart(projectId: string): Promise<{ hearted: boolean; awarded: boolean }> {
  const { data, error } = await supabase.rpc("xp_toggle_project_heart", { p_project_id: projectId });
  if (error) throw new Error(error.message);
  return data as { hearted: boolean; awarded: boolean };
}

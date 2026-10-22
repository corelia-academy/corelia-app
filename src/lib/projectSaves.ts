import { supabase } from "@/lib/supabase";

export async function listMyProjectSaveIds(projectIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean)));
  if (!ids.length) return new Set();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("project_saves")
    .select("project_id")
    .eq("user_id", user.id)
    .in("project_id", ids);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.project_id as string));
}

export async function setProjectSaved(
  projectId: string,
  saved: boolean,
): Promise<{ saved: boolean; changed: boolean }> {
  const { data, error } = await supabase.rpc("set_project_saved", {
    p_project_id: projectId,
    p_saved: saved,
  });
  if (error) throw new Error(error.message);
  return data as { saved: boolean; changed: boolean };
}

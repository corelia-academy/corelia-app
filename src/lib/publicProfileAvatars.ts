import { supabase } from "@/lib/supabase";

export async function getPublicAvatarSeeds(
  userIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return new Map();

  let request = supabase
    .from("public_profiles")
    .select("id,avatar_seed")
    .in("id", ids);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);

  return new Map(
    (data ?? []).map((row) => [String(row.id), row.avatar_seed ?? null]),
  );
}

import { supabase } from "@/lib/supabase";
import type { AvatarConfig } from "@/lib/avatar";

export type PublicHackathonApplicant = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_seed: string | null;
  avatar_config: AvatarConfig | null;
};

export type PublicHackathonApplicantPreviews = Record<string, PublicHackathonApplicant[]>;

export async function listPublicHackathonApplicantPreviews(
  hackathonIds: string[],
): Promise<PublicHackathonApplicantPreviews> {
  const ids = Array.from(new Set(hackathonIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return {};

  const previews: PublicHackathonApplicantPreviews = Object.fromEntries(ids.map((id) => [id, []]));
  for (let offset = 0; offset < ids.length; offset += 20) {
    const { data, error } = await supabase.rpc("list_public_hackathon_applicant_previews", {
      p_hackathon_ids: ids.slice(offset, offset + 20),
    });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = String(row.hackathon_id);
      if (!previews[id]) continue;
      previews[id].push({
        user_id: String(row.user_id),
        username: row.username ?? null,
        full_name: row.full_name ?? null,
        avatar_seed: row.avatar_seed ?? null,
        avatar_config: (row.avatar_config ?? null) as AvatarConfig | null,
      });
    }
  }
  return previews;
}

import { supabase } from "@/lib/supabase";
import type { AvatarConfig } from "@/lib/avatar";

export async function saveMyAvatar(seed: string | null, config: AvatarConfig): Promise<{ seed: string | null } & AvatarConfig> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Unauthenticated");
  const response = await fetch("/api/me/avatar", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ seed, ...config }),
  });
  if (!response.ok) throw new Error(`Avatar save failed (${response.status})`);
  return response.json();
}

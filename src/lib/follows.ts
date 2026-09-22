import { supabase } from "@/lib/supabase";
import type { FollowRow, FollowSubject } from "@/types/feed";
import { getPublicAvatarSeeds } from "@/lib/publicProfileAvatars";

export interface FollowerPreviewRow {
  id: string;
  username: string | null;
  ocid: string | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  followed_at: string;
}

export type FeedSuggestedProfile = Omit<FollowerPreviewRow, "followed_at"> & { total_xp: number };

async function requireFollowerId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("Sign in required");
  return user.id;
}

export async function followSubject(subject: FollowSubject): Promise<void> {
  const followerId = await requireFollowerId();

  const { error } = await supabase.from("follows").insert({
    follower_id: followerId,
    subject_type: subject.type,
    subject_id: subject.id,
  });
  if (error) throw new Error(error.message);
}

export async function unfollowSubject(subject: FollowSubject): Promise<void> {
  const followerId = await requireFollowerId();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id);
  if (error) throw new Error(error.message);
}

export async function muteSubject(
  subject: FollowSubject,
  mutedUntil: string | null,
): Promise<void> {
  const followerId = await requireFollowerId();
  const { error } = await supabase
    .from("follows")
    .update({ muted_until: mutedUntil })
    .eq("follower_id", followerId)
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id);
  if (error) throw new Error(error.message);
}

export async function listFollowing(signal?: AbortSignal): Promise<FollowRow[]> {
  const followerId = await requireFollowerId();
  let request = supabase
    .from("follows")
    .select("follower_id,subject_type,subject_id,created_at,muted_until")
    .eq("follower_id", followerId)
    .order("created_at", { ascending: false });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return (data ?? []) as FollowRow[];
}

export async function listFollowers(
  subject: FollowSubject,
  limit = 12,
): Promise<FollowerPreviewRow[]> {
  const { data, error } = await supabase.rpc("list_followers_v1", {
    p_subject_type: subject.type,
    p_subject_id: subject.id,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<FollowerPreviewRow, "avatar_seed">[];
  const seeds = await getPublicAvatarSeeds(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, avatar_seed: seeds.get(row.id) ?? null }));
}

export async function listUserFollowing(
  userId: string,
  limit = 50,
): Promise<FollowerPreviewRow[]> {
  const { data, error } = await supabase.rpc("list_user_following_v1", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<FollowerPreviewRow, "avatar_seed">[];
  const seeds = await getPublicAvatarSeeds(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, avatar_seed: seeds.get(row.id) ?? null }));
}

export async function listMyFeedFollowingProfiles(
  userId: string,
  cursor: Pick<FollowerPreviewRow, "id" | "followed_at"> | null = null,
  limit = 20,
): Promise<FollowerPreviewRow[]> {
  const followerId = await requireFollowerId();
  if (followerId !== userId) throw new Error("Forbidden following list");
  const { data, error } = await supabase.rpc("list_my_feed_following_profiles_v1", {
    p_cursor_at: cursor?.followed_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<FollowerPreviewRow, "avatar_seed">[];
  const seeds = await getPublicAvatarSeeds(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, avatar_seed: seeds.get(row.id) ?? null }));
}

export async function listSuggestedFeedProfiles(userId: string, limit = 4): Promise<FeedSuggestedProfile[]> {
  const followerId = await requireFollowerId();
  if (followerId !== userId) throw new Error("Forbidden suggestions list");
  const { data, error } = await supabase.rpc("list_feed_xp_suggestions_v1", { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FeedSuggestedProfile[]).map((row) => ({
    ...row,
    total_xp: Number(row.total_xp),
  }));
}

export async function getUserFollowingProfileCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_user_following_profile_count_v1", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function isFollowing(subject: FollowSubject): Promise<boolean> {
  const followerId = await requireFollowerId();
  const { data, error } = await supabase
    .from("follows")
    .select("subject_id")
    .eq("follower_id", followerId)
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export function subscribeToFollowingChanges(
  userId: string,
  concernId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`following:${concernId}:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "follows",
        filter: `follower_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

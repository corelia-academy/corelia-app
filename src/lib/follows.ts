import { supabase } from "@/lib/supabase";
import type { FollowRow, FollowSubject } from "@/types/feed";

export async function followSubject(subject: FollowSubject): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Sign in required");

  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    subject_type: subject.type,
    subject_id: subject.id,
  });
  if (error) throw new Error(error.message);
}

export async function unfollowSubject(subject: FollowSubject): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id);
  if (error) throw new Error(error.message);
}

export async function muteSubject(
  subject: FollowSubject,
  mutedUntil: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .update({ muted_until: mutedUntil })
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id);
  if (error) throw new Error(error.message);
}

export async function listFollowing(): Promise<FollowRow[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id,subject_type,subject_id,created_at,muted_until")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FollowRow[];
}

export async function isFollowing(subject: FollowSubject): Promise<boolean> {
  const { data, error } = await supabase
    .from("follows")
    .select("subject_id")
    .eq("subject_type", subject.type)
    .eq("subject_id", subject.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

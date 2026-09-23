import { supabase } from "@/lib/supabase";

export type FeedMode = "explore" | "following";

export type FeedMilestone = {
  id: number;
  actor_id: string;
  kind: "course_completed" | "xp_reached" | "project_submitted";
  source_key: string;
  course_id: string | null;
  hackathon_id: string | null;
  project_id: string | null;
  xp_total: number | null;
  created_at: string;
};
export type FeedProfile = { id: string; username: string | null; ocid: string | null; full_name: string | null; avatar_url: string | null; avatar_seed: string | null; avatar_config?: import("../../shared/avatarConfig").AvatarConfig | null };
export type FeedSource = { label: string; href: string };
export type MilestonePage = { milestones: FeedMilestone[]; profiles: Record<string, FeedProfile>; sources: Record<number, FeedSource[]>; likes: Record<number, number>; liked: Set<number> };

function titleFrom(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const object = value as Record<string, unknown>;
  const title = object.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const locale = object.vi ?? object.en;
  if (locale && typeof locale === "object" && typeof (locale as { title?: unknown }).title === "string") return (locale as { title: string }).title;
  return fallback;
}
export async function getMilestonePage(userId: string, mode: FeedMode | "profile", actorId?: string, cursor?: FeedMilestone | null): Promise<MilestonePage> {
  const pagination = {
    p_cursor_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: 20,
  };
  if (mode === "profile" && !actorId) throw new Error("Profile actor is required");
  const { data, error } = mode === "profile"
    ? await supabase.rpc("get_feed_milestones_v1", { ...pagination, p_following: false, p_actor_id: actorId })
    : await supabase.rpc("get_feed_milestones_v2", { ...pagination, p_mode: mode });
  if (error) throw error;
  const milestones = (data ?? []) as FeedMilestone[];
  const ids = milestones.map((item) => item.id);
  const actors = [...new Set(milestones.map((item) => item.actor_id))];
  const courses = [...new Set(milestones.flatMap((item) => item.course_id ? [item.course_id] : []))];
  const hackathons = [...new Set(milestones.flatMap((item) => item.hackathon_id ? [item.hackathon_id] : []))];
  const [profileResult, courseResult, hackathonResult, likeResult] = await Promise.all([
    actors.length ? supabase.from("public_profiles").select("id,username,ocid,full_name,avatar_url,avatar_seed,avatar_config").in("id", actors) : Promise.resolve({ data: [], error: null }),
    courses.length ? supabase.from("courses").select("id,slug,data").in("id", courses) : Promise.resolve({ data: [], error: null }),
    hackathons.length ? supabase.from("hackathons").select("id,document").in("id", hackathons) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("feed_milestone_likes").select("milestone_id,user_id").in("milestone_id", ids) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [profileResult, courseResult, hackathonResult, likeResult]) if (result.error) throw result.error;
  const profiles = Object.fromEntries(((profileResult.data ?? []) as FeedProfile[]).map((item) => [item.id,item]));
  const courseById = Object.fromEntries((courseResult.data ?? []).map((item) => [item.id,item]));
  const hackathonById = Object.fromEntries((hackathonResult.data ?? []).map((item) => [item.id,item]));
  const sources: Record<number,FeedSource[]> = {};
  for (const item of milestones) {
    const links: FeedSource[] = [];
    const course = item.course_id ? courseById[item.course_id] : null;
    const hackathon = item.hackathon_id ? hackathonById[item.hackathon_id] : null;
    if (course) links.push({ label: titleFrom(course.data, course.id), href: `/courses/${course.slug || course.id}` });
    if (hackathon) links.push({ label: titleFrom(hackathon.document, hackathon.id), href: `/hackathons/${typeof hackathon.document?.slug === "string" ? hackathon.document.slug : hackathon.id}` });
    sources[item.id] = links;
  }
  const likes: Record<number,number> = {}; const liked = new Set<number>();
  for (const row of likeResult.data ?? []) { likes[row.milestone_id] = (likes[row.milestone_id] ?? 0) + 1; if (row.user_id===userId) liked.add(row.milestone_id); }
  return { milestones, profiles, sources, likes, liked };
}
export async function setMilestoneLike(id: number, userId: string, liked: boolean): Promise<void> {
  const result = liked ? await supabase.from("feed_milestone_likes").insert({ milestone_id:id, user_id:userId }) : await supabase.from("feed_milestone_likes").delete().eq("milestone_id",id).eq("user_id",userId);
  if (result.error) throw result.error;
}
export function subscribeToMilestones(onNew: () => void): () => void {
  const channel = supabase.channel("verified-feed-milestones").on("postgres_changes",{ event:"INSERT",schema:"public",table:"feed_milestones" },onNew).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

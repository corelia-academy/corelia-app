import { json } from "../lib/http.ts";
import { type SupabaseClient } from "../lib/supabase.ts";

export async function handleNotificationsUnsubscribe(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const type = String(body.type ?? "").trim();

    if (type === "track_blast") return json({ message: "career_tracks_retired" }, 410);
    if (!token) return json({ message: "missing_fields:token" }, 400);
    if (type !== "course_blast") return json({ message: "invalid_type" }, 400);
    const column = "email_course_blast";

    const { data, error } = await db
      .from("notification_preferences")
      .update({ [column]: false, updated_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("user_id");

    if (error) {
      console.error("[corelia-api] notifications.unsubscribe db error", error);
      return json({ message: "db_error" }, 500);
    }

    if (!data || data.length === 0) {
      return json({ message: "token_not_found" }, 404);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("[corelia-api] notifications.unsubscribe", e);
    return json({ message: "internal_error" }, 500);
  }
}

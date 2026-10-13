import { supabase } from "@/lib/supabase";
import { coreliaEdgeUrl } from "@/lib/coreliaEdgeApi";
import { supabasePublicClientKey } from "@/lib/supabase";

export interface NotificationPreferences {
  in_app_likes: boolean;
  in_app_follows: boolean;
  email_social_digest: boolean;
  digest_timezone: string;
  email_course_blast: boolean;
  email_learning_reminders: boolean;
  in_app_course_blast: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  in_app_likes: true,
  in_app_follows: true,
  email_social_digest: false,
  digest_timezone: "Asia/Ho_Chi_Minh",
  email_course_blast: true,
  email_learning_reminders: true,
  in_app_course_blast: true,
};

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_course_blast,email_learning_reminders,in_app_course_blast,in_app_likes,in_app_follows,email_social_digest,digest_timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    in_app_likes: data.in_app_likes ?? true,
    in_app_follows: data.in_app_follows ?? true,
    email_social_digest: data.email_social_digest ?? false,
    digest_timezone: data.digest_timezone ?? "Asia/Ho_Chi_Minh",
    email_course_blast: data.email_course_blast ?? true,
    email_learning_reminders: data.email_learning_reminders ?? true,
    in_app_course_blast: data.in_app_course_blast ?? true,
  };
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return preferences;
}

export async function countMintedCredentials(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("credential_issuances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "minted");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function unsubscribeFromNotifications(input: {
  token: string;
  type: string;
  signal?: AbortSignal;
}): Promise<void> {
  const url = coreliaEdgeUrl(input.type === "marketing" ? "email.unsubscribe" : "notifications.unsubscribe");
  if (!url || !input.token) throw new Error("invalid_unsubscribe_link");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabasePublicClientKey(),
    },
    body: JSON.stringify({ token: input.token, type: input.type }),
    signal: input.signal,
  });
  if (!response.ok) throw new Error("unsubscribe_failed");
}

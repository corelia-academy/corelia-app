import type { SupabaseClient } from "../lib/supabase.ts";
import { normalizeEmail } from "./csv.ts";
import { resolveRecipientEmailLocale } from "../lib/mail/locale.ts";

export async function enqueueEmailAutomationForUser(params: {
  db: SupabaseClient;
  triggerType: string;
  userId: string;
  triggerKey: string;
  objectType?: "course" | "program" | "hackathon";
  objectId?: string;
  context?: Record<string, unknown>;
}): Promise<number> {
  const { data: authUser } = await params.db.auth.admin.getUserById(params.userId);
  const email = normalizeEmail(authUser?.user?.email ?? "");
  if (!email) return 0;
  const { data: profile } = await params.db.from("profiles").select("full_name, locale").eq("id", params.userId).maybeSingle();
  const resolved = resolveRecipientEmailLocale({ profileLocale: profile?.locale, authMetadataLocale: authUser?.user?.user_metadata?.locale });
  const { data: contact, error } = await params.db.from("email_contacts").upsert({ user_id: params.userId, email, full_name: profile?.full_name ?? null, locale: resolved.locale, updated_at: new Date().toISOString() }, { onConflict: "email" }).select("id").single();
  if (error || !contact) return 0;
  let query = params.db.from("email_automations").select("id").eq("enabled", true).eq("trigger_type", params.triggerType);
  if (params.objectType && params.objectId) query = query.eq("object_type", params.objectType).eq("object_id", params.objectId);
  else query = query.is("object_type", null).is("object_id", null);
  const { data: automations } = await query;
  if (!automations?.length) return 0;
  const enrollments = await Promise.all(automations.map(async (automation) => {
    const { data: firstStep } = await params.db.from("email_automation_steps").select("delay_minutes").eq("automation_id", automation.id).eq("position", 0).maybeSingle();
    return { automation_id: automation.id, contact_id: contact.id, trigger_key: params.triggerKey, context: params.context ?? {}, next_step_at: new Date(Date.now() + Number(firstStep?.delay_minutes ?? 0) * 60_000).toISOString() };
  }));
  const { error: insertError } = await params.db.from("email_automation_enrollments").upsert(enrollments, { onConflict: "automation_id,trigger_key", ignoreDuplicates: true });
  return insertError ? 0 : automations.length;
}

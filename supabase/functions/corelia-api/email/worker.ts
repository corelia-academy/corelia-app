import { json } from "../lib/http.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { claimOutboxLease, commitOutboxFailure, commitOutboxSuccess, persistOutboxDispatch, releaseOutboxUnconfigured } from "../lib/mail/outbox.ts";
import { isTransactionalEmailConfigured } from "../lib/mail/resend.ts";
import type { SupabaseClient } from "../lib/supabase.ts";
import { renderEmailDocument } from "./template.ts";
import { processNextImportChunk } from "./importWorker.ts";

type Recipient = {
  id: string;
  campaign_id: string;
  recipient_email: string;
  contact_id: string;
  personalization: Record<string, unknown>;
  attempts: number;
  dispatch_batch_key: string;
};

function env(name: string): string { return Deno.env.get(name)?.trim() ?? ""; }

async function reserveProviderSlot(db: SupabaseClient): Promise<void> {
  const { data, error } = await db.rpc("email_reserve_provider_slot");
  if (error) throw error;
  const waitMs = Math.max(0, new Date(String(data)).getTime() - Date.now());
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 5_000)));
}

async function claimRecipients(db: SupabaseClient, campaignId: string, limit: number): Promise<{ rows: Recipient[]; lease: string }> {
  const lease = crypto.randomUUID();
  const { data, error } = await db.rpc("email_claim_campaign_recipients", { p_campaign_id: campaignId, p_limit: limit, p_lease_token: lease });
  if (error) throw error;
  return { rows: (data ?? []) as Recipient[], lease };
}

async function dispatchBatch(db: SupabaseClient, campaign: Record<string, unknown>, rows: Recipient[], lease: string): Promise<{ accepted: number; failed: number }> {
  const contactIds = rows.map((row) => row.contact_id);
  const { data: contacts } = await db.from("email_contacts").select("id,user_id,global_suppressed_at,email_contact_consents(topic,status)").in("id", contactIds);
  const userIds = (contacts ?? []).map((contact) => contact.user_id).filter(Boolean);
  const { data: preferences } = userIds.length ? await db.from("notification_preferences").select("user_id,email_course_blast,email_track_blast").in("user_id", userIds) : { data: [] };
  const preferenceByUser = new Map((preferences ?? []).map((preference) => [preference.user_id, preference]));
  const allowedIds = new Set((contacts ?? []).filter((contact) => {
    if (contact.global_suppressed_at) return false;
    const preference = contact.user_id ? preferenceByUser.get(contact.user_id) : null;
    if (campaign.object_type === "course" && preference?.email_course_blast === false) return false;
    if (campaign.object_type === "program" && preference?.email_track_blast === false) return false;
    if (campaign.purpose !== "marketing") return true;
    return contact.email_contact_consents?.some((consent: { topic: string; status: string }) => consent.topic === "marketing" && consent.status === "subscribed");
  }).map((contact) => contact.id));
  const suppressed = rows.filter((row) => !allowedIds.has(row.contact_id));
  if (suppressed.length) await db.from("email_campaign_recipients").update({ status: "suppressed", lease_token: null, lease_acquired_at: null, updated_at: new Date().toISOString() }).in("id", suppressed.map((row) => row.id)).eq("lease_token", lease);
  rows = rows.filter((row) => allowedIds.has(row.contact_id));
  if (!rows.length) return { accepted: 0, failed: 0 };
  const apiKey = env("RESEND_API_KEY");
  const { data: sender } = await db.from("email_senders").select("domain_status,active").eq("id", campaign.sender_id).single();
  const { data: version } = await db.from("email_template_versions").select("subject,preheader,body_text,cta_label,cta_url,image_url,variables").eq("id", campaign.template_version_id).single();
  if (!apiKey || !sender?.active || sender.domain_status !== "verified" || !version) {
    await db.from("email_campaign_recipients").update({ status: "failed", lease_token: null, last_error: !apiKey ? "email_not_configured" : "sender_not_verified", updated_at: new Date().toISOString() }).eq("lease_token", lease);
    return { accepted: 0, failed: rows.length };
  }
  const messages = rows.map((row) => {
    const values = { ...(campaign.frozen_values as Record<string, unknown> ?? {}), ...row.personalization, email: row.recipient_email };
    const unsubscribeUrl = campaign.purpose === "marketing" ? `${resolveAppUrl()}/email/unsubscribe?type=marketing&token=${encodeURIComponent(row.id)}` : undefined;
    const oneClickUrl = campaign.purpose === "marketing" ? `${env("SUPABASE_URL")}/functions/v1/corelia-api?op=email.unsubscribe&token=${encodeURIComponent(row.id)}` : undefined;
    const rendered = renderEmailDocument({ subject: version.subject, preheader: version.preheader, bodyText: version.body_text, ctaLabel: version.cta_label, ctaUrl: version.cta_url, imageUrl: version.image_url, purpose: String(campaign.purpose), locale: String(values.locale ?? "vi"), values, unsubscribeUrl });
    return { from: String(campaign.frozen_from), reply_to: String(campaign.frozen_reply_to), to: [row.recipient_email], subject: rendered.subject, html: rendered.html, headers: oneClickUrl ? { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined };
  });
  const batchKey = rows[0]!.dispatch_batch_key;
  if (!batchKey || rows.some((row) => row.dispatch_batch_key !== batchKey)) throw new Error("mixed_campaign_dispatch_batch");
  const idempotencyKey = `campaign/${campaign.id}/${batchKey}`.slice(0, 256);
  const { data: marked, error: markError } = await db.rpc("email_mark_campaign_batch_dispatched", { p_batch_key: batchKey, p_lease_token: lease });
  if (markError || Number(marked) !== rows.length) {
    await db.from("email_campaign_recipients").update({ status: "queued", lease_token: null, lease_acquired_at: null, last_error: "dispatch_fence_failed", updated_at: new Date().toISOString() }).eq("lease_token", lease).is("first_dispatched_at", null);
    throw markError ?? new Error("campaign_batch_dispatch_fence_failed");
  }
  try {
    const response = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(messages) });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const delayMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(60 * 60_000, 30_000 * (2 ** Math.min(rows[0]!.attempts, 6)) + Math.random() * 10_000);
      const status = retryable ? "queued" : response.status === 401 || response.status === 403 ? "indeterminate" : "failed";
      await db.from("email_campaign_recipients").update({ status, lease_token: null, lease_acquired_at: null, next_attempt_at: new Date(Date.now() + delayMs).toISOString(), last_error: `resend_http_${response.status}`, updated_at: new Date().toISOString() }).eq("lease_token", lease);
      return { accepted: 0, failed: retryable ? 0 : rows.length };
    }
    const payload = await response.json().catch(() => ({ data: [] })) as { data?: Array<{ id?: string }> };
    const results = rows.map((row, index) => ({ id: row.id, provider_message_id: payload.data?.[index]?.id ?? null }));
    const { data: committed, error: commitError } = await db.rpc("email_commit_campaign_batch", { p_batch_key: batchKey, p_lease_token: lease, p_results: results });
    if (commitError || Number(committed) !== rows.length) throw commitError ?? new Error("campaign_batch_commit_incomplete");
    return { accepted: rows.length, failed: 0 };
  } catch (error) {
    await db.from("email_campaign_recipients").update({ status: "indeterminate", lease_token: null, lease_acquired_at: null, last_error: error instanceof Error ? error.message : "network_error", next_attempt_at: new Date(Date.now() + 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("lease_token", lease);
    return { accepted: 0, failed: 0 };
  }
}

async function automationStillEligible(db: SupabaseClient, automation: Record<string, unknown>, enrollment: Record<string, unknown>, contact: Record<string, unknown>): Promise<boolean> {
  const userId = String(contact.user_id ?? "");
  const context = (enrollment.context ?? {}) as Record<string, unknown>;
  if (userId && (automation.object_type === "course" || automation.object_type === "program")) {
    const { data: preference } = await db.from("notification_preferences").select("email_course_blast,email_track_blast").eq("user_id", userId).maybeSingle();
    if (automation.object_type === "course" && preference?.email_course_blast === false) return false;
    if (automation.object_type === "program" && preference?.email_track_blast === false) return false;
  }
  if (automation.trigger_type === "account_verified") {
    if (!userId) return false;
    const { data } = await db.auth.admin.getUserById(userId);
    return Boolean(data.user?.email_confirmed_at && !data.user?.banned_until);
  }
  if (automation.trigger_type === "course_enrolled" || automation.trigger_type === "learning_inactive" || automation.trigger_type === "course_completed") {
    const courseId = String(automation.object_id ?? context.course_id ?? "");
    if (!userId || !courseId) return false;
    const { data: enrollmentRow } = await db.from("enrollments").select("completed_at").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
    if (!enrollmentRow) return false;
    if (automation.trigger_type === "course_completed") return Boolean(enrollmentRow.completed_at);
    if (Number(enrollment.current_position ?? 0) > 0) {
      const { count } = await db.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("course_id", courseId);
      if ((count ?? 0) > 0) return false;
    }
  }
  if (automation.trigger_type === "object_registration_approved" && automation.object_type === "hackathon") {
    if (!userId || !automation.object_id) return false;
    const { data } = await db.from("hackathon_registrations").select("id").eq("user_id", userId).eq("hackathon_id", automation.object_id).eq("document->>status", "approved").maybeSingle();
    return Boolean(data);
  }
  return true;
}

async function processAutomations(db: SupabaseClient, limit = 20): Promise<number> {
  const { data: enrollments } = await db.from("email_automation_enrollments")
    .select("*,email_automations!inner(id,name,purpose,trigger_type,object_type,object_id,enabled),email_contacts!inner(user_id,email,full_name,locale,global_suppressed_at,email_contact_consents(topic,status))")
    .eq("status", "active").lte("next_step_at", new Date().toISOString()).eq("email_automations.enabled", true).order("next_step_at").limit(limit);
  let processed = 0;
  for (const enrollment of enrollments ?? []) {
    const automation = enrollment.email_automations as { id: string; purpose: string };
    const contact = enrollment.email_contacts as { email: string; full_name?: string; locale?: string; global_suppressed_at?: string | null; email_contact_consents?: Array<{ topic: string; status: string }> };
    const marketingAllowed = automation.purpose !== "marketing" || contact.email_contact_consents?.some((consent) => consent.topic === "marketing" && consent.status === "subscribed");
    if (contact.global_suppressed_at || !marketingAllowed) {
      await db.from("email_automation_enrollments").update({ status: "stopped", updated_at: new Date().toISOString() }).eq("id", enrollment.id);
      continue;
    }
    if (!await automationStillEligible(db, automation as unknown as Record<string, unknown>, enrollment as Record<string, unknown>, contact as unknown as Record<string, unknown>)) {
      await db.from("email_automation_enrollments").update({ status: "stopped", updated_at: new Date().toISOString() }).eq("id", enrollment.id);
      continue;
    }
    const { data: step } = await db.from("email_automation_steps").select("*,email_template_versions(*),email_senders(*)").eq("automation_id", automation.id).eq("position", enrollment.current_position).maybeSingle();
    if (!step) {
      await db.from("email_automation_enrollments").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", enrollment.id);
      continue;
    }
    const version = step.email_template_versions as Record<string, unknown>;
    const sender = step.email_senders as Record<string, unknown>;
    if (!sender.active || sender.domain_status !== "verified") continue;
    const values = { ...(enrollment.context as Record<string, unknown>), name: contact.full_name ?? "", email: contact.email };
    const unsubscribeUrl = automation.purpose === "marketing" ? `${resolveAppUrl()}/email/unsubscribe?type=marketing&token=${encodeURIComponent(enrollment.id)}` : undefined;
    const rendered = renderEmailDocument({ subject: String(version.subject), preheader: String(version.preheader ?? ""), bodyText: String(version.body_text), ctaLabel: version.cta_label ? String(version.cta_label) : null, ctaUrl: version.cta_url ? String(version.cta_url) : null, imageUrl: version.image_url ? String(version.image_url) : null, purpose: automation.purpose, locale: contact.locale, values, unsubscribeUrl });
    const key = `automation/${enrollment.id}/${step.id}`;
    const from = `${String(sender.display_name)} <${String(sender.from_email)}>`;
    const claim = await claimOutboxLease({ db, idempotencyKey: key, eventType: "email_automation", recipientEmail: contact.email, buildSnapshot: () => ({ from, to: [contact.email], subject: rendered.subject, html: rendered.html, idempotency_key: key }) });
    if (claim.type === "already_accepted") {
      await db.from("email_automation_enrollments").update({ current_position: enrollment.current_position + 1, next_step_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", enrollment.id);
      continue;
    }
    if (claim.type !== "claimed") continue;
    if (!isTransactionalEmailConfigured(from)) {
      await releaseOutboxUnconfigured({ db, idempotencyKey: key, leaseToken: claim.leaseToken });
      continue;
    }
    await reserveProviderSlot(db);
    const dispatch = await persistOutboxDispatch({ db, idempotencyKey: key, leaseToken: claim.leaseToken, existingFirstDispatchedAt: claim.event.first_dispatched_at });
    if (!dispatch.ok) continue;
    const oneClickUrl = automation.purpose === "marketing" ? `${env("SUPABASE_URL")}/functions/v1/corelia-api?op=email.unsubscribe&token=${encodeURIComponent(enrollment.id)}` : undefined;
    const result = await sendTransactionalEmailViaResend({ db, mailType: `automation:${automation.id}`, to: [contact.email], subject: rendered.subject, html: rendered.html, from, replyTo: String(sender.reply_to), headers: oneClickUrl ? { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined, idempotencyKey: key });
    if (result.sent) {
      await commitOutboxSuccess({ db, idempotencyKey: key, leaseToken: claim.leaseToken, providerMessageId: result.providerMessageId });
      const nextPosition = enrollment.current_position + 1;
      const { data: nextStep } = await db.from("email_automation_steps").select("delay_minutes").eq("automation_id", automation.id).eq("position", nextPosition).maybeSingle();
      await db.from("email_automation_enrollments").update({ current_position: nextPosition, status: nextStep ? "active" : "completed", next_step_at: nextStep ? new Date(Date.now() + Number(nextStep.delay_minutes) * 60_000).toISOString() : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", enrollment.id);
      processed += 1;
    } else if ("providerError" in result) {
      await commitOutboxFailure({ db, idempotencyKey: key, leaseToken: claim.leaseToken, isPermanent: !result.isRetryable && !result.isConfigError, isConfigError: result.isConfigError, existingFirstDispatchedAt: claim.event.first_dispatched_at });
    }
  }
  return processed;
}

export async function runEmailWorker(req: Request, db: SupabaseClient): Promise<Response> {
  const expected = env("EMAIL_WORKER_SECRET");
  const supplied = req.headers.get("x-corelia-email-worker-secret")?.trim() ?? "";
  if (!expected || supplied !== expected) return json({ message: "unauthorized" }, 401);
  let importRows = 0;
  for (let index = 0; index < 4; index += 1) {
    const chunk = await processNextImportChunk(db);
    importRows += chunk.processed;
    if (!chunk.processed) break;
  }
  const { data: settings } = await db.from("email_settings").select("*").eq("singleton", true).single();
  if (!settings?.sending_enabled) return json({ ok: true, skipped: true, reason: "sending_disabled", import_rows: importRows });
  const due = new Date().toISOString();
  const { data: priorityCampaigns, error } = await db.from("email_campaigns").select("*").in("status", ["scheduled", "running"]).in("purpose", ["system", "learning"]).lte("scheduled_at", due).order("created_at").limit(5);
  if (error) throw error;
  let campaigns = priorityCampaigns ?? [];
  if (campaigns.length < 5) {
    const { data: bulkCampaigns, error: bulkError } = await db.from("email_campaigns").select("*").in("status", ["scheduled", "running"]).in("purpose", ["event", "marketing"]).lte("scheduled_at", due).order("created_at").limit(5 - campaigns.length);
    if (bulkError) throw bulkError;
    campaigns = [...campaigns, ...(bulkCampaigns ?? [])];
  }
  let accepted = 0, failed = 0;
  for (const campaign of campaigns ?? []) {
    await db.from("email_campaigns").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", campaign.id).neq("status", "paused");
    await reserveProviderSlot(db);
    const { rows, lease } = await claimRecipients(db, campaign.id, Math.min(100, Number(settings.worker_batch_size ?? 100)));
    if (!rows.length) {
      const { count } = await db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).in("status", ["queued", "sending", "indeterminate"]);
      if (!count) await db.from("email_campaigns").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", campaign.id).eq("status", "running");
      continue;
    }
    const result = await dispatchBatch(db, campaign, rows, lease);
    accepted += result.accepted; failed += result.failed;
    await db.rpc("email_refresh_campaign_counts", { p_campaign_id: campaign.id });
    await db.rpc("email_apply_campaign_guardrails", { p_campaign_id: campaign.id });
  }
  const automationSteps = await processAutomations(db);
  return json({ ok: true, campaigns: campaigns?.length ?? 0, accepted, failed, automation_steps: automationSteps, import_rows: importRows });
}

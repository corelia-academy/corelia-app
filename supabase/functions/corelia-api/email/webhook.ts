import { json } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i]! ^ b[i]!;
  return result === 0;
}

async function verifySvix(raw: string, id: string, timestamp: string, signatures: string, secret: string): Promise<boolean> {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const keyValue = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey("raw", decodeBase64(keyValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)));
  return signatures.split(" ").some((item) => {
    const value = item.startsWith("v1,") ? item.slice(3) : "";
    if (!value) return false;
    try { return constantTimeEqual(expected, decodeBase64(value)); } catch { return false; }
  });
}

export async function handleResendWebhook(req: Request, db: SupabaseClient): Promise<Response> {
  const raw = await req.text();
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";
  const secret = Deno.env.get("RESEND_WEBHOOK_SIGNING_SECRET")?.trim() ?? "";
  if (!secret || !await verifySvix(raw, id, timestamp, signature, secret)) return json({ message: "invalid_signature" }, 401);
  const event = JSON.parse(raw) as { type?: string; created_at?: string; data?: { email_id?: string } };
  const messageId = event.data?.email_id ?? null;
  const { error } = await db.from("email_webhook_events").insert({ id, event_type: String(event.type ?? "unknown"), provider_message_id: messageId, payload: event, occurred_at: event.created_at ?? new Date().toISOString() });
  if (error?.code === "23505") return json({ ok: true, duplicate: true });
  if (error) throw error;
  const state: Record<string, string> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed" };
  const next = state[String(event.type ?? "")];
  if (messageId && next) {
    const { data: recipient } = await db.from("email_campaign_recipients").select("id,contact_id,campaign_id,status").eq("provider_message_id", messageId).maybeSingle();
    if (recipient) {
      const allowed = next === "delivered"
        ? ["accepted", "sending"]
        : next === "failed"
          ? ["queued", "sending", "accepted"]
          : ["queued", "sending", "accepted", "delivered", "failed"];
      if (allowed.includes(recipient.status)) await db.from("email_campaign_recipients").update({ status: next, updated_at: new Date().toISOString() }).eq("id", recipient.id).in("status", allowed);
      if (next === "bounced" || next === "complained") await db.from("email_contacts").update({ global_suppressed_at: new Date().toISOString(), suppression_reason: next, updated_at: new Date().toISOString() }).eq("id", recipient.contact_id);
      await db.rpc("email_refresh_campaign_counts", { p_campaign_id: recipient.campaign_id });
      await db.rpc("email_apply_campaign_guardrails", { p_campaign_id: recipient.campaign_id });
    } else if (next === "bounced" || next === "complained") {
      const { data: outbox } = await db.from("email_outbox_events").select("recipient_email").eq("provider_message_id", messageId).maybeSingle();
      if (outbox?.recipient_email) await db.from("email_contacts").update({ global_suppressed_at: new Date().toISOString(), suppression_reason: next, updated_at: new Date().toISOString() }).eq("email", String(outbox.recipient_email).toLowerCase());
    }
  }
  await db.from("email_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", id);
  return json({ ok: true });
}

/**
 * Shared transactional email via Resend.
 * Feature handlers build subject/html; this module only sends (or skips if unset).
 */

const RESEND_SEND_URL = "https://api.resend.com/emails";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

const RESEND_BATCH_CHUNK = 100;

export type TransactionalMailResult =
  | { sent: true }
  | { sent: false; skipped: true; reason: "email_not_configured" }
  | { sent: false; providerError: true; httpStatus: number; body: string };

/**
 * Send one transactional message. If Resend is not configured, returns skip (no throw).
 * On HTTP error from Resend, returns providerError for the caller to map to 5xx.
 */
export async function sendTransactionalEmailViaResend(params: {
  to: string[];
  subject: string;
  html: string;
}): Promise<TransactionalMailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const mailFrom = Deno.env.get("MAIL_FROM")?.trim() ?? "";
  if (!apiKey || !mailFrom) {
    console.warn("[corelia-api] transactional email skipped (set RESEND_API_KEY and MAIL_FROM)");
    return { sent: false, skipped: true, reason: "email_not_configured" };
  }

  const res = await fetch(RESEND_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[corelia-api] Resend HTTP error", res.status, body);
    return { sent: false, providerError: true, httpStatus: res.status, body };
  }

  return { sent: true };
}

export type BatchMailResult = {
  sent: number;
  failed: number;
  skipped: boolean;
};

/**
 * Send a bulk blast to a list of unique recipient addresses.
 * Uses Resend's /emails/batch endpoint (up to 100 per request).
 * Each recipient gets a separate email object so Resend tracks per-address.
 */
export async function sendBatchEmailsViaResend(params: {
  to_list: string[];
  subject: string;
  html: string;
}): Promise<BatchMailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const mailFrom = Deno.env.get("MAIL_FROM")?.trim() ?? "";
  if (!apiKey || !mailFrom) {
    console.warn("[corelia-api] batch email skipped (set RESEND_API_KEY and MAIL_FROM)");
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < params.to_list.length; i += RESEND_BATCH_CHUNK) {
    const chunk = params.to_list.slice(i, i + RESEND_BATCH_CHUNK);
    const batch = chunk.map((to) => ({
      from: mailFrom,
      to: [to],
      subject: params.subject,
      html: params.html,
    }));

    try {
      const res = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[corelia-api] Resend batch chunk error", res.status, body);
        failed += chunk.length;
      } else {
        const data = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
        const successCount = Array.isArray(data?.data) ? data.data.length : chunk.length;
        sent += successCount;
        failed += chunk.length - successCount;
      }
    } catch (err) {
      console.error("[corelia-api] Resend batch chunk exception", err);
      failed += chunk.length;
    }
  }

  return { sent, failed, skipped: false };
}

/**
 * Shared transactional email via Resend.
 * Feature handlers build subject/html; this module only sends (or skips if unset).
 */

const RESEND_SEND_URL = "https://api.resend.com/emails";

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

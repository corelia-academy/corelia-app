/**
 * Shared transactional email via Resend.
 * Feature handlers build subject/html; this module only sends (or skips if unset).
 */
import type { SupabaseClient } from "../supabase.ts";

function getResendSendUrl(): string {
  return (
    (typeof Deno !== "undefined" ? Deno.env.get("RESEND_SEND_URL") : (typeof process !== "undefined" ? process.env.RESEND_SEND_URL : undefined))?.trim() ||
    "https://api.resend.com/emails"
  );
}

function getResendBatchUrl(): string {
  return (
    (typeof Deno !== "undefined" ? Deno.env.get("RESEND_BATCH_URL") : (typeof process !== "undefined" ? process.env.RESEND_BATCH_URL : undefined))?.trim() ||
    "https://api.resend.com/emails/batch"
  );
}

const RESEND_BATCH_CHUNK = 100;

export type TransactionalMailResult =
  | { sent: true; providerMessageId: string | null }
  | { sent: false; skipped: true; reason: "email_not_configured" }
  | {
      sent: false;
      providerError: true;
      httpStatus: number;
      body: string;
      errorName?: string;
      isRetryable: boolean;
      isConfigError?: boolean;
    };

type MailAttemptStatus = "accepted" | "provider_error" | "skipped";

async function recordMailAttempts(params: {
  db: SupabaseClient;
  mailType: string;
  recipients: string[];
  status: MailAttemptStatus;
  httpStatus?: number;
  providerMessageIds?: Array<string | null>;
}): Promise<void> {
  if (!params.recipients.length) return;

  try {
    const { error } = await params.db.from("email_delivery_attempts").insert(
      params.recipients.map((recipientEmail, index) => ({
        mail_type: params.mailType,
        recipient_email: recipientEmail,
        provider: "resend",
        provider_message_id: params.providerMessageIds?.[index] ?? null,
        provider_status: params.status,
        provider_http_status: params.httpStatus ?? null,
      })),
    );
    if (error) {
      // Observability must never turn a completed send into a user-facing failure.
      console.error("[corelia-api] email delivery audit write failed", error);
    }
  } catch (err) {
    console.error("[corelia-api] email delivery audit exception", err);
  }
}

function messageIdFromResponse(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("id" in data)) return null;
  const id = (data as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function isTransactionalEmailConfigured(from?: string): boolean {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const mailFrom = from?.trim() || Deno.env.get("MAIL_FROM")?.trim() || "";
  return Boolean(apiKey && mailFrom);
}

/**
 * Send one transactional message. If Resend is not configured, returns skip (no throw).
 * On HTTP error from Resend, returns providerError for the caller to map to 5xx.
 *
 * If `from` is specified in params (e.g. from frozen outbox snapshot), it is used verbatim.
 */
export async function sendTransactionalEmailViaResend(params: {
  db: SupabaseClient;
  mailType: string;
  to: string[];
  subject: string;
  html: string;
  from?: string;
  idempotencyKey?: string;
}): Promise<TransactionalMailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const mailFrom = params.from?.trim() || Deno.env.get("MAIL_FROM")?.trim() || "";
  if (!isTransactionalEmailConfigured(params.from)) {
    console.warn("[corelia-api] transactional email skipped (set RESEND_API_KEY and MAIL_FROM)");
    await recordMailAttempts({
      db: params.db,
      mailType: params.mailType,
      recipients: params.to,
      status: "skipped",
    });
    return { sent: false, skipped: true, reason: "email_not_configured" };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (params.idempotencyKey?.trim()) {
      headers["Idempotency-Key"] = params.idempotencyKey.trim();
    }

    const res = await fetch(getResendSendUrl(), {
      method: "POST",
      headers,
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

      let errorName: string | undefined;
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed.name === "string") {
          errorName = parsed.name;
        }
      } catch {
        // non-json body
      }

      // 401 Unauthorized / 403 Forbidden: API key, permissions, or unverified domain.
      // 409 concurrent_idempotent_requests is retryable (concurrent in-flight call at Resend).
      // 409 invalid_idempotent_request is permanent (payload mismatch).
      // 422 is permanent (invalid parameters / malformed payload).
      // 429 is retryable. 5xx is retryable.
      const isConfigError = res.status === 401 || res.status === 403;
      const isRetryable =
        res.status >= 500 ||
        res.status === 429 ||
        (res.status === 409 && errorName === "concurrent_idempotent_requests");

      await recordMailAttempts({
        db: params.db,
        mailType: params.mailType,
        recipients: params.to,
        status: "provider_error",
        httpStatus: res.status,
      });
      return {
        sent: false,
        providerError: true,
        httpStatus: res.status,
        body,
        errorName,
        isRetryable,
        isConfigError,
      };
    }

    const data = await res.json().catch(() => null);
    const providerMessageId = messageIdFromResponse(data);
    await recordMailAttempts({
      db: params.db,
      mailType: params.mailType,
      recipients: params.to,
      status: "accepted",
      httpStatus: res.status,
      providerMessageIds: params.to.map(() => providerMessageId),
    });
    return { sent: true, providerMessageId };
  } catch (err) {
    console.error("[corelia-api] Resend request exception", err);
    await recordMailAttempts({
      db: params.db,
      mailType: params.mailType,
      recipients: params.to,
      status: "provider_error",
    });
    return {
      sent: false,
      providerError: true,
      httpStatus: 0,
      body: "network_error",
      isRetryable: true,
    };
  }
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
  db: SupabaseClient;
  mailType: string;
  to_list: string[];
  subject: string;
  html: string;
}): Promise<BatchMailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const mailFrom = Deno.env.get("MAIL_FROM")?.trim() ?? "";
  if (!apiKey || !mailFrom) {
    console.warn("[corelia-api] batch email skipped (set RESEND_API_KEY and MAIL_FROM)");
    await recordMailAttempts({
      db: params.db,
      mailType: params.mailType,
      recipients: params.to_list,
      status: "skipped",
    });
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
      const res = await fetch(getResendBatchUrl(), {
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
        await recordMailAttempts({
          db: params.db,
          mailType: params.mailType,
          recipients: chunk,
          status: "provider_error",
          httpStatus: res.status,
        });
      } else {
        const data = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
        const successCount = Math.min(
          chunk.length,
          Array.isArray(data?.data) ? data.data.length : chunk.length,
        );
        sent += successCount;
        failed += chunk.length - successCount;
        await recordMailAttempts({
          db: params.db,
          mailType: params.mailType,
          recipients: chunk.slice(0, successCount),
          status: "accepted",
          httpStatus: res.status,
          providerMessageIds: Array.isArray(data?.data)
            ? data.data.slice(0, successCount).map(messageIdFromResponse)
            : chunk.slice(0, successCount).map(() => null),
        });
        if (successCount < chunk.length) {
          await recordMailAttempts({
            db: params.db,
            mailType: params.mailType,
            recipients: chunk.slice(successCount),
            status: "provider_error",
            httpStatus: res.status,
          });
        }
      }
    } catch (err) {
      console.error("[corelia-api] Resend batch chunk exception", err);
      failed += chunk.length;
      await recordMailAttempts({
        db: params.db,
        mailType: params.mailType,
        recipients: chunk,
        status: "provider_error",
      });
    }
  }

  return { sent, failed, skipped: false };
}

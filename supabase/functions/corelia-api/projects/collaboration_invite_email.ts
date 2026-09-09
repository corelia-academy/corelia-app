import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { buildProjectCollaborationInviteEmail } from "../lib/mail/project_collaboration_invite_body.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { claimOutboxLease, commitOutboxSuccess, commitOutboxFailure, releaseOutboxUnconfigured, persistOutboxDispatch } from "../lib/mail/outbox.ts";
import { sendTransactionalEmailViaResend, isTransactionalEmailConfigured } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

/**
 * Send the project collaboration invite email after the inviter has already created
 * the invite row via RPC `create_project_collaboration_invite`.
 *
 * Body: { invite_id: uuid, token: string }
 *
 * The plaintext token only exists in memory at the moment the RPC returns;
 * the caller passes it back here so we can embed it in the email deeplink.
 * We re-verify on the server that:
 *   - the caller is the inviter on the invite row (or admin/support),
 *   - the invite is still pending and not expired.
 */
async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleProjectCollaborationInviteEmail(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const sender = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const inviteId = String(body.invite_id ?? "").trim();
    const token = String(body.token ?? "").trim();
    if (!inviteId) {
      return json({ message: "missing_fields:invite_id" }, 400);
    }

    const { data: invite, error: invErr } = await db
      .from("project_collaboration_invites")
      .select("id, project_id, invitee_user_id, invited_by, status, expires_at, token_hash, notification_id, created_at")
      .eq("id", inviteId)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!invite) return json({ message: "invite_not_found" }, 404);

    if (invite.invited_by !== sender.id) {
      const { data: prof } = await db
        .from("profiles")
        .select("role")
        .eq("id", sender.id)
        .maybeSingle();
      const role = String(prof?.role ?? "");
      if (role !== "admin" && role !== "support_staff") {
        return json({ message: "forbidden" }, 403);
      }
    }

    if (invite.status !== "pending") {
      return json({ message: "invite_not_pending" }, 409);
    }
    if (new Date(String(invite.expires_at)).getTime() <= Date.now()) {
      return json({ message: "invite_expired" }, 409);
    }

    const inviteIdempotencyKey = inviteId;
    // V-01a: Fail-closed on outbox query error before modifying any state
    const { data: existingOutboxRows, error: outboxQueryErr } = await db
      .from("email_outbox_events")
      .select("id, status, request_payload, recipient_email")
      .eq("idempotency_key", inviteIdempotencyKey)
      .limit(1);

    if (outboxQueryErr) {
      console.error("[collaboration_invite_email] failed to query outbox (fail-closed):", outboxQueryErr);
      return json({ message: "internal_error" }, 500);
    }
    const existingRow = Array.isArray(existingOutboxRows) && existingOutboxRows.length > 0 ? existingOutboxRows[0] : null;

    if (!existingRow && !token) {
      // H1 HOLD: Historical invite without prepared outbox event and without client token cannot be dispatched
      return json({ message: "missing_fields:token" }, 400);
    }

    const existingPayload = existingRow?.request_payload as Record<string, unknown> | undefined;
    const isCompletedSnapshot = Boolean(
      existingRow &&
      typeof existingPayload?.html === "string" &&
      existingPayload?.prepared !== true
    );

    // Resolve active token from client or prepared outbox payload
    let activeToken = token;
    if (!activeToken && existingRow) {
      if (typeof existingPayload?.token === "string" && existingPayload.token.trim()) {
        activeToken = existingPayload.token.trim();
      } else if (
        typeof existingPayload?.metadata === "object" &&
        existingPayload.metadata !== null &&
        typeof (existingPayload.metadata as Record<string, unknown>).invite_token === "string"
      ) {
        activeToken = String((existingPayload.metadata as Record<string, unknown>).invite_token).trim();
      }
    }

    if (!isCompletedSnapshot) {
      if (!activeToken) {
        return json({ message: "missing_fields:token" }, 400);
      }

      if (activeToken.length < 32) {
        return json({ message: "invalid_input:token" }, 400);
      }

      const calculatedHash = await sha256Hex(activeToken);
      if (invite.token_hash && calculatedHash !== invite.token_hash) {
        return json({ message: "invalid_input:token_mismatch" }, 400);
      }
    }

    let notifId = (invite as { notification_id?: string | null }).notification_id ?? undefined;
    let notifPayload: Record<string, unknown> = {};

    if (!notifId) {
      const { data: notif } = await db
        .from("user_notifications")
        .select("id, payload")
        .eq("type", "project_collaboration_invite")
        .contains("payload", { invite_id: inviteId })
        .maybeSingle();
      if (notif) {
        notifId = notif.id;
        notifPayload = (notif.payload ?? {}) as Record<string, unknown>;
        await db
          .from("project_collaboration_invites")
          .update({ notification_id: notifId })
          .eq("id", inviteId)
          .is("notification_id", null);
      }
    }

    // Atomic claim on project_collaboration_invites for orphan invites:
    // Guarantees only one concurrent worker wins the right to link the notification row
    if (!notifId) {
      const candidateNotifId = crypto.randomUUID();
      const { data: newNotif, error: insErr } = await db
        .from("user_notifications")
        .insert({
          id: candidateNotifId,
          user_id: invite.invitee_user_id,
          type: "project_collaboration_invite",
          payload: {
            invite_id: inviteId,
            project_id: invite.project_id,
            invited_by: invite.invited_by,
          },
        })
        .select("id, payload")
        .maybeSingle();

      if (insErr || !newNotif) {
        console.error("[corelia-api] failed to create notification for orphan invite:", insErr);
        return json({ message: "internal_error" }, 500);
      }

      const { data: claimRows } = await db
        .from("project_collaboration_invites")
        .update({ notification_id: candidateNotifId })
        .eq("id", inviteId)
        .is("notification_id", null)
        .select("notification_id");

      const wonClaim = Array.isArray(claimRows) && claimRows.length > 0 && claimRows[0]?.notification_id === candidateNotifId;
      if (wonClaim) {
        notifId = candidateNotifId;
        notifPayload = (newNotif.payload ?? {}) as Record<string, unknown>;
      } else {
        // Redundant concurrent insert lost the claim race -> remove duplicate notification row
        await db
          .from("user_notifications")
          .delete()
          .eq("id", candidateNotifId);

        const { data: recheckInvite } = await db
          .from("project_collaboration_invites")
          .select("notification_id")
          .eq("id", inviteId)
          .maybeSingle();

        notifId = (recheckInvite as { notification_id?: string | null })?.notification_id ?? undefined;
        if (!notifId) {
          return json({ message: "internal_error" }, 500);
        }
        const { data: existingNotif } = await db
          .from("user_notifications")
          .select("id, payload")
          .eq("id", notifId)
          .maybeSingle();
        notifPayload = (existingNotif?.payload ?? {}) as Record<string, unknown>;
      }
    } else if (Object.keys(notifPayload).length === 0) {
      const { data: notif } = await db
        .from("user_notifications")
        .select("id, payload")
        .eq("id", notifId)
        .maybeSingle();
      if (notif) {
        notifPayload = (notif.payload ?? {}) as Record<string, unknown>;
      }
    }

    const scopedMailType = `project_collaboration_invite:${inviteIdempotencyKey}`;

    const [{ data: invitee }, { data: inviter }, { data: project }] = await Promise.all([
      db
        .from("profiles")
        .select("email, full_name, locale")
        .eq("id", invite.invitee_user_id)
        .maybeSingle(),
      db
        .from("profiles")
        .select("full_name")
        .eq("id", invite.invited_by)
        .maybeSingle(),
      db
        .from("projects")
        .select("title, slug")
        .eq("id", invite.project_id)
        .maybeSingle(),
    ]);

    let recipientEmail = invitee?.email?.trim() ?? "";
    let locale = (invitee?.locale ?? "").toString();

    if (!recipientEmail) {
      const { data: authData } = await db.auth.admin.getUserById(invite.invitee_user_id);
      recipientEmail = authData?.user?.email?.trim() ?? "";
      if (!locale) {
        const userMeta = authData?.user?.user_metadata;
        if (
          userMeta &&
          typeof userMeta === "object" &&
          "locale" in userMeta &&
          typeof (userMeta as { locale?: unknown }).locale === "string"
        ) {
          locale = (userMeta as { locale: string }).locale;
        }
      }
    }

    if (!recipientEmail) {
      if (notifId) {
        await db
          .from("user_notifications")
          .update({
            payload: {
              ...notifPayload,
              invite_id: inviteId,
              email_sent: false,
              email_sending: false,
              email_skip_reason: "no_recipient_email",
            },
          })
          .eq("id", notifId);
      }
      return json({ ok: true, email_sent: false, reason: "no_recipient_email" }, 200);
    }

    // -------------------------------------------------------------------------
    // V-01, V-02, V-03: Authoritative Outbox Lease & Request Snapshot
    // -------------------------------------------------------------------------
    const mailFrom = Deno.env.get("MAIL_FROM")?.trim() || "Corelia <noreply@corelia.academy>";
    const projectTitle = (project?.title ?? "").trim();
    const inviterName = (inviter?.full_name ?? "").trim();
    const inviteUrl = activeToken ? `${resolveAppUrl()}/invites/project/${encodeURIComponent(activeToken)}` : "";

    const claimRes = await claimOutboxLease({
      db,
      idempotencyKey: inviteIdempotencyKey,
      eventType: "project_collaboration_invite",
      recipientEmail,
      buildSnapshot: () => {
        const { subject, html } = buildProjectCollaborationInviteEmail({
          projectTitle,
          inviterName,
          inviteUrl,
          expiresAt: new Date(String(invite.expires_at)),
          locale,
          fingerprint: inviteIdempotencyKey,
        });
        return {
          from: mailFrom,
          to: [recipientEmail],
          subject,
          html,
          idempotency_key: inviteIdempotencyKey,
        };
      },
    });

    if (claimRes.type === "already_accepted") {
      if (notifId && notifPayload.email_sent !== true) {
        // Reconcile downstream notification display payload:
        await db.from("user_notifications").update({
          payload: {
            ...notifPayload,
            invite_id: inviteId,
            email_sent: true,
            email_sending: false,
            email_sent_at: claimRes.event.updated_at,
          },
        }).eq("id", notifId);
      }
      return json({ ok: true, email_sent: false, idempotent_replay: true }, 200);
    }

    if (claimRes.type === "rate_limited" || claimRes.type === "lease_locked") {
      return json({ message: "rate_limited:try_again_later" }, 429);
    }

    if (claimRes.type === "failed_permanent") {
      return json({ message: "email_delivery_rejected" }, 422);
    }

    if (claimRes.type === "indeterminate_outside_window") {
      return json({ message: "indeterminate_delivery_requires_reconciliation" }, 409);
    }

    if (claimRes.type === "db_error") {
      console.error("[collaboration_invite_email] Outbox DB failure:", claimRes.error);
      return json({ message: "internal_error:outbox_unavailable" }, 500);
    }

    // Acquired lease: evaluate request payload completeness
    let requestPayload = claimRes.event.request_payload as Record<string, unknown>;
    const isPreparedOnly = Boolean(
      (requestPayload as Record<string, unknown>)?.prepared === true ||
      typeof (requestPayload as Record<string, unknown>)?.html !== "string"
    );

    if (isPreparedOnly) {
      // Winner of the lease completes the full frozen snapshot from prepared token
      const completedUrl = `${resolveAppUrl()}/invites/project/${encodeURIComponent(activeToken)}`;
      const { subject, html } = buildProjectCollaborationInviteEmail({
        projectTitle,
        inviterName,
        inviteUrl: completedUrl,
        expiresAt: new Date(String(invite.expires_at)),
        locale,
        fingerprint: inviteIdempotencyKey,
      });

      const completedPayload = {
        from: mailFrom,
        to: [recipientEmail],
        subject,
        html,
        idempotency_key: inviteIdempotencyKey,
        metadata: {
          invite_token: activeToken,
        },
      };

      // Fenced update: commit full snapshot and recipient_email under lease
      const { data: updatedOutbox, error: updateOutboxErr } = await db
        .from("email_outbox_events")
        .update({
          request_payload: completedPayload,
          recipient_email: recipientEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("idempotency_key", inviteIdempotencyKey)
        .eq("lease_token", claimRes.leaseToken)
        .select("id");

      if (updateOutboxErr || !updatedOutbox || updatedOutbox.length === 0) {
        console.error("[collaboration_invite_email] failed to persist completed snapshot under lease:", updateOutboxErr);
        return json({ message: "internal_error" }, 500);
      }

      requestPayload = completedPayload;
    }

    // Check mail configuration BEFORE network call or recording dispatch
    const payloadFrom = typeof requestPayload.from === "string" ? requestPayload.from : undefined;
    if (!isTransactionalEmailConfigured(payloadFrom)) {
      await releaseOutboxUnconfigured({
        db,
        idempotencyKey: inviteIdempotencyKey,
        leaseToken: claimRes.leaseToken,
      });
      return json({ ok: true, email_sent: false, reason: "email_not_configured" }, 200);
    }

    // Persist dispatch attempt with fencing BEFORE provider network call (V-02a)
    const dispatchRes = await persistOutboxDispatch({
      db,
      idempotencyKey: inviteIdempotencyKey,
      leaseToken: claimRes.leaseToken,
      existingFirstDispatchedAt: claimRes.event.first_dispatched_at,
    });

    if (!dispatchRes.ok) {
      console.error("[collaboration_invite_email] dispatch fencing failed, aborting network call:", dispatchRes.error);
      if (dispatchRes.error === "dispatch_window_expired") {
        return json({ message: "indeterminate_delivery_requires_reconciliation" }, 409);
      }
      return json({ message: "dispatch_fencing_failed", error: dispatchRes.error }, 500);
    }

    const result = await sendTransactionalEmailViaResend({
      db,
      mailType: scopedMailType,
      to: Array.isArray(requestPayload.to) ? (requestPayload.to as string[]) : [recipientEmail],
      subject: String(requestPayload.subject ?? ""),
      html: String(requestPayload.html ?? ""),
      from: payloadFrom,
      idempotencyKey: typeof requestPayload.idempotency_key === "string" ? requestPayload.idempotency_key : inviteIdempotencyKey,
    });

    if ("sent" in result && result.sent) {
      const providerMsgId = "providerMessageId" in result && typeof result.providerMessageId === "string"
        ? result.providerMessageId
        : null;

      await commitOutboxSuccess({
        db,
        idempotencyKey: inviteIdempotencyKey,
        leaseToken: claimRes.leaseToken,
        providerMessageId: providerMsgId,
      });

      if (notifId) {
        await db
          .from("user_notifications")
          .update({
            payload: {
              ...notifPayload,
              invite_id: inviteId,
              email_sent: true,
              email_sending: false,
              email_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", notifId);
      }
      return json({ ok: true, email_sent: true }, 200);
    }

    // Provider error encountered
    const httpStatus = "httpStatus" in result && typeof result.httpStatus === "number" ? result.httpStatus : 500;
    const isConfigError = "isConfigError" in result ? Boolean(result.isConfigError) : (httpStatus === 401 || httpStatus === 403);
    const isRetryable = "isRetryable" in result ? Boolean(result.isRetryable) : (httpStatus >= 500 || httpStatus === 429);
    const isPermanent = !isRetryable && !isConfigError;

    await commitOutboxFailure({
      db,
      idempotencyKey: inviteIdempotencyKey,
      leaseToken: claimRes.leaseToken,
      isPermanent,
      isConfigError,
      existingFirstDispatchedAt: claimRes.event.first_dispatched_at,
    });

    if (notifId) {
      await db
        .from("user_notifications")
        .update({
          payload: {
            ...notifPayload,
            invite_id: inviteId,
            email_sending: false,
            email_last_attempt_at: new Date().toISOString(),
            ...(isPermanent ? { email_delivery_failed: true } : {}),
          },
        })
        .eq("id", notifId);
    }

    if (isConfigError) {
      return json(
        { message: "provider_config_error", status: httpStatus },
        503,
      );
    }

    return json(
      { message: isPermanent ? "provider_error_permanent" : "provider_error_retryable", status: httpStatus },
      isPermanent ? 422 : (httpStatus === 429 ? 429 : 502),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (isAuthFailure(msg)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] projects.collaborationInvite.sendEmail", e);
    return json({ message: "internal_error" }, 500);
  }
}

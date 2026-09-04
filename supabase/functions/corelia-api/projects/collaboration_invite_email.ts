import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { buildProjectCollaborationInviteEmail } from "../lib/mail/project_collaboration_invite_body.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
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
    if (!inviteId || !token) {
      return json({ message: "missing_fields:invite_id,token" }, 400);
    }
    if (token.length < 32) {
      return json({ message: "invalid_input:token" }, 400);
    }

    const { data: invite, error: invErr } = await db
      .from("project_collaboration_invites")
      .select("id, project_id, invitee_user_id, invited_by, status, expires_at, token_hash, notification_id")
      .eq("id", inviteId)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!invite) return json({ message: "invite_not_found" }, 404);

    const calculatedHash = await sha256Hex(token);
    if (invite.token_hash && calculatedHash !== invite.token_hash) {
      return json({ message: "invalid_input:token_mismatch" }, 400);
    }

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

    if (notifPayload.email_sent === true) {
      return json({ ok: true, email_sent: false, idempotent_replay: true }, 200);
    }

    const now = Date.now();
    const IN_FLIGHT_TIMEOUT_MS = 30_000;
    const COOLDOWN_MS = 60_000;

    if (notifPayload.email_sending === true) {
      const lockAt = typeof notifPayload.email_lock_at === "string"
        ? Date.parse(notifPayload.email_lock_at)
        : 0;
      if (!lockAt || now - lockAt < IN_FLIGHT_TIMEOUT_MS) {
        return json({ message: "rate_limited:try_again_later" }, 429);
      }
    }

    const lastAttemptAt = typeof notifPayload.email_last_attempt_at === "string"
      ? Date.parse(notifPayload.email_last_attempt_at)
      : 0;
    if (lastAttemptAt && now - lastAttemptAt < COOLDOWN_MS) {
      return json({ message: "rate_limited:try_again_later" }, 429);
    }

    // DB-level atomic compare-and-set lock:
    // Only transitions from not-sending (or expired stale lock) to sending in an atomic conditional update
    const nowIso = new Date().toISOString();
    const staleThresholdIso = new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS).toISOString();
    const { data: lockedRows, error: lockErr } = await db
      .from("user_notifications")
      .update({
        payload: {
          ...notifPayload,
          invite_id: inviteId,
          email_sending: true,
          email_lock_at: nowIso,
          email_last_attempt_at: nowIso,
        },
      })
      .eq("id", notifId)
      .or(`payload->>email_sending.is.null,payload->>email_sending.eq.false,payload->>email_lock_at.lt.${staleThresholdIso}`)
      .select("id");

    if (lockErr) {
      console.error("[corelia-api] failed to acquire email lock:", lockErr);
      return json({ message: "internal_error" }, 500);
    }

    if (!lockedRows || !Array.isArray(lockedRows) || lockedRows.length === 0) {
      // Another concurrent request acquired the lock in the same millisecond
      return json({ message: "rate_limited:try_again_later" }, 429);
    }

    const verifiedPayload = {
      ...notifPayload,
      invite_id: inviteId,
      email_sending: true,
      email_lock_at: nowIso,
      email_last_attempt_at: nowIso,
    };

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
      await db
        .from("user_notifications")
        .update({
          payload: {
            ...verifiedPayload,
            email_sending: false,
          },
        })
        .eq("id", notifId);
      return json({ ok: true, email_sent: false, reason: "no_recipient_email" }, 200);
    }

    const projectTitle = (project?.title ?? "").trim();
    const inviterName = (inviter?.full_name ?? "").trim();
    const inviteUrl = `${resolveAppUrl()}/invites/project/${encodeURIComponent(token)}`;

    const { subject, html } = buildProjectCollaborationInviteEmail({
      projectTitle,
      inviterName,
      inviteUrl,
      expiresAt: new Date(String(invite.expires_at)),
      locale,
    });

    const result = await sendTransactionalEmailViaResend({
      db,
      mailType: "project_collaboration_invite",
      to: [recipientEmail],
      subject,
      html,
    });

    if ("sent" in result && result.sent) {
      let updateSuccess = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: updErr } = await db
          .from("user_notifications")
          .update({
            payload: {
              ...verifiedPayload,
              invite_id: inviteId,
              email_sent: true,
              email_sending: false,
              email_sent_at: new Date().toISOString(),
            },
          })
          .eq("id", notifId);

        if (!updErr) {
          updateSuccess = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
      }
      if (!updateSuccess) {
        // Residual edge case: Resend accepted the email, but DB update retries failed.
        // The in-app lock remains active until the 30s stale threshold expires.
        // A subsequent retry after 30s could re-read email_sent=false and dispatch a duplicate email
        // (inherent distributed transaction limitation between external email provider and local DB).
        console.error("[corelia-api] failed to update notification payload after email sent");
      }
      return json({ ok: true, email_sent: true }, 200);
    }

    if ("skipped" in result && result.skipped) {
      await db
        .from("user_notifications")
        .update({
          payload: {
            ...verifiedPayload,
            email_sending: false,
          },
        })
        .eq("id", notifId);
      return json({ ok: true, email_sent: false, reason: "email_not_configured" }, 200);
    }

    await db
      .from("user_notifications")
      .update({
        payload: {
          ...verifiedPayload,
          email_sending: false,
          email_last_attempt_at: new Date().toISOString(),
        },
      })
      .eq("id", notifId);

    return json(
      { ok: false, email_sent: false, reason: "provider_error" },
      502,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (isAuthFailure(msg)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] projects.collaborationInvite.sendEmail", e);
    return json({ message: "internal_error" }, 500);
  }
}

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
      .select("id, project_id, invitee_user_id, invited_by, status, expires_at")
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
      // No email on file — in-app notification is already delivered by RPC.
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
      return json({ ok: true, email_sent: true }, 200);
    }
    if ("skipped" in result && result.skipped) {
      return json({ ok: true, email_sent: false, reason: "email_not_configured" }, 200);
    }
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

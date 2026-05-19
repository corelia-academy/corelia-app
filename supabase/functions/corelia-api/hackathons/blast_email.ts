import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { sendBatchEmailsViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

type RecipientFilter = "all" | "approved" | "pending" | "rejected";

async function senderCanBlastHackathon(
  db: SupabaseClient,
  senderId: string,
  hackathonId: string,
): Promise<boolean> {
  const { data: profile, error } = await db
    .from("profiles")
    .select("role,email")
    .eq("id", senderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return false;

  const role = String(profile.role ?? "");
  if (role === "admin" || role === "support_staff") return true;

  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!email) return false;

  const { data: h, error: hErr } = await db
    .from("hackathons")
    .select("document")
    .eq("id", hackathonId)
    .maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (!h?.document || typeof h.document !== "object") return false;

  const doc = h.document as Record<string, unknown>;

  // co_organizer_emails = full co-host with management permissions
  const coOrgEmails = doc.co_organizer_emails;
  if (Array.isArray(coOrgEmails)) {
    if (coOrgEmails.some((e) => typeof e === "string" && e.trim().toLowerCase() === email)) {
      return true;
    }
  }

  // reviewer_emails = application reviewers also get blast access
  const reviewerEmails = doc.reviewer_emails;
  if (Array.isArray(reviewerEmails)) {
    if (reviewerEmails.some((e) => typeof e === "string" && e.trim().toLowerCase() === email)) {
      return true;
    }
  }

  return false;
}

export async function handleHackathonBlastEmail(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const sender = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const hackathonId = String(body.hackathon_id ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const html = String(body.html ?? "").trim();
    const recipientFilter = String(body.recipient_filter ?? "all").trim() as RecipientFilter;

    if (!hackathonId || !subject || !html) {
      return json({ message: "missing_fields:hackathon_id,subject,html" }, 400);
    }
    if (!["all", "approved", "pending", "rejected"].includes(recipientFilter)) {
      return json({ message: "invalid_input:recipient_filter" }, 400);
    }
    if (subject.length > 200) {
      return json({ message: "invalid_input:subject_too_long" }, 400);
    }
    if (html.length > 100_000) {
      return json({ message: "invalid_input:html_too_long" }, 400);
    }

    const allowed = await senderCanBlastHackathon(db, sender.id, hackathonId);
    if (!allowed) return json({ message: "forbidden:blast_email" }, 403);

    // Fetch all registrations for this hackathon
    const { data: regs, error: regsErr } = await db
      .from("hackathon_registrations")
      .select("id, user_id, document")
      .eq("hackathon_id", hackathonId);
    if (regsErr) throw new Error(regsErr.message);
    if (!regs?.length) {
      return json({ ok: true, sent: 0, failed: 0, skipped: 0, total: 0 }, 200);
    }

    // Filter by status (stored in JSONB document)
    const filtered =
      recipientFilter === "all"
        ? regs
        : regs.filter((r) => {
            const doc = (r.document ?? {}) as Record<string, unknown>;
            return doc.status === recipientFilter;
          });

    if (!filtered.length) {
      return json({ ok: true, sent: 0, failed: 0, skipped: 0, total: 0 }, 200);
    }

    // Collect emails in parallel: prefer contact_email, fall back to auth email
    const emailResults = await Promise.all(
      filtered.map(async (r) => {
        const doc = (r.document ?? {}) as Record<string, unknown>;
        const contactEmail =
          typeof doc.contact_email === "string" ? doc.contact_email.trim().toLowerCase() : "";
        if (contactEmail) return contactEmail;
        const { data: authData } = await db.auth.admin.getUserById(r.user_id);
        return authData?.user?.email?.trim().toLowerCase() ?? "";
      }),
    );

    const uniqueEmails = [...new Set(emailResults.filter(Boolean))];
    const noEmailCount = filtered.length - emailResults.filter(Boolean).length;

    if (!uniqueEmails.length) {
      return json(
        { ok: true, sent: 0, failed: 0, skipped: filtered.length, total: filtered.length },
        200,
      );
    }

    const result = await sendBatchEmailsViaResend({
      to_list: uniqueEmails,
      subject,
      html,
    });

    if (result.skipped) {
      return json(
        { ok: true, sent: 0, failed: 0, skipped: filtered.length, total: filtered.length, reason: "email_not_configured" },
        200,
      );
    }

    return json(
      {
        ok: true,
        sent: result.sent,
        failed: result.failed,
        skipped: noEmailCount,
        total: filtered.length,
      },
      200,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] hackathon.blastEmail", e);
    return json({ message: "internal_error" }, 500);
  }
}

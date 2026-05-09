import { isAuthFailure } from "../lib/authz.ts";
import { escapeHtml } from "../lib/html.ts";
import { json } from "../lib/http.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

async function reviewerCanReviewHackathonRegistration(
  db: SupabaseClient,
  reviewerId: string,
  hackathonId: string,
): Promise<boolean> {
  const { data: profile, error } = await db.from("profiles").select("role,email").eq("id", reviewerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return false;
  const role = String(profile.role ?? "");
  if (role === "admin" || role === "support_staff") return true;
  const emailRaw = profile.email;
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email) return false;
  const { data: h, error: hErr } = await db.from("hackathons").select("document").eq("id", hackathonId).maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (!h?.document || typeof h.document !== "object") return false;
  const doc = h.document as Record<string, unknown>;
  const reviewers = doc.reviewer_emails;
  if (!Array.isArray(reviewers)) return false;
  return reviewers.some((r) => typeof r === "string" && r.trim().toLowerCase() === email);
}

export async function handleHackathonNotifyRegistrationReview(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const reviewer = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const hackathonId = String(body.hackathon_id ?? "").trim();
    const applicantUserId = String(body.applicant_user_id ?? "").trim();
    if (!hackathonId || !applicantUserId) {
      return json({ message: "Thiếu hackathon_id hoặc applicant_user_id." }, 400);
    }
    const allowed = await reviewerCanReviewHackathonRegistration(db, reviewer.id, hackathonId);
    if (!allowed) return json({ message: "Không có quyền gửi thông báo cho đăng ký này." }, 403);

    const { data: reg, error: regErr } = await db
      .from("hackathon_registrations")
      .select("document")
      .eq("hackathon_id", hackathonId)
      .eq("user_id", applicantUserId)
      .maybeSingle();
    if (regErr) throw new Error(regErr.message);
    if (!reg) return json({ message: "Không tìm thấy đăng ký." }, 404);
    const doc = (reg.document ?? {}) as Record<string, unknown>;
    const status = typeof doc.status === "string" ? doc.status : "";
    if (status !== "approved" && status !== "rejected") {
      return json({ message: "Trạng thái đăng ký chưa được duyệt." }, 400);
    }

    const { data: hRow, error: hRowErr } = await db.from("hackathons").select("document").eq("id", hackathonId)
      .maybeSingle();
    if (hRowErr) throw new Error(hRowErr.message);
    const hDoc = (hRow?.document ?? {}) as Record<string, unknown>;
    const hackathonTitle =
      typeof hDoc.title === "string" && hDoc.title.trim()
        ? hDoc.title.trim()
        : "Hackathon";
    const slug = typeof hDoc.slug === "string" ? hDoc.slug.trim() : "";

    const { data: authData, error: authErr } = await db.auth.admin.getUserById(applicantUserId);
    if (authErr) console.error("[corelia-api] hackathon notify applicant lookup", authErr);
    const loginEmail = authData?.user?.email?.trim() ?? "";
    const contactEmail =
      typeof doc.contact_email === "string" ? doc.contact_email.trim().toLowerCase() : "";
    const toEmail = loginEmail || contactEmail;
    if (!toEmail) {
      return json({ ok: true, skipped: true, reason: "no_recipient_email" }, 200);
    }

    const appOrigin = Deno.env.get("CORELIA_APP_ORIGIN")?.trim().replace(/\/+$/, "") ?? "";
    const hackathonHref =
      appOrigin && slug ? `${appOrigin}/hackathons/${encodeURIComponent(slug)}` : "";

    const isApproved = status === "approved";
    const subject = isApproved
      ? `[Corelia] Registration approved — ${hackathonTitle}`
      : `[Corelia] Registration update — ${hackathonTitle}`;
    const noteHtml =
      typeof doc.review_note === "string" && doc.review_note.trim()
        ? `<p style="margin-top:12px"><strong>Note:</strong> ${escapeHtml(doc.review_note.trim())}</p>`
        : "";
    const linkHtml = hackathonHref
      ? `<p style="margin-top:16px"><a href="${escapeHtml(hackathonHref)}">Open hackathon</a></p>`
      : "";

    const html = `
<p>Hello,</p>
<p>Your hackathon registration for <strong>${escapeHtml(hackathonTitle)}</strong> has been <strong>${
      isApproved ? "approved" : "rejected"
    }</strong>.</p>
${noteHtml}
${linkHtml}
`.trim();

    const mailResult = await sendTransactionalEmailViaResend({
      to: [toEmail],
      subject,
      html,
    });
    if (mailResult.sent) {
      return json({ ok: true, sent: true }, 200);
    }
    if ("skipped" in mailResult && mailResult.skipped) {
      return json({ ok: true, skipped: true, reason: mailResult.reason }, 200);
    }
    return json({ message: "Không gửi được email lúc này." }, 502);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] hackathon.notifyRegistrationReview", e);
    return json({ message: "Không thể xử lý yêu cầu." }, 500);
  }
}

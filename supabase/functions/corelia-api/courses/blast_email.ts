import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { sendBatchEmailsViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

async function senderCanBlastCourse(
  db: SupabaseClient,
  senderId: string,
  courseId: string,
): Promise<boolean> {
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("role")
    .eq("id", senderId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  const role = String(profile?.role ?? "");
  if (role === "admin" || role === "support_staff") return true;

  const { data: course, error: cErr } = await db
    .from("courses")
    .select("instructor_id, data")
    .eq("id", courseId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!course) return false;
  if (course.instructor_id === senderId) return true;
  const coPerms = (course.data as Record<string, unknown>)?.co_instructor_permissions;
  return typeof coPerms === "object" && coPerms !== null && senderId in coPerms;
}

export async function handleCourseBlastEmail(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const sender = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const courseId = String(body.course_id ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const html = String(body.html ?? "").trim();

    if (!courseId || !subject || !html) {
      return json({ message: "missing_fields:course_id,subject,html" }, 400);
    }
    if (subject.length > 200) return json({ message: "invalid_input:subject_too_long" }, 400);
    if (html.length > 100_000) return json({ message: "invalid_input:html_too_long" }, 400);

    const allowed = await senderCanBlastCourse(db, sender.id, courseId);
    if (!allowed) return json({ message: "forbidden:blast_email" }, 403);

    const { data: enrollments, error: eErr } = await db
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId);
    if (eErr) throw new Error(eErr.message);
    if (!enrollments?.length) {
      return json({ ok: true, sent: 0, failed: 0, skipped: 0, total: 0 }, 200);
    }

    const userIds = [...new Set(enrollments.map((e) => String(e.user_id)))];

    // Ensure every recipient has a notification_preferences row (upsert defaults)
    await db
      .from("notification_preferences")
      .upsert(
        userIds.map((uid) => ({ user_id: uid })),
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    const { data: prefs } = await db
      .from("notification_preferences")
      .select("user_id, email_course_blast, in_app_course_blast")
      .in("user_id", userIds);

    const prefsMap = Object.fromEntries(
      (prefs ?? []).map((p) => [String(p.user_id), p]),
    );

    const emailRecipientIds = userIds.filter(
      (uid) => prefsMap[uid]?.email_course_blast !== false,
    );
    const inAppRecipientIds = userIds.filter(
      (uid) => prefsMap[uid]?.in_app_course_blast !== false,
    );

    // Collect email addresses for opted-in recipients
    const emailResults = await Promise.all(
      emailRecipientIds.map(async (uid) => {
        const { data } = await db.auth.admin.getUserById(uid);
        return data?.user?.email?.trim().toLowerCase() ?? "";
      }),
    );
    const uniqueEmails = [...new Set(emailResults.filter(Boolean))];

    const appUrl = Deno.env.get("APP_URL") ?? "https://app.corelia.dev";
    const unsubUrl = `${appUrl}/account/settings`;
    const htmlWithFooter = `${html}
<br><br>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
<p style="font-size:12px;color:#6b7280;line-height:1.5">
  Bạn nhận email này vì đã đăng ký khoá học trên Corelia.<br>
  <a href="${unsubUrl}" style="color:#6b7280">Quản lý tuỳ chọn thông báo</a>
</p>`;

    const result = await sendBatchEmailsViaResend({
      to_list: uniqueEmails,
      subject,
      html: htmlWithFooter,
    });

    if (inAppRecipientIds.length > 0) {
      await db.from("user_notifications").insert(
        inAppRecipientIds.map((uid) => ({
          user_id: uid,
          type: "course_announcement",
          payload: { course_id: courseId, subject },
        })),
      );
    }

    await db.from("course_blast_logs").insert({
      target_type: "course",
      target_id: courseId,
      sender_id: sender.id,
      subject,
      recipient_count: userIds.length,
      sent_count: result.skipped ? 0 : result.sent,
      failed_count: result.skipped ? 0 : result.failed,
    });

    return json(
      {
        ok: true,
        sent: result.skipped ? 0 : result.sent,
        failed: result.skipped ? 0 : result.failed,
        skipped: userIds.length - emailRecipientIds.length,
        total: userIds.length,
        ...(result.skipped ? { reason: "email_not_configured" } : {}),
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (isAuthFailure(msg)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] courses.blastEmail", e);
    return json({ message: "internal_error" }, 500);
  }
}

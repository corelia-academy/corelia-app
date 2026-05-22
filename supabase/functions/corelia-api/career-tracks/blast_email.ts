import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { sendBatchEmailsViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

async function senderCanBlastCareerTrack(
  db: SupabaseClient,
  senderId: string,
  trackId: string,
): Promise<boolean> {
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("role")
    .eq("id", senderId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  const role = String(profile?.role ?? "");
  if (role === "admin" || role === "support_staff") return true;

  // Allow any instructor or co-instructor of any course in the track
  const { data: trackCourses, error: tcErr } = await db
    .from("career_track_courses")
    .select("courses!inner(instructor_id, data)")
    .eq("track_id", trackId);
  if (tcErr) throw new Error(tcErr.message);
  if (!trackCourses?.length) return false;

  return trackCourses.some((row) => {
    const c = (row as unknown as { courses: { instructor_id: string; data: Record<string, unknown> } }).courses;
    if (c.instructor_id === senderId) return true;
    const coPerms = c.data?.co_instructor_permissions;
    return typeof coPerms === "object" && coPerms !== null && senderId in coPerms;
  });
}

export async function handleCareerTrackBlastEmail(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const sender = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const trackId = String(body.track_id ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const html = String(body.html ?? "").trim();

    if (!trackId || !subject || !html) {
      return json({ message: "missing_fields:track_id,subject,html" }, 400);
    }
    if (subject.length > 200) return json({ message: "invalid_input:subject_too_long" }, 400);
    if (html.length > 100_000) return json({ message: "invalid_input:html_too_long" }, 400);

    const allowed = await senderCanBlastCareerTrack(db, sender.id, trackId);
    if (!allowed) return json({ message: "forbidden:blast_email" }, 403);

    // Get all courses in track
    const { data: trackCourses, error: tcErr } = await db
      .from("career_track_courses")
      .select("course_id")
      .eq("track_id", trackId);
    if (tcErr) throw new Error(tcErr.message);
    if (!trackCourses?.length) {
      return json({ ok: true, sent: 0, failed: 0, skipped: 0, total: 0 }, 200);
    }

    const courseIds = trackCourses.map((r) => String(r.course_id));

    // DISTINCT enrolled users across all courses in track
    const { data: enrollments, error: eErr } = await db
      .from("enrollments")
      .select("user_id")
      .in("course_id", courseIds);
    if (eErr) throw new Error(eErr.message);
    if (!enrollments?.length) {
      return json({ ok: true, sent: 0, failed: 0, skipped: 0, total: 0 }, 200);
    }

    const userIds = [...new Set(enrollments.map((e) => String(e.user_id)))];

    // Ensure notification_preferences rows exist
    await db
      .from("notification_preferences")
      .upsert(
        userIds.map((uid) => ({ user_id: uid })),
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    const { data: prefs } = await db
      .from("notification_preferences")
      .select("user_id, email_track_blast, in_app_track_blast")
      .in("user_id", userIds);

    const prefsMap = Object.fromEntries(
      (prefs ?? []).map((p) => [String(p.user_id), p]),
    );

    const emailRecipientIds = userIds.filter(
      (uid) => prefsMap[uid]?.email_track_blast !== false,
    );
    const inAppRecipientIds = userIds.filter(
      (uid) => prefsMap[uid]?.in_app_track_blast !== false,
    );

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
  Bạn nhận email này vì đã đăng ký khoá học trong lộ trình học trên Corelia.<br>
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
          type: "track_announcement",
          payload: { track_id: trackId, subject },
        })),
      );
    }

    await db.from("course_blast_logs").insert({
      target_type: "career_track",
      target_id: trackId,
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
    console.error("[corelia-api] careerTracks.blastEmail", e);
    return json({ message: "internal_error" }, 500);
  }
}

import { buildLearningReminderEmail } from "../lib/mail/learning_reminder_body.ts";
import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { normalizeEmailLocale, resolveAppUrl } from "../lib/mail/layout.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

interface ReminderCandidateRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  locale: string | null;
  days_inactive: number;
  stage: 3 | 7 | 14 | 30;
  last_active_at: string;
  in_progress_courses: Array<{ id: string; slug: string; title: string }> | null;
}

export async function handleSendLearningReminders(
  req: Request,
  db: SupabaseClient,
  options: { allowCron?: boolean } = {},
): Promise<Response> {
  try {
    if (!options.allowCron) {
      const sender = await verifyBearerUser(req, db);

      // Only admin or support_staff can trigger this batch job manually.
      const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", sender.id)
        .maybeSingle();
      const role = String(profile?.role ?? "");
      if (role !== "admin" && role !== "support_staff") {
        return json({ message: "forbidden:admin_only" }, 403);
      }
    }

    const appUrl = resolveAppUrl();

    // Candidate eligibility, cadence, opt-out, and cycle suppression live in one
    // SECURITY DEFINER RPC so scheduled and manual runs use identical rules.
    const { data: rawCandidates, error: candidateErr } = await db.rpc("get_learning_reminder_candidates");
    if (candidateErr) throw new Error(candidateErr.message);
    if (!rawCandidates || rawCandidates.length === 0) {
      return json({ ok: true, sent: 0, skipped: 0, message: "no_incomplete_enrollments" });
    }

    const userMap = new Map<string, {
      email: string;
      displayName: string;
      locale: ReturnType<typeof normalizeEmailLocale>;
      daysInactive: number;
      stage: 3 | 7 | 14 | 30;
      lastActiveAt: string;
      courses: Array<{ id: string; title: string; slug: string }>;
    }>();

    for (const rawCandidate of rawCandidates as unknown as ReminderCandidateRow[]) {
      const email = rawCandidate.email?.trim().toLowerCase();
      if (!email) continue;
      const courses = Array.isArray(rawCandidate.in_progress_courses)
        ? rawCandidate.in_progress_courses
            .filter((course) => course && typeof course.id === "string")
            .map((course) => ({
              id: course.id,
              title: course.title?.trim() || course.slug || "Course",
              slug: course.slug || course.id,
            }))
        : [];
      if (courses.length === 0) continue;
      userMap.set(String(rawCandidate.user_id), {
        email,
        displayName: rawCandidate.full_name?.trim() || email.split("@")[0]!,
        locale: normalizeEmailLocale(rawCandidate.locale),
        daysInactive: Number(rawCandidate.days_inactive),
        stage: rawCandidate.stage,
        lastActiveAt: rawCandidate.last_active_at,
        courses,
      });
    }

    if (userMap.size === 0) {
      return json({ ok: true, sent: 0, skipped: 0, message: "no_valid_reminder_candidates" });
    }

    // Keep a final read before sending to avoid duplicate sends if two scheduler
    // invocations overlap after the RPC candidate snapshot.
    const userIds = Array.from(userMap.keys());
    const { data: existingLogs } = await db
      .from("learning_reminder_logs")
      .select("user_id, stage, sent_at")
      .in("user_id", userIds);

    let sentCount = 0;
    let skippedCount = 0;

    for (const [uid, userRecord] of userMap.entries()) {
      const { email, displayName, locale, daysInactive, stage, lastActiveAt } = userRecord;

      const alreadySent = (existingLogs ?? []).some((log) => {
        if (String(log.user_id) !== uid || log.stage !== stage) return false;
        return new Date(log.sent_at) >= new Date(lastActiveAt);
      });

      if (alreadySent) {
        skippedCount++;
        continue;
      }

      if (!email) {
        skippedCount++;
        continue;
      }

      const primaryCourse = userRecord.courses[0];
      const { subject, html: emailHtml } = buildLearningReminderEmail({
        courses: userRecord.courses, displayName, locale, stage, appUrl,
      });

      const resendRes = await sendTransactionalEmailViaResend({
        to: [email],
        subject,
        html: emailHtml,
      });

      if (resendRes.sent) {
        sentCount++;
        // Log to database
        await db.from("learning_reminder_logs").insert({
          user_id: uid,
          stage,
          course_ids: userRecord.courses.map((c) => c.id),
          digest_summary: {
            courseCount: userRecord.courses.length,
            primaryCourseId: primaryCourse.id,
            daysInactive,
          },
        });
      } else {
        skippedCount++;
      }
    }

    return json({
      ok: true,
      sent: sentCount,
      skipped: skippedCount,
      totalEvaluated: userMap.size,
    });
  } catch (err) {
    if (isAuthFailure(err)) return json({ message: "unauthorized" }, 401);
    console.error("[corelia-api] handleSendLearningReminders error:", err);
    return json({ message: err instanceof Error ? err.message : "server_error" }, 500);
  }
}

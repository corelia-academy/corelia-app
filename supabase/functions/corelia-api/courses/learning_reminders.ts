import { isAuthFailure } from "../lib/authz.ts";
import { escapeHtml } from "../lib/html.ts";
import { json } from "../lib/http.ts";
import { normalizeEmailLocale, resolveAppUrl, wrapTransactionalEmail } from "../lib/mail/layout.ts";
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

      // Build email content based on stage
      const primaryCourse = userRecord.courses[0];
      const primaryLink = `${appUrl}/learn/${primaryCourse.slug}`;

      let heroTag = "NHẮC HỌC TẬP";
      let heroTitle = "Tiếp tục bài học dở của bạn";
      let heroSubtitle = `Chào ${escapeHtml(displayName)}, bạn đã tạm dừng việc học được vài ngày.`;
      let bodyText = "";

      if (locale === "vi") {
        if (stage === 3) {
          heroTag = "DUY TRÌ THÓI QUEN";
          heroTitle = `Đừng quên bài học "${escapeHtml(primaryCourse.title)}"`;
          heroSubtitle = `Chào ${escapeHtml(displayName)}, chỉ cần 10 phút hôm nay để giữ vững đà tiến bộ.`;
          bodyText = `<p>Kiến thức sẽ dễ ghi nhớ nhất khi bạn ôn tập đều đặn. Hãy tiếp tục nội dung đang học để không bị gián đoạn mục tiêu.</p>`;
        } else if (stage === 7) {
          heroTag = "MỤC TIÊU TUẦN";
          heroTitle = "Đã 1 tuần trôi qua kể từ bài học gần nhất";
          heroSubtitle = `Chào ${escapeHtml(displayName)}, cùng kiểm tra lại tiến độ khóa học nhé.`;
          bodyText = `<p>Bạn đang có ${userRecord.courses.length} khóa học đang tiến hành. Dành ra một khoảng thời gian ngắn để hoàn thành chương tiếp theo và mở khóa các kỹ năng mới.</p>`;
        } else if (stage === 14) {
          heroTag = "CỘNG ĐỒNG HỌC TẬP";
          heroTitle = "Các bạn cùng khóa đang tiến rất nhanh";
          heroSubtitle = `Chào ${escapeHtml(displayName)}, quay lại và hoàn tất mục tiêu nhé.`;
          bodyText = `<p>Rất nhiều học viên vừa mở khóa chứng chỉ và huy hiệu kỹ năng mới. Hãy quay lại tiếp tục bài học của bạn ngay hôm nay!</p>`;
        } else if (stage === 30) {
          heroTag = "THÔNG BÁO CUỐI CÙNG";
          heroTitle = "Chúng tôi sẽ tạm dừng gửi email nhắc học";
          heroSubtitle = `Chào ${escapeHtml(displayName)}, chúng tôi tôn trọng hòm thư của bạn.`;
          bodyText = `<p>Đây là email nhắc học cuối cùng cho các khóa học đang dở của bạn. Bất cứ khi nào bạn sẵn sàng, toàn bộ tiến độ và bài học vẫn luôn được lưu giữ an toàn tại Corelia.</p>`;
        }
      } else {
        if (stage === 3) {
          heroTag = "LEARNING REMINDER";
          heroTitle = `Keep up with "${escapeHtml(primaryCourse.title)}"`;
          heroSubtitle = `Hi ${escapeHtml(displayName)}, take 10 minutes today to maintain your momentum.`;
          bodyText = `<p>Consistent practice is the key to mastering new skills. Jump back into your lesson to stay on track.</p>`;
        } else if (stage === 7) {
          heroTag = "WEEKLY CHECK-IN";
          heroTitle = "It's been a week since your last lesson";
          heroSubtitle = `Hi ${escapeHtml(displayName)}, let's keep your progress going strong.`;
          bodyText = `<p>You have ${userRecord.courses.length} in-progress course(s). Resume now to make meaningful progress this week.</p>`;
        } else if (stage === 14) {
          heroTag = "LEARNING COMMUNITY";
          heroTitle = "Pick up where you left off";
          heroSubtitle = `Hi ${escapeHtml(displayName)}, your next milestones are waiting.`;
          bodyText = `<p>Your fellow learners are progressing quickly and claiming course credentials. Continue your journey today!</p>`;
        } else if (stage === 30) {
          heroTag = "FINAL REMINDER";
          heroTitle = "We're pausing learning reminders for you";
          heroSubtitle = `Hi ${escapeHtml(displayName)}, we respect your inbox.`;
          bodyText = `<p>This is the final automated reminder for your current courses. Whenever you are ready to learn again, your progress is safely saved on Corelia.</p>`;
        }
      }

      // Course list HTML for multi-course digest
      let courseListHtml = "";
      if (userRecord.courses.length > 1) {
        courseListHtml = `
          <div style="margin: 16px 0; padding: 12px; background: #f7f9fb; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="font-size: 12px; font-weight: bold; color: #475569; margin-bottom: 8px;">
              ${locale === "vi" ? "Các khóa học đang học:" : "Your in-progress courses:"}
            </p>
            <ul style="padding-left: 18px; margin: 0; font-size: 13px; color: #1e293b;">
              ${userRecord.courses.map((c) => `<li><a href="${appUrl}/learn/${c.slug}" style="color: #2ab89e; text-decoration: none;">${escapeHtml(c.title)}</a></li>`).join("")}
            </ul>
          </div>
        `;
      }

      const emailHtml = wrapTransactionalEmail({
        locale,
        heroTag,
        heroTitle,
        heroSubtitle,
        bodyHtml: `${bodyText}${courseListHtml}`,
        ctaHtml: `<a href="${primaryLink}" class="e-btn e-btn-teal" style="text-decoration:none; display:inline-block; padding:12px 24px; border-radius:8px; font-weight:bold;">${locale === "vi" ? "Tiếp tục học ngay" : "Resume Learning"}</a>`,
        footerReason: locale === "vi" ? "Bạn nhận được email này vì bạn đang ghi danh vào các khóa học trên Corelia." : "You received this email because you are enrolled in courses on Corelia.",
      });

      const subject = `[Corelia] ${heroTitle}`;

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

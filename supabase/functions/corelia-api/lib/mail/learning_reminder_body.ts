import { EMAIL_BRAND } from "./brand.ts";
import { escapeHtml } from "../html.ts";
import { emailCtaButton, wrapTransactionalEmail, type EmailLocale } from "./layout.ts";

export function buildLearningReminderEmail({ courses, displayName, locale, stage, appUrl }: {
  courses: Array<{ slug: string; title: string }>;
  displayName: string;
  locale: EmailLocale;
  stage: 3 | 7 | 14 | 30;
  appUrl: string;
}): { subject: string; html: string } {
  if (!courses.length) throw new Error("learning_reminder_requires_course");
  // Build email content based on stage
  const primaryCourse = courses[0];
  const primaryLink = `${appUrl}/learn/${encodeURIComponent(primaryCourse.slug)}`;

  let heroTag = "NHẮC HỌC TẬP";
  let heroTitle = "Tiếp tục bài học dở của bạn";
  let heroSubtitle = `Chào ${escapeHtml(displayName)}, bạn đã tạm dừng việc học được vài ngày.`;
  let bodyText = "";

  if (locale === "vi") {
    if (stage === 3) {
      heroTag = "DUY TRÌ THÓI QUEN";
      heroTitle = `Đừng quên bài học "${primaryCourse.title}"`;
      heroSubtitle = `Chào ${escapeHtml(displayName)}, chỉ cần 10 phút hôm nay để giữ vững đà tiến bộ.`;
      bodyText = `<p>Kiến thức sẽ dễ ghi nhớ nhất khi bạn ôn tập đều đặn. Hãy tiếp tục nội dung đang học để không bị gián đoạn mục tiêu.</p>`;
    } else if (stage === 7) {
      heroTag = "MỤC TIÊU TUẦN";
      heroTitle = "Đã 1 tuần trôi qua kể từ bài học gần nhất";
      heroSubtitle = `Chào ${escapeHtml(displayName)}, cùng kiểm tra lại tiến độ khóa học nhé.`;
      bodyText = `<p>Bạn đang có ${courses.length} khóa học đang tiến hành. Dành ra một khoảng thời gian ngắn để hoàn thành chương tiếp theo và mở khóa các kỹ năng mới.</p>`;
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
      heroTitle = `Keep up with "${primaryCourse.title}"`;
      heroSubtitle = `Hi ${escapeHtml(displayName)}, take 10 minutes today to maintain your momentum.`;
      bodyText = `<p>Consistent practice is the key to mastering new skills. Jump back into your lesson to stay on track.</p>`;
    } else if (stage === 7) {
      heroTag = "WEEKLY CHECK-IN";
      heroTitle = "It's been a week since your last lesson";
      heroSubtitle = `Hi ${escapeHtml(displayName)}, let's keep your progress going strong.`;
      bodyText = `<p>You have ${courses.length} in-progress course(s). Resume now to make meaningful progress this week.</p>`;
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
  if (courses.length > 1) {
    courseListHtml = `
      <div style="margin: 16px 0; padding: 12px; background: ${EMAIL_BRAND.surface}; border-radius: 8px; border: 1px solid ${EMAIL_BRAND.border};">
        <p style="font-size: 12px; font-weight: bold; color: ${EMAIL_BRAND.muted}; margin-bottom: 8px;">
          ${locale === "vi" ? "Các khóa học đang học:" : "Your in-progress courses:"}
        </p>
        <ul style="padding-left: 18px; margin: 0; font-size: 13px; color: ${EMAIL_BRAND.text};">
          ${courses.map((c) => `<li><a href="${escapeHtml(`${appUrl}/learn/${encodeURIComponent(c.slug)}`)}" style="color: ${EMAIL_BRAND.link}; text-decoration: none;">${escapeHtml(c.title)}</a></li>`).join("")}
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
    ctaHtml: emailCtaButton(primaryLink, locale === "vi" ? "Tiếp tục học ngay" : "Resume Learning"),
    footerReason: locale === "vi" ? "Bạn nhận được email này vì bạn đang ghi danh vào các khóa học trên Corelia." : "You received this email because you are enrolled in courses on Corelia.",
  });

  const subject = `[Corelia] ${heroTitle}`;
  return { subject, html: emailHtml };
}

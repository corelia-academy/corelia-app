import {
  type EmailLocale,
  emailCtaButton,
  normalizeEmailLocale,
  wrapTransactionalEmail,
} from "./layout.ts";
import { escapeHtml } from "../html.ts";

const COPY: Record<
  EmailLocale,
  {
    tag: string;
    title: string;
    subtitle: (courseTitle: string) => string;
    inviteLine: (inviterName: string) => string;
    permissionsLabel: string;
    expiresLabel: (formatted: string) => string;
    cta: string;
    reason: string;
  }
> = {
  en: {
    tag: "Course collaboration invite",
    title: "You're invited to co-teach a course",
    subtitle: (courseTitle) =>
      `You've been invited to be a co-instructor of "${courseTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> invited you to co-teach this course on Corelia.`,
    permissionsLabel: "Permissions granted",
    expiresLabel: (formatted) => `This invite expires on ${formatted}.`,
    cta: "Review invite",
    reason:
      "You received this email because someone invited you as a co-instructor on Corelia.",
  },
  vi: {
    tag: "Lời mời đồng giảng dạy",
    title: "Bạn được mời làm đồng giảng viên",
    subtitle: (courseTitle) =>
      `Bạn vừa được mời làm đồng giảng viên của khoá "${courseTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> đã mời bạn cùng giảng khoá học này trên Corelia.`,
    permissionsLabel: "Quyền được cấp",
    expiresLabel: (formatted) => `Lời mời sẽ hết hạn vào ${formatted}.`,
    cta: "Xem lời mời",
    reason:
      "Bạn nhận được email này vì có người mời bạn làm đồng giảng viên trên Corelia.",
  },
};

const PERMISSION_LABELS: Record<EmailLocale, Record<string, string>> = {
  en: {
    content: "Edit course content",
    students: "View students and analytics",
    submissions: "Grade submissions",
    certificates: "Manage certificates",
    pricing: "Manage pricing",
  },
  vi: {
    content: "Chỉnh sửa nội dung khoá học",
    students: "Xem học viên và phân tích",
    submissions: "Chấm bài nộp",
    certificates: "Quản lý chứng nhận",
    pricing: "Quản lý giá khoá học",
  },
};

function formatExpiry(expiresAt: Date, locale: EmailLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(expiresAt) + " (UTC)";
  } catch {
    return expiresAt.toISOString();
  }
}

function permissionList(permissions: string[], locale: EmailLocale): string {
  if (!permissions.length) return "";
  const labels = PERMISSION_LABELS[locale];
  const items = permissions
    .map((p) => `<li>${escapeHtml(labels[p] ?? p)}</li>`)
    .join("");
  return `<ul style="margin:0 0 12px 18px;padding:0;font-size:13px;color:#3d4566;line-height:1.8;">${items}</ul>`;
}

export function buildCoInstructorInviteEmail(args: {
  courseTitle: string;
  inviterName: string;
  permissions: string[];
  inviteUrl: string;
  expiresAt: Date;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];
  const safeCourse = args.courseTitle.trim() || (locale === "vi" ? "khoá học" : "a course");

  const bodyHtml = `
    <p>${copy.inviteLine(args.inviterName.trim() || (locale === "vi" ? "Một giảng viên" : "An instructor"))}</p>
    <p><strong>${escapeHtml(copy.permissionsLabel)}:</strong></p>
    ${permissionList(args.permissions, locale)}
    <p>${escapeHtml(copy.expiresLabel(formatExpiry(args.expiresAt, locale)))}</p>
  `;

  return {
    subject: `${copy.title} — ${safeCourse}`,
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title,
      heroSubtitle: copy.subtitle(safeCourse),
      bodyHtml,
      ctaHtml: emailCtaButton(args.inviteUrl, copy.cta),
      footerReason: copy.reason,
    }),
  };
}

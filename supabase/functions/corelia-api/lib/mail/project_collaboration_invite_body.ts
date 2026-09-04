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
    title: (projectTitle: string) => string;
    subject: (projectTitle: string) => string;
    subtitle: (inviterName: string) => string;
    benefits: string;
    expiresLabel: (formatted: string) => string;
    cta: string;
    reason: string;
  }
> = {
  en: {
    tag: "Project Collaboration",
    title: (projectTitle) => `Invitation to join "${projectTitle}"`,
    subject: (projectTitle) => `Invitation to join "${projectTitle}"`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> invited you to collaborate on this project.`,
    benefits:
      "Accept the invitation to join the team and showcase this project on your Corelia profile.",
    expiresLabel: (formatted) => `Expires on: <strong>${formatted}</strong>.`,
    cta: "Review invitation →",
    reason:
      "You received this notification because a team invitation was sent to your account on Corelia.",
  },
  vi: {
    tag: "Cộng tác dự án",
    title: (projectTitle) => `Lời mời tham gia "${projectTitle}"`,
    subject: (projectTitle) => `Lời mời tham gia dự án "${projectTitle}"`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> đã gửi lời mời bạn cùng phát triển dự án này.`,
    benefits:
      "Hãy xác nhận để tham gia đội ngũ và ghi nhận đóng góp vào hồ sơ dự án của bạn trên Corelia.",
    expiresLabel: (formatted) => `Thời hạn phản hồi: Trước <strong>${formatted}</strong>.`,
    cta: "Xem chi tiết lời mời →",
    reason:
      "Bạn nhận được thông báo này do có lời mời cộng tác gửi đến tài khoản của bạn trên Corelia.",
  },
};

function formatExpiry(expiresAt: Date, locale: EmailLocale): string {
  try {
    return (
      new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(expiresAt) + " (UTC)"
    );
  } catch {
    return expiresAt.toISOString();
  }
}

export function buildProjectCollaborationInviteEmail(args: {
  projectTitle: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];
  const safeProject =
    args.projectTitle.trim() || (locale === "vi" ? "dự án" : "a project");
  const safeInviter =
    args.inviterName.trim() ||
    (locale === "vi" ? "Một thành viên" : "A team member");

  const bodyHtml = `
    <p>${copy.benefits}</p>
    <p>${copy.expiresLabel(formatExpiry(args.expiresAt, locale))}</p>
  `;

  return {
    subject: copy.subject(safeProject),
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title(safeProject),
      heroSubtitle: copy.subtitle(safeInviter),
      bodyHtml,
      ctaHtml: emailCtaButton(args.inviteUrl, copy.cta),
      footerReason: copy.reason,
    }),
  };
}

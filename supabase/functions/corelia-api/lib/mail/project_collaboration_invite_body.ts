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
    subtitle: (projectTitle: string) => string;
    inviteLine: (inviterName: string) => string;
    expiresLabel: (formatted: string) => string;
    cta: string;
    reason: string;
  }
> = {
  en: {
    tag: "Project collaboration invite",
    title: "You're invited to join a project",
    subtitle: (projectTitle) =>
      `You've been invited to collaborate on "${projectTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> invited you to join and collaborate on this project on Corelia.`,
    expiresLabel: (formatted) => `This invite expires on ${formatted}.`,
    cta: "Review invite",
    reason:
      "You received this email because someone invited you to collaborate on a project on Corelia.",
  },
  vi: {
    tag: "Lời mời tham gia dự án",
    title: "Bạn được mời tham gia dự án",
    subtitle: (projectTitle) =>
      `Bạn vừa được mời tham gia vào dự án "${projectTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> đã mời bạn cùng phát triển dự án này trên Corelia.`,
    expiresLabel: (formatted) => `Lời mời sẽ hết hạn vào ${formatted}.`,
    cta: "Xem và phản hồi lời mời",
    reason:
      "Bạn nhận được email này vì có người mời bạn tham gia phát triển dự án trên Corelia.",
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

export function buildProjectCollaborationInviteEmail(args: {
  projectTitle: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];
  const safeProject = args.projectTitle.trim() || (locale === "vi" ? "dự án" : "a project");

  const bodyHtml = `
    <p>${copy.inviteLine(args.inviterName.trim() || (locale === "vi" ? "Một thành viên" : "A team member"))}</p>
    <p>${escapeHtml(copy.expiresLabel(formatExpiry(args.expiresAt, locale)))}</p>
  `;

  return {
    subject: `${copy.title} — ${safeProject}`,
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title,
      heroSubtitle: copy.subtitle(safeProject),
      bodyHtml,
      ctaHtml: emailCtaButton(args.inviteUrl, copy.cta),
      footerReason: copy.reason,
    }),
  };
}

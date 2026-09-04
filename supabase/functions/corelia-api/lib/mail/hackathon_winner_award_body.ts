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
    subtitle: (awardLabel: string, hackathonTitle: string) => string;
    bodyLine: (projectTitle: string, awardLabel: string, hackathonTitle: string) => string;
    cta: string;
    reason: string;
  }
> = {
  en: {
    tag: "Hackathon results",
    title: "Congratulations! Your project won an award",
    subtitle: (awardLabel, hackathonTitle) =>
      `Your project was awarded "${awardLabel}" at "${hackathonTitle}".`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `Congratulations to you and your team! Your project <strong>${escapeHtml(projectTitle)}</strong> has won <strong>${escapeHtml(awardLabel)}</strong> at <strong>${escapeHtml(hackathonTitle)}</strong>.`,
    cta: "View hackathon →",
    reason:
      "You received this email because you are an owner or team member of an award-winning project on Corelia Academy.",
  },
  vi: {
    tag: "Kết quả hackathon",
    title: "Chúc mừng! Dự án của bạn đã đạt giải",
    subtitle: (awardLabel, hackathonTitle) =>
      `Dự án của bạn đã xuất sắc đạt giải "${awardLabel}" tại "${hackathonTitle}".`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `Chúc mừng bạn và nhóm phát triển! Dự án <strong>${escapeHtml(projectTitle)}</strong> đã đạt giải <strong>${escapeHtml(awardLabel)}</strong> tại cuộc thi <strong>${escapeHtml(hackathonTitle)}</strong>.`,
    cta: "Xem cuộc thi →",
    reason:
      "Bạn nhận được email này vì là chủ sở hữu hoặc thành viên của dự án đạt giải trên Corelia Academy.",
  },
};

export function buildHackathonWinnerAwardEmail(args: {
  hackathonTitle: string;
  projectTitle: string;
  awardLabel: string;
  hackathonHref?: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];

  const safeHackathon = args.hackathonTitle.trim() || (locale === "vi" ? "Cuộc thi" : "Hackathon");
  const safeProject = args.projectTitle.trim() || (locale === "vi" ? "Dự án" : "Project");
  const safeAward = args.awardLabel.trim() || (locale === "vi" ? "Giải thưởng" : "Award");

  const bodyHtml = `
    <p>${copy.bodyLine(safeProject, safeAward, safeHackathon)}</p>
  `;

  const isProjectLink = args.hackathonHref ? /\/projects\/[^/?#]+/.test(args.hackathonHref) : false;
  const ctaText = isProjectLink
    ? (locale === "vi" ? "Xem chi tiết giải thưởng →" : "View award details →")
    : copy.cta;

  const ctaHtml = args.hackathonHref?.trim()
    ? emailCtaButton(args.hackathonHref.trim(), ctaText)
    : undefined;

  const subject = locale === "vi"
    ? `[Corelia] Chúc mừng! Dự án "${safeProject}" đạt giải ${safeAward} — ${safeHackathon}`
    : `[Corelia] Congratulations! "${safeProject}" won ${safeAward} — ${safeHackathon}`;

  return {
    subject,
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title,
      heroSubtitle: copy.subtitle(safeAward, safeHackathon),
      bodyHtml,
      ctaHtml,
      footerReason: copy.reason,
    }),
  };
}

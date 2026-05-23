import { escapeHtml } from "../lib/html.ts";
import {
  emailCtaButton,
  normalizeEmailLocale,
  type EmailLocale,
  wrapTransactionalEmail,
} from "../lib/mail/layout.ts";

export type CredentialMintEmailKind = "course" | "hackathon" | "milestone";

const COPY: Record<
  CredentialMintEmailKind,
  Record<
    EmailLocale,
    {
      heroTag: string;
      heroTitle: string;
      heroSubtitle: string;
      bodyIntro: string;
      ocbLine: string;
      ctaLabel: string;
      footerReason: string;
      subjectPrefix: string;
    }
  >
> = {
  course: {
    vi: {
      heroTag: "Huy hiệu khóa học",
      heroTitle: "Bạn vừa nhận huy hiệu hoàn thành",
      heroSubtitle: "Chứng nhận Open Campus (OCB) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Bạn đã hoàn thành:",
      ocbLine: "Chứng nhận Open Campus (OCB) của bạn đã được ghi nhận.",
      ctaLabel: "Xem trên hồ sơ Corelia →",
      footerReason: "Bạn nhận email này vì vừa được cấp huy hiệu trên Corelia Academy.",
      subjectPrefix: "Huy hiệu",
    },
    en: {
      heroTag: "Course badge",
      heroTitle: "You earned a completion badge",
      heroSubtitle: "Your Open Campus (OCB) credential is now on record at Corelia.",
      bodyIntro: "Congratulations! You completed:",
      ocbLine: "Your Open Campus (OCB) credential has been recorded.",
      ctaLabel: "View on your Corelia profile →",
      footerReason: "You received this because a badge was issued on Corelia Academy.",
      subjectPrefix: "Badge",
    },
  },
  hackathon: {
    vi: {
      heroTag: "Giải thưởng hackathon",
      heroTitle: "Bạn vừa nhận giải thưởng",
      heroSubtitle: "Chứng nhận Open Campus (OCB) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Giải thưởng của bạn:",
      ocbLine: "Chứng nhận Open Campus (OCB) của bạn đã được ghi nhận.",
      ctaLabel: "Xem trên hồ sơ Corelia →",
      footerReason: "Bạn nhận email này vì vừa được trao giải hackathon trên Corelia Academy.",
      subjectPrefix: "Giải thưởng",
    },
    en: {
      heroTag: "Hackathon award",
      heroTitle: "You received a hackathon award",
      heroSubtitle: "Your Open Campus (OCB) credential is now on record at Corelia.",
      bodyIntro: "Congratulations! Your award:",
      ocbLine: "Your Open Campus (OCB) credential has been recorded.",
      ctaLabel: "View on your Corelia profile →",
      footerReason: "You received this because a hackathon award was issued on Corelia Academy.",
      subjectPrefix: "Award",
    },
  },
  milestone: {
    vi: {
      heroTag: "Thành tích",
      heroTitle: "Bạn vừa đạt một thành tích",
      heroSubtitle: "Chứng nhận Open Campus (OCB) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Thành tích mới:",
      ocbLine: "Chứng nhận Open Campus (OCB) của bạn đã được ghi nhận.",
      ctaLabel: "Xem trên hồ sơ Corelia →",
      footerReason: "Bạn nhận email này vì vừa đạt thành tích trên Corelia Academy.",
      subjectPrefix: "Thành tích",
    },
    en: {
      heroTag: "Milestone",
      heroTitle: "You reached a new milestone",
      heroSubtitle: "Your Open Campus (OCB) credential is now on record at Corelia.",
      bodyIntro: "Congratulations! New milestone:",
      ocbLine: "Your Open Campus (OCB) credential has been recorded.",
      ctaLabel: "View on your Corelia profile →",
      footerReason: "You received this because a milestone was issued on Corelia Academy.",
      subjectPrefix: "Milestone",
    },
  },
};

export function buildCredentialMintEmail(params: {
  kind: CredentialMintEmailKind;
  badgeName: string;
  profileUrl: string;
  credentialId?: string | null;
  imageUrl?: string | null;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(params.locale);
  const copy = COPY[params.kind][locale];

  const subject = `${copy.subjectPrefix}: ${params.badgeName}`;

  const img =
    params.imageUrl?.trim()
      ? `<p><img src="${escapeHtml(params.imageUrl.trim())}" alt="" width="200" style="max-width:100%;border-radius:8px" /></p>`
      : "";

  const cred = params.credentialId?.trim()
    ? `<p style="font-family:monospace;font-size:12px;color:#8a8fa8">Credential ID: ${escapeHtml(params.credentialId.trim())}</p>`
    : "";

  const bodyHtml = `
    <p>${escapeHtml(copy.bodyIntro)}</p>
    <p><strong>${escapeHtml(params.badgeName)}</strong></p>
    ${img}
    <p>${escapeHtml(copy.ocbLine)}</p>
    ${cred}
  `.trim();

  const html = wrapTransactionalEmail({
    locale,
    heroTag: copy.heroTag,
    heroTitle: copy.heroTitle,
    heroSubtitle: copy.heroSubtitle,
    bodyHtml,
    ctaHtml: emailCtaButton(params.profileUrl, copy.ctaLabel),
    footerReason: copy.footerReason,
  });

  return { subject, html };
}

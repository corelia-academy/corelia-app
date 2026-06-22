import { escapeHtml } from "../lib/html.ts";
import {
  emailCtaButton,
  normalizeEmailLocale,
  type EmailLocale,
  wrapTransactionalEmail,
} from "../lib/mail/layout.ts";

/** course    = OCB single course (achievementType: Badge)
 *  course_oca = OCA course/bootcamp/track (achievementType: CertificateOfCompletion / MicroCredential / Diploma)
 *  hackathon  = OCB hackathon award
 *  milestone  = OCB activity milestone
 */
export type CredentialMintEmailKind = "course" | "course_oca" | "hackathon" | "milestone";

const COPY: Record<
  CredentialMintEmailKind,
  Record<
    EmailLocale,
    {
      heroTag: string;
      heroTitle: string;
      heroSubtitle: string;
      bodyIntro: string;
      credentialLine: string;
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
      heroSubtitle: "Open Campus Badge (OCB) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Bạn đã hoàn thành:",
      credentialLine: "Open Campus Badge (OCB) của bạn đã được ghi nhận.",
      ctaLabel: "Xem thành tích của tôi →",
      footerReason: "Bạn nhận email này vì vừa được cấp badge trên Corelia Academy.",
      subjectPrefix: "Huy hiệu",
    },
    en: {
      heroTag: "Course badge",
      heroTitle: "You earned a completion badge",
      heroSubtitle: "Your Open Campus Badge (OCB) is now on record at Corelia.",
      bodyIntro: "Congratulations! You completed:",
      credentialLine: "Your Open Campus Badge (OCB) credential has been recorded.",
      ctaLabel: "View my achievements →",
      footerReason: "You received this because a badge was issued on Corelia Academy.",
      subjectPrefix: "Badge",
    },
  },
  course_oca: {
    vi: {
      heroTag: "Chứng nhận hoàn thành",
      heroTitle: "Bạn vừa nhận chứng nhận hoàn thành",
      heroSubtitle: "Open Campus Achievement (OCA) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Bạn đã hoàn thành:",
      credentialLine: "Open Campus Achievement (OCA) của bạn đã được ghi nhận.",
      ctaLabel: "Xem thành tích của tôi →",
      footerReason: "Bạn nhận email này vì vừa được cấp chứng nhận trên Corelia Academy.",
      subjectPrefix: "Chứng nhận",
    },
    en: {
      heroTag: "Certificate of completion",
      heroTitle: "You earned a certificate",
      heroSubtitle: "Your Open Campus Achievement (OCA) is now on record at Corelia.",
      bodyIntro: "Congratulations! You completed:",
      credentialLine: "Your Open Campus Achievement (OCA) credential has been recorded.",
      ctaLabel: "View my achievements →",
      footerReason: "You received this because a certificate was issued on Corelia Academy.",
      subjectPrefix: "Certificate",
    },
  },
  hackathon: {
    vi: {
      heroTag: "Giải thưởng hackathon",
      heroTitle: "Bạn vừa nhận giải thưởng",
      heroSubtitle: "Open Campus Badge (OCB) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Giải thưởng của bạn:",
      credentialLine: "Open Campus Badge (OCB) của bạn đã được ghi nhận.",
      ctaLabel: "Xem thành tích của tôi →",
      footerReason: "Bạn nhận email này vì vừa được trao giải hackathon trên Corelia Academy.",
      subjectPrefix: "Giải thưởng",
    },
    en: {
      heroTag: "Hackathon award",
      heroTitle: "You received a hackathon award",
      heroSubtitle: "Your Open Campus Badge (OCB) is now on record at Corelia.",
      bodyIntro: "Congratulations! Your award:",
      credentialLine: "Your Open Campus Badge (OCB) credential has been recorded.",
      ctaLabel: "View my achievements →",
      footerReason: "You received this because a hackathon award was issued on Corelia Academy.",
      subjectPrefix: "Award",
    },
  },
  milestone: {
    vi: {
      heroTag: "Cột mốc thành tích",
      heroTitle: "Bạn vừa đạt một cột mốc",
      heroSubtitle: "Open Campus Badge (OCB) đã được ghi nhận trên Corelia.",
      bodyIntro: "Chúc mừng! Cột mốc mới:",
      credentialLine: "Open Campus Badge (OCB) của bạn đã được ghi nhận.",
      ctaLabel: "Xem thành tích của tôi →",
      footerReason: "Bạn nhận email này vì vừa đạt cột mốc trên Corelia Academy.",
      subjectPrefix: "Cột mốc",
    },
    en: {
      heroTag: "Achievement milestone",
      heroTitle: "You reached a new milestone",
      heroSubtitle: "Your Open Campus Badge (OCB) is now on record at Corelia.",
      bodyIntro: "Congratulations! New milestone:",
      credentialLine: "Your Open Campus Badge (OCB) credential has been recorded.",
      ctaLabel: "View my achievements →",
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

  const imageUrl = params.imageUrl?.trim() ?? "";
  const img = imageUrl
    ? params.kind === "course_oca"
      ? `<p><img src="${escapeHtml(imageUrl)}" alt="" width="480" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;height:auto;display:block" /></p>`
      : `<p><img src="${escapeHtml(imageUrl)}" alt="" width="200" style="max-width:100%;border-radius:8px;height:auto" /></p>`
    : "";

  const cred = params.credentialId?.trim()
    ? `<p style="font-family:monospace;font-size:12px;color:#8a8fa8">Credential ID: ${escapeHtml(params.credentialId.trim())}</p>`
    : "";

  const bodyHtml = `
    <p>${escapeHtml(copy.bodyIntro)}</p>
    <p><strong>${escapeHtml(params.badgeName)}</strong></p>
    ${img}
    <p>${escapeHtml(copy.credentialLine)}</p>
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

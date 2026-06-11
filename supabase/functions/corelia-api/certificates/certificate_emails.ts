import { escapeHtml } from "../lib/html.ts";
import {
  emailCtaButton,
  normalizeEmailLocale,
  wrapTransactionalEmail,
} from "../lib/mail/layout.ts";

const COPY: Record<
  "vi" | "en",
  {
    heroTag: string;
    heroTitle: string;
    heroSubtitle: string;
    bodyIntro: string;
    ctaLabel: string;
    footerReason: string;
    subjectLine: string;
  }
> = {
  vi: {
    heroTag: "Chứng nhận hoàn thành khoá học",
    heroTitle: "Chúc mừng! Bạn đã nhận được chứng nhận",
    heroSubtitle: "Chứng nhận hoàn thành khoá học đã được cấp cho bạn.",
    bodyIntro: "Bạn đã hoàn thành xuất sắc khoá học:",
    ctaLabel: "Xem chứng nhận của tôi →",
    footerReason: "Bạn nhận email này vì vừa được cấp chứng nhận hoàn thành khoá học trên Corelia Academy.",
    subjectLine: "🎓 Chúc mừng! Chứng nhận hoàn thành khoá học của bạn đã sẵn sàng",
  },
  en: {
    heroTag: "Course completion certificate",
    heroTitle: "Congratulations! Your certificate is ready",
    heroSubtitle: "Your course completion certificate has been issued.",
    bodyIntro: "You have successfully completed:",
    ctaLabel: "View my certificate →",
    footerReason: "You received this because a course certificate was issued on Corelia Academy.",
    subjectLine: "🎓 Congratulations! Your course certificate is ready",
  },
};

export function buildCertificateIssuedEmail(params: {
  courseTitle: string;
  certImageUrl?: string | null;
  profileUrl: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(params.locale);
  const copy = COPY[locale];

  const img = params.certImageUrl?.trim()
    ? `<p><img src="${escapeHtml(params.certImageUrl.trim())}" alt="" width="480" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb" /></p>`
    : "";

  const bodyHtml = `
    <p>${escapeHtml(copy.bodyIntro)}</p>
    <p><strong>${escapeHtml(params.courseTitle)}</strong></p>
    ${img}
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

  return { subject: copy.subjectLine, html };
}

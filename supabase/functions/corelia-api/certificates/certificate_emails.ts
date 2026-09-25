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
    bodyHint: string;
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
    bodyHint: "Mở chứng nhận đã điền tên, ngày cấp và mã xác thực bằng nút bên dưới. Bạn có thể tải về trong mục Thành tích.",
    ctaLabel: "Xem chứng nhận của tôi →",
    footerReason: "Bạn nhận email này vì vừa được cấp chứng nhận hoàn thành khoá học trên Corelia Academy.",
    subjectLine: "🎓 Chúc mừng! Chứng nhận hoàn thành khoá học của bạn đã sẵn sàng",
  },
  en: {
    heroTag: "Course completion certificate",
    heroTitle: "Congratulations! Your certificate is ready",
    heroSubtitle: "Your course completion certificate has been issued.",
    bodyIntro: "You have successfully completed:",
    bodyHint: "Use the button below to view the certificate with your name, issue date and verification code. You can download it in Achievements.",
    ctaLabel: "View my certificate →",
    footerReason: "You received this because a course certificate was issued on Corelia Academy.",
    subjectLine: "🎓 Congratulations! Your course certificate is ready",
  },
};

export function buildCertificateIssuedEmail(params: {
  courseTitle: string;
  certificateUrl: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(params.locale);
  const copy = COPY[locale];

  const bodyHtml = `
    <p>${escapeHtml(copy.bodyIntro)}</p>
    <p><strong>${escapeHtml(params.courseTitle)}</strong></p>
    <p>${escapeHtml(copy.bodyHint)}</p>
  `.trim();

  const html = wrapTransactionalEmail({
    locale,
    heroTag: copy.heroTag,
    heroTitle: copy.heroTitle,
    heroSubtitle: copy.heroSubtitle,
    bodyHtml,
    ctaHtml: emailCtaButton(params.certificateUrl, copy.ctaLabel),
    footerReason: copy.footerReason,
  });

  return { subject: copy.subjectLine, html };
}

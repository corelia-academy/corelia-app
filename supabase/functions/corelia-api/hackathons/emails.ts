import { escapeHtml } from "../lib/html.ts";
import {
  emailCtaButton,
  normalizeEmailLocale,
  type EmailLocale,
  wrapTransactionalEmail,
} from "../lib/mail/layout.ts";

const COPY: Record<
  EmailLocale,
  {
    approved: { tag: string; title: string; subtitle: string; subject: string; bodyStatus: string };
    rejected: { tag: string; title: string; subtitle: string; subject: string; bodyStatus: string };
    noteLabel: string;
    ctaLabel: string;
    footerReason: string;
    greeting: string;
  }
> = {
  vi: {
    approved: {
      tag: "Đăng ký hackathon",
      title: "Đăng ký đã được duyệt",
      subtitle: "Bạn có thể tiếp tục tham gia hackathon trên Corelia.",
      subject: "Đăng ký đã được duyệt",
      bodyStatus: "đã được duyệt",
    },
    rejected: {
      tag: "Đăng ký hackathon",
      title: "Cập nhật đăng ký",
      subtitle: "Ban tổ chức đã xem xét hồ sơ đăng ký của bạn.",
      subject: "Cập nhật đăng ký",
      bodyStatus: "không được chấp nhận",
    },
    noteLabel: "Ghi chú",
    ctaLabel: "Mở hackathon →",
    footerReason: "Bạn nhận email này vì đã đăng ký hackathon trên Corelia Academy.",
    greeting: "Xin chào,",
  },
  en: {
    approved: {
      tag: "Hackathon registration",
      title: "Registration approved",
      subtitle: "You can continue on Corelia for this hackathon.",
      subject: "Registration approved",
      bodyStatus: "has been approved",
    },
    rejected: {
      tag: "Hackathon registration",
      title: "Registration update",
      subtitle: "Organizers have reviewed your application.",
      subject: "Registration update",
      bodyStatus: "was not accepted",
    },
    noteLabel: "Note",
    ctaLabel: "Open hackathon →",
    footerReason: "You received this because you registered for a hackathon on Corelia Academy.",
    greeting: "Hello,",
  },
};

export function buildHackathonRegistrationReviewEmail(params: {
  hackathonTitle: string;
  isApproved: boolean;
  reviewNote?: string | null;
  hackathonHref?: string;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(params.locale);
  const copy = COPY[locale];
  const statusCopy = params.isApproved ? copy.approved : copy.rejected;

  const subject = `[Corelia] ${statusCopy.subject} — ${params.hackathonTitle}`;

  const noteHtml =
    params.reviewNote?.trim()
      ? `<p><strong>${escapeHtml(copy.noteLabel)}:</strong> ${escapeHtml(params.reviewNote.trim())}</p>`
      : "";

  const bodyHtml = `
    <p>${escapeHtml(copy.greeting)}</p>
    <p>${locale === "vi" ? "Đăng ký hackathon của bạn cho" : "Your hackathon registration for"} <strong>${escapeHtml(params.hackathonTitle)}</strong> ${escapeHtml(statusCopy.bodyStatus)}.</p>
    ${noteHtml}
  `.trim();

  const ctaHtml = params.hackathonHref?.trim()
    ? emailCtaButton(params.hackathonHref.trim(), copy.ctaLabel)
    : undefined;

  const html = wrapTransactionalEmail({
    locale,
    heroTag: statusCopy.tag,
    heroTitle: statusCopy.title,
    heroSubtitle: statusCopy.subtitle,
    bodyHtml,
    ctaHtml,
    footerReason: copy.footerReason,
  });

  return { subject, html };
}

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
    bodyLine: (hackathonTitleHtml: string, status: string) => string;
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
    bodyLine: (title, status) => `Đăng ký hackathon của bạn cho <strong>${title}</strong> ${status}.`,
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
    bodyLine: (title, status) => `Your hackathon registration for <strong>${title}</strong> ${status}.`,
  },
  "zh-CN": {
    approved: {
      tag: "黑客松报名",
      title: "报名已通过",
      subtitle: "您可以继续在 Corelia 参与此黑客松。",
      subject: "报名已通过",
      bodyStatus: "已通过",
    },
    rejected: {
      tag: "黑客松报名",
      title: "报名更新",
      subtitle: "组织方已审核您的报名申请。",
      subject: "报名更新",
      bodyStatus: "未获通过",
    },
    noteLabel: "备注",
    ctaLabel: "打开黑客松 →",
    footerReason: "您收到此邮件是因为您已在 Corelia Academy 报名了黑客松。",
    greeting: "您好，",
    bodyLine: (title, status) => `您对 <strong>${title}</strong> 的黑客松报名${status}。`,
  },
  ko: {
    approved: {
      tag: "해커톤 등록",
      title: "등록이 승인되었습니다",
      subtitle: "Corelia에서 이 해커톤을 계속 진행하실 수 있습니다.",
      subject: "등록 승인",
      bodyStatus: "승인되었습니다",
    },
    rejected: {
      tag: "해커톤 등록",
      title: "등록 업데이트",
      subtitle: "주최 측에서 등록 신청서를 검토했습니다.",
      subject: "등록 업데이트",
      bodyStatus: "승인되지 않았습니다",
    },
    noteLabel: "메모",
    ctaLabel: "해커톤 열기 →",
    footerReason: "Corelia Academy에서 해커톤에 등록하셨기 때문에 이 이메일을 받으셨습니다.",
    greeting: "안녕하세요,",
    bodyLine: (title, status) => `<strong>${title}</strong> 해커톤 등록이 ${status}.`,
  },
  es: {
    approved: {
      tag: "Registro en el hackathon",
      title: "Registro aprobado",
      subtitle: "Puedes continuar en Corelia con este hackathon.",
      subject: "Registro aprobado",
      bodyStatus: "ha sido aprobado",
    },
    rejected: {
      tag: "Registro en el hackathon",
      title: "Actualización del registro",
      subtitle: "Los organizadores han revisado tu solicitud de registro.",
      subject: "Actualización del registro",
      bodyStatus: "no fue aceptado",
    },
    noteLabel: "Nota",
    ctaLabel: "Abrir hackathon →",
    footerReason: "Recibes este correo porque te registraste en un hackathon en Corelia Academy.",
    greeting: "Hola,",
    bodyLine: (title, status) => `Tu registro en el hackathon <strong>${title}</strong> ${status}.`,
  },
  "zh-TW": {
    approved: {
      tag: "黑客松報名",
      title: "報名已通過",
      subtitle: "您可以繼續在 Corelia 參與此黑客松。",
      subject: "報名已通過",
      bodyStatus: "已通過",
    },
    rejected: {
      tag: "黑客松報名",
      title: "報名更新",
      subtitle: "主辦單位已審核您的報名申請。",
      subject: "報名更新",
      bodyStatus: "未獲通過",
    },
    noteLabel: "備註",
    ctaLabel: "開啟黑客松 →",
    footerReason: "您收到此郵件是因為您已在 Corelia Academy 報名了黑客松。",
    greeting: "您好，",
    bodyLine: (title, status) => `您對 <strong>${title}</strong> 的黑客松報名${status}。`,
  },
  ja: {
    approved: {
      tag: "ハッカソン登録",
      title: "登録が承認されました",
      subtitle: "Corelia でこのハッカソンへの参加を続けられます。",
      subject: "登録が承認されました",
      bodyStatus: "承認されました",
    },
    rejected: {
      tag: "ハッカソン登録",
      title: "登録のお知らせ",
      subtitle: "主催者があなたの登録内容を確認しました。",
      subject: "登録のお知らせ",
      bodyStatus: "承認されませんでした",
    },
    noteLabel: "メモ",
    ctaLabel: "ハッカソンを開く →",
    footerReason: "Corelia Academy でハッカソンに登録されたため、このメールをお送りしています。",
    greeting: "こんにちは。",
    bodyLine: (title, status) => `<strong>${title}</strong> のハッカソン登録は${status}。`,
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

  const subject = `[Corelia] ${statusCopy.subject}: ${params.hackathonTitle}`;

  const noteHtml =
    params.reviewNote?.trim()
      ? `<p><strong>${escapeHtml(copy.noteLabel)}:</strong> ${escapeHtml(params.reviewNote.trim())}</p>`
      : "";

  const bodyHtml = `
    <p>${escapeHtml(copy.greeting)}</p>
    <p>${copy.bodyLine(escapeHtml(params.hackathonTitle), escapeHtml(statusCopy.bodyStatus))}</p>
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

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
  "zh-CN": {
    heroTag: "课程结业证书",
    heroTitle: "恭喜！您的证书已就绪",
    heroSubtitle: "您的课程结业证书已颁发。",
    bodyIntro: "您已成功完成：",
    bodyHint: "点击下方按钮查看含您姓名、颁发日期和验证码的证书，也可在“成就”中下载。",
    ctaLabel: "查看我的证书 →",
    footerReason: "您收到此邮件是因为 Corelia Academy 向您颁发了课程证书。",
    subjectLine: "🎓 恭喜！您的课程证书已就绪",
  },
  ko: {
    heroTag: "강의 수료증",
    heroTitle: "축하합니다! 수료증이 준비되었습니다",
    heroSubtitle: "강의 수료증이 발급되었습니다.",
    bodyIntro: "다음 강의를 성공적으로 수료하셨습니다:",
    bodyHint: "아래 버튼으로 이름, 발급일, 인증 코드가 포함된 수료증을 확인하세요. '성과'에서 다운로드할 수 있습니다.",
    ctaLabel: "내 수료증 보기 →",
    footerReason: "Corelia Academy에서 강의 수료증이 발급되어 이 이메일을 받으셨습니다.",
    subjectLine: "🎓 축하합니다! 강의 수료증이 준비되었습니다",
  },
  es: {
    heroTag: "Certificado de finalización del curso",
    heroTitle: "¡Felicidades! Tu certificado está listo",
    heroSubtitle: "Se emitió tu certificado de finalización del curso.",
    bodyIntro: "Completaste con éxito:",
    bodyHint: "Usa el botón de abajo para ver el certificado con tu nombre, fecha de emisión y código de verificación. Puedes descargarlo en Logros.",
    ctaLabel: "Ver mi certificado →",
    footerReason: "Recibes esto porque se emitió un certificado de curso en Corelia Academy.",
    subjectLine: "🎓 ¡Felicidades! Tu certificado del curso está listo",
  },
  "zh-TW": {
    heroTag: "課程結業證書",
    heroTitle: "恭喜！您的證書已就緒",
    heroSubtitle: "您的課程結業證書已頒發。",
    bodyIntro: "您已成功完成：",
    bodyHint: "點擊下方按鈕查看含您姓名、頒發日期和驗證碼的證書，也可在「成就」中下載。",
    ctaLabel: "查看我的證書 →",
    footerReason: "您收到此郵件是因為 Corelia Academy 向您頒發了課程證書。",
    subjectLine: "🎓 恭喜！您的課程證書已就緒",
  },
  ja: {
    heroTag: "コース修了証",
    heroTitle: "おめでとうございます！修了証の準備ができました",
    heroSubtitle: "コースの修了証が発行されました。",
    bodyIntro: "次のコースを無事修了しました：",
    bodyHint: "下のボタンから、お名前・発行日・認証コード入りの修了証をご確認ください。「実績」からダウンロードもできます。",
    ctaLabel: "修了証を見る →",
    footerReason: "Corelia Academy でコース修了証が発行されたため、このメールをお送りしています。",
    subjectLine: "🎓 おめでとうございます！コース修了証の準備ができました",
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

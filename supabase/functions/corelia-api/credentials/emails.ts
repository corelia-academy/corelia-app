import { EMAIL_BRAND } from "../lib/mail/brand.ts";
import { escapeHtml } from "../lib/html.ts";
import {
  emailCtaButton,
  normalizeEmailLocale,
  type EmailLocale,
  wrapTransactionalEmail,
} from "../lib/mail/layout.ts";

/** course        = OCB single course (achievementType: Badge)
 *  course_oca    = OCA course/bootcamp/track (achievementType: CertificateOfCompletion / MicroCredential / Diploma)
 *  hackathon     = OCB hackathon award
 *  milestone     = OCB activity milestone
 *  pending_claim = manually granted (OCA or OCB) to an email with no Corelia account yet —
 *                  distinct wording since the credential isn't "on record" in a profile until signup.
 */
export type CredentialMintEmailKind = "course" | "course_oca" | "hackathon" | "milestone" | "pending_claim";

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
    "zh-CN": {
      heroTag: "课程徽章",
      heroTitle: "您获得了结业徽章",
      heroSubtitle: "您的 Open Campus Badge (OCB) 已记录在 Corelia。",
      bodyIntro: "恭喜！您已完成：",
      credentialLine: "您的 Open Campus Badge (OCB) 凭证已被记录。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此邮件是因为 Corelia Academy 向您颁发了徽章。",
      subjectPrefix: "徽章",
    },
    ko: {
      heroTag: "강의 배지",
      heroTitle: "수료 배지를 받았습니다",
      heroSubtitle: "Open Campus Badge (OCB)가 Corelia에 기록되었습니다.",
      bodyIntro: "축하합니다! 다음 강의를 수료하셨습니다:",
      credentialLine: "Open Campus Badge (OCB) 자격이 기록되었습니다.",
      ctaLabel: "내 성과 보기 →",
      footerReason: "Corelia Academy에서 배지가 발급되어 이 이메일을 받으셨습니다.",
      subjectPrefix: "배지",
    },
    es: {
      heroTag: "Insignia del curso",
      heroTitle: "Obtuviste una insignia de finalización",
      heroSubtitle: "Tu Open Campus Badge (OCB) ya está registrada en Corelia.",
      bodyIntro: "¡Felicidades! Completaste:",
      credentialLine: "Se registró tu credencial Open Campus Badge (OCB).",
      ctaLabel: "Ver mis logros →",
      footerReason: "Recibes esto porque se emitió una insignia en Corelia Academy.",
      subjectPrefix: "Insignia",
    },
    "zh-TW": {
      heroTag: "課程徽章",
      heroTitle: "您獲得了結業徽章",
      heroSubtitle: "您的 Open Campus Badge (OCB) 已記錄在 Corelia。",
      bodyIntro: "恭喜！您已完成：",
      credentialLine: "您的 Open Campus Badge (OCB) 憑證已被記錄。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此郵件是因為 Corelia Academy 向您頒發了徽章。",
      subjectPrefix: "徽章",
    },
    ja: {
      heroTag: "コースバッジ",
      heroTitle: "修了バッジを獲得しました",
      heroSubtitle: "Open Campus Badge (OCB) が Corelia に記録されました。",
      bodyIntro: "おめでとうございます！次のコースを修了しました：",
      credentialLine: "Open Campus Badge (OCB) の資格情報が記録されました。",
      ctaLabel: "自分の実績を見る →",
      footerReason: "Corelia Academy でバッジが発行されたため、このメールをお送りしています。",
      subjectPrefix: "バッジ",
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
    "zh-CN": {
      heroTag: "结业证书",
      heroTitle: "您获得了一份证书",
      heroSubtitle: "您的 Open Campus Achievement (OCA) 已记录在 Corelia。",
      bodyIntro: "恭喜！您已完成：",
      credentialLine: "您的 Open Campus Achievement (OCA) 凭证已被记录。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此邮件是因为 Corelia Academy 向您颁发了证书。",
      subjectPrefix: "证书",
    },
    ko: {
      heroTag: "수료증",
      heroTitle: "수료증을 받았습니다",
      heroSubtitle: "Open Campus Achievement (OCA)가 Corelia에 기록되었습니다.",
      bodyIntro: "축하합니다! 다음 과정을 수료하셨습니다:",
      credentialLine: "Open Campus Achievement (OCA) 자격이 기록되었습니다.",
      ctaLabel: "내 성과 보기 →",
      footerReason: "Corelia Academy에서 수료증이 발급되어 이 이메일을 받으셨습니다.",
      subjectPrefix: "수료증",
    },
    es: {
      heroTag: "Certificado de finalización",
      heroTitle: "Obtuviste un certificado",
      heroSubtitle: "Tu Open Campus Achievement (OCA) ya está registrado en Corelia.",
      bodyIntro: "¡Felicidades! Completaste:",
      credentialLine: "Se registró tu credencial Open Campus Achievement (OCA).",
      ctaLabel: "Ver mis logros →",
      footerReason: "Recibes esto porque se emitió un certificado en Corelia Academy.",
      subjectPrefix: "Certificado",
    },
    "zh-TW": {
      heroTag: "結業證書",
      heroTitle: "您獲得了一份證書",
      heroSubtitle: "您的 Open Campus Achievement (OCA) 已記錄在 Corelia。",
      bodyIntro: "恭喜！您已完成：",
      credentialLine: "您的 Open Campus Achievement (OCA) 憑證已被記錄。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此郵件是因為 Corelia Academy 向您頒發了證書。",
      subjectPrefix: "證書",
    },
    ja: {
      heroTag: "修了証",
      heroTitle: "修了証を獲得しました",
      heroSubtitle: "Open Campus Achievement (OCA) が Corelia に記録されました。",
      bodyIntro: "おめでとうございます！次を修了しました：",
      credentialLine: "Open Campus Achievement (OCA) の資格情報が記録されました。",
      ctaLabel: "自分の実績を見る →",
      footerReason: "Corelia Academy で修了証が発行されたため、このメールをお送りしています。",
      subjectPrefix: "修了証",
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
    "zh-CN": {
      heroTag: "黑客松奖项",
      heroTitle: "您获得了奖项",
      heroSubtitle: "您的 Open Campus Badge (OCB) 已记录在 Corelia。",
      bodyIntro: "恭喜！您的奖项：",
      credentialLine: "您的 Open Campus Badge (OCB) 凭证已被记录。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此邮件是因为 Corelia Academy 向您颁发了黑客松奖项。",
      subjectPrefix: "奖项",
    },
    ko: {
      heroTag: "해커톤 수상",
      heroTitle: "해커톤 상을 받았습니다",
      heroSubtitle: "Open Campus Badge (OCB)가 Corelia에 기록되었습니다.",
      bodyIntro: "축하합니다! 수상 내역:",
      credentialLine: "Open Campus Badge (OCB) 자격이 기록되었습니다.",
      ctaLabel: "내 성과 보기 →",
      footerReason: "Corelia Academy에서 해커톤 상이 수여되어 이 이메일을 받으셨습니다.",
      subjectPrefix: "수상",
    },
    es: {
      heroTag: "Premio del hackathon",
      heroTitle: "Recibiste un premio de hackathon",
      heroSubtitle: "Tu Open Campus Badge (OCB) ya está registrada en Corelia.",
      bodyIntro: "¡Felicidades! Tu premio:",
      credentialLine: "Se registró tu credencial Open Campus Badge (OCB).",
      ctaLabel: "Ver mis logros →",
      footerReason: "Recibes esto porque se otorgó un premio de hackathon en Corelia Academy.",
      subjectPrefix: "Premio",
    },
    "zh-TW": {
      heroTag: "黑客松獎項",
      heroTitle: "您獲得了獎項",
      heroSubtitle: "您的 Open Campus Badge (OCB) 已記錄在 Corelia。",
      bodyIntro: "恭喜！您的獎項：",
      credentialLine: "您的 Open Campus Badge (OCB) 憑證已被記錄。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此郵件是因為 Corelia Academy 向您頒發了黑客松獎項。",
      subjectPrefix: "獎項",
    },
    ja: {
      heroTag: "ハッカソン受賞",
      heroTitle: "ハッカソンの賞を受賞しました",
      heroSubtitle: "Open Campus Badge (OCB) が Corelia に記録されました。",
      bodyIntro: "おめでとうございます！受賞内容：",
      credentialLine: "Open Campus Badge (OCB) の資格情報が記録されました。",
      ctaLabel: "自分の実績を見る →",
      footerReason: "Corelia Academy でハッカソンの賞が授与されたため、このメールをお送りしています。",
      subjectPrefix: "受賞",
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
    "zh-CN": {
      heroTag: "成就里程碑",
      heroTitle: "您达成了新的里程碑",
      heroSubtitle: "您的 Open Campus Badge (OCB) 已记录在 Corelia。",
      bodyIntro: "恭喜！新的里程碑：",
      credentialLine: "您的 Open Campus Badge (OCB) 凭证已被记录。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此邮件是因为您在 Corelia Academy 达成了里程碑。",
      subjectPrefix: "里程碑",
    },
    ko: {
      heroTag: "성과 마일스톤",
      heroTitle: "새로운 마일스톤을 달성했습니다",
      heroSubtitle: "Open Campus Badge (OCB)가 Corelia에 기록되었습니다.",
      bodyIntro: "축하합니다! 새로운 마일스톤:",
      credentialLine: "Open Campus Badge (OCB) 자격이 기록되었습니다.",
      ctaLabel: "내 성과 보기 →",
      footerReason: "Corelia Academy에서 마일스톤이 발급되어 이 이메일을 받으셨습니다.",
      subjectPrefix: "마일스톤",
    },
    es: {
      heroTag: "Hito de logros",
      heroTitle: "Alcanzaste un nuevo hito",
      heroSubtitle: "Tu Open Campus Badge (OCB) ya está registrada en Corelia.",
      bodyIntro: "¡Felicidades! Nuevo hito:",
      credentialLine: "Se registró tu credencial Open Campus Badge (OCB).",
      ctaLabel: "Ver mis logros →",
      footerReason: "Recibes esto porque se emitió un hito en Corelia Academy.",
      subjectPrefix: "Hito",
    },
    "zh-TW": {
      heroTag: "成就里程碑",
      heroTitle: "您達成了新的里程碑",
      heroSubtitle: "您的 Open Campus Badge (OCB) 已記錄在 Corelia。",
      bodyIntro: "恭喜！新的里程碑：",
      credentialLine: "您的 Open Campus Badge (OCB) 憑證已被記錄。",
      ctaLabel: "查看我的成就 →",
      footerReason: "您收到此郵件是因為您在 Corelia Academy 達成了里程碑。",
      subjectPrefix: "里程碑",
    },
    ja: {
      heroTag: "実績マイルストーン",
      heroTitle: "新しいマイルストーンに到達しました",
      heroSubtitle: "Open Campus Badge (OCB) が Corelia に記録されました。",
      bodyIntro: "おめでとうございます！新しいマイルストーン：",
      credentialLine: "Open Campus Badge (OCB) の資格情報が記録されました。",
      ctaLabel: "自分の実績を見る →",
      footerReason: "Corelia Academy でマイルストーンが発行されたため、このメールをお送りしています。",
      subjectPrefix: "マイルストーン",
    },
  },
  pending_claim: {
    vi: {
      heroTag: "Chứng nhận đang chờ",
      heroTitle: "Bạn vừa nhận một chứng nhận từ Corelia",
      heroSubtitle: "Tham gia Corelia để lưu chứng nhận này vào hồ sơ của bạn.",
      bodyIntro: "Bạn vừa được trao:",
      credentialLine: "Chứng nhận đang chờ được lưu vào tài khoản Corelia của bạn.",
      ctaLabel: "Xem ngay trên Corelia →",
      footerReason: "Bạn nhận email này vì vừa được cấp một chứng nhận/huy hiệu trên Corelia Academy.",
      subjectPrefix: "Chứng nhận đang chờ",
    },
    en: {
      heroTag: "Pending credential",
      heroTitle: "You just received a credential from Corelia",
      heroSubtitle: "Join Corelia to save this credential to your profile.",
      bodyIntro: "You were just awarded:",
      credentialLine: "This credential is waiting to be saved to your Corelia account.",
      ctaLabel: "View it on Corelia →",
      footerReason: "You received this because a credential was issued to you on Corelia Academy.",
      subjectPrefix: "Pending credential",
    },
    "zh-CN": {
      heroTag: "待领取凭证",
      heroTitle: "您刚刚收到了来自 Corelia 的凭证",
      heroSubtitle: "加入 Corelia，将此凭证保存到您的个人资料。",
      bodyIntro: "您刚刚获得：",
      credentialLine: "此凭证正等待保存到您的 Corelia 账户。",
      ctaLabel: "在 Corelia 查看 →",
      footerReason: "您收到此邮件是因为 Corelia Academy 向您颁发了凭证。",
      subjectPrefix: "待领取凭证",
    },
    ko: {
      heroTag: "대기 중인 자격",
      heroTitle: "Corelia에서 자격을 받았습니다",
      heroSubtitle: "Corelia에 가입하여 이 자격을 프로필에 저장하세요.",
      bodyIntro: "방금 다음을 받으셨습니다:",
      credentialLine: "이 자격은 Corelia 계정에 저장되기를 기다리고 있습니다.",
      ctaLabel: "Corelia에서 보기 →",
      footerReason: "Corelia Academy에서 자격이 발급되어 이 이메일을 받으셨습니다.",
      subjectPrefix: "대기 중인 자격",
    },
    es: {
      heroTag: "Credencial pendiente",
      heroTitle: "Acabas de recibir una credencial de Corelia",
      heroSubtitle: "Únete a Corelia para guardar esta credencial en tu perfil.",
      bodyIntro: "Acabas de recibir:",
      credentialLine: "Esta credencial está esperando a guardarse en tu cuenta de Corelia.",
      ctaLabel: "Verla en Corelia →",
      footerReason: "Recibes esto porque se te emitió una credencial en Corelia Academy.",
      subjectPrefix: "Credencial pendiente",
    },
    "zh-TW": {
      heroTag: "待領取憑證",
      heroTitle: "您剛剛收到了來自 Corelia 的憑證",
      heroSubtitle: "加入 Corelia，將此憑證儲存到您的個人檔案。",
      bodyIntro: "您剛剛獲得：",
      credentialLine: "此憑證正等待儲存到您的 Corelia 帳戶。",
      ctaLabel: "在 Corelia 查看 →",
      footerReason: "您收到此郵件是因為 Corelia Academy 向您頒發了憑證。",
      subjectPrefix: "待領取憑證",
    },
    ja: {
      heroTag: "保留中の資格情報",
      heroTitle: "Corelia から資格情報を受け取りました",
      heroSubtitle: "Corelia に参加して、この資格情報をプロフィールに保存しましょう。",
      bodyIntro: "次を授与されました：",
      credentialLine: "この資格情報は Corelia アカウントへの保存を待っています。",
      ctaLabel: "Corelia で見る →",
      footerReason: "Corelia Academy で資格情報が発行されたため、このメールをお送りしています。",
      subjectPrefix: "保留中の資格情報",
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
      ? `<p><img src="${escapeHtml(imageUrl)}" alt="" width="480" style="max-width:100%;border-radius:8px;border:1px solid ${EMAIL_BRAND.border};height:auto;display:block" /></p>`
      : `<p><img src="${escapeHtml(imageUrl)}" alt="" width="200" style="max-width:100%;border-radius:8px;height:auto" /></p>`
    : "";

  const cred = params.credentialId?.trim()
    ? `<p style="font-family:monospace;font-size:12px;color:${EMAIL_BRAND.muted}">Credential ID: ${escapeHtml(params.credentialId.trim())}</p>`
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

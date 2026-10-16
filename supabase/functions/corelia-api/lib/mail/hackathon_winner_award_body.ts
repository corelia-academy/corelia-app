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
    awardCta: string;
    hackathonFallback: string;
    projectFallback: string;
    awardFallback: string;
    subject: (project: string, award: string, hackathon: string) => string;
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
    awardCta: "View award details →",
    hackathonFallback: "Hackathon",
    projectFallback: "Project",
    awardFallback: "Award",
    subject: (project, award, hackathon) =>
      `[Corelia] Congratulations! "${project}" won ${award}: ${hackathon}`,
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
    awardCta: "Xem chi tiết giải thưởng →",
    hackathonFallback: "Cuộc thi",
    projectFallback: "Dự án",
    awardFallback: "Giải thưởng",
    subject: (project, award, hackathon) =>
      `[Corelia] Chúc mừng! Dự án "${project}" đạt giải ${award}: ${hackathon}`,
    reason:
      "Bạn nhận được email này vì là chủ sở hữu hoặc thành viên của dự án đạt giải trên Corelia Academy.",
  },
  "zh-CN": {
    tag: "黑客松结果",
    title: "恭喜！您的项目荣获奖项",
    subtitle: (awardLabel, hackathonTitle) =>
      `您的项目在“${hackathonTitle}”中荣获“${awardLabel}”。`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `恭喜您和您的团队！您的项目 <strong>${escapeHtml(projectTitle)}</strong> 在 <strong>${escapeHtml(hackathonTitle)}</strong> 中荣获 <strong>${escapeHtml(awardLabel)}</strong>。`,
    cta: "查看黑客松 →",
    awardCta: "查看获奖详情 →",
    hackathonFallback: "黑客松",
    projectFallback: "项目",
    awardFallback: "奖项",
    subject: (project, award, hackathon) =>
      `[Corelia] 恭喜！“${project}”荣获 ${award}：${hackathon}`,
    reason:
      "您收到此邮件是因为您是 Corelia Academy 上获奖项目的所有者或团队成员。",
  },
  ko: {
    tag: "해커톤 결과",
    title: "축하합니다! 프로젝트가 수상했습니다",
    subtitle: (awardLabel, hackathonTitle) =>
      `회원님의 프로젝트가 "${hackathonTitle}"에서 "${awardLabel}"을(를) 수상했습니다.`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `회원님과 팀원 여러분 축하드립니다! 프로젝트 <strong>${escapeHtml(projectTitle)}</strong>이(가) <strong>${escapeHtml(hackathonTitle)}</strong>에서 <strong>${escapeHtml(awardLabel)}</strong>을(를) 수상했습니다.`,
    cta: "해커톤 보기 →",
    awardCta: "수상 상세 보기 →",
    hackathonFallback: "해커톤",
    projectFallback: "프로젝트",
    awardFallback: "상",
    subject: (project, award, hackathon) =>
      `[Corelia] 축하합니다! "${project}"이(가) ${award}을(를) 수상했습니다: ${hackathon}`,
    reason:
      "Corelia Academy의 수상 프로젝트 소유자 또는 팀원이시기 때문에 이 이메일을 받으셨습니다.",
  },
  es: {
    tag: "Resultados del hackathon",
    title: "¡Felicidades! Tu proyecto ganó un premio",
    subtitle: (awardLabel, hackathonTitle) =>
      `Tu proyecto recibió el premio "${awardLabel}" en "${hackathonTitle}".`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `¡Felicidades a ti y a tu equipo! Tu proyecto <strong>${escapeHtml(projectTitle)}</strong> ganó <strong>${escapeHtml(awardLabel)}</strong> en <strong>${escapeHtml(hackathonTitle)}</strong>.`,
    cta: "Ver hackathon →",
    awardCta: "Ver detalles del premio →",
    hackathonFallback: "Hackathon",
    projectFallback: "Proyecto",
    awardFallback: "Premio",
    subject: (project, award, hackathon) =>
      `[Corelia] ¡Felicidades! "${project}" ganó ${award}: ${hackathon}`,
    reason:
      "Recibes este correo porque eres propietario o miembro del equipo de un proyecto premiado en Corelia Academy.",
  },
  "zh-TW": {
    tag: "黑客松結果",
    title: "恭喜！您的專案榮獲獎項",
    subtitle: (awardLabel, hackathonTitle) =>
      `您的專案在「${hackathonTitle}」中榮獲「${awardLabel}」。`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `恭喜您和您的團隊！您的專案 <strong>${escapeHtml(projectTitle)}</strong> 在 <strong>${escapeHtml(hackathonTitle)}</strong> 中榮獲 <strong>${escapeHtml(awardLabel)}</strong>。`,
    cta: "查看黑客松 →",
    awardCta: "查看獲獎詳情 →",
    hackathonFallback: "黑客松",
    projectFallback: "專案",
    awardFallback: "獎項",
    subject: (project, award, hackathon) =>
      `[Corelia] 恭喜！「${project}」榮獲 ${award}：${hackathon}`,
    reason:
      "您收到此郵件是因為您是 Corelia Academy 上獲獎專案的擁有者或團隊成員。",
  },
  ja: {
    tag: "ハッカソン結果",
    title: "おめでとうございます！プロジェクトが入賞しました",
    subtitle: (awardLabel, hackathonTitle) =>
      `あなたのプロジェクトが「${hackathonTitle}」で「${awardLabel}」を受賞しました。`,
    bodyLine: (projectTitle, awardLabel, hackathonTitle) =>
      `あなたとチームの皆さま、おめでとうございます！プロジェクト <strong>${escapeHtml(projectTitle)}</strong> が <strong>${escapeHtml(hackathonTitle)}</strong> で <strong>${escapeHtml(awardLabel)}</strong> を受賞しました。`,
    cta: "ハッカソンを見る →",
    awardCta: "受賞の詳細を見る →",
    hackathonFallback: "ハッカソン",
    projectFallback: "プロジェクト",
    awardFallback: "賞",
    subject: (project, award, hackathon) =>
      `[Corelia] おめでとうございます！「${project}」が ${award} を受賞：${hackathon}`,
    reason:
      "Corelia Academy の受賞プロジェクトのオーナーまたはチームメンバーであるため、このメールをお送りしています。",
  },
};

export function buildHackathonWinnerAwardEmail(args: {
  hackathonTitle: string;
  projectTitle: string;
  awardLabel: string;
  hackathonHref?: string;
  locale?: string | null;
  fingerprint?: string;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];

  const safeHackathon = args.hackathonTitle.trim() || copy.hackathonFallback;
  const safeProject = args.projectTitle.trim() || copy.projectFallback;
  const safeAward = args.awardLabel.trim() || copy.awardFallback;

  const bodyHtml = `
    <p>${copy.bodyLine(safeProject, safeAward, safeHackathon)}</p>
  `;

  const isProjectLink = args.hackathonHref ? /\/projects\/[^/?#]+/.test(args.hackathonHref) : false;
  const ctaText = isProjectLink
    ? copy.awardCta
    : copy.cta;

  const ctaHtml = args.hackathonHref?.trim()
    ? emailCtaButton(args.hackathonHref.trim(), ctaText)
    : undefined;

  const subject = copy.subject(safeProject, safeAward, safeHackathon);

  return {
    subject,
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title,
      heroSubtitle: escapeHtml(copy.subtitle(safeAward, safeHackathon)),
      bodyHtml,
      ctaHtml,
      footerReason: copy.reason,
      fingerprint: args.fingerprint,
    }),
  };
}

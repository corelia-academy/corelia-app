import {
  type EmailLocale,
  emailCtaButton,
  normalizeEmailLocale,
  wrapTransactionalEmail,
} from "./layout.ts";
import { escapeHtml } from "../html.ts";
import { INTL_LOCALES } from "../locale.ts";

const COPY: Record<
  EmailLocale,
  {
    tag: string;
    title: (projectTitle: string) => string;
    subject: (projectTitle: string) => string;
    subtitle: (inviterName: string) => string;
    benefits: string;
    expiresLabel: (formatted: string) => string;
    cta: string;
    reason: string;
    projectFallback: string;
    memberFallback: string;
  }
> = {
  en: {
    tag: "Project Collaboration",
    title: (projectTitle) => `Invitation to join "${projectTitle}"`,
    subject: (projectTitle) => `Invitation to join "${projectTitle}"`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> invited you to collaborate on this project.`,
    benefits:
      "Accept the invitation to join the team and showcase this project on your Corelia profile.",
    expiresLabel: (formatted) => `Expires on: <strong>${formatted}</strong>.`,
    cta: "Review invitation →",
    reason:
      "You received this notification because a team invitation was sent to your account on Corelia.",
    projectFallback: "a project",
    memberFallback: "A team member",
  },
  vi: {
    tag: "Cộng tác dự án",
    title: (projectTitle) => `Lời mời tham gia "${projectTitle}"`,
    subject: (projectTitle) => `Lời mời tham gia dự án "${projectTitle}"`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> đã gửi lời mời bạn cùng phát triển dự án này.`,
    benefits:
      "Hãy xác nhận để tham gia đội ngũ và ghi nhận đóng góp vào hồ sơ dự án của bạn trên Corelia.",
    expiresLabel: (formatted) => `Thời hạn phản hồi: Trước <strong>${formatted}</strong>.`,
    cta: "Xem chi tiết lời mời →",
    reason:
      "Bạn nhận được thông báo này do có lời mời cộng tác gửi đến tài khoản của bạn trên Corelia.",
    projectFallback: "dự án",
    memberFallback: "Một thành viên",
  },
  "zh-CN": {
    tag: "项目协作",
    title: (projectTitle) => `邀请您加入“${projectTitle}”`,
    subject: (projectTitle) => `邀请您加入“${projectTitle}”`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>邀请您共同参与这个项目。`,
    benefits:
      "接受邀请即可加入团队，并在您的 Corelia 个人资料中展示该项目。",
    expiresLabel: (formatted) => `有效期至：<strong>${formatted}</strong>。`,
    cta: "查看邀请 →",
    reason:
      "您收到此通知是因为有团队邀请发送到了您在 Corelia 的账户。",
    projectFallback: "一个项目",
    memberFallback: "一位团队成员",
  },
  ko: {
    tag: "프로젝트 협업",
    title: (projectTitle) => `"${projectTitle}" 프로젝트에 초대받았습니다`,
    subject: (projectTitle) => `"${projectTitle}" 프로젝트 참여 초대`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>님이 이 프로젝트에 함께하도록 초대했습니다.`,
    benefits:
      "초대를 수락하면 팀에 합류하고 Corelia 프로필에 이 프로젝트를 소개할 수 있습니다.",
    expiresLabel: (formatted) => `만료일: <strong>${formatted}</strong>`,
    cta: "초대 확인하기 →",
    reason:
      "Corelia 계정으로 팀 초대가 발송되어 이 알림을 받으셨습니다.",
    projectFallback: "프로젝트",
    memberFallback: "팀원",
  },
  es: {
    tag: "Colaboración en proyecto",
    title: (projectTitle) => `Invitación para unirte a "${projectTitle}"`,
    subject: (projectTitle) => `Invitación para unirte a "${projectTitle}"`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> te invitó a colaborar en este proyecto.`,
    benefits:
      "Acepta la invitación para unirte al equipo y mostrar este proyecto en tu perfil de Corelia.",
    expiresLabel: (formatted) => `Caduca el: <strong>${formatted}</strong>.`,
    cta: "Revisar invitación →",
    reason:
      "Recibes esta notificación porque se envió una invitación de equipo a tu cuenta de Corelia.",
    projectFallback: "un proyecto",
    memberFallback: "Un miembro del equipo",
  },
  "zh-TW": {
    tag: "專案協作",
    title: (projectTitle) => `邀請您加入「${projectTitle}」`,
    subject: (projectTitle) => `邀請您加入「${projectTitle}」`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>邀請您共同參與這個專案。`,
    benefits:
      "接受邀請即可加入團隊，並在您的 Corelia 個人檔案中展示該專案。",
    expiresLabel: (formatted) => `有效期限至：<strong>${formatted}</strong>。`,
    cta: "查看邀請 →",
    reason:
      "您收到此通知是因為有團隊邀請發送到了您在 Corelia 的帳戶。",
    projectFallback: "一個專案",
    memberFallback: "一位團隊成員",
  },
  ja: {
    tag: "プロジェクトのコラボレーション",
    title: (projectTitle) => `「${projectTitle}」への参加招待`,
    subject: (projectTitle) => `「${projectTitle}」への参加招待`,
    subtitle: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> さんが、このプロジェクトへの参加を招待しています。`,
    benefits:
      "招待を承認してチームに参加し、Corelia のプロフィールでこのプロジェクトを紹介しましょう。",
    expiresLabel: (formatted) => `有効期限：<strong>${formatted}</strong>`,
    cta: "招待を確認 →",
    reason:
      "Corelia のアカウントにチーム招待が送信されたため、この通知をお送りしています。",
    projectFallback: "プロジェクト",
    memberFallback: "チームメンバー",
  },
};

function formatExpiry(expiresAt: Date, locale: EmailLocale): string {
  try {
    return (
      new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(expiresAt) + " (UTC)"
    );
  } catch {
    return expiresAt.toISOString();
  }
}

export function buildProjectCollaborationInviteEmail(args: {
  projectTitle: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
  locale?: string | null;
  fingerprint?: string;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];
  const safeProject =
    args.projectTitle.trim() || copy.projectFallback;
  const safeInviter =
    args.inviterName.trim() || copy.memberFallback;

  const bodyHtml = `
    <p>${copy.benefits}</p>
    <p>${copy.expiresLabel(formatExpiry(args.expiresAt, locale))}</p>
  `;

  return {
    subject: copy.subject(safeProject),
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title(safeProject),
      heroSubtitle: copy.subtitle(safeInviter),
      bodyHtml,
      ctaHtml: emailCtaButton(args.inviteUrl, copy.cta),
      footerReason: copy.reason,
      fingerprint: args.fingerprint,
    }),
  };
}

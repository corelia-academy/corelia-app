import { EMAIL_BRAND } from "./brand.ts";
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
    title: string;
    subtitle: (courseTitle: string) => string;
    inviteLine: (inviterName: string) => string;
    permissionsLabel: string;
    expiresLabel: (formatted: string) => string;
    cta: string;
    reason: string;
    anonymousInviter: string;
    courseFallback: string;
  }
> = {
  en: {
    tag: "Course collaboration invite",
    title: "You're invited to co-teach a course",
    subtitle: (courseTitle) =>
      `You've been invited to be a co-instructor of "${courseTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> invited you to co-teach this course on Corelia.`,
    permissionsLabel: "Permissions granted",
    expiresLabel: (formatted) => `This invite expires on ${formatted}.`,
    cta: "Review invite",
    reason:
      "You received this email because someone invited you as a co-instructor on Corelia.",
    anonymousInviter: "An instructor",
    courseFallback: "a course",
  },
  vi: {
    tag: "Lời mời đồng giảng dạy",
    title: "Bạn được mời làm đồng giảng viên",
    subtitle: (courseTitle) =>
      `Bạn vừa được mời làm đồng giảng viên của khoá "${courseTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> đã mời bạn cùng giảng khoá học này trên Corelia.`,
    permissionsLabel: "Quyền được cấp",
    expiresLabel: (formatted) => `Lời mời sẽ hết hạn vào ${formatted}.`,
    cta: "Xem lời mời",
    reason:
      "Bạn nhận được email này vì có người mời bạn làm đồng giảng viên trên Corelia.",
    anonymousInviter: "Một giảng viên",
    courseFallback: "khoá học",
  },
  "zh-CN": {
    tag: "课程协作邀请",
    title: "邀请您共同授课",
    subtitle: (courseTitle) =>
      `您已受邀成为“${courseTitle}”的联合讲师。`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>邀请您在 Corelia 上共同讲授这门课程。`,
    permissionsLabel: "授予的权限",
    expiresLabel: (formatted) => `此邀请将于 ${formatted} 过期。`,
    cta: "查看邀请",
    reason:
      "您收到此邮件是因为有人邀请您在 Corelia 上担任联合讲师。",
    anonymousInviter: "一位讲师",
    courseFallback: "一门课程",
  },
  ko: {
    tag: "강의 공동 운영 초대",
    title: "강의를 함께 가르치도록 초대받았습니다",
    subtitle: (courseTitle) =>
      `"${courseTitle}" 강의의 공동 강사로 초대받았습니다.`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>님이 Corelia에서 이 강의를 함께 가르치도록 초대했습니다.`,
    permissionsLabel: "부여된 권한",
    expiresLabel: (formatted) => `이 초대는 ${formatted}에 만료됩니다.`,
    cta: "초대 확인하기",
    reason:
      "누군가 Corelia에서 공동 강사로 초대했기 때문에 이 이메일을 받으셨습니다.",
    anonymousInviter: "한 강사",
    courseFallback: "강의",
  },
  es: {
    tag: "Invitación a colaborar en un curso",
    title: "Te invitan a impartir un curso en conjunto",
    subtitle: (courseTitle) =>
      `Te han invitado a ser coinstructor de "${courseTitle}".`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>te invitó a impartir este curso en conjunto en Corelia.`,
    permissionsLabel: "Permisos otorgados",
    expiresLabel: (formatted) => `Esta invitación caduca el ${formatted}.`,
    cta: "Revisar invitación",
    reason:
      "Recibes este correo porque alguien te invitó como coinstructor en Corelia.",
    anonymousInviter: "Un instructor",
    courseFallback: "un curso",
  },
  "zh-TW": {
    tag: "課程協作邀請",
    title: "邀請您共同授課",
    subtitle: (courseTitle) =>
      `您已受邀成為「${courseTitle}」的共同講師。`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong>邀請您在 Corelia 上共同講授這門課程。`,
    permissionsLabel: "授予的權限",
    expiresLabel: (formatted) => `此邀請將於 ${formatted} 到期。`,
    cta: "查看邀請",
    reason:
      "您收到此郵件是因為有人邀請您在 Corelia 上擔任共同講師。",
    anonymousInviter: "一位講師",
    courseFallback: "一門課程",
  },
  ja: {
    tag: "コース共同運営の招待",
    title: "コースの共同講師に招待されました",
    subtitle: (courseTitle) =>
      `「${courseTitle}」の共同講師に招待されました。`,
    inviteLine: (inviterName) =>
      `<strong>${escapeHtml(inviterName)}</strong> さんが、Corelia でこのコースを共同で指導するようあなたを招待しました。`,
    permissionsLabel: "付与される権限",
    expiresLabel: (formatted) => `この招待は ${formatted} に期限切れとなります。`,
    cta: "招待を確認",
    reason:
      "Corelia で共同講師として招待されたため、このメールをお送りしています。",
    anonymousInviter: "ある講師",
    courseFallback: "コース",
  },
};

const PERMISSION_LABELS: Record<EmailLocale, Record<string, string>> = {
  en: {
    content: "Edit course content",
    students: "View students and analytics",
    submissions: "Grade submissions",
    certificates: "Manage certificates",
    pricing: "Manage pricing",
  },
  vi: {
    content: "Chỉnh sửa nội dung khoá học",
    students: "Xem học viên và phân tích",
    submissions: "Chấm bài nộp",
    certificates: "Quản lý chứng nhận",
    pricing: "Quản lý giá khoá học",
  },
  "zh-CN": {
    content: "编辑课程内容",
    students: "查看学员和分析数据",
    submissions: "批改提交作业",
    certificates: "管理证书",
    pricing: "管理定价",
  },
  ko: {
    content: "강의 콘텐츠 편집",
    students: "수강생 및 분석 보기",
    submissions: "제출물 채점",
    certificates: "수료증 관리",
    pricing: "가격 관리",
  },
  es: {
    content: "Editar el contenido del curso",
    students: "Ver estudiantes y analíticas",
    submissions: "Calificar entregas",
    certificates: "Gestionar certificados",
    pricing: "Gestionar precios",
  },
  "zh-TW": {
    content: "編輯課程內容",
    students: "檢視學員與分析資料",
    submissions: "批改繳交作業",
    certificates: "管理證書",
    pricing: "管理定價",
  },
  ja: {
    content: "コース内容の編集",
    students: "受講生と分析の閲覧",
    submissions: "提出物の採点",
    certificates: "修了証の管理",
    pricing: "価格の管理",
  },
};

function formatExpiry(expiresAt: Date, locale: EmailLocale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(expiresAt) + " (UTC)";
  } catch {
    return expiresAt.toISOString();
  }
}

function permissionList(permissions: string[], locale: EmailLocale): string {
  if (!permissions.length) return "";
  const labels = PERMISSION_LABELS[locale];
  const items = permissions
    .map((p) => `<li>${escapeHtml(labels[p] ?? p)}</li>`)
    .join("");
  return `<ul style="margin:0 0 12px 18px;padding:0;font-size:13px;color:${EMAIL_BRAND.muted};line-height:1.8;">${items}</ul>`;
}

export function buildCoInstructorInviteEmail(args: {
  courseTitle: string;
  inviterName: string;
  permissions: string[];
  inviteUrl: string;
  expiresAt: Date;
  locale?: string | null;
}): { subject: string; html: string } {
  const locale = normalizeEmailLocale(args.locale);
  const copy = COPY[locale];
  const safeCourse = args.courseTitle.trim() || copy.courseFallback;

  const bodyHtml = `
    <p>${copy.inviteLine(args.inviterName.trim() || copy.anonymousInviter)}</p>
    <p><strong>${escapeHtml(copy.permissionsLabel)}:</strong></p>
    ${permissionList(args.permissions, locale)}
    <p>${escapeHtml(copy.expiresLabel(formatExpiry(args.expiresAt, locale)))}</p>
  `;

  return {
    subject: `${copy.title}: ${safeCourse}`,
    html: wrapTransactionalEmail({
      locale,
      heroTag: copy.tag,
      heroTitle: copy.title,
      heroSubtitle: escapeHtml(copy.subtitle(safeCourse)),
      bodyHtml,
      ctaHtml: emailCtaButton(args.inviteUrl, copy.cta),
      footerReason: copy.reason,
    }),
  };
}

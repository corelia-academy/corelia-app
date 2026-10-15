import type { SupabaseClient } from "../lib/supabase.ts";
import { escapeHtml } from "../lib/html.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { normalizeEmailLocale, type EmailLocale } from "../lib/mail/locale.ts";
import { emailCtaButton, renderTransactionalEmail } from "../lib/mail/render.ts";
import { claimOutboxLease, commitOutboxFailure, commitOutboxSuccess, persistOutboxDispatch, releaseOutboxUnconfigured, type OutboxRequestPayload } from "../lib/mail/outbox.ts";
import { isTransactionalEmailConfigured, sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";

export type DigestItem = { key: string; type: string; payload: Record<string, unknown> };
type Candidate = { user_id: string; email: string; locale: string; unsubscribe_token: string; digest_key: string };
type DigestSnapshot = OutboxRequestPayload & { notification_items: DigestItem[]; notification_user_id: string };

type DigestTexts = {
  project_liked: (c: number, t: string) => string;
  project_followed: (c: number, t: string) => string;
  user_followed: (c: number, t: string) => string;
  milestone_liked: (c: number, t: string) => string;
  project_invite_accepted: (c: number, t: string) => string;
  project_invite_declined: (c: number, t: string) => string;
  course_invite_accepted: (c: number, t: string) => string;
  course_invite_declined: (c: number, t: string) => string;
  submission_received: (c: number, t: string) => string;
  submission_approved: (c: number, t: string) => string;
  submission_rejected: (c: number, t: string) => string;
  followed_milestone: (c: number, t: string) => string;
  fallback: string;
  subject: string;
  cta: string;
  unsubscribe: string;
};

const DIGEST_COPY: Record<EmailLocale, DigestTexts> = {
  en: {
    project_liked: (c, t) => `${c} people liked your project ${t}.`,
    project_followed: (c, t) => `${c} people followed your project ${t}.`,
    user_followed: (c) => `You have ${c} new followers.`,
    milestone_liked: (c) => `${c} people liked your achievement.`,
    project_invite_accepted: (_c, t) => `Your invitation to ${t} was accepted.`,
    project_invite_declined: (_c, t) => `Your invitation to ${t} was declined.`,
    course_invite_accepted: (_c, t) => `Your co-instructor invitation for ${t} was accepted.`,
    course_invite_declined: (_c, t) => `Your co-instructor invitation for ${t} was declined.`,
    submission_received: (c, t) => `${t}: ${c} submissions await review.`,
    submission_approved: (_c, t) => `Your final assignment for ${t} was approved.`,
    submission_rejected: (_c, t) => `Your final assignment for ${t} needs revision.`,
    followed_milestone: (_c, t) => `${t} reached a new milestone.`,
    fallback: "You have new activity.",
    subject: "Your new activity on Corelia",
    cta: "View notifications",
    unsubscribe: "Unsubscribe from activity emails",
  },
  vi: {
    project_liked: (c, t) => `${c} người đã thích dự án ${t}.`,
    project_followed: (c, t) => `${c} người đã theo dõi dự án ${t}.`,
    user_followed: (c) => `Bạn có ${c} người theo dõi mới.`,
    milestone_liked: (c) => `${c} người đã thích thành tựu của bạn.`,
    project_invite_accepted: (_c, t) => `Lời mời tham gia ${t} đã được chấp nhận.`,
    project_invite_declined: (_c, t) => `Lời mời tham gia ${t} đã bị từ chối.`,
    course_invite_accepted: (_c, t) => `Lời mời đồng giảng viên ${t} đã được chấp nhận.`,
    course_invite_declined: (_c, t) => `Lời mời đồng giảng viên ${t} đã bị từ chối.`,
    submission_received: (c, t) => `${t}: ${c} bài đang chờ chấm.`,
    submission_approved: (_c, t) => `Bài cuối khóa ${t} đã được duyệt.`,
    submission_rejected: (_c, t) => `Bài cuối khóa ${t} cần chỉnh sửa.`,
    followed_milestone: (_c, t) => `${t} vừa đạt thành tựu mới.`,
    fallback: "Bạn có hoạt động mới.",
    subject: "Tương tác mới của bạn trên Corelia",
    cta: "Xem thông báo",
    unsubscribe: "Hủy nhận email tổng hợp",
  },
  "zh-CN": {
    project_liked: (c, t) => `${c} 人赞了您的项目 ${t}。`,
    project_followed: (c, t) => `${c} 人关注了您的项目 ${t}。`,
    user_followed: (c) => `您有 ${c} 位新关注者。`,
    milestone_liked: (c) => `${c} 人赞了您的成就。`,
    project_invite_accepted: (_c, t) => `您加入 ${t} 的邀请已被接受。`,
    project_invite_declined: (_c, t) => `您加入 ${t} 的邀请已被拒绝。`,
    course_invite_accepted: (_c, t) => `您对 ${t} 的联合讲师邀请已被接受。`,
    course_invite_declined: (_c, t) => `您对 ${t} 的联合讲师邀请已被拒绝。`,
    submission_received: (c, t) => `${t}：有 ${c} 份作业等待批改。`,
    submission_approved: (_c, t) => `您在 ${t} 的结业作业已通过。`,
    submission_rejected: (_c, t) => `您在 ${t} 的结业作业需要修改。`,
    followed_milestone: (_c, t) => `${t} 达成了新的里程碑。`,
    fallback: "您有新的动态。",
    subject: "您在 Corelia 上的新动态",
    cta: "查看通知",
    unsubscribe: "退订动态邮件",
  },
  ko: {
    project_liked: (c, t) => `${c}명이 내 프로젝트 ${t}을(를) 좋아합니다.`,
    project_followed: (c, t) => `${c}명이 내 프로젝트 ${t}을(를) 팔로우했습니다.`,
    user_followed: (c) => `새 팔로워가 ${c}명 있습니다.`,
    milestone_liked: (c) => `${c}명이 내 성과를 좋아합니다.`,
    project_invite_accepted: (_c, t) => `${t} 참여 초대가 수락되었습니다.`,
    project_invite_declined: (_c, t) => `${t} 참여 초대가 거절되었습니다.`,
    course_invite_accepted: (_c, t) => `${t} 공동 강사 초대가 수락되었습니다.`,
    course_invite_declined: (_c, t) => `${t} 공동 강사 초대가 거절되었습니다.`,
    submission_received: (c, t) => `${t}: 검토 대기 중인 제출물이 ${c}건 있습니다.`,
    submission_approved: (_c, t) => `${t}의 최종 과제가 승인되었습니다.`,
    submission_rejected: (_c, t) => `${t}의 최종 과제를 수정해야 합니다.`,
    followed_milestone: (_c, t) => `${t}이(가) 새로운 성과를 달성했습니다.`,
    fallback: "새로운 활동이 있습니다.",
    subject: "Corelia의 새로운 활동",
    cta: "알림 보기",
    unsubscribe: "활동 이메일 수신 거부",
  },
  es: {
    project_liked: (c, t) => `A ${c} personas les gustó tu proyecto ${t}.`,
    project_followed: (c, t) => `${c} personas siguieron tu proyecto ${t}.`,
    user_followed: (c) => `Tienes ${c} seguidores nuevos.`,
    milestone_liked: (c) => `A ${c} personas les gustó tu logro.`,
    project_invite_accepted: (_c, t) => `Tu invitación a ${t} fue aceptada.`,
    project_invite_declined: (_c, t) => `Tu invitación a ${t} fue rechazada.`,
    course_invite_accepted: (_c, t) => `Tu invitación de coinstructor para ${t} fue aceptada.`,
    course_invite_declined: (_c, t) => `Tu invitación de coinstructor para ${t} fue rechazada.`,
    submission_received: (c, t) => `${t}: ${c} entregas esperan revisión.`,
    submission_approved: (_c, t) => `Tu trabajo final de ${t} fue aprobado.`,
    submission_rejected: (_c, t) => `Tu trabajo final de ${t} necesita correcciones.`,
    followed_milestone: (_c, t) => `${t} alcanzó un nuevo hito.`,
    fallback: "Tienes actividad nueva.",
    subject: "Tu nueva actividad en Corelia",
    cta: "Ver notificaciones",
    unsubscribe: "Cancelar correos de actividad",
  },
  "zh-TW": {
    project_liked: (c, t) => `${c} 人讚了您的專案 ${t}。`,
    project_followed: (c, t) => `${c} 人追蹤了您的專案 ${t}。`,
    user_followed: (c) => `您有 ${c} 位新追蹤者。`,
    milestone_liked: (c) => `${c} 人讚了您的成就。`,
    project_invite_accepted: (_c, t) => `您加入 ${t} 的邀請已被接受。`,
    project_invite_declined: (_c, t) => `您加入 ${t} 的邀請已被拒絕。`,
    course_invite_accepted: (_c, t) => `您對 ${t} 的共同講師邀請已被接受。`,
    course_invite_declined: (_c, t) => `您對 ${t} 的共同講師邀請已被拒絕。`,
    submission_received: (c, t) => `${t}：有 ${c} 份作業等待批改。`,
    submission_approved: (_c, t) => `您在 ${t} 的結業作業已通過。`,
    submission_rejected: (_c, t) => `您在 ${t} 的結業作業需要修改。`,
    followed_milestone: (_c, t) => `${t} 達成了新的里程碑。`,
    fallback: "您有新的動態。",
    subject: "您在 Corelia 上的新動態",
    cta: "查看通知",
    unsubscribe: "取消訂閱動態郵件",
  },
  ja: {
    project_liked: (c, t) => `${c} 人があなたのプロジェクト ${t} に「いいね」しました。`,
    project_followed: (c, t) => `${c} 人があなたのプロジェクト ${t} をフォローしました。`,
    user_followed: (c) => `新しいフォロワーが ${c} 人います。`,
    milestone_liked: (c) => `${c} 人があなたの実績に「いいね」しました。`,
    project_invite_accepted: (_c, t) => `${t} への招待が承認されました。`,
    project_invite_declined: (_c, t) => `${t} への招待が辞退されました。`,
    course_invite_accepted: (_c, t) => `${t} の共同講師への招待が承認されました。`,
    course_invite_declined: (_c, t) => `${t} の共同講師への招待が辞退されました。`,
    submission_received: (c, t) => `${t}：レビュー待ちの提出物が ${c} 件あります。`,
    submission_approved: (_c, t) => `${t} の最終課題が承認されました。`,
    submission_rejected: (_c, t) => `${t} の最終課題は修正が必要です。`,
    followed_milestone: (_c, t) => `${t} が新しいマイルストーンを達成しました。`,
    fallback: "新しいアクティビティがあります。",
    subject: "Corelia の新しいアクティビティ",
    cta: "通知を見る",
    unsubscribe: "アクティビティメールの配信停止",
  },
};

export function digestText(item: DigestItem, locale: string): string {
  const copy = DIGEST_COPY[normalizeEmailLocale(locale)];
  const title = String(item.payload.title ?? "");
  const count = Number(item.payload.count ?? 1);
  const render = (copy as unknown as Record<string, unknown>)[item.type];
  return Object.hasOwn(copy, item.type) && typeof render === "function"
    ? (render as (c: number, t: string) => string)(count, title)
    : copy.fallback;
}

export function buildDigest(items: DigestItem[], locale: string, appUrl: string, unsubscribeUrl: string) {
  const copy = DIGEST_COPY[normalizeEmailLocale(locale)];
  const subject = copy.subject;
  const bodyHtml = `<ul>${items.slice(0, 10).map(item => {
    const path = String(item.payload.target_path ?? "/notifications");
    const safePath = /^\/(?![\\/])/.test(path) && !/[\\\x00-\x1f]/.test(path) ? path : "/notifications";
    return `<li><a href="${escapeHtml(appUrl + safePath)}">${escapeHtml(digestText(item, locale))}</a></li>`;
  }).join("")}</ul>`;
  return { subject, html: renderTransactionalEmail({ locale: normalizeEmailLocale(locale), heroTag: "Corelia", heroTitle: subject, bodyHtml,
    ctaHtml: emailCtaButton(`${appUrl}/notifications`, copy.cta),
    footerExtraHtml: `<a href="${escapeHtml(unsubscribeUrl)}">${copy.unsubscribe}</a>`,
  }, { appUrl }) };
}

/** Recheck both permission and exact frozen content before any retry can expose stale data. */
export function digestStillVisible(frozen: DigestItem[], current: DigestItem[]): boolean {
  return frozen.length > 0 && frozen.every(item => current.some(next => next.key === item.key && JSON.stringify(next.payload) === JSON.stringify(item.payload)));
}

export async function sendSocialDigests(db: SupabaseClient): Promise<{ accepted: number; skipped: number; failed: number }> {
  const totals = { accepted: 0, skipped: 0, failed: 0 };
  const { data, error } = await db.rpc("notification_digest_candidates");
  if (error) throw error;
  for (const candidate of (data ?? []) as Candidate[]) {
    try {
      const finish = async (keys: string[], accepted: boolean) => {
        const result = await db.rpc("notification_digest_finish", { p_user: candidate.user_id, p_keys: keys, p_accepted: accepted });
        if (result.error) throw result.error;
      };
      const content = async (): Promise<DigestItem[]> => {
        const result = await db.rpc("notification_digest_content", { p_user: candidate.user_id });
        if (result.error) throw result.error;
        return result.data as DigestItem[];
      };
      const items = await content();
      // An accepted outbox is authoritative even if finishing the digest state failed.
      const existing = await db.from("email_outbox_events").select("status,request_payload").eq("idempotency_key", candidate.digest_key).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.status === "accepted") {
        await finish((existing.data.request_payload as DigestSnapshot).notification_items.map(i => i.key), true);
        totals.accepted++; continue;
      }
      if (!items.length) { await finish([], false); totals.skipped++; continue; }
      const appUrl = resolveAppUrl();
      const unsub = `${appUrl}/email/unsubscribe?type=social_digest&token=${encodeURIComponent(candidate.unsubscribe_token)}`;
      const rendered = buildDigest(items, candidate.locale, appUrl, unsub);
      const oneClick = `${Deno.env.get("SUPABASE_URL")}/functions/v1/corelia-api?op=notifications.unsubscribe&type=social_digest&token=${encodeURIComponent(candidate.unsubscribe_token)}`;
      const snapshot: DigestSnapshot = { ...rendered, from: Deno.env.get("MAIL_FROM")?.trim() ?? "", to: [candidate.email],
        idempotency_key: candidate.digest_key, notification_items: items, notification_user_id: candidate.user_id,
        headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
      const claim = await claimOutboxLease({ db, idempotencyKey: candidate.digest_key, eventType: "social_digest", recipientEmail: candidate.email, buildSnapshot: () => snapshot });
      if (claim.type === "already_accepted") {
        await finish((claim.event.request_payload as DigestSnapshot).notification_items.map(i => i.key), true);
        totals.accepted++; continue;
      }
      if (claim.type !== "claimed") { await finish([], false); totals.skipped++; continue; }
      const frozen = claim.event.request_payload as DigestSnapshot;
      const keys = frozen.notification_items.map(i => i.key);
      if (!isTransactionalEmailConfigured(frozen.from)) {
        await releaseOutboxUnconfigured({ db, idempotencyKey: candidate.digest_key, leaseToken: claim.leaseToken });
        await finish([], false); totals.skipped++; continue;
      }
      // Query after acquiring the lease, not just when the batch was selected.
      const fresh = await content();
      if (!digestStillVisible(frozen.notification_items, fresh) || frozen.to[0] !== candidate.email) {
        await commitOutboxFailure({ db, idempotencyKey: candidate.digest_key, leaseToken: claim.leaseToken, isPermanent: true, existingFirstDispatchedAt: claim.event.first_dispatched_at });
        await finish(keys, true); totals.skipped++; continue;
      }
      const contact = await db.from("email_contacts").upsert({ email: candidate.email.toLowerCase() }, { onConflict: "email", ignoreDuplicates: true });
      if (contact.error) throw contact.error;
      const dispatch = await persistOutboxDispatch({ db, idempotencyKey: candidate.digest_key, leaseToken: claim.leaseToken, existingFirstDispatchedAt: claim.event.first_dispatched_at });
      if (!dispatch.ok) { totals.skipped++; continue; }
      const result = await sendTransactionalEmailViaResend({ db, mailType: "social_digest", to: frozen.to, subject: frozen.subject, html: frozen.html, from: frozen.from, headers: frozen.headers, idempotencyKey: candidate.digest_key });
      if (result.sent) {
        const committed = await commitOutboxSuccess({ db, idempotencyKey: candidate.digest_key, leaseToken: claim.leaseToken, providerMessageId: result.providerMessageId });
        if (committed) await finish(keys, true);
        totals.accepted++;
      } else if ("providerError" in result) {
        await commitOutboxFailure({ db, idempotencyKey: candidate.digest_key, leaseToken: claim.leaseToken, isPermanent: !result.isRetryable && !result.isConfigError, isConfigError: result.isConfigError, existingFirstDispatchedAt: claim.event.first_dispatched_at });
        await finish([], false); totals.failed++;
      }
    } catch (error) {
      console.error("[notifications/digest] failed", error instanceof Error ? error.message : "unknown_error");
      totals.failed++;
    }
  }
  return totals;
}

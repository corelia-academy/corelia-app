import type { SupabaseClient } from "../lib/supabase.ts";
import { escapeHtml } from "../lib/html.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { emailCtaButton, renderTransactionalEmail } from "../lib/mail/render.ts";
import { claimOutboxLease, commitOutboxFailure, commitOutboxSuccess, persistOutboxDispatch, releaseOutboxUnconfigured, type OutboxRequestPayload } from "../lib/mail/outbox.ts";
import { isTransactionalEmailConfigured, sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";

export type DigestItem = { key: string; type: string; payload: Record<string, unknown> };
type Candidate = { user_id: string; email: string; locale: string; unsubscribe_token: string; digest_key: string };
type DigestSnapshot = OutboxRequestPayload & { notification_items: DigestItem[]; notification_user_id: string };

export function digestText(item: DigestItem, locale: string): string {
  const vi = locale === "vi";
  const title = String(item.payload.title ?? "");
  const count = Number(item.payload.count ?? 1);
  const labels: Record<string, [string, string]> = {
    project_liked: [`${count} người đã thích dự án ${title}.`, `${count} people liked your project ${title}.`],
    project_followed: [`${count} người đã theo dõi dự án ${title}.`, `${count} people followed your project ${title}.`],
    user_followed: [`Bạn có ${count} người theo dõi mới.`, `You have ${count} new followers.`],
    milestone_liked: [`${count} người đã thích thành tựu của bạn.`, `${count} people liked your achievement.`],
    project_invite_accepted: [`Lời mời tham gia ${title} đã được chấp nhận.`, `Your invitation to ${title} was accepted.`],
    project_invite_declined: [`Lời mời tham gia ${title} đã bị từ chối.`, `Your invitation to ${title} was declined.`],
    course_invite_accepted: [`Lời mời đồng giảng viên ${title} đã được chấp nhận.`, `Your co-instructor invitation for ${title} was accepted.`],
    course_invite_declined: [`Lời mời đồng giảng viên ${title} đã bị từ chối.`, `Your co-instructor invitation for ${title} was declined.`],
    submission_received: [`${title}: ${count} bài đang chờ chấm.`, `${title}: ${count} submissions await review.`],
    submission_approved: [`Bài cuối khóa ${title} đã được duyệt.`, `Your final assignment for ${title} was approved.`],
    submission_rejected: [`Bài cuối khóa ${title} cần chỉnh sửa.`, `Your final assignment for ${title} needs revision.`],
    followed_milestone: [`${title} vừa đạt thành tựu mới.`, `${title} reached a new milestone.`],
  };
  return labels[item.type]?.[vi ? 0 : 1] ?? (vi ? "Bạn có hoạt động mới." : "You have new activity.");
}

export function buildDigest(items: DigestItem[], locale: string, appUrl: string, unsubscribeUrl: string) {
  const vi = locale === "vi";
  const subject = vi ? "Tương tác mới của bạn trên Corelia" : "Your new activity on Corelia";
  const bodyHtml = `<ul>${items.slice(0, 10).map(item => {
    const path = String(item.payload.target_path ?? "/notifications");
    const safePath = /^\/(?![\\/])/.test(path) && !/[\\\x00-\x1f]/.test(path) ? path : "/notifications";
    return `<li><a href="${escapeHtml(appUrl + safePath)}">${escapeHtml(digestText(item, locale))}</a></li>`;
  }).join("")}</ul>`;
  return { subject, html: renderTransactionalEmail({ locale, heroTag: "Corelia", heroTitle: subject, bodyHtml,
    ctaHtml: emailCtaButton(`${appUrl}/notifications`, vi ? "Xem thông báo" : "View notifications"),
    footerExtraHtml: `<a href="${escapeHtml(unsubscribeUrl)}">${vi ? "Hủy nhận email tổng hợp" : "Unsubscribe from activity emails"}</a>`,
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

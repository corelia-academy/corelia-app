import { isAuthFailure } from "../lib/authz.ts";
import { generateDeterministicUuid } from "../lib/crypto.ts";
import { json } from "../lib/http.ts";
import { buildHackathonWinnerAwardEmail } from "../lib/mail/hackathon_winner_award_body.ts";
import { resolveAppUrl } from "../lib/mail/layout.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

interface AwardItem {
  project_id: string;
  label: string;
}

export async function handleHackathonWinnerAwardNotify(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const sender = await verifyBearerUser(req, db);

    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", sender.id)
      .maybeSingle();
    const role = String(profile?.role ?? "");
    if (role !== "admin" && role !== "support_staff") {
      return json({ message: "forbidden" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const hackathonId = String(body.hackathon_id ?? "").trim();
    const rawAwards = body.awards;

    if (!hackathonId || !Array.isArray(rawAwards) || rawAwards.length === 0) {
      return json({ message: "missing_fields:hackathon_id,awards" }, 400);
    }

    const { data: hackathonRow, error: hErr } = await db
      .from("hackathons")
      .select("id, document")
      .eq("id", hackathonId)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!hackathonRow) return json({ message: "hackathon_not_found" }, 404);

    const hDoc = (hackathonRow.document ?? {}) as Record<string, unknown>;
    const hackathonTitle =
      typeof hDoc.title === "string" && hDoc.title.trim()
        ? hDoc.title.trim()
        : "Hackathon";
    const hackathonSlug = typeof hDoc.slug === "string" ? hDoc.slug.trim() : "";
    const appOrigin = resolveAppUrl();
    const defaultHackathonHref = hackathonSlug
      ? `${appOrigin}/hackathons/${encodeURIComponent(hackathonSlug)}`
      : "";

    let notifiedCount = 0;
    let emailsSentCount = 0;

    for (const item of rawAwards) {
      const award = item as Partial<AwardItem>;
      const projectId = String(award.project_id ?? "").trim();
      const awardLabel = String(award.label ?? "").trim();
      if (!projectId || !awardLabel) continue;

      const { data: project, error: pErr } = await db
        .from("projects")
        .select("id, title, slug, owner_id, source_id")
        .eq("id", projectId)
        .maybeSingle();
      if (pErr || !project) continue;
      if (String(project.source_id ?? "") !== hackathonId) {
        console.warn(`[winner_award_notify] project ${projectId} does not belong to hackathon ${hackathonId}`);
        continue;
      }

      const projectTitle = String(project.title ?? "").trim() || "Project";
      const projectSlug = String(project.slug ?? "").trim();
      const awardHref = projectSlug
        ? `${appOrigin}/projects/${encodeURIComponent(projectSlug)}`
        : hackathonSlug
          ? `${appOrigin}/hackathons/${encodeURIComponent(hackathonSlug)}/projects`
          : defaultHackathonHref;

      const { data: collabs } = await db
        .from("project_collaborators")
        .select("user_id")
        .eq("project_id", projectId);

      const targetUserIds = new Set<string>();
      if (project.owner_id) targetUserIds.add(project.owner_id);
      if (Array.isArray(collabs)) {
        for (const c of collabs) {
          if (c.user_id) targetUserIds.add(c.user_id);
        }
      }

      for (const userId of targetUserIds) {
        const deterministicNotifId = await generateDeterministicUuid(
          `hackathon_winner_award:${hackathonId}:${projectId}:${userId}:${awardLabel.trim().toLowerCase()}`
        );

        // Check deduplication so saving multiple times does not spam
        const { data: existingNotif } = await db
          .from("user_notifications")
          .select("id, payload")
          .eq("user_id", userId)
          .eq("type", "hackathon_winner_award")
          .contains("payload", {
            hackathon_id: hackathonId,
            project_id: projectId,
            award_label: awardLabel,
          })
          .maybeSingle();

        let notifId = (existingNotif?.id as string | undefined) ?? null;
        let existingPayload = (existingNotif?.payload ?? {}) as Record<string, unknown>;
        let isFirstInsert = false;

        if (!notifId) {
          const nowIso = new Date().toISOString();
          const candidatePayload = {
            hackathon_id: hackathonId,
            hackathon_title: hackathonTitle,
            hackathon_slug: hackathonSlug,
            project_id: projectId,
            project_title: projectTitle,
            project_slug: projectSlug,
            award_label: awardLabel,
            email_sent: false,
            email_sending: true,
            email_lock_at: nowIso,
          };

          // True DB-level atomic insertion using deterministic primary key:
          // If another concurrent worker attempts to insert simultaneously, PostgreSQL's
          // PRIMARY KEY (id) constraint enforces that exactly ONE worker succeeds.
          const { data: insData, error: insErr } = await db
            .from("user_notifications")
            .insert({
              id: deterministicNotifId,
              user_id: userId,
              type: "hackathon_winner_award",
              payload: candidatePayload,
            })
            .select("id")
            .maybeSingle();

          if (insErr) {
            // Check if error was due to unique violation (duplicate primary key 23505)
            // If so, another concurrent worker won the race and created the notification!
            const isDuplicateKey = (insErr as { code?: string })?.code === "23505" ||
              insErr.message?.includes("duplicate key") ||
              insErr.message?.includes("user_notifications_pkey");

            if (isDuplicateKey) {
              const { data: winnerNotif } = await db
                .from("user_notifications")
                .select("id, payload")
                .eq("id", deterministicNotifId)
                .maybeSingle();

              if (!winnerNotif) {
                continue;
              }
              notifId = winnerNotif.id;
              existingPayload = (winnerNotif.payload ?? {}) as Record<string, unknown>;
            } else {
              console.error("[winner_award_notify] insert notification failed:", insErr);
              continue;
            }
          } else {
            notifId = (insData?.id as string | undefined) ?? deterministicNotifId;
            notifiedCount++;
            isFirstInsert = true;
          }
        }

        if (!isFirstInsert) {
          if (existingPayload.email_sent === true) {
            continue;
          }

          const now = Date.now();
          const IN_FLIGHT_TIMEOUT_MS = 30_000;
          if (existingPayload.email_sending === true) {
            const lockAt = typeof existingPayload.email_lock_at === "string"
              ? Date.parse(existingPayload.email_lock_at)
              : 0;
            if (!lockAt || now - lockAt < IN_FLIGHT_TIMEOUT_MS) {
              // Already being sent by another concurrent call
              continue;
            }
          }

          // DB-level atomic compare-and-set lock:
          const lockAtIso = new Date().toISOString();
          const staleThresholdIso = new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS).toISOString();
          const { data: lockedRows, error: lockErr } = await db
            .from("user_notifications")
            .update({
              payload: {
                ...(existingPayload ?? {}),
                hackathon_id: hackathonId,
                hackathon_title: hackathonTitle,
                hackathon_slug: hackathonSlug,
                project_id: projectId,
                project_title: projectTitle,
                project_slug: projectSlug,
                award_label: awardLabel,
                email_sending: true,
                email_lock_at: lockAtIso,
              },
            })
            .eq("id", notifId)
            .or(`payload->>email_sending.is.null,payload->>email_sending.eq.false,payload->>email_lock_at.lt.${staleThresholdIso}`)
            .select("id");

          if (lockErr || !lockedRows || !Array.isArray(lockedRows) || lockedRows.length === 0) {
            // Concurrent invocation acquired the lock -> skip
            continue;
          }
        }

        // Lookup recipient email & locale
        const { data: prof } = await db
          .from("profiles")
          .select("email, locale")
          .eq("id", userId)
          .maybeSingle();

        let recipientEmail = prof?.email?.trim() ?? "";
        let locale = (prof?.locale ?? "").toString();

        if (!recipientEmail) {
          const { data: authUser } = await db.auth.admin.getUserById(userId);
          recipientEmail = authUser?.user?.email?.trim() ?? "";
          if (!locale) {
            const userMeta = authUser?.user?.user_metadata;
            if (
              userMeta &&
              typeof userMeta === "object" &&
              "locale" in userMeta &&
              typeof (userMeta as { locale?: unknown }).locale === "string"
            ) {
              locale = (userMeta as { locale: string }).locale;
            }
          }
        }

        if (recipientEmail) {

          const { subject, html } = buildHackathonWinnerAwardEmail({
            hackathonTitle,
            projectTitle,
            awardLabel,
            hackathonHref: awardHref,
            locale,
          });

          const mailResult = await sendTransactionalEmailViaResend({
            db,
            mailType: "hackathon_winner_award",
            to: [recipientEmail],
            subject,
            html,
          });

          if ("sent" in mailResult && mailResult.sent) {
            emailsSentCount++;
            if (notifId) {
              let updated = false;
              for (let attempt = 0; attempt < 3; attempt++) {
                const { error: updErr } = await db
                  .from("user_notifications")
                  .update({
                    payload: {
                      ...(existingPayload ?? {}),
                      hackathon_id: hackathonId,
                      hackathon_title: hackathonTitle,
                      hackathon_slug: hackathonSlug,
                      project_id: projectId,
                      project_title: projectTitle,
                      project_slug: projectSlug,
                      award_label: awardLabel,
                      email_sent: true,
                      email_sending: false,
                      email_sent_at: new Date().toISOString(),
                    },
                  })
                  .eq("id", notifId);

                if (!updErr) {
                  updated = true;
                  break;
                }
                await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
              }
              if (!updated) {
                // Residual edge case: Resend accepted the email, but DB update retries failed.
                // The in-app lock remains active until the 30s stale threshold expires.
                // A subsequent retry after 30s could re-read email_sent=false and dispatch a duplicate email
                // (inherent distributed transaction limitation between external email provider and local DB).
                console.error(`[winner_award_notify] failed to update notification payload after email sent to ${recipientEmail}`);
              }
            }
          } else {
            if ("providerError" in mailResult && mailResult.providerError) {
              console.error(
                `[winner_award_notify] send email failed for recipient ${recipientEmail}: status ${mailResult.httpStatus}`,
                mailResult.body,
              );
            }
            if (notifId) {
              await db
                .from("user_notifications")
                .update({
                  payload: {
                    ...(existingPayload ?? {}),
                    hackathon_id: hackathonId,
                    hackathon_title: hackathonTitle,
                    hackathon_slug: hackathonSlug,
                    project_id: projectId,
                    project_title: projectTitle,
                    project_slug: projectSlug,
                    award_label: awardLabel,
                    email_sending: false,
                    email_last_attempt_at: new Date().toISOString(),
                  },
                })
                .eq("id", notifId);
            }
          }
        }
      }
    }

    return json({ ok: true, notified_count: notifiedCount, emails_sent_count: emailsSentCount }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (isAuthFailure(msg)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] hackathons.winnerAwards.notify", e);
    return json({ message: "internal_error" }, 500);
  }
}

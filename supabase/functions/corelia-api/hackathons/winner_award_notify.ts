import { isAuthFailure } from "../lib/authz.ts";
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
    const hackathonHref = hackathonSlug
      ? `${appOrigin}/hackathons/${encodeURIComponent(hackathonSlug)}`
      : "";

    let notifiedCount = 0;

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
        // Check deduplication so saving multiple times does not spam
        const { data: existingNotif } = await db
          .from("user_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "hackathon_winner_award")
          .contains("payload", {
            hackathon_id: hackathonId,
            project_id: projectId,
            award_label: awardLabel,
          })
          .maybeSingle();

        if (existingNotif) {
          continue;
        }

        const { error: insErr } = await db.from("user_notifications").insert({
          user_id: userId,
          type: "hackathon_winner_award",
          payload: {
            hackathon_id: hackathonId,
            hackathon_title: hackathonTitle,
            hackathon_slug: hackathonSlug,
            project_id: projectId,
            project_title: projectTitle,
            project_slug: projectSlug,
            award_label: awardLabel,
          },
        });
        if (insErr) {
          console.error("[winner_award_notify] insert notification failed:", insErr);
          continue;
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
            hackathonHref,
            locale,
          });

          await sendTransactionalEmailViaResend({
            db,
            mailType: "hackathon_winner_award",
            to: [recipientEmail],
            subject,
            html,
          });
        }

        notifiedCount++;
      }
    }

    return json({ ok: true, notified_count: notifiedCount }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (isAuthFailure(msg)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] hackathons.winnerAwards.notify", e);
    return json({ message: "internal_error" }, 500);
  }
}

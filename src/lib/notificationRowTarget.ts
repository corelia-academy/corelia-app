import { notificationTarget } from "@/lib/notificationTarget";
import type { UserNotificationRow } from "@/lib/notifications";

export type NotificationRowTarget = { kind: "internal"; to: string } | { kind: "external"; href: string };

const str = (p: Record<string, unknown>, k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
const internalPath = (p: Record<string, unknown>, k: string, fallback: string) => {
  const v = str(p, k);
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
};

export function notificationRowTarget(n: UserNotificationRow, ctx: { achievementsPath: string; ocCredentialUrl: string | null; projectSlug?: string | null }): NotificationRowTarget | null {
  const p = n.payload;
  if (n.group_key) return { kind: "internal", to: notificationTarget(p) };
  switch (n.type) {
    case "project_collaboration_invite": return ctx.projectSlug ? { kind: "internal", to: `/projects/${encodeURIComponent(ctx.projectSlug)}` } : null;
    case "co_instructor_invite": { const id = str(p, "course_id"); return id ? { kind: "internal", to: `/courses/${encodeURIComponent(id)}` } : null; }
    case "hackathon_registration_approved":
    case "hackathon_registration_rejected": { const slug = str(p, "hackathon_slug"); return slug ? { kind: "internal", to: `/hackathons/${slug}` } : null; }
    case "hackathon_winner_award": {
      const project = str(p, "project_slug"), hackathon = str(p, "hackathon_slug");
      return project ? { kind: "internal", to: `/projects/${project}` } : hackathon ? { kind: "internal", to: `/hackathons/${hackathon}/projects` } : null;
    }
    case "course_announcement": return { kind: "internal", to: internalPath(p, "target_path", `/courses/${encodeURIComponent(str(p, "course_id"))}`) };
    case "course_completed":
    case "course_certificate_issued": return { kind: "internal", to: internalPath(p, "target_path", ctx.achievementsPath) };
    case "oc_credential_minted": return ctx.ocCredentialUrl ? { kind: "external", href: ctx.ocCredentialUrl } : { kind: "internal", to: "/achievements" };
    case "project_auto_hidden": return { kind: "internal", to: notificationTarget(p) };
    default: return null;
  }
}

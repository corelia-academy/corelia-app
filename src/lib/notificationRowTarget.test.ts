import { describe, expect, it } from "vitest";
import type { UserNotificationRow } from "@/lib/notifications";
import { notificationRowTarget } from "./notificationRowTarget";

const ctx = { achievementsPath: "/@learner", ocCredentialUrl: null as string | null };
const row = (type: string, payload: Record<string, unknown> = {}, group_key: string | null = null) => ({ id: "1", user_id: "u", type, payload, read_at: null, resolved_at: null, created_at: "2026-10-13T00:00:00Z", activity_at: "2026-10-13T00:00:00Z", group_key }) as UserNotificationRow;

describe("notificationRowTarget", () => {
  it("sends social rows to their target path", () => {
    expect(notificationRowTarget(row("project_liked", { target_path: "/projects/a" }, "g1"), ctx)).toEqual({ kind: "internal", to: "/projects/a" });
  });

  it("maps invite, hackathon and course rows to the page they describe", () => {
    expect(notificationRowTarget(row("co_instructor_invite", { course_id: "c 1" }), ctx)).toEqual({ kind: "internal", to: "/courses/c%201" });
    expect(notificationRowTarget(row("hackathon_registration_approved", { hackathon_slug: "stellar" }), ctx)).toEqual({ kind: "internal", to: "/hackathons/stellar" });
    expect(notificationRowTarget(row("hackathon_winner_award", { project_slug: "pact", hackathon_slug: "stellar" }), ctx)).toEqual({ kind: "internal", to: "/projects/pact" });
    expect(notificationRowTarget(row("hackathon_winner_award", { hackathon_slug: "stellar" }), ctx)).toEqual({ kind: "internal", to: "/hackathons/stellar/projects" });
    expect(notificationRowTarget(row("course_completed"), ctx)).toEqual({ kind: "internal", to: "/@learner" });
    expect(notificationRowTarget(row("course_announcement", { course_id: "c1", target_path: "//evil" }), ctx)).toEqual({ kind: "internal", to: "/courses/c1" });
  });

  it("opens external credentials in a new tab and falls back to achievements", () => {
    expect(notificationRowTarget(row("oc_credential_minted"), { ...ctx, ocCredentialUrl: "https://explorer.example/x" })).toEqual({ kind: "external", href: "https://explorer.example/x" });
    expect(notificationRowTarget(row("oc_credential_minted"), ctx)).toEqual({ kind: "internal", to: "/achievements" });
  });

  it("sends project invites to the project once its slug is known", () => {
    expect(notificationRowTarget(row("project_collaboration_invite", { project_id: "p" }), { ...ctx, projectSlug: "pact" })).toEqual({ kind: "internal", to: "/projects/pact" });
  });

  it("has no destination for unreadable project invites or unknown types", () => {
    expect(notificationRowTarget(row("project_collaboration_invite", { project_id: "p" }), ctx)).toBeNull();
    expect(notificationRowTarget(row("something_new"), ctx)).toBeNull();
    expect(notificationRowTarget(row("hackathon_registration_approved"), ctx)).toBeNull();
  });
});

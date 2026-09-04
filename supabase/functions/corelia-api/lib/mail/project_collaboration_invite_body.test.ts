import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProjectCollaborationInviteEmail } from "./project_collaboration_invite_body.ts";

describe("buildProjectCollaborationInviteEmail", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "https://app.corelia.academy" } });
  });
  it("builds Vietnamese email correctly", () => {
    const result = buildProjectCollaborationInviteEmail({
      projectTitle: "AI Chatbot",
      inviterName: "Nguyen Van A",
      inviteUrl: "https://corelia.academy/invites/project/tok123",
      expiresAt: new Date("2026-10-01T00:00:00Z"),
      locale: "vi",
    });

    expect(result.subject).toContain("Bạn được mời tham gia dự án — AI Chatbot");
    expect(result.html).toContain("AI Chatbot");
    expect(result.html).toContain("Nguyen Van A");
    expect(result.html).toContain("https://corelia.academy/invites/project/tok123");
    expect(result.html).toContain("Xem và phản hồi lời mời");
  });

  it("builds English email correctly", () => {
    const result = buildProjectCollaborationInviteEmail({
      projectTitle: "Web3 Wallet",
      inviterName: "Alice Smith",
      inviteUrl: "https://corelia.academy/invites/project/tok456",
      expiresAt: new Date("2026-10-01T00:00:00Z"),
      locale: "en",
    });

    expect(result.subject).toContain("You're invited to join a project — Web3 Wallet");
    expect(result.html).toContain("Web3 Wallet");
    expect(result.html).toContain("Alice Smith");
    expect(result.html).toContain("https://corelia.academy/invites/project/tok456");
    expect(result.html).toContain("Review invite");
  });

  it("handles fallback values gracefully for Vietnamese", () => {
    const result = buildProjectCollaborationInviteEmail({
      projectTitle: "",
      inviterName: "",
      inviteUrl: "https://corelia.academy/invites/project/tok789",
      expiresAt: new Date("2026-10-01T00:00:00Z"),
      locale: "vi",
    });

    expect(result.subject).toContain("dự án");
    expect(result.html).toContain("Một thành viên");
  });

  it("handles fallback values gracefully for default locale", () => {
    const result = buildProjectCollaborationInviteEmail({
      projectTitle: "",
      inviterName: "",
      inviteUrl: "https://corelia.academy/invites/project/tok789",
      expiresAt: new Date("2026-10-01T00:00:00Z"),
      locale: null,
    });

    expect(result.subject).toContain("a project");
    expect(result.html).toContain("A team member");
  });
});

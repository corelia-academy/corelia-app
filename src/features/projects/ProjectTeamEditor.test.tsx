// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectTeamEditor } from "./ProjectTeamEditor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  listProjectCollaborators,
  listProjectCollaborationInvites,
  listCollaborationProfiles,
  listProjectTeamCandidates,
  sendProjectCollaborationInviteEmail,
  revokeProjectCollaborationInvite,
  removeProjectCollaborator,
  toastSuccess,
  toastError,
  toastInfo,
} = vi.hoisted(() => ({
  listProjectCollaborators: vi.fn(),
  listProjectCollaborationInvites: vi.fn(),
  listCollaborationProfiles: vi.fn(),
  listProjectTeamCandidates: vi.fn(),
  sendProjectCollaborationInviteEmail: vi.fn(),
  revokeProjectCollaborationInvite: vi.fn(),
  removeProjectCollaborator: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
  },
}));

vi.mock("@/lib/projectCollaboration", () => ({
  listProjectCollaborators,
  listProjectCollaborationInvites,
  listCollaborationProfiles,
  listProjectTeamCandidates,
  sendProjectCollaborationInviteEmail,
  revokeProjectCollaborationInvite,
  removeProjectCollaborator,
  createProjectCollaborationInvite: vi.fn(),
}));

describe("ProjectTeamEditor UI resend email", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    listProjectCollaborators.mockResolvedValue([]);
    listProjectTeamCandidates.mockResolvedValue([]);
    listCollaborationProfiles.mockResolvedValue({
      "user-invitee-1": {
        id: "user-invitee-1",
        username: "testinvitee",
        full_name: "Test Invitee",
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders pending invites with Resend Email button and calls API on click", async () => {
    listProjectCollaborationInvites.mockResolvedValue([
      {
        id: "invite-123",
        project_id: "proj-1",
        invitee_user_id: "user-invitee-1",
        invited_by: "user-inviter-1",
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
      },
    ]);

    sendProjectCollaborationInviteEmail.mockResolvedValue({
      ok: true,
      email_sent: true,
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectTeamEditor
            projectId="proj-1"
            sourceType="hackathon"
            persisted={true}
          />
        </QueryClientProvider>,
      );
    });

    // Wait for queries to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("projects.team.resendEmail"),
    );
    expect(resendBtn).toBeDefined();

    // Click Resend Email button
    await act(async () => {
      resendBtn?.click();
    });

    expect(sendProjectCollaborationInviteEmail).toHaveBeenCalledWith({
      inviteId: "invite-123",
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(toastSuccess).toHaveBeenCalledWith("projects.team.emailSent");
  });

  it("handles rate limited retry error gracefully", async () => {
    listProjectCollaborationInvites.mockResolvedValue([
      {
        id: "invite-123",
        project_id: "proj-1",
        invitee_user_id: "user-invitee-1",
        invited_by: "user-inviter-1",
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
        resolved_at: null,
      },
    ]);

    sendProjectCollaborationInviteEmail.mockRejectedValue(new Error("rate_limited:try_again_later"));

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectTeamEditor
            projectId="proj-1"
            sourceType="hackathon"
            persisted={true}
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const resendBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("projects.team.resendEmail"),
    );

    await act(async () => {
      resendBtn?.click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(toastError).toHaveBeenCalledWith("projects.team.emailRateLimited");
  });
});

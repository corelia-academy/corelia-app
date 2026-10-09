// @vitest-environment happy-dom
import { act } from "react";
import { useState } from "react";
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
  createProjectCollaborationInvite,
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
  createProjectCollaborationInvite: vi.fn(),
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
  createProjectCollaborationInvite,
  sendProjectCollaborationInviteEmail,
  revokeProjectCollaborationInvite,
  removeProjectCollaborator,
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
    removeProjectCollaborator.mockResolvedValue(undefined);
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

  it("asks before removing a member and uses direct current-team wording", async () => {
    listProjectCollaborators.mockResolvedValue([{ user_id: "user-member-1" }]);
    listProjectCollaborationInvites.mockResolvedValue([]);
    listCollaborationProfiles.mockResolvedValue({
      "user-member-1": { id: "user-member-1", username: "member", full_name: "Team Member" },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectTeamEditor projectId="proj-1" sourceType="hackathon" persisted={true} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const removeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("projects.team.remove"),
    );
    expect(removeButton).toBeDefined();
    await act(async () => removeButton?.click());

    const dialog = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    expect(dialog.textContent).toContain("projects.team.removeMemberConfirm");
    expect(removeProjectCollaborator).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("projects.team.removeMemberAction"),
      )?.click();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(removeProjectCollaborator).toHaveBeenCalledWith("proj-1", "user-member-1");
  });

  it("searches beyond the first 50 candidates by @username and can invite the result", async () => {
    listProjectCollaborationInvites.mockResolvedValue([]);
    listProjectTeamCandidates.mockImplementation(async ({ search }: { search?: string }) => {
      if (search === "trieuquocbao") {
        return [{ user_id: "user-76", username: "trieuquocbao", full_name: "Triệu Quốc Bảo" }];
      }
      return Array.from({ length: 50 }, (_, index) => ({
        user_id: `user-${index}`,
        username: `user${index}`,
        full_name: `User ${index}`,
      }));
    });
    createProjectCollaborationInvite.mockResolvedValue({ invite_id: "invite-76", token: "token" });

    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}>
        <ProjectTeamEditor projectId="proj-1" sourceType="hackathon" persisted />
      </QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("projects.team.placeholder"))?.click();
    });
    const dialog = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    const input = dialog.querySelector("input") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "@trieuquocbao");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

    expect(listProjectTeamCandidates).toHaveBeenCalledWith(expect.objectContaining({ search: "trieuquocbao" }));
    const candidate = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("@trieuquocbao"));
    expect(candidate, dialog.textContent ?? "").toBeDefined();
    await act(async () => { candidate?.click(); });
    expect(createProjectCollaborationInvite).toHaveBeenCalledWith("proj-1", "user-76");
  });

  it("keeps selected names when searching for another candidate before saving", async () => {
    listProjectTeamCandidates.mockImplementation(async ({ search }: { search?: string }) => {
      if (search === "second") return [{ user_id: "second", username: "second", full_name: "Second Member" }];
      return [{ user_id: "first", username: "first", full_name: "First Member" }];
    });
    function DraftTeam() {
      const [selectedIds, setSelectedIds] = useState<string[]>([]);
      return <><ProjectTeamEditor projectId="proj-1" sourceType="hackathon" persisted={false} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} /><output data-testid="selected">{selectedIds.join(",")}</output></>;
    }
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}><DraftTeam /></QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("projects.team.placeholder"))?.click();
    });
    const dialog = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("First Member"))?.click();
    });
    const input = dialog.querySelector("input") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "second");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const second = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("Second Member"));
    expect(second, dialog.textContent ?? "").toBeDefined();
    await act(async () => {
      second?.click();
    });
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe("first,second");
    expect(container.textContent).toContain("First Member");
    expect(container.textContent, dialog.textContent ?? "").toContain("Second Member");
  });

  it("shows a load error inside the member picker", async () => {
    listProjectTeamCandidates.mockRejectedValue(new Error("network failure"));
    listProjectCollaborationInvites.mockResolvedValue([]);
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}>
        <ProjectTeamEditor projectId="proj-1" sourceType="hackathon" persisted />
      </QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("projects.team.placeholder"))?.click();
    });
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe("projects.team.loadError");
  });
  it("blocks invitations at six people but keeps member removal available", async () => {
    listProjectCollaborators.mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({ user_id: `member-${index}` })));
    listProjectCollaborationInvites.mockResolvedValue([]);
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}>
        <ProjectTeamEditor projectId="proj-1" sourceType="standalone" persisted />
      </QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(container.textContent).toContain("projects.team.full");
    expect(Array.from(container.querySelectorAll("button")).some(button => button.textContent?.includes("projects.team.placeholder"))).toBe(false);
    expect(Array.from(container.querySelectorAll("button")).filter(button => button.textContent?.includes("projects.team.remove"))).toHaveLength(5);
  });

  it("rejects a sixth collaborator selection before saving", async () => {
    const change = vi.fn();
    listProjectTeamCandidates.mockResolvedValue([{ user_id: "sixth", username: "sixth", full_name: "Sixth Member" }]);
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}>
        <ProjectTeamEditor projectId="proj-1" sourceType="standalone" persisted={false} selectedIds={["a", "b", "c", "d", "e"]} onSelectedIdsChange={change} />
      </QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("projects.team.placeholder"))?.click();
    });
    const dialog = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find(button => button.textContent?.includes("Sixth Member"))?.click();
    });
    expect(change).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("projects.team.full");
  });

  it("shows a localized error when another member fills the last seat", async () => {
    listProjectCollaborationInvites.mockResolvedValue([]);
    listProjectTeamCandidates.mockResolvedValue([{ user_id: "candidate", username: "candidate", full_name: "Candidate" }]);
    createProjectCollaborationInvite.mockRejectedValue(new Error("conflict:project_team_full"));
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}>
        <ProjectTeamEditor projectId="proj-1" sourceType="standalone" persisted />
      </QueryClientProvider>);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("projects.team.placeholder"))?.click();
    });
    const dialog = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find(button => button.textContent?.includes("Candidate"))?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(toastError).toHaveBeenCalledWith("projects.team.full");
  });

});

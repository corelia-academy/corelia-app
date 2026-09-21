// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSelfLeaveButton } from "./ProjectSelfLeaveButton";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { leaveProject, toastSuccess, toastError } = vi.hoisted(() => ({
  leaveProject: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/projectCollaboration", () => ({ leaveProject }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("ProjectSelfLeaveButton", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    leaveProject.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function openConfirmation() {
    await act(async () => {
      container.querySelector("button")!.click();
    });
    return document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
  }

  it("confirms, leaves the selected project, and refreshes the parent", async () => {
    const onLeft = vi.fn();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectSelfLeaveButton projectId="project-a" onLeft={onLeft} />
        </QueryClientProvider>,
      );
    });

    const dialog = await openConfirmation();
    expect(dialog.textContent).toContain("projects.team.leaveProjectConfirm");

    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("projects.team.leaveProjectAction"))!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(leaveProject).toHaveBeenCalledWith("project-a");
    expect(onLeft).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalledWith("projects.team.leftProject");
  });

  it("does not call the API when the confirmation is cancelled", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectSelfLeaveButton projectId="project-a" />
        </QueryClientProvider>,
      );
    });

    const dialog = await openConfirmation();
    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("actions.cancel"))!.click();
    });

    expect(leaveProject).not.toHaveBeenCalled();
  });

  it("shows a localized failure without exposing the database error", async () => {
    leaveProject.mockRejectedValue(new Error("forbidden:project_owner"));

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectSelfLeaveButton projectId="project-a" />
        </QueryClientProvider>,
      );
    });

    const dialog = await openConfirmation();
    await act(async () => {
      Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("projects.team.leaveProjectAction"))!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(toastError).toHaveBeenCalledWith("projects.team.leaveProjectFailed");
  });
});

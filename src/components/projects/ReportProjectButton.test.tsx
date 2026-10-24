// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ reportProject: vi.fn(), user: { id: "viewer" } as { id: string } | null, toastSuccess: vi.fn() }));
vi.mock("@/lib/projectReports", async () => ({
  ...(await vi.importActual<typeof import("@/lib/projectReports")>("@/lib/projectReports")),
  reportProject: mocks.reportProject,
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { ReportProjectButton } from "./ReportProjectButton";

type ReportedProject = { id: string; owner_id: string; visibility: "public" | "unlisted" | "private"; blocked: boolean };
const project: ReportedProject = { id: "project-1", owner_id: "owner", visibility: "public", blocked: false };

describe("ReportProjectButton", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "viewer" };
    mocks.reportProject.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(props: ReportedProject = project) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={client}><ReportProjectButton project={props} /></QueryClientProvider>));
  }

  it.each([
    ["signed out", null, project],
    ["the owner", { id: "owner" }, project],
    ["a private project", { id: "viewer" }, { ...project, visibility: "private" as const }],
    ["a blocked project", { id: "viewer" }, { ...project, blocked: true }],
  ])("is hidden for %s", async (_label, user, props) => {
    mocks.user = user;
    await render(props);
    expect(container.textContent).toBe("");
  });

  it("sends the selected reason and note", async () => {
    await render();
    await act(async () => container.querySelector("button")!.click());
    const dialog = document.body.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    const select = dialog.querySelector("select") as HTMLSelectElement;
    const textarea = dialog.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "plagiarism");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Copied from my repo");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => Array.from(dialog.querySelectorAll("button")).find(button => button.textContent === "projects.report.submit")!.click());
    expect(mocks.reportProject).toHaveBeenCalledWith("project-1", "plagiarism", "Copied from my repo");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("projects.report.success");
  });
});

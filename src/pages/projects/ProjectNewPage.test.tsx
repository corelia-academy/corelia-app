// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({
  submission: vi.fn(),
  registration: vi.fn(),
  save: vi.fn(),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/lib/hackathons", () => ({
  getContestBySlug: async () => ({ id: "event", slug: "event", title: "Event" }),
  getMyContestRegistration: mocks.registration,
  getMyContestSubmission: mocks.submission,
  upsertContestSubmission: mocks.save,
}));
vi.mock("@/lib/projectSubmission", () => ({ saveProject: mocks.save }));
vi.mock("@/lib/projectCollaboration", () => ({ createProjectCollaborationInvite: vi.fn() }));
vi.mock("@/features/projects/ProjectEditor", () => ({ ProjectEditor: () => <div data-testid="new-editor">New editor</div> }));
import ProjectNewPage from "./ProjectNewPage";

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
function Destination() { return <output>{useLocation().pathname}</output>; }
async function render() {
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/new?hackathon=event"]}><Routes><Route path="/projects/new" element={<ProjectNewPage />} /><Route path="/projects/:id/edit" element={<Destination />} /></Routes></MemoryRouter></QueryClientProvider>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}
beforeEach(() => {
  mocks.registration.mockResolvedValue({ status: "approved" });
  mocks.submission.mockResolvedValue(null);
  mocks.save.mockClear();
});
afterEach(async () => { if (root) await act(async () => root.unmount()); client?.clear(); host?.remove(); });

it("redirects an existing submission to its editor without mounting a blank form or saving", async () => {
  mocks.submission.mockResolvedValue({ project_id: "original-project" });
  await render();
  expect(host.querySelector("output")?.textContent).toBe("/projects/original-project/edit");
  expect(host.querySelector('[data-testid="new-editor"]')).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("keeps creation closed when the existing submission lookup fails", async () => {
  mocks.submission.mockRejectedValue(new Error("connection failed"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("projects.errorDescription");
  expect(host.querySelector('[data-testid="new-editor"]')).toBeNull();
});

it("opens creation only for an eligible owner with no existing submission", async () => {
  await render();
  expect(host.querySelector('[data-testid="new-editor"]')).not.toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("does not open creation for an ineligible registration", async () => {
  mocks.registration.mockResolvedValue({ status: "rejected" });
  await render();
  expect(host.textContent).toContain("projects.form.notEligible");
  expect(host.querySelector('[data-testid="new-editor"]')).toBeNull();
});

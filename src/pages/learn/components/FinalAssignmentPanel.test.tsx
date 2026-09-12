// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { FinalAssignmentPanel } from "./FinalAssignmentPanel";
import type { Course } from "@/types/courses";
import { uploadFinalAssignmentFile } from "@/lib/storage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const translate = (key: string) => key;
vi.mock("react-i18next", async importOriginal => ({ ...await importOriginal<typeof import("react-i18next")>(), useTranslation: () => ({ t: translate }) }));
vi.mock("@/lib/storage", () => ({ uploadFinalAssignmentFile: vi.fn() }));
const course = { final_assignment_title: "Final project", final_assignment_fields: ["notes"] } as Course;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; localStorage.clear(); vi.resetAllMocks(); });

it.each([{ courseId: "second", profileId: "learner" }, { courseId: "first", profileId: "another" }])("resets submission form when scope changes to %j", next => {
    localStorage.setItem("corelia:final-artifacts:learner:first", JSON.stringify({ notes: "First draft" }));
    localStorage.setItem(`corelia:final-artifacts:${next.profileId}:${next.courseId}`, JSON.stringify({ notes: "Second draft" }));
    const container = document.createElement("div");
    const root = createRoot(container);
    cleanup = () => act(() => root.unmount());
    const props = { course, courseId: "first", profileId: "learner", submission: null, translate, onSubmit: vi.fn() };
    act(() => root.render(<FinalAssignmentPanel {...props} />));
    const content = container.querySelector("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(content, "Private first submission");
      content.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => root.render(<FinalAssignmentPanel {...props} {...next} />));
    expect(container.querySelector("textarea")?.value).toBe("");
    expect((container.querySelector("input:not([type=file])") as HTMLInputElement).value).toBe("Second draft");
    act(() => window.dispatchEvent(new CustomEvent("learning:final-artifacts", { detail: { userId: "learner", courseId: "first", artifacts: { notes: "Stale event" } } })));
    expect((container.querySelector("input:not([type=file])") as HTMLInputElement).value).toBe("Second draft");
  });

it("keeps content and request ID for retry after a failed submission", async () => {
  localStorage.setItem("corelia:final-artifacts:learner:first", JSON.stringify({ notes: "My project" }));
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onSubmit = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce(undefined);
  act(() => root.render(<FinalAssignmentPanel course={course} courseId="first" profileId="learner" submission={null} translate={translate} onSubmit={onSubmit} />));
  const content = container.querySelector("textarea")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(content, "My final work");
    content.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Network unavailable");
  expect(content.value).toBe("My final work");
  expect(content.disabled).toBe(true);
  act(() => window.dispatchEvent(new CustomEvent("learning:final-artifacts", { detail: { userId: "learner", courseId: "first", artifacts: { notes: "Later changes" } } })));
  expect((container.querySelector("input:not([type=file])") as HTMLInputElement).value).toBe("My project");
  await act(async () => container.querySelector("button")!.click());
  expect(onSubmit).toHaveBeenCalledTimes(2);
  expect(onSubmit.mock.calls[1][0]).toEqual(onSubmit.mock.calls[0][0]);
  expect(content.value).toBe("");
});

it.each(["submit", "upload"])("reuses successful uploads after %s failure", async failure => {
  localStorage.setItem("corelia:final-artifacts:learner:first", JSON.stringify({ notes: "Project" }));
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  if (failure === "submit") onSubmit.mockRejectedValueOnce(new Error("Response lost"));
  const first = new File(["first"], "first.pdf", { type: "application/pdf" });
  const second = new File(["second"], "second.pdf", { type: "application/pdf" });
  vi.mocked(uploadFinalAssignmentFile).mockResolvedValueOnce({ url: "https://example.com/first", path: "first" });
  if (failure === "upload") vi.mocked(uploadFinalAssignmentFile).mockRejectedValueOnce(new Error("Upload interrupted"));
  vi.mocked(uploadFinalAssignmentFile).mockResolvedValue({ url: "https://example.com/second", path: "second" });
  act(() => root.render(<FinalAssignmentPanel course={course} courseId="first" profileId="learner" submission={null} translate={translate} onSubmit={onSubmit} />));
  const content = container.querySelector("textarea")!;
  const files = container.querySelector('input[type="file"]') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(content, "Complete project");
    content.dispatchEvent(new Event("input", { bubbles: true }));
    Object.defineProperty(files, "files", { value: [first, second], configurable: true });
    files.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => { container.querySelector("button")!.click(); container.querySelector("button")!.click(); });
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  if (failure === "upload") expect(onSubmit).not.toHaveBeenCalled();
  await act(async () => container.querySelector("button")!.click());
  const calls = vi.mocked(uploadFinalAssignmentFile).mock.calls;
  expect(calls.filter(call => call[2] === first)).toHaveLength(1);
  expect(calls.filter(call => call[2] === second)).toHaveLength(failure === "upload" ? 2 : 1);
  expect(onSubmit.mock.lastCall?.[0]).toMatchObject({ content: "Complete project", fileUrls: ["https://example.com/first", "https://example.com/second"] });
  if (failure === "submit") expect(onSubmit.mock.calls[1][0]).toEqual(onSubmit.mock.calls[0][0]);
  expect(content.value).toBe("");
});

it("blocks the submission form until the read succeeds, offers retry, and preserves a draft across read errors", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onSubmit = vi.fn();
  const onRetryLoad = vi.fn();
  const props = { course, courseId: "first", profileId: "learner", submission: null, translate, onSubmit, onRetryLoad };
  act(() => root.render(<FinalAssignmentPanel {...props} submissionState="loading" />));
  expect(container.querySelector("textarea")).toBeNull();
  expect(container.querySelector('[role="status"]')?.textContent).toBe("learning.loading");
  act(() => root.render(<FinalAssignmentPanel {...props} submissionState="error" />));
  expect(container.querySelector("textarea")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("learning.loadError");
  await act(async () => container.querySelector("button")!.click());
  expect(onRetryLoad).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
  act(() => root.render(<FinalAssignmentPanel {...props} submissionState="ready" />));
  const content = container.querySelector("textarea")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(content, "Unsent draft");
    content.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => root.render(<FinalAssignmentPanel {...props} submissionState="error" />));
  act(() => root.render(<FinalAssignmentPanel {...props} submissionState="ready" />));
  expect(container.querySelector("textarea")?.value).toBe("Unsent draft");
  act(() => root.render(<FinalAssignmentPanel {...props} submission={{ status: "pending" }} submissionState="error" />));
  expect(container.textContent).toContain("detail.learn.finalAssignment.status.pending");
  expect(container.querySelector("textarea")).toBeNull();
});

it.each([
  { fields: ["github_url", "notes"], artifacts: { github_url: "https://github.com/example/tasks", notes: "Design decisions" }, enabled: true },
  { fields: ["github_url", "notes"], artifacts: { github_url: "https://github.com/example/tasks" }, enabled: false },
  { fields: ["github_url", "notes"], artifacts: { github_url: "invalid", notes: "Design decisions" }, enabled: false },
  { fields: [], artifacts: { notes: "Draft from a removed field" }, enabled: false },
])("allows artifact-only submissions only when configured requirements are met: %j", async ({ fields, artifacts, enabled }) => {
  localStorage.setItem("corelia:final-artifacts:learner:first", JSON.stringify(artifacts));
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanup = () => act(() => root.unmount());
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const configuredCourse = { ...course, final_assignment_fields: fields } as Course;
  act(() => root.render(<FinalAssignmentPanel course={configuredCourse} courseId="first" profileId="learner" submission={null} translate={translate} onSubmit={onSubmit} />));
  const button = container.querySelector("button")!;
  expect(button.disabled).toBe(!enabled);
  expect(container.querySelector("textarea")!.required).toBe(fields.length === 0);
  expect(container.textContent).toContain(fields.length ? "learning.finalContentOptional" : "learning.finalContentRequired");
  await act(async () => button.click());
  if (enabled) expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ content: "", artifacts }));
  else expect(onSubmit).not.toHaveBeenCalled();
});

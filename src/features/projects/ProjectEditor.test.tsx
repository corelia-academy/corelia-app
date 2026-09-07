// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/projects";
import type { Contest } from "@/types/hackathons";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/hackathons", () => ({ getEffectiveContestSubmissionDeadline: () => null, isPastContestSubmissionDeadline: () => false }));
vi.mock("./ProjectTeamEditor", () => ({ ProjectTeamEditor: () => null }));
vi.mock("./ProjectMediaEditor", () => ({ ProjectMediaEditor: ({ onUploadingChange }: { onUploadingChange: (value: boolean) => void }) => <button type="button" onClick={() => onUploadingChange(true)}>upload-test</button> }));
import { ProjectEditor } from "./ProjectEditor";
const project = { id: "project-1", title: "Original", slug: "original", summary: "Keep description", visibility: "public", screenshot_paths: [], hackathon_track_ids: ["track"], hackathon_sector_ids: ["area"], hackathon_tech_stack_ids: ["tech"] } as unknown as Project;
const contest = { id: "event", slug: "event", title: "Event", tracks: [{ id: "track", name: "Track" }], sectors: [{ id: "area", name: "Area" }], tech_stacks: [{ id: "tech", name: "Tech" }] } as unknown as Contest;
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
async function render(onSave = vi.fn(async () => "original"), editing = true) {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter><ProjectEditor projectId="project-1" userId="user" project={editing ? project : undefined} contest={contest} onSave={onSave} onSaved={vi.fn()} /></MemoryRouter></QueryClientProvider>));
  return onSave;
}
async function input(selector: string, value: string) {
  const element = host.querySelector(selector) as HTMLInputElement;
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,"value")!.set!.call(element,value);
    element.dispatchEvent(new Event("input",{bubbles:true}));
  });
}
async function submit() {
  await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})); await new Promise(resolve => setTimeout(resolve,10)); });
}
afterEach(async () => { if(root) await act(async()=>root.unmount()); client?.clear(); host?.remove(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe("ProjectEditor", () => {
  it("retains entered text and selections when the server rejects a save", async () => {
    const save = await render(vi.fn(async () => { throw new Error("link_unverifiable:demo_url"); }));
    await input("textarea", "Unsaved changes must survive");
    await submit();
    expect(save).toHaveBeenCalledOnce();
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Unsaved changes must survive");
    expect(host.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(3);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("projects.errors.link");
    expect(host.textContent).not.toContain("link_unverifiable");
  });
  it("does not submit while upload is in progress", async () => {
    const save = await render();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='upload-test')!.click());
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
  it("does not submit an incomplete new project and explains required fields", async () => {
    const save = await render(undefined,false);
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("projects.editor.requiredHint");
    await input('input[required]', 'Dự án mới');
    expect((host.querySelector('input[pattern]') as HTMLInputElement).value).toBe('du-an-moi');
  });
  it("asks before leaving a dirty editor and recovers text after remount", async () => {
    await render();
    await input('textarea','Recover this draft');
    const confirm = vi.spyOn(window,'confirm').mockReturnValue(false);
    await act(async()=>host.querySelector('a')!.click());
    expect(confirm).toHaveBeenCalledOnce();
    await act(async()=>root.unmount()); client.clear(); host.remove();
    await render();
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Recover this draft');
    expect(host.textContent).toContain('projects.editor.recovered');
  });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/projects";
import type { Contest } from "@/types/hackathons";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const translate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projectSubmission", () => ({ translateProjectContent: translate }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/hackathons", () => ({ getEffectiveContestSubmissionDeadline: () => null, isPastContestSubmissionDeadline: () => false }));
vi.mock("./ProjectTeamEditor", () => ({ ProjectTeamEditor: () => null }));
vi.mock("./ProjectMediaEditor", () => ({ ProjectMediaEditor: ({ onUploadingChange }: { onUploadingChange: (value: boolean) => void }) => <button type="button" onClick={() => onUploadingChange(true)}>upload-test</button> }));
import { ProjectEditor } from "./ProjectEditor";
const project = { id: "project-1", title: "Original", slug: "original", summary: "Keep description", description: "The problem and solution", progress: "Built a working prototype", video_url: "https://youtu.be/demo", visibility: "public", screenshot_paths: [], hackathon_track_ids: ["track"], hackathon_sector_ids: ["area"], hackathon_tech_stack_ids: ["tech"] } as unknown as Project;
const contest = { id: "event", slug: "event", title: "Event", tracks: [{ id: "track", name: "Track" }], sectors: [{ id: "area", name: "Area" }], tech_stacks: [{ id: "tech", name: "Tech" }] } as unknown as Contest;
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
async function render(onSave = vi.fn(async () => "original"), editing = true, event: Contest | null = contest, initialProject = project) {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter><ProjectEditor projectId="project-1" userId="user" project={editing ? initialProject : undefined} contest={event} onSave={onSave} onSaved={vi.fn()} /></MemoryRouter></QueryClientProvider>));
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
  it.each([['textarea', ''], ['textarea', '   '], ['#project-story textarea', '### ---'], ['#project-story textarea:nth-of-type(1)', '']])("blocks incomplete public content (%s)", async (selector, value) => {
    const save = await render();
    await input(selector,value);
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
  it("requires progress but accepts an idea without resources", async () => {
    const save = await render();
    await input('#project-story > div:last-child textarea','');
    await submit();
    expect(save).not.toHaveBeenCalled();
    await input('#project-story > div:last-child textarea','Built a prototype');
    await input('#project-links input[value="https://youtu.be/demo"]','');
    await submit();
    expect(save).toHaveBeenCalledOnce();
    expect(host.textContent).not.toContain('projects.editor.resourceRequired');
    expect(host.textContent).toContain('projects.editor.optional');
  });

  it("adds optional resources on demand and keeps empty links out of the save", async () => {
    const save = await render(undefined, true, contest, { ...project, video_url: null });
    expect(host.querySelectorAll('#project-links input')).toHaveLength(0);
    await act(async () => (host.querySelector('#project-links button') as HTMLButtonElement).click());
    expect(host.querySelectorAll('#project-links input')).toHaveLength(1);
    await input('#project-links input', 'https://example.com/demo');
    await submit();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ draft: expect.objectContaining({ demo: 'https://example.com/demo', repo: '', slide: '' }) }));
    await act(async () => (host.querySelector('#project-links button[aria-label]') as HTMLButtonElement).click());
    expect(host.querySelectorAll('#project-links input')).toHaveLength(0);
    await submit();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ draft: expect.objectContaining({ demo: '' }) }));
  });

  it("allows an unfinished private draft but blocks changing it to public", async () => {
    const save = await render(undefined, true, null, {...project, summary:"", description:"", visibility:"private"});
    await submit();
    expect(save).toHaveBeenCalledOnce();
    save.mockClear();
    await act(async () => {
      const select = host.querySelector('select')!;
      select.value = 'public';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await submit();
    expect(save).not.toHaveBeenCalled();
  });
  it("formats selected Markdown and previews it without saving or losing the draft", async () => {
    const save = await render();
    await input('#project-story textarea','A useful solution');
    const textarea = host.querySelector('#project-story textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(2,8);
    await act(async () => (host.querySelector('button[aria-label="projects.editor.markdownbold"]') as HTMLButtonElement).click());
    expect(textarea.value).toBe('A **useful** solution');
    await act(async () => Array.from(host.querySelectorAll('[role="tab"]')).find(tab=>tab.textContent==='projects.editor.preview')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    expect(host.querySelector('#project-story strong')?.textContent).toBe('useful');
    expect(save).not.toHaveBeenCalled();
    await act(async () => Array.from(host.querySelectorAll('[role="tab"]')).find(tab=>tab.textContent==='projects.editor.write')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    expect((host.querySelector('#project-story textarea') as HTMLTextAreaElement).value).toBe('A **useful** solution');
  });
  it("does not let toolbar formatting exceed the Markdown limit", async () => {
    await render();
    await input('#project-story textarea','x'.repeat(20000));
    const textarea = host.querySelector('#project-story textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(0,1);
    await act(async () => (host.querySelector('button[aria-label="projects.editor.markdownbold"]') as HTMLButtonElement).click());
    expect(textarea.value).toHaveLength(20000);
  });

  it("blocks oversized restored content even when all required items are complete", async () => {
    const save = await render();
    await input('textarea','x'.repeat(1001));
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('projects.editor.limitHint');
    await input('textarea','x'.repeat(1000));
    await submit();
    expect(save).toHaveBeenCalledOnce();
  });

});

describe("project language editing", () => {
  async function button(text: string) {
    await act(async () => Array.from(host.querySelectorAll("button")).find(item => item.textContent?.includes(text))!.click());
  }
  it("keeps primary and secondary content independent and saves both without changing the slug", async () => {
    const save = await render();
    await button("English");
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
    await input("#project-basics input", "English project");
    await input("textarea", "English summary");
    await button("Tiếng Việt");
    expect((host.querySelector("#project-basics input") as HTMLInputElement).value).toBe("Original");
    expect((host.querySelector("input[pattern]") as HTMLInputElement).value).toBe("original");
    await submit();
    expect((save.mock.calls as unknown as Array<[{ draft: import("./projectEditorDraft").ProjectDraft }]>)[0][0].draft).toMatchObject({ primaryLocale: "vi", title: "Original", locales: { en: { title: "English project", summary: "English summary" } } });
  });
  it("recovers secondary content and validates the selected primary language", async () => {
    const save = await render();
    await button("English");
    await input("textarea", "Recovered English summary");
    await button("projects.translation.makePrimary");
    await submit();
    expect(save).not.toHaveBeenCalled();
    await act(async()=>root.unmount()); client.clear(); host.remove();
    await render();
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Recovered English summary");
    await button("Tiếng Việt");
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Keep description");
  });
  it("previews AI output without saving and rejects applying it after a newer edit", async () => {
    translate.mockResolvedValue({ title: "Translated", summary: "Summary", description: "Story", progress: "Progress" });
    const save = await render();
    await button("projects.translation.translate");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(host.textContent).toContain("projects.translation.preview");
    expect(save).not.toHaveBeenCalled();
    await input("#project-basics input", "New original");
    const apply = Array.from(host.querySelectorAll("button")).find(item => item.textContent === "projects.translation.apply")!;
    expect(apply.disabled).toBe(true);
    expect(host.textContent).toContain("projects.translation.stale");
  });
  it("applies a reviewed translation only to the secondary language", async () => {
    translate.mockResolvedValue({ title: "Translated", summary: "Summary", description: "Story", progress: "Progress" });
    const save = await render();
    await button("projects.translation.translate");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    await button("projects.translation.apply");
    expect((host.querySelector("#project-basics input") as HTMLInputElement).value).toBe("Translated");
    await submit();
    expect((save.mock.calls as unknown as Array<[{ draft: import("./projectEditorDraft").ProjectDraft }]>)[0][0].draft.title).toBe("Original");
    expect((save.mock.calls as unknown as Array<[{ draft: import("./projectEditorDraft").ProjectDraft }]>)[0][0].draft.locales.en?.description).toBe("Story");
  });
});

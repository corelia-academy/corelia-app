// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/projectSubmission", () => ({ uploadProjectMedia: mocks.upload, deleteProjectMedia: mocks.remove }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
import { ProjectMediaEditor, type ProjectMediaItem } from "./ProjectMediaEditor";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let changed: ReturnType<typeof vi.fn>;
function Harness({ initial=[] }: { initial?: ProjectMediaItem[] }) {
  const [screenshots,setScreenshots] = useState(initial);
  const [logo,setLogo] = useState<ProjectMediaItem|null>(null);
  return <ProjectMediaEditor projectId="project" logo={logo} onLogoChange={setLogo} screenshots={screenshots} onScreenshotsChange={value=>{setScreenshots(value);changed(value);}} deleteOnRemove={false} />;
}
async function mount(initial?: ProjectMediaItem[]) {
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>root.render(<Harness initial={initial} />));
}
async function choose(files: File[], screenshots=false) {
  const input=host.querySelector(screenshots?'input[multiple]':'input:not([multiple])') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:files});
  await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));});
}
beforeEach(()=>{vi.clearAllMocks();changed=vi.fn();mocks.upload.mockImplementation(async (_id:string,_kind:string,file:File)=>({path:file.name,signed_url:`https://example.com/${file.name}`}));});
afterEach(async()=>{if(root) await act(async()=>root.unmount());host?.remove();});
describe('ProjectMediaEditor',()=>{
  it('rejects unsupported, empty and oversized logos before calling the server',async()=>{
    await mount();
    await choose([new File(['x'],'test.txt',{type:'text/plain'})]);
    await choose([new File([],'empty.png',{type:'image/png'})]);
    await choose([new File([new Uint8Array(2*1024*1024+1)],'large.png',{type:'image/png'})]);
    expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.error).toHaveBeenCalledTimes(3);
  });
  it('caps a batch at six screenshots',async()=>{
    await mount();
    await choose(Array.from({length:7},(_,i)=>new File(['x'],`${i}.png`,{type:'image/png'})),true);
    expect(mocks.upload).toHaveBeenCalledTimes(6);expect(changed.mock.lastCall?.[0]).toHaveLength(6);expect(mocks.error).toHaveBeenCalledWith('projects.form.screenshotLimit');
  });
  it('keeps successful uploads if a later file fails',async()=>{
    await mount();mocks.upload.mockResolvedValueOnce({path:'one',signed_url:'https://example.com/one'}).mockRejectedValueOnce(new Error('unavailable'));
    await choose([new File(['a'],'1.png',{type:'image/png'}),new File(['b'],'2.png',{type:'image/png'})],true);
    expect(changed.mock.lastCall?.[0]).toEqual([{path:'one',url:'https://example.com/one'}]);
  });
  it('reorders screenshots and defers deletion until the project is saved',async()=>{
    await mount([{path:'one',url:'https://example.com/one'},{path:'two',url:'https://example.com/two'}]);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="projects.form.moveDown"]')!.click());
    expect(changed.mock.lastCall?.[0].map((item:ProjectMediaItem)=>item.path)).toEqual(['two','one']);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="projects.form.remove"]')!.click());
    expect(changed.mock.lastCall?.[0].map((item:ProjectMediaItem)=>item.path)).toEqual(['one']);expect(mocks.remove).not.toHaveBeenCalled();
  });
});

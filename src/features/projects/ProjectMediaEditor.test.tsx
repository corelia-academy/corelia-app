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
function Harness({ initial=[], presentation="default" }: { initial?: ProjectMediaItem[]; presentation?: "default" | "submission" }) {
  const [screenshots,setScreenshots] = useState(initial);
  const [logo,setLogo] = useState<ProjectMediaItem|null>(null);
  return <ProjectMediaEditor projectId="project" logo={logo} onLogoChange={setLogo} screenshots={screenshots} onScreenshotsChange={value=>{setScreenshots(value);changed(value);}} deleteOnRemove={false} presentation={presentation} />;
}
async function mount(initial?: ProjectMediaItem[], presentation?: "default" | "submission") {
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>root.render(<Harness initial={initial} presentation={presentation} />));
}
async function choose(files: File[], screenshots=false) {
  const input=host.querySelector(screenshots?'input[multiple]':'input:not([multiple])') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:files});
  await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));});
}
function dispatchPointerEvent(target: HTMLElement, type: string, values: PointerEventInit) {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, ...values });
  if (values.pointerType !== undefined) Object.defineProperty(event, "pointerType", { value: values.pointerType });
  target.dispatchEvent(event);
}
beforeEach(()=>{vi.clearAllMocks();changed=vi.fn();mocks.upload.mockImplementation(async (_id:string,_kind:string,file:File)=>({path:file.name,signed_url:`https://example.com/${file.name}`}));});
afterEach(async()=>{if(root) await act(async()=>root.unmount());host?.remove();vi.useRealTimers();});
describe('ProjectMediaEditor',()=>{
  it('uses the configured dashed frame for both submission image placeholders',async()=>{
    await mount(undefined, 'submission');
    const frames = [...host.querySelectorAll<HTMLElement>('[data-slot="separator"]')];

    expect(frames).toHaveLength(2);
    expect(frames.map(frame => frame.getAttribute('data-dash-pattern'))).toEqual(['12 4', '12 4']);
  });
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
  it('renders sortable screenshot cards with cover badge and allows removal in submission presentation', async () => {
    await mount(
      [
        { path: 'one.png', url: 'https://example.com/one.png' },
        { path: 'two.png', url: 'https://example.com/two.png' },
      ],
      'submission',
    );
    const cards = host.querySelectorAll('[data-sortable-card]');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain('projects.form.coverImageBadge');
    expect(cards[1]?.textContent).toContain('#2');

    // Remove one item
    await act(async () => {
      cards[0]?.querySelector<HTMLButtonElement>('[aria-label="projects.form.remove"]')?.click();
    });
    expect(changed.mock.lastCall?.[0].map((item: ProjectMediaItem) => item.path)).toEqual(['two.png']);
  });

  it('starts mouse dragging from the image card after the movement threshold', async () => {
    await mount(
      [
        { path: 'one.png', url: 'https://example.com/one.png' },
        { path: 'two.png', url: 'https://example.com/two.png' },
      ],
      'submission',
    );
    const card = host.querySelector<HTMLElement>('[data-sortable-card]')!;

    await act(async () => {
      dispatchPointerEvent(card, 'pointerdown', { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
      dispatchPointerEvent(card, 'pointermove', { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 20, clientY: 10 });
    });

    expect(document.body.querySelector('[class~="fixed"][class~="z-50"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => dispatchPointerEvent(card, 'pointerup', { pointerId: 3, pointerType: 'mouse', button: 0 }));
    expect(document.body.style.overflow).toBe('');
  });

  it('cancels touch drag activation when the finger moves before the hold delay', async () => {
    vi.useFakeTimers();
    await mount([{ path: 'one.png', url: 'https://example.com/one.png' }], 'submission');
    const card = host.querySelector<HTMLElement>('[data-sortable-card]')!;

    await act(async () => {
      dispatchPointerEvent(card, 'pointerdown', { pointerId: 5, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
      dispatchPointerEvent(card, 'pointermove', { pointerId: 5, pointerType: 'touch', button: 0, clientX: 10, clientY: 22 });
      vi.advanceTimersByTime(300);
    });

    expect(document.body.style.overflow).toBe('');
    expect(document.body.querySelector('[class~="fixed"][class~="z-50"]')).toBeNull();
  });

  it('locks page scrolling after the touch hold delay and restores it on pointer cancel', async () => {
    vi.useFakeTimers();
    await mount(
      [
        { path: 'one.png', url: 'https://example.com/one.png' },
        { path: 'two.png', url: 'https://example.com/two.png' },
      ],
      'submission',
    );
    const card = host.querySelector<HTMLElement>('[data-sortable-card]')!;

    await act(async () => {
      dispatchPointerEvent(card, 'pointerdown', { pointerId: 7, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
      vi.advanceTimersByTime(250);
    });
    expect(document.body.style.overflow).toBe('hidden');

    const touchMove = new Event('touchmove', { cancelable: true });
    window.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);

    await act(async () => dispatchPointerEvent(card, 'pointercancel', { pointerId: 7, pointerType: 'touch', button: 0 }));
    expect(document.body.style.overflow).toBe('');
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not start dragging when the remove button is pressed', async () => {
    vi.useFakeTimers();
    await mount([{ path: 'one.png', url: 'https://example.com/one.png' }], 'submission');
    const removeButton = host.querySelector<HTMLButtonElement>('[aria-label="projects.form.remove"]')!;

    await act(async () => {
      dispatchPointerEvent(removeButton, 'pointerdown', { pointerId: 9, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
      vi.advanceTimersByTime(300);
    });

    expect(document.body.style.overflow).toBe('');
    expect(document.body.querySelector('[class~="fixed"][class~="z-50"]')).toBeNull();
  });
});

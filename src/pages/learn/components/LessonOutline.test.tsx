// @vitest-environment happy-dom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LessonOutline } from "./LessonOutline";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const gsapTo = vi.hoisted(() => vi.fn());
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn(), to: gsapTo } }));
vi.mock("gsap/ScrollToPlugin", () => ({ ScrollToPlugin: {} }));

const sizes = { scroll: 0, client: 0 };
const original = {
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight"),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
  matchMedia: window.matchMedia,
  observer: globalThis.ResizeObserver,
};
// Reports once when it starts watching, like the browser one. The empty entry list keeps the dropdown's own observer working.
class FakeResizeObserver {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe() { this.cb([], this as unknown as ResizeObserver); }
  unobserve() {}
  disconnect() {}
}
let cleanup: (() => void) | undefined;
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return (this as HTMLElement).tagName === "MAIN" ? sizes.scroll : 0; } });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return (this as HTMLElement).tagName === "MAIN" ? sizes.client : 0; } });
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = "";
  for (const key of ["scrollHeight", "clientHeight"] as const) {
    if (original[key]) Object.defineProperty(HTMLElement.prototype, key, original[key]!);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
  window.matchMedia = original.matchMedia;
  globalThis.ResizeObserver = original.observer;
  gsapTo.mockClear();
});

type Heading = ["h2" | "h3" | "h4", string];
function Page({ headings, divider = true }: { headings: Heading[]; divider?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <main>
      <div ref={ref}><h1>Title</h1>{headings.map(([Tag, text]) => <Tag key={text}>{text}</Tag>)}</div>
      <LessonOutline bodyRef={ref} lessonId="lesson" withDivider={divider} />
    </main>
  );
}
function mount(headings: Heading[], divider = true) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<Page headings={headings} divider={divider} />));
  return host;
}
const three: Heading[] = [["h2", "Goal"], ["h3", "Setup"], ["h4", "Install"]];
const open = (host: HTMLElement) => {
  const trigger = host.querySelector<HTMLButtonElement>("button")!;
  act(() => {
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    trigger.click();
  });
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]'));
};

it("shows the Content button and a divider when the lesson is longer than one page", () => {
  sizes.scroll = 1600; sizes.client = 700;
  const host = mount(three);
  expect(host.querySelector("button")?.textContent).toBe("learning.outline");
  expect(host.querySelector("button")!.parentElement!.className).toContain("order-first");
  expect(host.querySelector("span[aria-hidden].w-px")).not.toBeNull();
});

it("leaves out the divider when nothing follows it", () => {
  sizes.scroll = 1600; sizes.client = 700;
  const host = mount(three, false);
  expect(host.querySelector("button")).not.toBeNull();
  expect(host.querySelector("span[aria-hidden].w-px")).toBeNull();
});

it("shows nothing when the lesson fits on one page", () => {
  sizes.scroll = 600; sizes.client = 700;
  expect(mount(three).querySelector("button")).toBeNull();
});

it("shows nothing when there is only one heading", () => {
  sizes.scroll = 1600; sizes.client = 700;
  expect(mount([["h2", "Only"]]).querySelector("button")).toBeNull();
});

it("lists the headings, indents them by level and scrolls the lesson to the chosen one", () => {
  sizes.scroll = 1600; sizes.client = 700;
  const host = mount(three);
  const items = open(host);
  expect(items.map(item => item.textContent)).toEqual(["Goal", "Setup", "Install"]);
  expect(items[0].className).not.toContain("pl-xl");
  expect(items[1].className).toContain("pl-xl");
  expect(items[2].className).toContain("pl-3xl");
  act(() => items[1].click());
  const target = host.querySelector("h3");
  expect(gsapTo).toHaveBeenCalledWith(host.querySelector("main"), expect.objectContaining({ scrollTo: { y: target, offsetY: 24 }, duration: 0.6 }));
});

it("shows Content on the first render, without waiting for the resize observer", () => {
  sizes.scroll = 1600; sizes.client = 700;
  globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
  expect(mount(three).querySelector("button")?.textContent).toBe("learning.outline");
});

it("marks the heading the reader is at, and the chosen one at once", () => {
  sizes.scroll = 1600; sizes.client = 700;
  // Runs the frame at once; returning 0 keeps the component's "a frame is pending" flag clear, like a frame that already ran.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const host = mount(three);
  const tops = [-300, -10, 400];
  host.querySelectorAll<HTMLElement>("h2, h3, h4").forEach((el, i) => { el.getBoundingClientRect = () => ({ top: tops[i] }) as DOMRect; });
  host.querySelector("main")!.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  act(() => { host.querySelector("main")!.dispatchEvent(new Event("scroll")); });
  expect(open(host).map(item => item.getAttribute("aria-current"))).toEqual([null, "true", null]);
  act(() => open(host)[2].click());
  expect(open(host).map(item => item.getAttribute("aria-current"))).toEqual([null, null, "true"]);
  vi.unstubAllGlobals();
});

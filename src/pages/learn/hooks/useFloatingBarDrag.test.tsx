// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BAR_DAMPING, useFloatingBarDrag } from "./useFloatingBarDrag"

type SpringCall = {
  from: { x: number; y: number }
  onFrame: (point: { x: number; y: number }) => void
  onDone: () => void
  cancel: ReturnType<typeof vi.fn>
}

const physics = vi.hoisted(() => ({ runSpring: vi.fn() }))

vi.mock("../utils/dockPhysics", async importOriginal => ({
  ...(await importOriginal<typeof import("../utils/dockPhysics")>()),
  runSpring: physics.runSpring,
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const STORAGE_KEY = "learn-dock-bar-v1"
// The bar sits at the bottom centre of a 1000x600 box, so it can travel 400px each way
// horizontally, 520px up and 40px down.
const BAR = { left: 400, top: 520, width: 200, height: 40 }
const layout = { boxWidth: 1000, boxHeight: 600, barHidden: false }

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  observe = vi.fn()
  disconnect = vi.fn()
  callback: () => void
  constructor(callback: () => void) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }
}

let root: Root
let container: HTMLDivElement
let storage: Storage
let springs: SpringCall[]
let restoreProto: Array<() => void>

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function translateOf(el: HTMLElement) {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform)
  return { x: match ? Number(match[1]) : 0, y: match ? Number(match[2]) : 0 }
}

/** happy-dom has no layout, so geometry and pointer-capture methods are patched for the test only. */
function patchProto(props: Record<string, PropertyDescriptor>) {
  for (const [name, descriptor] of Object.entries(props)) {
    const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, ...descriptor })
    restoreProto.push(() => {
      if (saved) Object.defineProperty(HTMLElement.prototype, name, saved)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
    })
  }
}

function installMemoryStorage() {
  const data = new Map<string, string>()
  const memory = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size
    },
  } satisfies Storage
  Object.defineProperty(window, "localStorage", { configurable: true, value: memory })
  return memory
}

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function Harness() {
  const { barRef, gripProps, isMoved, reset } = useFloatingBarDrag()
  return (
    <div data-testid="box">
      <div data-testid="strip">
        <div ref={barRef} data-testid="bar">
          <button type="button" data-testid="grip" {...gripProps}>
            grip
          </button>
          {isMoved && (
            <button type="button" data-testid="reset" onClick={reset}>
              reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const pointer = (type: string, init: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "mouse", button: 0, ...init })

const byId = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const bar = () => byId("bar")!
const grip = () => byId("grip")!

const mount = () => act(async () => root.render(<Harness />))

async function dragGrip(dx: number, dy: number) {
  await act(async () => void grip().dispatchEvent(pointer("pointerdown", { clientX: 500, clientY: 500 })))
  await act(async () => void grip().dispatchEvent(pointer("pointermove", { clientX: 500 + dx, clientY: 500 + dy })))
}

const release = () => act(async () => void grip().dispatchEvent(pointer("pointerup")))

const pressKey = (key: string) =>
  act(async () => void grip().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })))

const savedPosition = () => JSON.parse(storage.getItem(STORAGE_KEY) ?? "null")

beforeEach(() => {
  storage = installMemoryStorage()
  setReducedMotion(false)
  layout.boxWidth = 1000
  layout.boxHeight = 600
  layout.barHidden = false
  springs = []
  restoreProto = []
  FakeResizeObserver.instances = []
  vi.stubGlobal("ResizeObserver", FakeResizeObserver)
  physics.runSpring.mockReset()
  physics.runSpring.mockImplementation((from, onFrame, onDone) => {
    const cancel = vi.fn()
    springs.push({ from, onFrame, onDone, cancel })
    return cancel
  })
  patchProto({
    clientWidth: { get: function (this: HTMLElement) { return this.dataset.testid === "box" ? layout.boxWidth : 0 } },
    clientHeight: { get: function (this: HTMLElement) { return this.dataset.testid === "box" ? layout.boxHeight : 0 } },
    getBoundingClientRect: {
      value: function (this: HTMLElement) {
        if (this.dataset.testid === "box") return rect(0, 0, layout.boxWidth, layout.boxHeight)
        if (this.dataset.testid === "bar" && !layout.barHidden) {
          const { x, y } = translateOf(this)
          return rect(BAR.left + x, BAR.top + y, BAR.left + BAR.width + x, BAR.top + BAR.height + y)
        }
        return rect(0, 0, 0, 0)
      },
      writable: true,
    },
    setPointerCapture: { value: vi.fn(), writable: true },
    hasPointerCapture: { value: () => true, writable: true },
    releasePointerCapture: { value: vi.fn(), writable: true },
  })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  restoreProto.forEach(restore => restore())
  vi.unstubAllGlobals()
})

describe("useFloatingBarDrag", () => {
  it("follows the grip, then shows the reset button and saves the offset as a ratio of the box", async () => {
    await mount()
    expect(byId("reset")).toBeNull()

    await dragGrip(-150, -300)
    expect(translateOf(bar())).toEqual({ x: -150, y: -300 })
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(1)

    await release()
    expect(byId("reset")).not.toBeNull()
    expect(savedPosition()).toEqual({ x: -0.15, y: -0.5 })
  })

  it("keeps the bar inside the box on every side", async () => {
    await mount()
    await dragGrip(-9999, 9999)
    expect(translateOf(bar())).toEqual({ x: -BAR.left, y: layout.boxHeight - (BAR.top + BAR.height) })

    await release()
    await dragGrip(9999, -9999)
    expect(translateOf(bar())).toEqual({ x: layout.boxWidth - (BAR.left + BAR.width), y: -BAR.top })
  })

  it("ignores a drag started with a non-primary mouse button", async () => {
    await mount()
    await act(async () => void grip().dispatchEvent(pointer("pointerdown", { button: 2, clientX: 500, clientY: 500 })))
    await act(async () => void grip().dispatchEvent(pointer("pointermove", { clientX: 300, clientY: 300 })))

    expect(bar().style.transform).toBe("")
  })

  it("springs back to the default place on reset and forgets the saved position", async () => {
    await mount()
    await dragGrip(-150, -300)
    await release()
    await act(async () => byId("reset")!.click())

    expect(physics.runSpring).toHaveBeenCalledTimes(1)
    expect(physics.runSpring).toHaveBeenCalledWith(
      { x: -150, y: -300 },
      expect.any(Function),
      expect.any(Function),
      BAR_DAMPING,
    )
    expect(springs[0].from).toEqual({ x: -150, y: -300 })

    act(() => springs[0].onFrame({ x: -75, y: -150 }))
    expect(translateOf(bar())).toEqual({ x: -75, y: -150 })

    act(() => springs[0].onDone())
    expect(bar().style.transform).toBe("")
    expect(byId("reset")).toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("resets immediately when reduced motion is preferred", async () => {
    setReducedMotion(true)
    await mount()
    await dragGrip(-150, -300)
    await release()
    await act(async () => byId("reset")!.click())

    expect(physics.runSpring).not.toHaveBeenCalled()
    expect(bar().style.transform).toBe("")
    expect(byId("reset")).toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("cancels a running spring when the grip is pressed again", async () => {
    await mount()
    await dragGrip(-150, -300)
    await release()
    await act(async () => byId("reset")!.click())
    await act(async () => void grip().dispatchEvent(pointer("pointerdown", { clientX: 500, clientY: 500 })))

    expect(springs[0].cancel).toHaveBeenCalled()
  })

  it("restores a saved position on mount and shows the reset button", async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ x: 0.1, y: -0.2 }))
    await mount()

    expect(translateOf(bar())).toEqual({ x: 100, y: -120 })
    expect(byId("reset")).not.toBeNull()
  })

  it("clamps a saved position that no longer fits the box", async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ x: 5, y: 0 }))
    await mount()

    expect(translateOf(bar()).x).toBe(layout.boxWidth - (BAR.left + BAR.width))
  })

  it.each([["not json"], ["null"], [JSON.stringify({ x: "a", y: 1 })]])("ignores an unusable saved value (%s)", async raw => {
    storage.setItem(STORAGE_KEY, raw)
    await mount()

    expect(bar().style.transform).toBe("")
    expect(byId("reset")).toBeNull()
  })

  it("nudges 16px per arrow key, stays inside the box and saves the offset", async () => {
    await mount()
    await pressKey("ArrowLeft")
    await pressKey("ArrowLeft")
    expect(translateOf(bar())).toEqual({ x: -32, y: 0 })
    expect(savedPosition()).toEqual({ x: -0.032, y: 0 })

    await pressKey("ArrowDown")
    await pressKey("ArrowDown")
    await pressKey("ArrowDown")
    expect(translateOf(bar()).y).toBe(layout.boxHeight - (BAR.top + BAR.height))

    await pressKey("Enter")
    expect(translateOf(bar()).x).toBe(-32)
  })

  it("does not clamp or crash while the bar is hidden, then clamps once it is visible", async () => {
    layout.barHidden = true
    storage.setItem(STORAGE_KEY, JSON.stringify({ x: 0.9, y: 0 }))
    await mount()
    expect(translateOf(bar()).x).toBe(900)

    layout.barHidden = false
    act(() => FakeResizeObserver.instances[0].callback())
    expect(translateOf(bar()).x).toBe(layout.boxWidth - (BAR.left + BAR.width))
  })

  it("re-clamps when the box shrinks", async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ x: 0.35, y: 0 }))
    await mount()
    expect(translateOf(bar()).x).toBe(350)

    layout.boxWidth = 800
    act(() => FakeResizeObserver.instances[0].callback())
    expect(translateOf(bar()).x).toBe(200)
  })

  it("observes the bar and its box, and disconnects on unmount", async () => {
    await mount()
    const observer = FakeResizeObserver.instances[0]
    expect(observer.observe).toHaveBeenCalledTimes(2)

    await act(async () => root.render(null))
    expect(observer.disconnect).toHaveBeenCalled()
  })
})

// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { rubberBand } from "../utils/dockPhysics"
import { useEdgeTabDrag } from "./useEdgeTabDrag"

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

const STORAGE_KEY = "learn-dock-tab-v1"
const LAYOUT = { parentHeight: 800, tabHeight: 40, defaultTop: 20 }

let root: Root
let container: HTMLDivElement
let storage: Storage
let springs: SpringCall[]
let restoreProto: Array<() => void>

/** happy-dom has no layout, so size getters and pointer-capture methods are patched for the test only. */
function patchProto(patch: { getters?: Record<string, (el: HTMLElement) => number>; values?: Record<string, unknown> }) {
  const define = (name: string, descriptor: PropertyDescriptor) => {
    const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, ...descriptor })
    restoreProto.push(() => {
      if (saved) Object.defineProperty(HTMLElement.prototype, name, saved)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
    })
  }
  for (const [name, read] of Object.entries(patch.getters ?? {})) {
    define(name, { get(this: HTMLElement) { return read(this) } })
  }
  for (const [name, value] of Object.entries(patch.values ?? {})) {
    define(name, { value, writable: true })
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

function Harness({ onClick }: { onClick: () => void }) {
  const { ref, handlers } = useEdgeTabDrag()
  return (
    <div data-testid="parent">
      <div ref={ref} {...handlers} data-testid="wrap">
        <button type="button" onClick={onClick}>
          tab
        </button>
      </div>
    </div>
  )
}

const pointer = (type: string, init: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: "mouse", button: 0, ...init })

const wrap = () => container.querySelector<HTMLElement>('[data-testid="wrap"]')!
const tabButton = () => container.querySelector<HTMLButtonElement>("button")!

/** Horizontal pull in px read back from the wrapper's transform (positive = pulled left). */
function pull() {
  const match = /translate3d\((-?[\d.]+)px/.exec(wrap().style.transform)
  return match ? -Number(match[1]) : 0
}

async function mount(onClick = vi.fn()) {
  await act(async () => root.render(<Harness onClick={onClick} />))
  return onClick
}

async function pressAndMove(to: { x: number; y: number }, from = { x: 1000, y: 100 }) {
  await act(async () => void tabButton().dispatchEvent(pointer("pointerdown", { clientX: from.x, clientY: from.y })))
  await act(async () => void window.dispatchEvent(pointer("pointermove", { clientX: to.x, clientY: to.y })))
}

const release = () => act(async () => void window.dispatchEvent(pointer("pointerup")))

beforeEach(() => {
  storage = installMemoryStorage()
  setReducedMotion(false)
  springs = []
  restoreProto = []
  physics.runSpring.mockReset()
  physics.runSpring.mockImplementation((from, onFrame, onDone) => {
    const cancel = vi.fn()
    springs.push({ from, onFrame, onDone, cancel })
    return cancel
  })
  patchProto({
    getters: {
      clientHeight: el => (el.dataset.testid === "parent" ? LAYOUT.parentHeight : 0),
      offsetHeight: el => (el.dataset.testid === "wrap" ? LAYOUT.tabHeight : 0),
      offsetTop: el => (el.dataset.testid === "wrap" ? Number.parseFloat(el.style.top) || LAYOUT.defaultTop : 0),
    },
    values: {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
    },
  })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  restoreProto.forEach(restore => restore())
})

describe("useEdgeTabDrag", () => {
  it("lets a plain tap through to the button without moving the tab", async () => {
    const onClick = await mount()
    await act(async () => void tabButton().dispatchEvent(pointer("pointerdown", { clientX: 1000, clientY: 100 })))
    await act(async () => void window.dispatchEvent(pointer("pointerup")))
    await act(async () => tabButton().click())

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(wrap().style.transform).toBe("")
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled()
    expect(physics.runSpring).not.toHaveBeenCalled()
  })

  it("treats a wobble under the drag threshold as a tap", async () => {
    const onClick = await mount()
    await pressAndMove({ x: 998, y: 101 })
    await release()
    await act(async () => tabButton().click())

    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled()
    expect(wrap().style.transform).toBe("")
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("ignores a drag started with a non-primary mouse button", async () => {
    await mount()
    await act(async () => void tabButton().dispatchEvent(pointer("pointerdown", { button: 2, clientX: 1000, clientY: 100 })))
    await act(async () => void window.dispatchEvent(pointer("pointermove", { clientX: 800, clientY: 300 })))

    expect(wrap().style.transform).toBe("")
    expect(wrap().style.top).toBe("")
  })

  it("pulls with rubber-band resistance, follows the pointer vertically and captures the pointer", async () => {
    await mount()
    await pressAndMove({ x: 900, y: 160 })

    expect(pull()).toBeCloseTo(rubberBand(100), 1)
    expect(pull()).toBeLessThan(100)
    expect(wrap().style.top).toBe("80px")
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it("keeps the tab inside its parent vertically", async () => {
    await mount()
    await pressAndMove({ x: 1000, y: 5000 })
    expect(wrap().style.top).toBe(`${LAYOUT.parentHeight - LAYOUT.tabHeight}px`)

    await release()
    await pressAndMove({ x: 1000, y: -5000 })
    expect(wrap().style.top).toBe("0px")
  })

  it("does not move when pulled to the right, away from the edge it hugs", async () => {
    await mount()
    await pressAndMove({ x: 1100, y: 100 })
    expect(pull()).toBe(0)
  })

  it("still follows a fast flick whose first move lands outside the small tab", async () => {
    await mount()
    await act(async () => void tabButton().dispatchEvent(pointer("pointerdown", { clientX: 1000, clientY: 100 })))
    await act(async () => void document.body.dispatchEvent(pointer("pointermove", { clientX: 400, clientY: 400 })))

    expect(pull()).toBeGreaterThan(0)
    expect(wrap().style.top).toBe("320px")
  })

  it("suppresses the click that follows a drag", async () => {
    const onClick = await mount()
    await pressAndMove({ x: 900, y: 160 })
    // A browser dispatches the click in the same task as the pointerup that ends the drag.
    await act(async () => {
      window.dispatchEvent(pointer("pointerup"))
      tabButton().click()
    })

    expect(onClick).not.toHaveBeenCalled()
  })

  it("clears the click suppression when no click follows, so keyboard activation still works", async () => {
    const onClick = await mount()
    await pressAndMove({ x: 900, y: 160 })
    await release()
    await act(async () => void (await new Promise(resolve => setTimeout(resolve, 0))))
    await act(async () => tabButton().click())

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("springs back from the current pull on release and persists the height as a ratio", async () => {
    await mount()
    await pressAndMove({ x: 900, y: 160 })
    const pulled = pull()
    await release()

    expect(physics.runSpring).toHaveBeenCalledTimes(1)
    expect(springs[0].from.x).toBeCloseTo(pulled, 5)
    expect(springs[0].from.y).toBe(0)
    expect(Number(storage.getItem(STORAGE_KEY))).toBeCloseTo(80 / LAYOUT.parentHeight, 5)

    act(() => springs[0].onFrame({ x: 10, y: 0 }))
    expect(pull()).toBe(10)
    act(() => springs[0].onDone())
    expect(wrap().style.transform).toBe("")
  })

  it("returns to the edge immediately when reduced motion is preferred", async () => {
    setReducedMotion(true)
    await mount()
    await pressAndMove({ x: 900, y: 160 })
    await release()

    expect(physics.runSpring).not.toHaveBeenCalled()
    expect(wrap().style.transform).toBe("")
    expect(wrap().style.top).toBe("80px")
  })

  it("cancels a running spring when a new press starts", async () => {
    await mount()
    await pressAndMove({ x: 900, y: 160 })
    await release()
    await act(async () => void tabButton().dispatchEvent(pointer("pointerdown", { clientX: 1000, clientY: 100 })))

    expect(springs[0].cancel).toHaveBeenCalled()
    expect(wrap().style.transform).toBe("")
  })

  it("restores the saved height on mount and clamps it into the parent", async () => {
    storage.setItem(STORAGE_KEY, "0.5")
    await mount()
    expect(wrap().style.top).toBe("400px")

    await act(async () => root.render(null))
    storage.setItem(STORAGE_KEY, "5")
    await mount()
    expect(wrap().style.top).toBe(`${LAYOUT.parentHeight - LAYOUT.tabHeight}px`)
  })

  it.each([["not json"], ['"text"'], ["null"]])("ignores an unusable saved value (%s)", async raw => {
    storage.setItem(STORAGE_KEY, raw)
    await mount()
    expect(wrap().style.top).toBe("")
  })

  it("moves 16px with the arrow keys, stays inside the parent and saves the position", async () => {
    await mount()
    const press = (key: string) =>
      act(async () => void tabButton().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })))

    await press("ArrowDown")
    expect(wrap().style.top).toBe("36px")
    expect(Number(storage.getItem(STORAGE_KEY))).toBeCloseTo(36 / LAYOUT.parentHeight, 5)

    await press("ArrowUp")
    await press("ArrowUp")
    await press("ArrowUp")
    expect(wrap().style.top).toBe("0px")

    await press("Enter")
    expect(wrap().style.top).toBe("0px")
  })

  it("removes its window listeners when unmounted mid-press", async () => {
    await mount()
    await act(async () => void tabButton().dispatchEvent(pointer("pointerdown", { clientX: 1000, clientY: 100 })))
    const remove = vi.spyOn(window, "removeEventListener")
    await act(async () => root.render(null))

    const removed = remove.mock.calls.map(([type]) => type)
    expect(removed).toEqual(expect.arrayContaining(["pointermove", "pointerup", "pointercancel"]))
    expect(() => window.dispatchEvent(pointer("pointermove", { clientX: 400, clientY: 400 }))).not.toThrow()
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled()
  })
})

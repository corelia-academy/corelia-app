// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelHandle,
} from "./resizable"

type TweenVars = {
  duration: number
  ease: string
  onUpdate: () => void
  onComplete: () => void
}

type RunningTween = {
  target: { value: number }
  vars: TweenVars
  kill: ReturnType<typeof vi.fn>
}

const gsapMocks = vi.hoisted(() => ({ to: vi.fn() }))

vi.mock("gsap", () => ({ gsap: gsapMocks }))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const STORAGE_KEY = "resizable-panels:test-layout"

const tween: { current: RunningTween | null } = { current: null }
const handle: { current: ResizablePanelHandle | null } = { current: null }
const onCollapse = vi.fn()
const onExpand = vi.fn()

let root: Root
let container: HTMLDivElement
let storage: Storage

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

function Harness({ label = "a" }: { label?: string }) {
  return (
    <ResizablePanelGroup autoSaveId="test-layout" animationDuration={0.4}>
      <ResizablePanel defaultSize={70} minSize={40}>
        <div>content {label}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        ref={(value: ResizablePanelHandle | null) => {
          handle.current = value
        }}
        defaultSize={30}
        minSize={10}
        collapsible
        collapsedSize={0}
        onCollapse={onCollapse}
        onExpand={onExpand}
      >
        <div>side {label}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

async function mountHarness() {
  await act(async () => root.render(<Harness />))
  onCollapse.mockClear()
  onExpand.mockClear()
}

function panels() {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]'))
}

beforeEach(() => {
  storage = installMemoryStorage()
  tween.current = null
  handle.current = null
  onCollapse.mockClear()
  onExpand.mockClear()
  gsapMocks.to.mockReset()
  gsapMocks.to.mockImplementation((target: { value: number }, vars: TweenVars) => {
    const kill = vi.fn()
    tween.current = { target, vars, kill }
    return { kill }
  })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("ResizablePanelGroup programmatic collapse and expand", () => {
  it("commits instantly without a tween when reduced motion is preferred", async () => {
    setReducedMotion(true)
    await mountHarness()

    await act(async () => handle.current!.collapse())

    expect(gsapMocks.to).not.toHaveBeenCalled()
    expect(panels()[1].hasAttribute("data-collapsed")).toBe(true)
    expect(panels().map(panel => panel.style.flexGrow)).toEqual(["100", "0"])
    expect(onCollapse).toHaveBeenCalledTimes(1)

    await act(async () => handle.current!.expand())

    expect(panels()[1].hasAttribute("data-collapsed")).toBe(false)
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it("tweens flex-grow on the DOM and commits state only when the tween completes", async () => {
    setReducedMotion(false)
    await mountHarness()
    expect(storage.getItem(STORAGE_KEY)).toBe("[70,30]")

    await act(async () => handle.current!.collapse())

    expect(gsapMocks.to).toHaveBeenCalledTimes(1)
    expect(tween.current!.vars.duration).toBe(0.4)
    expect(tween.current!.vars.ease).toBe("power3.inOut")
    expect(handle.current!.isCollapsed()).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe("[70,30]")

    tween.current!.target.value = 0.5
    act(() => tween.current!.vars.onUpdate())
    expect(panels().map(panel => Number(panel.style.flexGrow))).toEqual([85, 15])

    tween.current!.target.value = 1
    act(() => {
      tween.current!.vars.onUpdate()
      tween.current!.vars.onComplete()
    })

    expect(panels().map(panel => panel.style.flexGrow)).toEqual(["100", "0"])
    expect(panels()[1].hasAttribute("data-collapsed")).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe("[100,0]")
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it("keeps the new sizes when the parent re-renders in the same batch", async () => {
    setReducedMotion(true)
    await mountHarness()

    await act(async () => {
      handle.current!.collapse()
      root.render(<Harness label="b" />)
    })

    expect(panels()[1].hasAttribute("data-collapsed")).toBe(true)
    expect(panels().map(panel => panel.style.flexGrow)).toEqual(["100", "0"])
    expect(storage.getItem(STORAGE_KEY)).toBe("[100,0]")
  })

  it("cancels the running tween and freezes the visible sizes when dragging starts", async () => {
    setReducedMotion(false)
    await mountHarness()
    await act(async () => handle.current!.collapse())
    const running = tween.current!

    running.target.value = 0.5
    act(() => running.vars.onUpdate())

    const separator = container.querySelector<HTMLElement>('[role="separator"]')!
    separator.setPointerCapture = vi.fn()
    await act(async () =>
      separator.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 700, pointerId: 1 })),
    )

    expect(running.kill).toHaveBeenCalled()
    expect(panels().map(panel => Number(panel.style.flexGrow))).toEqual([85, 15])
  })
})

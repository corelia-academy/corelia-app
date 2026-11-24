// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { gsap } from "gsap"

import { SideDrawer, type SideDrawerProps } from "./side-drawer"

vi.mock("gsap", () => ({ gsap: { from: vi.fn(() => ({ kill: vi.fn() })), set: vi.fn() } }))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

async function mount(props: Partial<SideDrawerProps> = {}) {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  cleanup = () => {
    act(() => root.unmount())
    host.remove()
  }
  await act(async () =>
    root.render(
      <SideDrawer open onOpenChange={() => {}} title="Tiêu đề" description="Mô tả chung." {...props}>
        <p data-testid="slot-content">Nội dung</p>
      </SideDrawer>,
    ),
  )
}

const drawer = () => document.querySelector<HTMLElement>('[data-slot="side-drawer"]')

describe("SideDrawer", () => {
  it("renders nothing while closed", async () => {
    await mount({ open: false })

    expect(drawer()).toBeNull()
  })

  it("shows the title and the description", async () => {
    await mount()

    expect(drawer()?.querySelector('[data-slot="side-drawer-title"]')?.textContent).toBe("Tiêu đề")
    expect(drawer()?.querySelector('[data-slot="side-drawer-description"]')?.textContent).toBe("Mô tả chung.")
  })

  it("omits the description when it is not passed", async () => {
    await mount({ description: undefined })

    expect(drawer()?.querySelector('[data-slot="side-drawer-description"]')).toBeNull()
  })

  it.each([
    ["30vw", "w-[min(480px,100vw)]"],
    ["50vw", "w-[min(720px,100vw)]"],
  ] as const)("uses the %s width", async (size, widthClass) => {
    await mount({ size })

    expect(drawer()?.getAttribute("data-size")).toBe(size)
    expect(drawer()?.className).toContain(widthClass)
  })

  it("renders the content in a scrolling slot", async () => {
    await mount()

    const slot = drawer()?.querySelector('[data-slot="side-drawer-slot"]')
    expect(slot?.querySelector('[data-testid="slot-content"]')).not.toBeNull()
    expect(slot?.className).toContain("overflow-y-auto")
  })

  it("labels the close button and requests close", async () => {
    const onOpenChange = vi.fn()
    await mount({ closeLabel: "Đóng", onOpenChange })

    const close = drawer()?.querySelector<HTMLButtonElement>('[data-slot="side-drawer-close"]')
    expect(close?.textContent).toBe("Đóng")
    await act(async () => close?.click())
    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange.mock.calls[0][0]).toBe(false)
  })

  it("links the dialog to its title and description", async () => {
    await mount()

    const title = drawer()?.querySelector('[data-slot="side-drawer-title"]')
    const description = drawer()?.querySelector('[data-slot="side-drawer-description"]')
    expect(drawer()?.getAttribute("aria-labelledby")).toBe(title?.id)
    expect(drawer()?.getAttribute("aria-describedby")).toBe(description?.id)
  })

  it("marks the title and description for the reveal animation", async () => {
    await mount()

    expect(drawer()?.querySelector('[data-slot="side-drawer-title"]')?.hasAttribute("data-reveal")).toBe(true)
    expect(drawer()?.querySelector('[data-slot="side-drawer-description"]')?.hasAttribute("data-reveal")).toBe(true)
  })

  it("reveals the header text and falls back to the slot children", async () => {
    await mount()

    expect(gsap.from).toHaveBeenCalledOnce()
    const targets = vi.mocked(gsap.from).mock.calls[0][0] as unknown as HTMLElement[]
    expect(targets.map(el => el.getAttribute("data-slot") ?? el.getAttribute("data-testid"))).toEqual([
      "side-drawer-title",
      "side-drawer-description",
      "slot-content",
    ])
  })

  it("skips the reveal when the user prefers reduced motion", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList)
    await mount()

    expect(gsap.from).not.toHaveBeenCalled()
  })
})

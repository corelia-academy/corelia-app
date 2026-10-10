// @vitest-environment happy-dom
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { gsap } from "gsap"

import {
  Tooltip,
  TooltipContent,
  TooltipPreview,
  TooltipProvider,
  TooltipTrigger,
  type TooltipArrow,
} from "./tooltip"

const gsapMocks = vi.hoisted(() => ({
  fromTo: vi.fn(() => ({ kill: vi.fn() })),
  set: vi.fn(),
}))

vi.mock("gsap", () => ({ gsap: gsapMocks }))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type MountedView = {
  container: HTMLDivElement
  root: Root
}

const mountedViews: MountedView[] = []

function mount(ui: ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const view = { container, root }
  mountedViews.push(view)

  return {
    container,
    async render() {
      await act(async () => root.render(ui))
    },
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
      const index = mountedViews.indexOf(view)
      if (index >= 0) mountedViews.splice(index, 1)
    },
  }
}

function setReducedMotionPreference(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  })
}

function renderOpenTooltip({
  arrow,
  side,
  supportingText,
  isOpen = false,
}: {
  arrow: TooltipArrow
  side?: "top" | "bottom"
  supportingText?: string
  isOpen?: boolean
}) {
  return mount(
    <TooltipProvider delay={0}>
      <Tooltip open>
        <TooltipTrigger>Help</TooltipTrigger>
        <TooltipContent
          arrow={arrow}
          isOpen={isOpen}
          side={side}
          supportingText={supportingText}
        >
          Tooltip title
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  )
}

function dispatchPointerEvent(
  target: HTMLElement,
  type: string,
  values: PointerEventInit,
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    ...values,
  })
  if (values.pointerType !== undefined) {
    Object.defineProperty(event, "pointerType", { value: values.pointerType })
  }
  target.dispatchEvent(event)
}

const tooltipArrows: readonly TooltipArrow[] = [
  "none",
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
  "left",
  "right",
]

const tooltipArrowCases = tooltipArrows.flatMap((arrow) => [
  { arrow, variant: "title-only", supportingText: undefined },
  {
    arrow,
    variant: "title-and-description",
    supportingText: "Tooltip description",
  },
])

const tooltipArrowOverlapClasses: Record<Exclude<TooltipArrow, "none">, string> = {
  "bottom-center": "data-[side=top]:translate-y-[calc(100%_-_1px)]",
  "bottom-left": "data-[side=top]:translate-y-[calc(100%_-_1px)]",
  "bottom-right": "data-[side=top]:translate-y-[calc(100%_-_1px)]",
  "top-center": "data-[side=bottom]:translate-y-[calc(-100%_+_1px)]",
  "top-left": "data-[side=bottom]:translate-y-[calc(-100%_+_1px)]",
  "top-right": "data-[side=bottom]:translate-y-[calc(-100%_+_1px)]",
  left: "data-[side=right]:translate-x-[calc(-100%_+_1px)]",
  right: "data-[side=left]:translate-x-[calc(100%_-_1px)]",
}

beforeEach(() => {
  setReducedMotionPreference(true)
  vi.clearAllMocks()
})

afterEach(async () => {
  await act(async () => {
    for (const view of [...mountedViews]) {
      view.root.unmount()
      view.container.remove()
    }
  })
  mountedViews.splice(0)
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("Tooltip content variants", () => {
  it("renders the compact title-only form", async () => {
    const view = renderOpenTooltip({ arrow: "none" })
    await view.render()

    const popup = document.body.querySelector<HTMLElement>(
      '[data-slot="tooltip-content"]',
    )
    const surface = popup?.firstElementChild as HTMLElement | null

    expect(popup?.textContent).toContain("Tooltip title")
    expect(popup?.textContent).not.toContain("Tooltip description")
    expect(surface?.className).toContain("w-fit")
    expect(surface?.className).not.toContain("w-80")

    await view.unmount()
  })

  it("renders the larger title-and-description form", async () => {
    const view = renderOpenTooltip({
      arrow: "none",
      supportingText: "Tooltip description",
    })
    await view.render()

    const popup = document.body.querySelector<HTMLElement>(
      '[data-slot="tooltip-content"]',
    )
    const surface = popup?.firstElementChild as HTMLElement | null

    expect(popup?.textContent).toContain("Tooltip title")
    expect(popup?.textContent).toContain("Tooltip description")
    expect(surface?.className).toContain("w-80")
    expect(surface?.className).toContain("items-start")

    await view.unmount()
  })
})

describe("Tooltip arrow variants", () => {
  it.each(tooltipArrowCases)(
    "renders the $arrow arrow for $variant content",
    async ({ arrow, supportingText }) => {
      const view = renderOpenTooltip({
        arrow,
        supportingText,
      })
      await view.render()

      const arrowElement = document.body.querySelector(
        '[data-slot="tooltip-arrow"]',
      )

      if (arrow === "none") {
        expect(arrowElement).toBeNull()
      } else {
        expect(arrowElement).not.toBeNull()
        expect(arrowElement?.className).toContain(
          tooltipArrowOverlapClasses[arrow],
        )
        expect(arrowElement?.firstElementChild).not.toBeNull()
        expect(arrowElement?.firstElementChild?.getAttribute("aria-hidden")).toBe(
          "true",
        )
      }

      await view.unmount()
    },
  )

  it("keeps the requested side when the tooltip has no arrow", async () => {
    const view = renderOpenTooltip({ arrow: "none", side: "bottom" })
    await view.render()

    const popup = document.body.querySelector<HTMLElement>(
      '[data-slot="tooltip-content"]',
    )

    expect(popup?.getAttribute("data-side")).toBe("bottom")

    await view.unmount()
  })

  it("applies the optical correction to the top-left and top-right tips", async () => {
    const cases = [
      { arrow: "top-left", supportingText: undefined, marginLeft: "-7.29289px" },
      { arrow: "top-right", supportingText: undefined, marginLeft: "5.9279px" },
      {
        arrow: "top-right",
        supportingText: "Tooltip description",
        marginLeft: "4.70711px",
      },
    ] as const

    for (const { arrow, supportingText, marginLeft } of cases) {
      const view = renderOpenTooltip({ arrow, supportingText })
      await view.render()

      const arrowElement = document.body.querySelector<HTMLElement>(
        '[data-slot="tooltip-arrow"]',
      )

      expect(arrowElement?.style.marginLeft).toBe(marginLeft)
      await view.unmount()
    }
  })
})

describe("TooltipPreview interactions", () => {
  function renderPreview() {
    return mount(
      <TooltipPreview
        arrow="none"
        trigger={<span aria-hidden="true">?</span>}
        triggerLabel="Help"
        supportingText="Tooltip description"
      >
        Tooltip title
      </TooltipPreview>,
    )
  }

  it("opens from mouse hover", async () => {
    const view = renderPreview()
    await view.render()
    const trigger = view.container.querySelector<HTMLElement>(
      'button[aria-label="Help"]',
    )

    expect(document.body.querySelector('[data-slot="tooltip-content"]')).toBeNull()
    expect(trigger).not.toBeNull()

    await act(async () => {
      if (trigger) {
        dispatchPointerEvent(trigger, "pointerenter", {
          pointerType: "mouse",
          pointerId: 1,
        })
        trigger.dispatchEvent(
          new MouseEvent("mouseenter", { cancelable: true }),
        )
      }
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(document.body.querySelector('[data-slot="tooltip-content"]')).not.toBeNull()
    await view.unmount()
  })

  it("opens while the mouse button is held", async () => {
    const view = renderPreview()
    await view.render()
    const trigger = view.container.querySelector<HTMLElement>(
      'button[aria-label="Help"]',
    )

    expect(trigger).not.toBeNull()
    if (!trigger) return

    Object.defineProperty(trigger, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    })

    await act(async () => {
      dispatchPointerEvent(trigger, "pointerdown", {
        pointerType: "mouse",
        pointerId: 1,
        button: 0,
      })
    })

    expect(document.body.querySelector('[data-slot="tooltip-content"]')).not.toBeNull()
    await view.unmount()
  })

  it("toggles open and closed on consecutive touch taps", async () => {
    const view = renderPreview()
    await view.render()
    const trigger = view.container.querySelector<HTMLElement>(
      'button[aria-label="Help"]',
    )

    expect(trigger).not.toBeNull()
    if (!trigger) return

    const tap = async () => {
      await act(async () => {
        dispatchPointerEvent(trigger, "pointerdown", {
          pointerType: "touch",
          pointerId: 1,
          button: 0,
        })
        dispatchPointerEvent(trigger, "pointerup", {
          pointerType: "touch",
          pointerId: 1,
          button: 0,
        })
        trigger.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        )
      })
    }

    await tap()
    expect(
      document.body.querySelector('[data-slot="tooltip-content"][data-open]'),
    ).not.toBeNull()

    await tap()
    expect(
      document.body.querySelector('[data-slot="tooltip-content"][data-open]'),
    ).toBeNull()

    await view.unmount()
  })
})

describe("Tooltip animation", () => {
  it("animates when motion is allowed", async () => {
    setReducedMotionPreference(false)
    const view = mount(
      <TooltipPreview
        arrow="none"
        trigger={<span aria-hidden="true">?</span>}
        triggerLabel="Help"
        supportingText="Tooltip description"
      >
        Tooltip title
      </TooltipPreview>,
    )
    await view.render()

    const trigger = view.container.querySelector<HTMLElement>(
      'button[aria-label="Help"]',
    )
    if (!trigger) throw new Error("Tooltip trigger was not rendered")
    Object.defineProperty(trigger, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    })

    await act(async () => {
      dispatchPointerEvent(trigger, "pointerdown", {
        pointerType: "mouse",
        pointerId: 1,
        button: 0,
      })
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(gsap.fromTo).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ autoAlpha: 0, scale: 0.98 }),
      expect.objectContaining({ duration: 0.18, ease: "power2.out" }),
    )

    await view.unmount()
  })

  it("skips the animation when reduced motion is requested", async () => {
    setReducedMotionPreference(true)
    const view = renderOpenTooltip({ arrow: "none", isOpen: true })
    await view.render()

    expect(gsap.fromTo).not.toHaveBeenCalled()

    await view.unmount()
  })
})

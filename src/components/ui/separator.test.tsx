// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { Separator } from "./separator"

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const lineCases = [
  ["horizontal", "solid", "h-px w-full border-t", "border-solid"],
  ["horizontal", "dashed", "h-px w-full border-t", "border-dashed"],
  ["vertical", "solid", "self-stretch w-px border-s", "border-solid"],
  ["vertical", "dashed", "self-stretch w-px border-s", "border-dashed"],
] as const

describe("Separator", () => {
  it("renders a rounded frame and keeps caller classes", () => {
    const markup = renderToStaticMarkup(
      <Separator
        shape="frame"
        variant="dashed"
        className="rounded-lg border-neutral-500"
      />,
    )

    expect(markup).toContain("h-full w-full border")
    expect(markup).toContain("border-dashed")
    expect(markup).toContain("rounded-lg")
    expect(markup).toContain("border-neutral-500")
    expect(markup).toContain('aria-hidden="true"')
  })

  it("uses a custom dash pattern only for dashed separators", () => {
    const dashedMarkup = renderToStaticMarkup(
      <Separator
        variant="dashed"
        dashPattern={{ dashLength: 6, gapLength: 4 }}
      />,
    )
    const solidMarkup = renderToStaticMarkup(
      <Separator
        variant="solid"
        dashPattern={{ dashLength: 6, gapLength: 4 }}
      />,
    )

    expect(dashedMarkup).toContain('data-dash-pattern="6 4"')
    expect(solidMarkup).not.toContain("data-dash-pattern")
    expect(solidMarkup).toContain("border-solid")
  })

  it("draws a dashed frame with the caller border color, width, and radius", async () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)
    const originalGetComputedStyle = window.getComputedStyle.bind(window)

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.slot === "separator"
          ? new DOMRect(0, 0, 80, 40)
          : new DOMRect()
      },
    )
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element instanceof HTMLElement && element.dataset.slot === "separator") {
        return {
          borderTopWidth: "2px",
          borderLeftWidth: "2px",
          borderTopColor: "rgb(10, 20, 30)",
          borderTopLeftRadius: "8px",
        } as CSSStyleDeclaration
      }

      return originalGetComputedStyle(element)
    })

    await act(async () => {
      root.render(
        <Separator
          shape="frame"
          variant="dashed"
          dashPattern={{ dashLength: 6, gapLength: 4 }}
          className="rounded-lg border-neutral-500"
        />,
      )
    })

    const frame = host.querySelector<SVGRectElement>(
      '[data-slot="separator-dash-pattern"] rect',
    )
    expect(frame?.getAttribute("stroke-dasharray")).toBe("6 4")
    expect(frame?.getAttribute("stroke-width")).toBe("2")
    expect(frame?.getAttribute("rx")).toBe("7")
    expect(frame?.getAttribute("stroke")).toBe("rgb(10, 20, 30)")

    await act(async () => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  it.each(lineCases)(
    "preserves the %s %s line geometry",
    (orientation, variant, geometry, style) => {
      const markup = renderToStaticMarkup(
        <Separator orientation={orientation} variant={variant} />,
      )

      expect(markup).toContain(`data-orientation="${orientation}"`)
      expect(markup).toContain(geometry)
      expect(markup).toContain(style)
      expect(markup).not.toContain('aria-hidden="true"')
    },
  )
})

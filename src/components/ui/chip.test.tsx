import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Chip } from "./chip"

describe("Chip", () => {
  it.each([
    ["xsmall", "h-5", "text-xs leading-4"],
    ["small", "h-6", "text-sm leading-5"],
    ["medium", "h-7", "text-sm leading-5"],
    ["large", "h-8", "text-sm leading-5"],
  ] as const)("renders the %s size", (size, height, textClasses) => {
    const markup = renderToStaticMarkup(<Chip size={size}>3</Chip>)

    expect(markup).toContain(height)
    expect(markup).toContain(textClasses)
    expect(markup).toContain(">3</span>")
  })

  it.each([
    ["rounded", "rounded-[6px]"],
    ["circle", "rounded-full"],
  ] as const)("renders the %s shape", (shape, shapeClass) => {
    const markup = renderToStaticMarkup(
      <Chip size="small" shape={shape}>
        3
      </Chip>,
    )

    expect(markup).toContain(shapeClass)
  })

  it("renders children and maps the active and disabled states", () => {
    const active = renderToStaticMarkup(
      <Chip aria-label="Count">3</Chip>,
    )
    const disabled = renderToStaticMarkup(<Chip disabled>3</Chip>)

    expect(active).toContain('data-slot="chip"')
    expect(active).toContain('aria-label="Count"')
    expect(active).toContain("bg-tag-overflow-background")
    expect(active).toContain(">3</span>")
    expect(disabled).toContain("bg-tag-disabled-background")
    expect(disabled).toContain('data-disabled="true"')
    expect(disabled).toContain('aria-disabled="true"')
  })
})

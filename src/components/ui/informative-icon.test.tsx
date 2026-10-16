import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { InformativeIcon } from "./informative-icon"

const colors = ["error", "warning", "success", "blue"] as const
const sizes = ["xs", "sm", "md", "lg", "xl"] as const
const types = ["circle", "circle-outline"] as const

describe("InformativeIcon", () => {
  it.each([
    ["xs", "size-6", "p-[6px]", "[&amp;&gt;svg]:size-3", "border-2"],
    ["sm", "size-8", "p-2", "[&amp;&gt;svg]:size-4", "border-4"],
    ["md", "size-10", "p-[10px]", "[&amp;&gt;svg]:size-5", "border-6"],
    ["lg", "size-12", "p-3", "[&amp;&gt;svg]:size-6", "border-8"],
    ["xl", "size-14", "p-[14px]", "[&amp;&gt;svg]:size-7", "border-10"],
  ] as const)("uses Figma dimensions for %s", (size, outerClass, paddingClass, iconClass, borderClass) => {
    const circle = renderToStaticMarkup(<InformativeIcon size={size} />)
    const outline = renderToStaticMarkup(<InformativeIcon size={size} type="circle-outline" />)

    expect(circle).toContain(outerClass)
    expect(circle).toContain(paddingClass)
    expect(circle).toContain(iconClass)
    expect(circle).toContain("border-0")
    expect(outline).toContain(outerClass)
    expect(outline).toContain("p-1")
    expect(outline).toContain(iconClass)
    expect(outline).toContain(borderClass)
  })

  it.each([
    ["error", "--informative-icon-error-surface", "--informative-icon-error-content", "--informative-icon-error-outline"],
    ["warning", "--informative-icon-warning-surface", "--informative-icon-warning-content", "--informative-icon-warning-outline"],
    ["success", "--informative-icon-success-surface", "--informative-icon-success-content", "--informative-icon-success-outline"],
    ["blue", "--informative-icon-blue-surface", "--informative-icon-blue-content", "--informative-icon-blue-outline"],
  ] as const)("uses theme tokens for %s", (color, surfaceToken, contentToken, outlineToken) => {
    const circle = renderToStaticMarkup(<InformativeIcon color={color} />)
    const outline = renderToStaticMarkup(<InformativeIcon color={color} type="circle-outline" />)

    expect(circle).toContain(`bg-[var(${surfaceToken})]`)
    expect(circle).toContain(`fill="var(${contentToken})"`)
    expect(outline).toContain(`border-[var(${outlineToken})]`)
    expect(circle).not.toContain("style=")
  })

  it("renders all 40 color, size, and type combinations", () => {
    const markup = renderToStaticMarkup(
      <div>
        {colors.flatMap((color) =>
          sizes.flatMap((size) =>
            types.map((type) => (
              <InformativeIcon key={`${color}-${size}-${type}`} color={color} size={size} type={type} />
            )),
          ),
        )}
      </div>,
    )

    expect(markup.match(/data-slot="informative-icon"/g)).toHaveLength(40)
  })

  it("provides an accessible image label when supplied and hides decorative icons otherwise", () => {
    const decorative = renderToStaticMarkup(<InformativeIcon color="warning" />)
    const labeled = renderToStaticMarkup(<InformativeIcon color="warning" aria-label="Warning" />)
    const labeledRoot = labeled.match(/<span[^>]*>/)?.[0]

    expect(decorative).toContain('aria-hidden="true"')
    expect(labeled).toContain('role="img"')
    expect(labeled).toContain('aria-label="Warning"')
    expect(labeledRoot).not.toContain('aria-hidden="true"')
  })
})

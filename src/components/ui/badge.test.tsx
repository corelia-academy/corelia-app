import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ArrowRight, Check } from "lucide-react"

import { Badge } from "./badge"

describe("Badge", () => {
  it.each([
    ["xsmall", "h-[18px]"],
    ["small", "h-6"],
    ["medium", "h-7"],
    ["large", "h-8"],
  ] as const)("uses the Figma height and line-height for %s", (size, heightClass) => {
    const markup = renderToStaticMarkup(
      <Badge size={size} color="primary" variant="outline">
        Label
      </Badge>,
    )

    expect(markup).toContain(heightClass)
    expect(markup).toContain("leading-none")
    expect(markup).toContain("font-medium")
  })

  it("renders filled and outline color variants", () => {
    const filled = renderToStaticMarkup(
      <Badge color="success" variant="filled">
        Success
      </Badge>,
    )
    const outline = renderToStaticMarkup(
      <Badge color="success" variant="outline">
        Success
      </Badge>,
    )

    expect(filled).toContain("bg-success-700")
    expect(filled).toContain("text-neutral-50")
    expect(outline).toContain("border-success-500")
    expect(outline).toContain("bg-neutral-50/5")
  })

  it("maps Lime Green, Gray, and Disabled to the theme-aware Figma colors", () => {
    const limeGreen = renderToStaticMarkup(
      <Badge color="limeGreen" variant="filled">
        Lime Green
      </Badge>,
    )
    const grayOutline = renderToStaticMarkup(
      <Badge color="gray" variant="outline">
        Gray
      </Badge>,
    )
    const grayFilled = renderToStaticMarkup(
      <Badge color="gray" variant="filled">
        Gray
      </Badge>,
    )
    const disabledOutline = renderToStaticMarkup(
      <Badge color="disabled" variant="outline">
        Disabled
      </Badge>,
    )
    const disabledFilled = renderToStaticMarkup(
      <Badge color="disabled" variant="filled">
        Disabled
      </Badge>,
    )

    expect(limeGreen).toContain("bg-accent-teal-900")
    expect(limeGreen).toContain("text-accent-teal-50")
    expect(grayOutline).toContain("border-neutral-600")
    expect(grayOutline).toContain("text-neutral-600")
    expect(grayOutline).toContain("dark:border-neutral-200")
    expect(grayOutline).toContain("dark:text-neutral-200")
    expect(grayFilled).toContain("bg-neutral-200")
    expect(grayFilled).toContain("text-neutral-800")
    expect(grayFilled).toContain("dark:bg-neutral-600")
    expect(grayFilled).toContain("dark:text-neutral-100")
    expect(disabledOutline).toContain("border-neutral-400")
    expect(disabledOutline).toContain("text-neutral-400")
    expect(disabledOutline).toContain("dark:border-neutral-500")
    expect(disabledOutline).toContain("dark:text-neutral-500")
    expect(disabledFilled).toContain("bg-neutral-100")
    expect(disabledFilled).toContain("text-neutral-400")
    expect(disabledFilled).toContain("dark:bg-neutral-800")
    expect(disabledFilled).toContain("dark:text-neutral-500")
  })

  it.each([
    ["primary", "border-blue-400", "bg-blue-400", "text-neutral-900"],
    ["warning", "border-warning-500", "bg-warning-700", "text-neutral-50"],
    ["success", "border-success-500", "bg-success-700", "text-neutral-50"],
    ["gold", "border-accent-yellow-500", "bg-accent-yellow-500", "text-neutral-900"],
    ["limeGreen", "border-accent-teal-500", "bg-accent-teal-900", "text-accent-teal-50"],
    ["cyan", "border-accent-sky-500", "bg-accent-sky-100", "text-neutral-900"],
    ["error", "border-error-500", "bg-error-700", "text-neutral-50"],
    ["gray", "border-neutral-600", "bg-neutral-200", "text-neutral-800"],
    ["disabled", "border-neutral-400", "bg-neutral-100", "text-neutral-400"],
  ] as const)("maps %s to the current Figma color tokens", (color, outlineClass, filledClass, filledTextClass) => {
    const outline = renderToStaticMarkup(
      <Badge color={color} variant="outline">
        Label
      </Badge>,
    )
    const filled = renderToStaticMarkup(
      <Badge color={color} variant="filled">
        Label
      </Badge>,
    )

    expect(outline).toContain(outlineClass)
    expect(filled).toContain(filledClass)
    expect(filled).toContain(filledTextClass)
  })

  it("renders leading and trailing icons in the declared slots", () => {
    const markup = renderToStaticMarkup(
      <Badge
        size="medium"
        color="primary"
        leadingIcon={<Check />}
        trailingIcon={<ArrowRight />}
      >
        Continue
      </Badge>,
    )

    expect(markup).toContain("Continue")
    expect(markup).toContain('aria-hidden="true"')
    expect(markup.match(/<svg/g)).toHaveLength(2)
  })

  it("keeps XSmall text-only when icons are provided dynamically", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Badge,
        {
          size: "xsmall",
          color: "gray",
          leadingIcon: <Check />,
        } as unknown as ComponentProps<typeof Badge>,
        "Text only",
      ),
    )

    expect(markup).toContain("Text only")
    expect(markup).not.toContain("aria-hidden=\"true\"")
  })
})

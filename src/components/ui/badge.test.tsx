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
    expect(markup).toContain("select-none")
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

    expect(filled).toContain("bg-badge-success-filled")
    expect(filled).toContain("text-badge-success-filled-foreground")
    expect(outline).toContain("border-badge-success")
    expect(outline).toContain("bg-badge-outline-background")
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

    expect(limeGreen).toContain("bg-badge-lime-green-filled")
    expect(limeGreen).toContain("text-badge-lime-green-filled-foreground")
    expect(grayOutline).toContain("border-badge-gray")
    expect(grayOutline).toContain("text-badge-gray")
    expect(grayFilled).toContain("bg-badge-gray-filled")
    expect(grayFilled).toContain("text-badge-gray-filled-foreground")
    expect(disabledOutline).toContain("border-badge-disabled")
    expect(disabledOutline).toContain("text-badge-disabled")
    expect(disabledOutline).toContain('data-disabled="true"')
    expect(disabledOutline).toContain('aria-disabled="true"')
    expect(disabledOutline).toContain("cursor-not-allowed")
    expect(disabledOutline).toContain("select-none")
    expect(disabledFilled).toContain("bg-badge-disabled-filled")
    expect(disabledFilled).toContain("text-badge-disabled-filled-foreground")
  })

  it.each([
    ["primary", "border-badge-primary", "bg-badge-primary-filled", "text-badge-primary-filled-foreground"],
    ["warning", "border-badge-warning", "bg-badge-warning-filled", "text-badge-warning-filled-foreground"],
    ["success", "border-badge-success", "bg-badge-success-filled", "text-badge-success-filled-foreground"],
    ["gold", "border-badge-gold", "bg-badge-gold-filled", "text-badge-gold-filled-foreground"],
    ["limeGreen", "border-badge-lime-green", "bg-badge-lime-green-filled", "text-badge-lime-green-filled-foreground"],
    ["cyan", "border-badge-cyan", "bg-badge-cyan-filled", "text-badge-cyan-filled-foreground"],
    ["error", "border-badge-error", "bg-badge-error-filled", "text-badge-error-filled-foreground"],
    ["gray", "border-badge-gray", "bg-badge-gray-filled", "text-badge-gray-filled-foreground"],
    ["disabled", "border-badge-disabled", "bg-badge-disabled-filled", "text-badge-disabled-filled-foreground"],
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

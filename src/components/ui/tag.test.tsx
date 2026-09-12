import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Tag } from "./tag"

describe("Tag", () => {
  it.each([
    ["small", "pl-md pr-sm py-xs"],
    ["medium", "pl-md pr-sm py-sm"],
    ["large", "p-md"],
  ] as const)("uses the Figma label padding for %s", (size, paddingClasses) => {
    const markup = renderToStaticMarkup(
      <Tag type="label" size={size}>
        Label
      </Tag>,
    )

    expect(markup).toContain(paddingClasses)
    expect(markup).toContain("rounded-sm")
    expect(markup).toContain("font-body")
    expect(markup).toContain("font-medium")
    expect(markup).toContain("text-sm")
    expect(markup).toContain("leading-none")
    expect(markup).toContain("tracking-[-0.07px]")
  })

  it.each([
    ["small", "h-6", "pl-md pr-sm py-xs"],
    ["medium", "h-7", "pl-md pr-sm py-sm"],
    ["large", "h-8", "p-md"],
  ] as const)("uses the Figma datetime dimensions for %s", (size, heightClass, paddingClasses) => {
    const markup = renderToStaticMarkup(
      <Tag type="datetime" size={size} date="02 Jun 2026" time="9:15 AM" />,
    )

    expect(markup).toContain(heightClass)
    expect(markup).toContain(paddingClasses)
    expect(markup).toContain("gap-md")
  })

  it("maps active and disabled states to the Figma tokens", () => {
    const active = renderToStaticMarkup(<Tag type="label">Active</Tag>)
    const disabled = renderToStaticMarkup(
      <Tag type="label" disabled>
        Disabled
      </Tag>,
    )

    expect(active).toContain("bg-neutral-700")
    expect(active).toContain("text-neutral-200")
    expect(active).not.toContain("data-disabled")
    expect(disabled).toContain("bg-neutral-800")
    expect(disabled).toContain("text-neutral-500")
    expect(disabled).toContain('data-disabled="true"')
  })

  it("renders label children and preserves valid span attributes", () => {
    const markup = renderToStaticMarkup(
      <Tag type="label" id="label-tag" aria-label="Status">
        Label content
      </Tag>,
    )

    expect(markup).toContain('data-slot="tag"')
    expect(markup).toContain('id="label-tag"')
    expect(markup).toContain('aria-label="Status"')
    expect(markup).toContain("Label content")
  })

  it.each([
    ["small", "h-6", "pl-xs", "gap-[5px]"],
    ["medium", "h-7", "pl-sm", "gap-sm"],
    ["large", "h-8", "p-md", "gap-sm"],
  ] as const)("renders the Figma leading visual layout for %s", (size, heightClass, paddingClass, contentGap) => {
    const markup = renderToStaticMarkup(
      <Tag
        type="label"
        size={size}
        leadingVisual={<img src="/avatar.png" alt="" />}
      >
        Label
      </Tag>,
    )

    expect(markup).toContain(heightClass)
    expect(markup).toContain(paddingClass)
    expect(markup).toContain(contentGap)
    expect(markup).toContain('data-has-leading-visual="true"')
    expect(markup).toContain('data-slot="tag-leading-visual"')
    expect(markup).toContain("size-4")
    expect(markup).toContain("rounded-full")
    expect(markup).toContain("[&amp;&gt;img]:block")
    expect(markup).toContain("[&amp;&gt;img]:rounded-full")
    expect(markup).toContain("[&amp;&gt;img]:object-cover")
  })

  it("dims only the leading visual for a disabled Avatar-style label", () => {
    const markup = renderToStaticMarkup(
      <Tag
        type="label"
        disabled
        leadingVisual={<img src="/avatar.png" alt="" />}
      >
        Disabled
      </Tag>,
    )

    expect(markup).toContain("bg-neutral-800")
    expect(markup).toContain("text-neutral-500")
    expect(markup).toContain("opacity-50")
  })

  it("renders datetime values with the existing vertical Separator", () => {
    const markup = renderToStaticMarkup(
      <Tag
        type="datetime"
        date={<time dateTime="2026-06-02">02 Jun 2026</time>}
        time="9:15 AM"
      />,
    )

    expect(markup).toContain("02 Jun 2026")
    expect(markup).toContain("9:15 AM")
    expect(markup).toContain('data-slot="separator"')
    expect(markup).toContain('data-orientation="vertical"')
    expect(markup).toContain("border-neutral-600")
  })

  it("renders a date-only datetime Tag without a Separator", () => {
    const markup = renderToStaticMarkup(
      <Tag type="datetime" date="02 Jun 2026" />,
    )

    expect(markup).toContain("02 Jun 2026")
    expect(markup).not.toContain('data-slot="separator"')
  })

  it("renders a time-only datetime Tag without a Separator", () => {
    const markup = renderToStaticMarkup(
      <Tag type="datetime" time="9:15 AM" />,
    )

    expect(markup).toContain("9:15 AM")
    expect(markup).not.toContain('data-slot="separator"')
  })

})

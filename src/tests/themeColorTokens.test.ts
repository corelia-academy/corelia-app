import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const stylesheet = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8")

function readCssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const rule = stylesheet.match(
    new RegExp(`^${escapedSelector}\\s*\\{([^}]*)\\}`, "m"),
  )

  if (!rule) {
    throw new Error(`Could not find CSS rule: ${selector}`)
  }

  return rule[1]
}

function expectSingleDeclaration(rule: string, name: string, value: string) {
  const declarations = rule
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`--${name}:`))

  expect(declarations).toEqual([`--${name}: ${value};`])
}

describe("semantic theme color tokens", () => {
  it("defines every role explicitly in light and dark mode", () => {
    const lightMode = readCssRule(":root")
    const darkMode = readCssRule(".dark")
    const roles = [
      ["loading-bar-end", "var(--blue-800)", "var(--blue-800)"],
      ["hackathon-unpublish-surface", "var(--blue-700)", "var(--blue-700)"],
      ["hackathon-unpublish-hover-surface", "var(--blue-800)", "var(--blue-800)"],
      ["mint-pending-filter-text", "var(--neutral-900)", "var(--neutral-900)"],
      ["mint-pending-count-surface", "var(--neutral-900)", "var(--neutral-900)"],
      ["mint-pending-count-text", "var(--neutral-900)", "var(--neutral-900)"],
      ["mint-oca-badge-surface", "var(--blue-600)", "var(--blue-600)"],
      ["mint-oca-badge-text", "var(--blue-700)", "var(--blue-500)"],
      ["mint-oca-badge-border", "var(--blue-600)", "var(--blue-600)"],
      ["mint-revoked-badge-surface", "var(--neutral-500)", "var(--neutral-500)"],
      ["mint-revoked-badge-text", "var(--neutral-400)", "var(--neutral-400)"],
      ["mint-revoked-badge-border", "var(--neutral-500)", "var(--neutral-500)"],
      ["stroke-divider", "var(--neutral-500)", "var(--neutral-600)"],
      ["selection-mark", "var(--blue-100)", "var(--blue-100)"],
    ] as const

    for (const [name, lightValue, darkValue] of roles) {
      expectSingleDeclaration(lightMode, name, lightValue)
      expectSingleDeclaration(darkMode, name, darkValue)
    }
  })

  it("exposes the utility tokens through Tailwind aliases", () => {
    const theme = readCssRule("@theme inline")
    const utilityRoles = [
      "loading-bar-end",
      "hackathon-unpublish-surface",
      "hackathon-unpublish-hover-surface",
      "mint-pending-filter-text",
      "mint-pending-count-surface",
      "mint-pending-count-text",
      "mint-oca-badge-surface",
      "mint-oca-badge-text",
      "mint-oca-badge-border",
      "mint-revoked-badge-surface",
      "mint-revoked-badge-text",
      "mint-revoked-badge-border",
      "stroke-divider",
    ]

    for (const name of utilityRoles) {
      expectSingleDeclaration(theme, `color-${name}`, `var(--${name})`)
    }
  })
})

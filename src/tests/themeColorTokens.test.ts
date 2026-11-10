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
  it("defines Informative Icon colors separately in light and dark mode", () => {
    const lightMode = readCssRule(":root")
    const darkMode = readCssRule(".dark")
    const lightInformativeIconColors = [
      ["informative-icon-error-surface", "error-400"],
      ["informative-icon-error-content", "error-100"],
      ["informative-icon-error-outline", "error-300"],
      ["informative-icon-warning-surface", "warning-400"],
      ["informative-icon-warning-content", "warning-100"],
      ["informative-icon-warning-outline", "warning-200"],
      ["informative-icon-success-surface", "success-400"],
      ["informative-icon-success-content", "success-100"],
      ["informative-icon-success-outline", "success-300"],
      ["informative-icon-blue-surface", "accent-sky-300"],
      ["informative-icon-blue-content", "accent-sky-100"],
      ["informative-icon-blue-outline", "accent-sky-200"],
    ] as const

    const darkInformativeIconColors = [
      ["informative-icon-error-surface", "error-400"],
      ["informative-icon-error-content", "error-200"],
      ["informative-icon-error-outline", "error-600"],
      ["informative-icon-warning-surface", "warning-500"],
      ["informative-icon-warning-content", "warning-200"],
      ["informative-icon-warning-outline", "warning-600"],
      ["informative-icon-success-surface", "success-500"],
      ["informative-icon-success-content", "success-200"],
      ["informative-icon-success-outline", "success-600"],
      ["informative-icon-blue-surface", "accent-sky-500"],
      ["informative-icon-blue-content", "accent-sky-200"],
      ["informative-icon-blue-outline", "accent-sky-600"],
    ] as const

    for (const [name, paletteToken] of lightInformativeIconColors) {
      expectSingleDeclaration(lightMode, name, `var(--${paletteToken})`)
    }

    for (const [name, paletteToken] of darkInformativeIconColors) {
      expectSingleDeclaration(darkMode, name, `var(--${paletteToken})`)
    }
  })

  it("defines every role explicitly in light and dark mode", () => {
    const lightMode = readCssRule(":root")
    const darkMode = readCssRule(".dark")
    const roles = [
      ["border", "var(--neutral-200)", "var(--neutral-600)"],
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
      ["selection-mark", "var(--neutral-50)", "var(--neutral-50)"],
      ["confetti-yellow", "var(--accent-yellow-400)", "var(--accent-yellow-400)"],
      ["confetti-green", "var(--success-400)", "var(--success-400)"],
      ["confetti-sky", "var(--accent-sky-400)", "var(--accent-sky-400)"],
      ["confetti-teal", "var(--accent-teal-400)", "var(--accent-teal-400)"],
      ["confetti-coral", "var(--error-400)", "var(--error-400)"],
      ["confetti-purple", "var(--accent-purple-400)", "var(--accent-purple-400)"],
    ] as const

    for (const [name, lightValue, darkValue] of roles) {
      expectSingleDeclaration(lightMode, name, lightValue)
      expectSingleDeclaration(darkMode, name, darkValue)
    }
  })

  it("maps Gray and White Badge colors to the inspected Figma tokens in dark mode", () => {
    const darkMode = readCssRule(".dark")
    const badgeRoles = [
      ["badge-gray", "var(--neutral-400)"],
      ["badge-gray-filled", "var(--neutral-600)"],
      ["badge-gray-filled-foreground", "var(--neutral-100)"],
      ["badge-white", "var(--neutral-100)"],
      ["badge-white-foreground", "var(--neutral-200)"],
      ["badge-white-filled", "var(--neutral-300)"],
      ["badge-white-filled-foreground", "var(--neutral-900)"],
    ] as const

    for (const [name, value] of badgeRoles) {
      expectSingleDeclaration(darkMode, name, value)
    }

    expectSingleDeclaration(readCssRule(":root"), "neutral-400", "#8f99b5")
  })

  it("exposes the utility tokens through Tailwind aliases", () => {
    const theme = readCssRule("@theme inline")
    const utilityRoles = [
      "border",
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
      "badge-gray",
      "badge-gray-filled",
      "badge-gray-filled-foreground",
      "badge-white",
      "badge-white-foreground",
      "badge-white-filled",
      "badge-white-filled-foreground",
      "confetti-yellow",
      "confetti-green",
      "confetti-sky",
      "confetti-teal",
      "confetti-coral",
      "confetti-purple",
    ]

    for (const name of utilityRoles) {
      expectSingleDeclaration(theme, `color-${name}`, `var(--${name})`)
    }
  })
})

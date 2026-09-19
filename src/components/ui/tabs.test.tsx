// @vitest-environment happy-dom
import { act } from "react"
import * as React from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"

import { Tabs, TabsGroup } from "./tabs"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(ui: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  return {
    container,
    async render() {
      await act(async () => root.render(ui))
    },
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ""
})

function TabsFixture({
  level,
  orientation = "horizontal",
  disabled = false,
  activateOnFocus = false,
}: {
  level: 1 | "1" | "2a" | "2b" | "3a" | "3b"
  orientation?: "horizontal" | "vertical"
  disabled?: boolean
  activateOnFocus?: boolean
}) {
  return (
    <Tabs.Root defaultValue="one" orientation={orientation}>
      <Tabs.List
        level={level}
        activateOnFocus={activateOnFocus}
        aria-label={`Level ${level} tabs`}
      >
        <Tabs.Tab value="one">
          One
          <Tabs.Badge>1</Tabs.Badge>
        </Tabs.Tab>
        <Tabs.Tab disabled={disabled} value="two">
          Two
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel keepMounted value="one">
        Panel one
      </Tabs.Panel>
      <Tabs.Panel keepMounted value="two">
        Panel two
      </Tabs.Panel>
    </Tabs.Root>
  )
}

describe("Tabs", () => {
  it("renders all five Figma levels as standalone Tabs", async () => {
    const levels = [1, "2a", "2b", "3a", "3b"] as const
    const view = render(
      <>
        {levels.map((level) => (
          <TabsFixture key={level} level={level} />
        ))}
      </>,
    )
    await view.render()

    const lists = view.container.querySelectorAll('[data-slot="tabs-list"]')
    const tabs = view.container.querySelectorAll('[data-slot="tabs-tab"]')

    expect("Group" in Tabs).toBe(false)
    expect(lists).toHaveLength(levels.length)
    expect(view.container.querySelector('[data-slot="tabs-group"]')).toBeNull()
    expect(tabs).toHaveLength(levels.length * 2)
    levels.forEach((level, index) => {
      expect(lists[index]?.getAttribute("data-level")).toBe(String(level))
      expect(tabs[index * 2]?.getAttribute("data-level")).toBe(String(level))
      expect(tabs[index * 2]?.hasAttribute("data-active")).toBe(true)
    })

    expect(tabs[0]?.className).toContain("data-[active]:bg-tabs-surface-hover")
    expect(tabs[2]?.className).toContain("data-[active]:after:bg-tabs-active-accent")
    expect(tabs[0]?.className).toContain("data-[active]:ring-tabs-border-secondary")
    expect(tabs[0]?.className).not.toContain("data-[active]:border-tabs-border-active")
    expect(tabs[6]?.className).toContain("rounded-full")
    expect(tabs[4]?.className).toContain("data-[active]:ring-tabs-border-active")
    expect(tabs[6]?.className).toContain("data-[active]:ring-tabs-border-active")
    expect(tabs[8]?.className).toContain("data-[active]:ring-tabs-border-secondary")

    const badge = view.container.querySelector('[data-slot="tabs-badge"]')
    expect(badge?.className).toContain("-ml-1")
    expect(badge?.className).toContain("leading-[1.2]")
    expect(badge?.hasAttribute("level")).toBe(false)

    await view.unmount()
  })

  it("keeps vertical orientation on the visual group and Base UI tablist", async () => {
    const view = render(<TabsFixture level="2b" orientation="vertical" />)
    await view.render()

    const list = view.container.querySelector('[role="tablist"]')
    const tab = view.container.querySelector('[data-slot="tabs-tab"]')

    expect(view.container.querySelector('[data-slot="tabs-group"]')).toBeNull()
    expect(list?.getAttribute("data-orientation")).toBe("vertical")
    expect(list?.getAttribute("aria-orientation")).toBe("vertical")
    expect(tab?.getAttribute("data-orientation")).toBe("vertical")
    expect(tab?.getAttribute("role")).toBe("tab")

    await view.unmount()
  })

  it("uses the root orientation as the single source of truth for standalone layout", async () => {
    const cases = [1, "2a", "2b", "3a", "3b"] as const
    const view = render(
      <>
        {cases.map((level) => (
          <TabsFixture key={level} level={level} orientation="vertical" />
        ))}
      </>,
    )
    await view.render()

    const lists = view.container.querySelectorAll('[data-slot="tabs-list"]')
    const tabs = view.container.querySelectorAll('[data-slot="tabs-tab"]')
    expect(lists[0]?.className).toContain("data-[orientation=vertical]:gap-2")
    expect(lists[1]?.className).toContain("data-[orientation=vertical]:gap-2")
    expect(lists[2]?.className).toContain("data-[orientation=vertical]:gap-2")
    expect(lists[3]?.className).toContain("data-[orientation=vertical]:gap-2")
    lists.forEach((list) => {
      expect(list.className).toContain("data-[orientation=vertical]:w-full")
      expect(list.getAttribute("data-orientation")).toBe("vertical")
    })
    tabs.forEach((tab) => {
      expect(tab.className).toContain("data-[orientation=vertical]:w-full")
    })

    await view.unmount()
  })

  it("keeps Figma horizontal list gaps for each level", async () => {
    const levels = [1, "2a", "2b", "3a", "3b"] as const
    const expectedGaps = ["gap-1", "gap-4", "gap-1", "gap-3", "gap-2"]
    const view = render(
      <>
        {levels.map((level) => (
          <TabsFixture key={level} level={level} />
        ))}
      </>,
    )
    await view.render()

    const lists = view.container.querySelectorAll('[data-slot="tabs-list"]')
    expectedGaps.forEach((gap, index) => {
      expect(lists[index]?.className).toContain(gap)
    })

    await view.unmount()
  })

  it("exposes Base UI active and disabled states without duplicating ARIA roles", async () => {
    const view = render(<TabsFixture disabled level="1" />)
    await view.render()

    const tabs = view.container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="tabs-tab"]',
    )
    const disabledTab = tabs[1]

    expect(tabs[0]?.hasAttribute("data-active")).toBe(true)
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true")
    expect(disabledTab?.getAttribute("aria-disabled")).toBe("true")
    expect(disabledTab?.hasAttribute("data-disabled")).toBe(true)
    expect(disabledTab?.className).toContain("data-[disabled]:text-tabs-text-disabled")
    expect(disabledTab?.getAttribute("role")).toBe("tab")

    await act(async () => disabledTab?.click())
    expect(tabs[0]?.hasAttribute("data-active")).toBe(true)
    expect(view.container.querySelector('[data-slot="tabs-panel"]')?.textContent).toBe(
      "Panel one",
    )

    await view.unmount()
  })

  it.each([
    { level: 1, hoverGuard: "data-[disabled]:hover:bg-transparent" },
    { level: "2a", hoverGuard: "data-[disabled]:hover:after:bg-transparent" },
    { level: "2b", hoverGuard: "data-[disabled]:hover:bg-transparent" },
    { level: "3a", hoverGuard: "data-[disabled]:hover:text-tabs-text-disabled" },
    { level: "3b", hoverGuard: "data-[disabled]:hover:text-tabs-text-disabled" },
  ] as const)("locks disabled interaction styles for level $level", async ({ level, hoverGuard }) => {
    const view = render(<TabsFixture disabled level={level} />)
    await view.render()

    const disabledTab = view.container.querySelector<HTMLButtonElement>(
      '[data-slot="tabs-tab"][data-disabled]',
    )

    expect(disabledTab?.getAttribute("aria-disabled")).toBe("true")
    expect(disabledTab?.className).not.toContain("disabled:pointer-events-none")
    expect(disabledTab?.className).not.toContain("data-[disabled]:pointer-events-none")
    expect(disabledTab?.className).toContain("data-[disabled]:cursor-not-allowed")
    expect(disabledTab?.className).toContain(hoverGuard)

    await view.unmount()
  })

  it("changes the active panel when the second tab is clicked", async () => {
    const view = render(<TabsFixture level="2b" />)
    await view.render()

    const tabs = view.container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="tabs-tab"]',
    )
    const panels = view.container.querySelectorAll<HTMLElement>(
      '[data-slot="tabs-panel"]',
    )

    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true")
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("false")
    expect(panels[0]?.hidden).toBe(false)
    expect(panels[1]?.hidden).toBe(true)

    await act(async () => tabs[1]?.click())

    expect(tabs[0]?.getAttribute("aria-selected")).toBe("false")
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true")
    expect(panels[0]?.hidden).toBe(true)
    expect(panels[1]?.hidden).toBe(false)

    await view.unmount()
  })

  it("moves focus with ArrowRight without activating by default", async () => {
    const view = render(<TabsFixture level="2b" />)
    await view.render()

    const tabs = view.container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="tabs-tab"]',
    )
    const firstTab = tabs[0]
    const secondTab = tabs[1]

    await act(async () => {
      firstTab?.focus()
      firstTab?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      )
    })
    expect(document.activeElement).toBe(secondTab)
    expect(firstTab?.getAttribute("aria-selected")).toBe("true")
    expect(secondTab?.getAttribute("aria-selected")).toBe("false")

    await view.unmount()
  })

  it("activates the focused tab with ArrowRight when activateOnFocus is enabled", async () => {
    const view = render(
      <TabsFixture level="2b" activateOnFocus />,
    )
    await view.render()

    const tabs = view.container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="tabs-tab"]',
    )
    const firstTab = tabs[0]
    const secondTab = tabs[1]
    const panels = view.container.querySelectorAll<HTMLElement>(
      '[data-slot="tabs-panel"]',
    )

    await act(async () => {
      firstTab?.focus()
      firstTab?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
        }),
      )
    })

    expect(document.activeElement).toBe(secondTab)
    expect(firstTab?.getAttribute("aria-selected")).toBe("false")
    expect(secondTab?.getAttribute("aria-selected")).toBe("true")
    expect(panels[0]?.hidden).toBe(true)
    expect(panels[1]?.hidden).toBe(false)

    await view.unmount()
  })

  it("marks Level 2a vertical as a generic fallback, not a Figma sample", async () => {
    const view = render(<TabsFixture level="2a" orientation="vertical" />)
    await view.render()

    const tab = view.container.querySelector('[data-slot="tabs-tab"]')
    expect(tab?.className).toContain("data-[orientation=vertical]:after:hidden")

    await view.unmount()
  })
})

function TabsGroupFixture({
  level,
  orientation = "horizontal",
}: {
  level: 1 | "1" | "2a" | "2b" | "3a" | "3b"
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <Tabs.Root defaultValue="one" orientation={orientation}>
      <TabsGroup level={level}>
        <Tabs.List aria-label={`Level ${level} grouped tabs`}>
          <Tabs.Tab value="one">
            One
            <Tabs.Badge>1</Tabs.Badge>
          </Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </TabsGroup>
      <Tabs.Panel keepMounted value="one">
        Panel one
      </Tabs.Panel>
      <Tabs.Panel keepMounted value="two">
        Panel two
      </Tabs.Panel>
    </Tabs.Root>
  )
}

describe("TabsGroup", () => {
  it("renders the visual wrapper separately from the Tabs API", async () => {
    const levels = [1, "2a", "2b", "3a", "3b"] as const
    const view = render(
      <>
        {levels.map((level) => (
          <TabsGroupFixture key={level} level={level} />
        ))}
      </>,
    )
    await view.render()

    expect("Group" in Tabs).toBe(false)

    const groups = view.container.querySelectorAll('[data-slot="tabs-group"]')
    const lists = view.container.querySelectorAll('[data-slot="tabs-list"]')
    const tabs = view.container.querySelectorAll('[data-slot="tabs-tab"]')

    expect(groups).toHaveLength(levels.length)
    expect(lists).toHaveLength(levels.length)
    expect(tabs).toHaveLength(levels.length * 2)
    levels.forEach((level, index) => {
      expect(groups[index]?.getAttribute("data-level")).toBe(String(level))
      expect(lists[index]?.getAttribute("data-level")).toBe(String(level))
      expect(tabs[index * 2]?.getAttribute("data-level")).toBe(String(level))
    })

    await view.unmount()
  })

  it("preserves the exact Figma group geometry for vertical variants", async () => {
    const cases = [
      { level: 1 as const, width: "w-[200px]", hasFrame: true },
      { level: "2b" as const, width: "w-[192px]", hasFrame: true },
      { level: "3a" as const, width: "w-[196px]", hasFrame: false },
      { level: "3b" as const, width: "w-[192px]", hasFrame: false },
    ]
    const view = render(
      <>
        {cases.map(({ level }) => (
          <TabsGroupFixture key={level} level={level} orientation="vertical" />
        ))}
      </>,
    )
    await view.render()

    const groups = view.container.querySelectorAll('[data-slot="tabs-group"]')
    const lists = view.container.querySelectorAll('[data-slot="tabs-list"]')
    const tabs = view.container.querySelectorAll('[data-slot="tabs-tab"]')

    cases.forEach(({ width, hasFrame }, index) => {
      expect(groups[index]?.className).toContain(
        `data-[orientation=vertical]:${width}`,
      )
      if (hasFrame) {
        expect(groups[index]?.className).toContain(
          "data-[orientation=vertical]:rounded-xl",
        )
        expect(groups[index]?.className).toContain(
          "data-[orientation=vertical]:p-2",
        )
      }
      expect(groups[index]?.getAttribute("data-orientation")).toBe("vertical")
      expect(lists[index]?.className).toContain("data-[orientation=vertical]:w-full")
      expect(tabs[index * 2]?.className).toContain(
        "data-[orientation=vertical]:w-full",
      )
    })

    await view.unmount()
  })

  it("keeps Tabs interaction real when composed with the visual group", async () => {
    const view = render(<TabsGroupFixture level="2b" />)
    await view.render()

    const tabs = view.container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="tabs-tab"]',
    )
    const panels = view.container.querySelectorAll<HTMLElement>(
      '[data-slot="tabs-panel"]',
    )

    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true")
    expect(panels[0]?.hidden).toBe(false)

    await act(async () => tabs[1]?.click())

    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true")
    expect(panels[0]?.hidden).toBe(true)
    expect(panels[1]?.hidden).toBe(false)

    await view.unmount()
  })
})

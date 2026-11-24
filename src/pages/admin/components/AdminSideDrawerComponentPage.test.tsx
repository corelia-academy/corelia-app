// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))

import AdminSideDrawerComponentPage from "./AdminSideDrawerComponentPage"

async function render(embedded = false) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminSideDrawerComponentPage embedded={embedded} />
      </MemoryRouter>,
    )
  })

  return container
}

const click = (element: Element | null | undefined) =>
  act(async () => (element as HTMLElement | null | undefined)?.click())

describe("AdminSideDrawerComponentPage", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders a trigger and a criterion for each size", async () => {
    const container = await render()

    expect(container.querySelector("h1")?.textContent).toBe("Side Drawer")
    expect(container.querySelector('[data-testid="side-drawer-trigger-30vw"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="side-drawer-trigger-50vw"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="side-drawer-criteria"] > div')).toHaveLength(2)
    expect(document.querySelector('[data-slot="side-drawer"]')).toBeNull()
  })

  it("renders in embedded mode without the outer header", async () => {
    const container = await render(true)

    expect(container.querySelector("h1")).toBeNull()
    expect(container.querySelector('[data-testid="side-drawer-trigger-30vw"]')).not.toBeNull()
  })

  it("opens the 30vw drawer alone", async () => {
    const container = await render()

    await click(container.querySelector('[data-testid="side-drawer-trigger-30vw"]'))

    const drawers = document.querySelectorAll('[data-slot="side-drawer"]')
    expect(drawers).toHaveLength(1)
    expect(drawers[0].className).toContain("w-[min(480px,100vw)]")
  })

  it("opens the 50vw drawer and closes it with the close button", async () => {
    const container = await render()

    await click(container.querySelector('[data-testid="side-drawer-trigger-50vw"]'))
    const drawer = document.querySelector('[data-slot="side-drawer"]')
    expect(drawer?.className).toContain("w-[min(720px,100vw)]")

    await click(drawer?.querySelector('[data-slot="side-drawer-close"]'))
    expect(document.querySelector('[data-slot="side-drawer"]')).toBeNull()
  })
})

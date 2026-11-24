// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))

import AdminModalComponentPage from "./AdminModalComponentPage"

async function render(embedded = false) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminModalComponentPage embedded={embedded} />
      </MemoryRouter>,
    )
  })

  return container
}

const click = (element: Element | null | undefined) =>
  act(async () => (element as HTMLElement | null | undefined)?.click())

describe("AdminModalComponentPage", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders a trigger and a criterion for each of the five modal types", async () => {
    const container = await render()

    expect(container.querySelector("h1")?.textContent).toBe("Modal")
    for (const type of ["confirmation", "destructive", "form", "status", "slot"]) {
      expect(container.querySelector(`[data-testid="modal-trigger-${type}"]`)).not.toBeNull()
    }
    expect(container.querySelectorAll('[data-testid="modal-criteria"] > div')).toHaveLength(5)
    expect(document.querySelector('[data-slot="modal"]')).toBeNull()
  })

  it("renders in embedded mode without the outer header", async () => {
    const container = await render(true)

    expect(container.querySelector("h1")).toBeNull()
    expect(container.querySelector('[data-testid="modal-trigger-form"]')).not.toBeNull()
  })

  it("opens one modal at a time and closes it with Cancel", async () => {
    const container = await render()

    await click(container.querySelector('[data-testid="modal-trigger-destructive"]'))
    expect(document.querySelectorAll('[data-slot="modal"]')).toHaveLength(1)
    expect(document.querySelector('[data-slot="modal"]')?.getAttribute("data-type")).toBe("destructive")

    const cancel = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Huỷ")
    await click(cancel)
    expect(document.querySelector('[data-slot="modal"]')).toBeNull()
    expect(container.textContent).toContain("destructive / cancel")
  })

  it("closes after Confirm and records the action", async () => {
    const container = await render()

    await click(container.querySelector('[data-testid="modal-trigger-form"]'))
    expect(document.querySelector('[data-slot="modal"] input')).not.toBeNull()

    const confirm = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Xác nhận")
    await click(confirm)
    expect(document.querySelector('[data-slot="modal"]')).toBeNull()
    expect(container.textContent).toContain("form / confirm")
  })

  it("opens the status modal without any buttons", async () => {
    const container = await render()

    await click(container.querySelector('[data-testid="modal-trigger-status"]'))
    expect(document.querySelector('[data-slot="modal"] [data-slot="modal-illustration"] svg')).not.toBeNull()
    expect(document.querySelector('[data-slot="modal-actions"]')).toBeNull()
  })
})

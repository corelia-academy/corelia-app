// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))

import AdminToastBarComponentPage from "./AdminToastBarComponentPage"

describe("AdminToastBarComponentPage", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders as an independent showcase page with all 8 models", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminToastBarComponentPage />
        </MemoryRouter>,
      )
    })

    expect(container.querySelector("h1")?.textContent).toBe("Toast Bar")
    expect(container.querySelector('[data-testid="toast-bar-top-group"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="toast-bar-bottom-group"]')).not.toBeNull()

    // 8 models
    expect(container.querySelectorAll('[data-slot="toast-bar"]')).toHaveLength(8)
    expect(container.querySelectorAll('[data-slot="informative-icon"]')).toHaveLength(8)

    // Trigger buttons
    expect(container.querySelector('[data-testid="trigger-toast-success"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="trigger-toast-error"]')).not.toBeNull()
  })

  it("renders in embedded mode without outer header", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminToastBarComponentPage embedded />
        </MemoryRouter>,
      )
    })

    expect(container.querySelector("h1")).toBeNull()
    expect(container.querySelectorAll('[data-slot="toast-bar"]')).toHaveLength(8)
  })
})

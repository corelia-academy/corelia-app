// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}))

import { Toaster } from "./sonner"

describe("Toaster Component", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders Sonner toaster container", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<Toaster />)
    })

    const section = container.querySelector("section[aria-live='polite']")
    expect(section).not.toBeNull()
  })

  it("renders custom InformativeIcon on toast trigger", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<Toaster />)
    })

    await act(async () => {
      toast.success("Thao tác thành công")
      await new Promise((r) => setTimeout(r, 50))
    })

    const toastText = document.body.textContent
    expect(toastText).toContain("Thao tác thành công")
    const informativeIcon = document.body.querySelector("[data-slot='informative-icon']")
    expect(informativeIcon).not.toBeNull()
  })
})

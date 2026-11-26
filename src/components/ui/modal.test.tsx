// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Modal, type ModalProps } from "./modal"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let cleanup: (() => void) | undefined

afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

async function mount(props: ModalProps) {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  cleanup = () => {
    act(() => root.unmount())
    host.remove()
  }
  await act(async () => root.render(<Modal {...props} />))
}

const actionProps = {
  open: true,
  onOpenChange: () => {},
  title: "Xoá khoá học?",
  description: "Không thể hoàn tác.",
  cancelLabel: "Huỷ",
  confirmLabel: "Xác nhận",
} as const

const popup = () => document.querySelector<HTMLElement>('[data-slot="modal"]')
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label)

describe("Modal", () => {
  it("renders nothing while closed", async () => {
    await mount({ ...actionProps, open: false })

    expect(popup()).toBeNull()
  })

  it.each([
    ["confirmation", "success"],
    ["destructive", "warning"],
  ] as const)("shows the %s featured icon in %s", async (type, color) => {
    await mount({ ...actionProps, type })

    expect(popup()?.getAttribute("data-type")).toBe(type)
    expect(popup()?.querySelector('[data-slot="informative-icon"]')?.getAttribute("data-color")).toBe(color)
    expect(popup()?.querySelector('[data-slot="informative-icon"]')?.getAttribute("data-size")).toBe("lg")
    expect(popup()?.getAttribute("role")).toBe("dialog")
  })

  it.each(["form", "slot"] as const)("has no featured icon for %s", async (type) => {
    await mount({ ...actionProps, type })

    expect(popup()?.querySelector('[data-slot="informative-icon"]')).toBeNull()
  })

  it("uses the 520px width for the slot type and 440px otherwise", async () => {
    await mount({ ...actionProps, type: "slot" })
    expect(popup()?.className).toContain("max-w-[520px]")
    cleanup?.()

    await mount({ ...actionProps, type: "form" })
    expect(popup()?.className).toContain("max-w-[440px]")
  })

  it("renders the status type with an illustration and no buttons", async () => {
    await mount({ open: true, onOpenChange: () => {}, type: "status", title: "Đang xử lý" })

    expect(popup()?.querySelector('[data-slot="modal-illustration"] svg')).not.toBeNull()
    expect(popup()?.querySelector('[data-slot="modal-actions"]')).toBeNull()
    expect(button("Huỷ")).toBeUndefined()
  })

  it("swaps the status illustration", async () => {
    await mount({
      open: true,
      onOpenChange: () => {},
      type: "status",
      title: "Xong",
      illustration: <span data-testid="custom-illustration" />,
    })

    expect(document.querySelector('[data-testid="custom-illustration"]')).not.toBeNull()
    expect(popup()?.querySelector('[data-slot="modal-illustration"] svg')).toBeNull()
  })

  it("renders the content slot only when children are passed", async () => {
    await mount({ ...actionProps, type: "form" })
    expect(popup()?.querySelector('[data-slot="modal-slot"]')).toBeNull()
    cleanup?.()

    await mount({ ...actionProps, type: "form", children: <input aria-label="Tên" /> })
    expect(popup()?.querySelector('[data-slot="modal-slot"] input')).not.toBeNull()
  })

  it("cancel runs onCancel and requests close; confirm only runs onConfirm", async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    await mount({ ...actionProps, onCancel, onConfirm, onOpenChange })

    await act(async () => button("Xác nhận")?.click())
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()

    await act(async () => button("Huỷ")?.click())
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it("disables the confirm button", async () => {
    await mount({ ...actionProps, confirmDisabled: true })

    expect(button("Xác nhận")?.disabled).toBe(true)
  })

  it("uses the destructive button variant for destructive actions", async () => {
    await mount({ ...actionProps, type: "destructive" })

    expect(button("Xác nhận")?.className).toContain("bg-button-destructive-primary")
  })

  it("labels the close button and can hide it", async () => {
    await mount({ ...actionProps, closeLabel: "Đóng" })
    expect(popup()?.querySelector('[data-slot="modal-close"]')?.textContent).toBe("Đóng")
    cleanup?.()

    await mount({ ...actionProps, showCloseButton: false })
    expect(popup()?.querySelector('[data-slot="modal-close"]')).toBeNull()
  })

  it("links the dialog to its title and description", async () => {
    await mount(actionProps)

    const title = popup()?.querySelector('[data-slot="modal-title"]')
    const description = popup()?.querySelector('[data-slot="modal-description"]')
    expect(popup()?.getAttribute("aria-labelledby")).toBe(title?.id)
    expect(popup()?.getAttribute("aria-describedby")).toBe(description?.id)
  })
})

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ToastBar } from "./toast-bar"

const variants = ["success", "warning", "info", "error"] as const
const positions = ["top", "bottom"] as const

describe("ToastBar Component", () => {
  it.each(variants)("renders correctly with variant %s", (variant) => {
    const markup = renderToStaticMarkup(
      <ToastBar variant={variant}>Đã cập nhật thay đổi thành công</ToastBar>,
    )

    expect(markup).toContain('data-slot="toast-bar"')
    expect(markup).toContain(`data-variant="${variant}"`)
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain("Đã cập nhật thay đổi thành công")
    expect(markup).toContain('data-slot="informative-icon"')
  })

  it.each(positions)("renders with position %s", (position) => {
    const markup = renderToStaticMarkup(
      <ToastBar position={position}>Thông báo vị trí</ToastBar>,
    )

    expect(markup).toContain(`data-position="${position}"`)
  })

  it("renders all 8 Figma variant combinations without crashing", () => {
    const markup = renderToStaticMarkup(
      <div>
        {positions.flatMap((pos) =>
          variants.map((v) => (
            <ToastBar key={`${pos}-${v}`} position={pos} variant={v}>
              Đã cập nhật thay đổi thành công
            </ToastBar>
          )),
        )}
      </div>,
    )

    expect(markup.match(/data-slot="toast-bar"/g)).toHaveLength(8)
    expect(markup.match(/data-slot="informative-icon"/g)).toHaveLength(8)
  })
})

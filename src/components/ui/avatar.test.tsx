import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  AVATAR_SIZES,
  AVATAR_TYPES,
  Avatar,
  AvatarAction,
  AvatarFallback,
} from "./avatar"

describe("Avatar Figma contract", () => {
  it("exposes every canonical size and type as stable data attributes", () => {
    for (const type of AVATAR_TYPES) {
      for (const size of AVATAR_SIZES) {
        const markup = renderToStaticMarkup(
          <Avatar type={type} size={size}>
            <AvatarFallback>OR</AvatarFallback>
          </Avatar>,
        )

        expect(markup).toContain(`data-avatar-size="${size === "1.5XLarge" ? "xlarge-1-5" : size === "2XLarge" ? "xlarge-2" : size === "3XLarge" ? "xlarge-3" : size === "4XLarge" ? "xlarge-4" : size.toLowerCase()}"`)
        expect(markup).toContain(`data-avatar-type="${type === "Set avatar" ? "set-avatar" : type === "Brand Logos" ? "brand-logos" : type.toLowerCase()}"`)
      }
    }
  })

  it("renders edit and add actions only for their Figma type and size", () => {
    const userAction = renderToStaticMarkup(
      <Avatar type="User" size="XLarge">
        <AvatarFallback>OR</AvatarFallback>
        <AvatarAction kind="edit" aria-label="Edit avatar" />
      </Avatar>,
    )
    const setAction = renderToStaticMarkup(
      <Avatar type="Set avatar" size="XLarge">
        <AvatarFallback>OR</AvatarFallback>
        <AvatarAction kind="add" aria-label="Add avatar" />
      </Avatar>,
    )
    const textAction = renderToStaticMarkup(
      <Avatar type="Text" size="XLarge">
        <AvatarFallback>OR</AvatarFallback>
        <AvatarAction kind="edit" aria-label="Edit avatar" />
      </Avatar>,
    )
    const smallUser = renderToStaticMarkup(
      <Avatar type="User" size="Large">
        <AvatarFallback>OR</AvatarFallback>
        <AvatarAction kind="edit" aria-label="Edit avatar" />
      </Avatar>,
    )

    expect(userAction).toContain('data-avatar-action="edit"')
    expect(userAction).toContain("absolute right-0 bottom-0")
    expect(setAction).toContain('data-avatar-action="add"')
    expect(textAction).toContain('data-avatar-action="edit"')
    expect(smallUser).not.toContain("data-avatar-action")
  })

  it("does not render an active action for a disabled avatar", () => {
    const markup = renderToStaticMarkup(
      <Avatar type="Disabled" size="4XLarge">
        <AvatarFallback>OR</AvatarFallback>
        <AvatarAction kind="edit" aria-label="Edit avatar" />
      </Avatar>,
    )

    expect(markup).not.toContain("data-avatar-action")
  })
})

// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { CaretDown } from "@phosphor-icons/react"
import { UserRound } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuSearch,
  DropdownMenuSelectAll,
  DropdownMenuTrigger,
} from "./dropdown-menu"

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderMenuItem(children: React.ReactNode) {
  return renderToStaticMarkup(
    <DropdownMenu open>{children}</DropdownMenu>,
  )
}

describe("Dropdown Menu multiple list", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders the based item content slots in Figma order", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenuItemContent
        leading={<UserRound data-testid="leading-icon" />}
        supportingText="Supporting Text"
        badge={<span data-testid="badge">03</span>}
      >
        Lorem ipsum
      </DropdownMenuItemContent>,
    )

    expect(markup.indexOf('data-testid="leading-icon"')).toBeGreaterThan(-1)
    expect(markup.indexOf("Lorem ipsum")).toBeGreaterThan(-1)
    expect(markup.indexOf("Supporting Text")).toBeGreaterThan(-1)
    expect(markup.indexOf('data-testid="badge"')).toBeGreaterThan(-1)
    expect(markup).toContain("text-dropdown-title")
    expect(markup).toContain("text-dropdown-supporting")
  })

  it("supports hiding the trailing icon", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenuItemContent showTrailingIcon={false}>
        Item
      </DropdownMenuItemContent>,
    )

    expect(markup).not.toContain("lucide-chevron-down")
  })

  it("renders only the caller-provided trailing icon", () => {
    const customIconMarkup = renderToStaticMarkup(
      <DropdownMenuItemContent
        trailingIcon={<CaretDown data-testid="custom-trailing-icon" />}
      >
        Item
      </DropdownMenuItemContent>,
    )
    const noIconMarkup = renderToStaticMarkup(
      <DropdownMenuItemContent>Item</DropdownMenuItemContent>,
    )

    expect(customIconMarkup).toContain('data-slot="dropdown-menu-item-trailing-icon"')
    expect(customIconMarkup).toContain('data-testid="custom-trailing-icon"')
    expect(customIconMarkup).not.toContain("lucide-chevron-down")
    expect(noIconMarkup).not.toContain('data-slot="dropdown-menu-item-trailing-icon"')
  })

  it("supports a larger trailing control hit area without changing the icon slot", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenuItemContent
        trailingIconHitArea="control"
        trailingIcon={<CaretDown data-testid="control-trailing-icon" />}
      >
        Item
      </DropdownMenuItemContent>,
    )

    expect(markup).toContain('data-hit-area="control"')
    expect(markup).toContain("size-11")
    expect(markup).toContain('data-testid="control-trailing-icon"')
  })

  it("renders the optional menu header slots", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenuHeader
        title="Select people"
        supportingText="Choose people"
        action={<span data-testid="header-action">Manage</span>}
      />,
    )

    expect(markup).toContain('data-slot="dropdown-menu-header"')
    expect(markup).toContain("Select people")
    expect(markup).toContain("Choose people")
    expect(markup).toContain('data-testid="header-action"')
  })

  it("renders the multiple-list popup layout and composed controls", () => {
    const searchMarkup = renderToStaticMarkup(
      <DropdownMenuSearch
        placeholder="Search"
        aria-label="Search"
        value=""
        readOnly
      />,
    )
    const selectAllMarkup = renderToStaticMarkup(
      <DropdownMenuSelectAll
        label="Select All"
        checked={false}
        indeterminate
        onCheckedChange={() => undefined}
      />,
    )
    const listMarkup = renderToStaticMarkup(
      <DropdownMenu open>
        <DropdownMenuList>
          <DropdownMenuCheckboxItem checked>
            <DropdownMenuItemContent supportingText="Supporting Text">
              Lorem ipsum
            </DropdownMenuItemContent>
          </DropdownMenuCheckboxItem>
        </DropdownMenuList>
      </DropdownMenu>,
    )

    expect(searchMarkup).toContain("bg-dropdown-surface")
    expect(searchMarkup).toContain("border-dropdown-input-border")
    expect(selectAllMarkup).toContain("Select All")
    expect(listMarkup).toContain('data-slot="dropdown-menu-list"')
    expect(listMarkup).toContain(
      'data-slot="dropdown-menu-checkbox-item-indicator"',
    )
    expect(listMarkup).toContain('data-slot="dropdown-menu-item-supporting"')
  })

  it("matches Figma item radii and keeps hover separate from focus", () => {
    const markup = renderMenuItem(
      <DropdownMenuCheckboxItem>
        <DropdownMenuItemContent supportingText="Supporting Text">
          Lorem ipsum
        </DropdownMenuItemContent>
      </DropdownMenuCheckboxItem>,
    )
    const normalizedMarkup = markup
      .replaceAll("&amp;", "&")
      .replaceAll("&#x27;", "'")

    expect(normalizedMarkup).toContain("rounded-xl")
    expect(normalizedMarkup).toContain("hover:rounded-xl")
    expect(normalizedMarkup).toContain("hover:bg-dropdown-hover")
    expect(normalizedMarkup).not.toContain("[&:hover:not(:focus)]")
    expect(normalizedMarkup).toContain("focus-visible:rounded-xl")
    expect(normalizedMarkup).toContain("focus-visible:after:inset-[-1px]")
    expect(normalizedMarkup).toContain("focus-visible:after:rounded-xl")
    expect(normalizedMarkup).toContain("focus-visible:after:border-2")
    expect(normalizedMarkup).toContain("focus-visible:after:border-dropdown-focus")
    expect(normalizedMarkup).not.toContain("focus:rounded-xl")
    expect(normalizedMarkup).not.toContain("focus:after:inset-[-1px]")
    expect(normalizedMarkup).toContain("data-checked:rounded-xl")
    expect(normalizedMarkup).toContain("data-disabled:hover:rounded-xl")
    expect(normalizedMarkup).not.toContain("rounded-sm")
    expect(normalizedMarkup).not.toContain("focus:after:inset-[-2px]")
    expect(normalizedMarkup).not.toContain("focus:after:rounded-[10px]")
    expect(normalizedMarkup).not.toContain("focus:ring-2")
  })

  it("mounts the multiple-list layout through the existing menu portal", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent layout="multiple-list">
            <DropdownMenuSearch placeholder="Search" aria-label="Search" />
            <DropdownMenuSelectAll label="Select All" />
            <DropdownMenuList>
              <DropdownMenuCheckboxItem>
                <DropdownMenuItemContent supportingText="Supporting Text">
                  Lorem ipsum
                </DropdownMenuItemContent>
              </DropdownMenuCheckboxItem>
            </DropdownMenuList>
          </DropdownMenuContent>
        </DropdownMenu>,
      )
    })

    const content = document.body.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-content"][data-layout="multiple-list"]',
    )

    expect(content).not.toBeNull()
    expect(content?.className).toContain("w-[296px]")
    expect(content?.querySelector('input[type="search"]')).not.toBeNull()
    expect(content?.textContent).toContain("Select All")
    expect(content?.querySelector('[data-slot="dropdown-menu-list"]')).not.toBeNull()

    await act(async () => root.unmount())
    container.remove()
  })

  it("keeps warning and disabled states scoped to dropdown item tokens", () => {
    const warningMarkup = renderMenuItem(
      <DropdownMenuCheckboxItem variant="warning">
        <DropdownMenuItemContent supportingText="Warning detail">
          Warning item
        </DropdownMenuItemContent>
      </DropdownMenuCheckboxItem>,
    )

    const disabledMarkup = renderMenuItem(
      <DropdownMenuCheckboxItem disabled>
        <DropdownMenuItemContent supportingText="Disabled detail">
          Disabled item
        </DropdownMenuItemContent>
      </DropdownMenuCheckboxItem>,
    )

    const checkedDisabledMarkup = renderMenuItem(
      <DropdownMenuCheckboxItem checked disabled>
        <DropdownMenuItemContent supportingText="Active disabled detail">
          Active disabled item
        </DropdownMenuItemContent>
      </DropdownMenuCheckboxItem>,
    )

    expect(warningMarkup).toContain('data-variant="warning"')
    expect(disabledMarkup).toContain("data-disabled")
    expect(disabledMarkup).toContain("data-disabled:cursor-not-allowed")
    expect(disabledMarkup).not.toContain("data-disabled:pointer-events-none")
    expect(checkedDisabledMarkup).toContain("bg-dropdown-checkbox-disabled-active")
    expect(checkedDisabledMarkup).toContain("border-0")
    expect(checkedDisabledMarkup).toContain("text-dropdown-checkbox-disabled-mark")
    expect(checkedDisabledMarkup).not.toContain(
      "group-data-[disabled]/dropdown-menu-checkbox-item:bg-transparent",
    )
  })

  it("renders a mixed checkbox state for nested parent items", () => {
    const markup = renderMenuItem(
      <DropdownMenuCheckboxItem indeterminate>
        <DropdownMenuItemContent supportingText="Some children are selected">
          Parent item
        </DropdownMenuItemContent>
      </DropdownMenuCheckboxItem>,
    )

    expect(markup).toContain('data-indeterminate="true"')
    expect(markup).toContain('aria-checked="mixed"')
    expect(markup).toContain("lucide-minus")
  })
})

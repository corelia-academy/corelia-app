// @vitest-environment happy-dom
import * as React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup as renderServerMarkup } from "react-dom/server"
import { I18nextProvider, useTranslation } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemContent,
  DropdownMenuList,
  DropdownMenuSearch,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import i18n from "@/i18n"
import { Field, FieldContextReset, FieldLabel } from "./field"
import {
  Input,
  type InputAccessoryState,
  type InputOption,
  type InputProps,
  type InputTagMenuState,
  type InputVariant,
} from "./input"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderToStaticMarkup(ui: React.ReactNode) {
  return renderServerMarkup(
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>,
  )
}

function render(ui: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  return {
    container,
    root,
    async mount() {
      await act(async () =>
        root.render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>),
      )
    },
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

function TestSelector({
  ariaLabel,
  options,
  state,
  side,
  onValueChange,
}: {
  ariaLabel: string
  options: readonly InputOption[]
  state: InputAccessoryState
  side: "leading" | "trailing"
  onValueChange?: (value: string) => void
}) {
  const { t } = useTranslation("common")
  const [value, setValue] = React.useState(options[0]?.value ?? "")
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const selectedOption = options.find((option) => option.value === value)
  const filteredOptions = options.filter((option) => {
    const label = typeof option.label === "string" ? option.label : option.value
    return `${label} ${option.value}`.toLowerCase().includes(search.toLowerCase())
  })
  const isLeading = side === "leading"

  return (
    <div
      data-accessory-disabled={state.disabled || undefined}
      data-accessory-invalid={state.invalid || undefined}
      className={
        isLeading
          ? "flex h-full shrink-0 items-center border-r border-input-field-divider pr-lg mr-xs group-focus-within/input-field:border-input-field-divider-focus"
          : "flex h-full shrink-0 items-center border-l border-input-field-divider pl-lg ml-xs group-focus-within/input-field:border-input-field-divider-focus"
      }
    >
      <DropdownMenu
        open={!state.disabled && open}
        onOpenChange={(nextOpen) => setOpen(!state.disabled && nextOpen)}
      >
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={ariaLabel}
              disabled={state.disabled}
              className={`inline-flex h-10 shrink-0 items-center rounded-sm bg-transparent p-0 text-body-large font-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-input-field-focus-ring disabled:cursor-not-allowed disabled:text-input-field-disabled-foreground ${isLeading ? "gap-xs" : "gap-md"}`}
            />
          }
        >
          <span className="max-w-32 truncate">
            {selectedOption?.label ?? value}
          </span>
          <span className="inline-flex size-4 items-center justify-center">
            <CaretDown aria-hidden="true" size={16} weight="regular" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent layout="multiple-list" className="w-max min-w-32">
          <DropdownMenuSearch>
            <FieldContextReset>
              <Input
                type="search"
                variant="icon-leading"
                disabled={state.disabled}
                leadingIconClassName="text-dropdown-supporting"
                statusIcon={null}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t("actions.search")}
                aria-label={t("combobox.searchLabel", { label: ariaLabel })}
                controlClassName="h-10 gap-sm rounded-lg border-dropdown-input-border bg-dropdown-surface px-md focus-within:ring-dropdown-focus"
                className="text-body-large text-dropdown-title placeholder:text-dropdown-supporting"
              />
            </FieldContextReset>
          </DropdownMenuSearch>
          <DropdownMenuList>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  disabled={state.disabled || option.disabled}
                  className="min-h-[42px] whitespace-nowrap"
                  onClick={() => {
                    setValue(option.value)
                    onValueChange?.(option.value)
                  }}
                >
                  <DropdownMenuItemContent>{option.label}</DropdownMenuItemContent>
                </DropdownMenuItem>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-body-small text-dropdown-supporting">
                {t("combobox.emptyLabel")}
              </p>
            )}
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TestTagMenu({ menu }: { menu: InputTagMenuState }) {
  const { t } = useTranslation("common")
  const [search, setSearch] = React.useState("")
  const filteredOptions = menu.options.filter((option) => {
    const label = typeof option.label === "string" ? option.label : option.value
    return `${label} ${option.value}`.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <DropdownMenu open={menu.open} onOpenChange={menu.onOpenChange}>
      <DropdownMenuTrigger
        render={menu.trigger}
        aria-label={menu.triggerAriaLabel}
      />
      <DropdownMenuContent
        layout="multiple-list"
        sideOffset={8}
        className="w-max min-w-32"
      >
        <DropdownMenuSearch>
          <FieldContextReset>
            <Input
              type="search"
              variant="icon-leading"
              disabled={menu.disabled}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={t("actions.search")}
              aria-label={t("combobox.searchLabel", {
                label: t("combobox.tagsLabel"),
              })}
            />
          </FieldContextReset>
        </DropdownMenuSearch>
        <DropdownMenuList>
          {filteredOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={menu.selectedValues.includes(option.value)}
              disabled={menu.disabled || option.disabled}
              size="compact"
              onCheckedChange={(checked, eventDetails) => {
                eventDetails.cancel()
                menu.onSelectedValuesChange(
                  checked
                    ? [...menu.selectedValues, option.value]
                    : menu.selectedValues.filter((value) => value !== option.value),
                )
              }}
            >
              <DropdownMenuItemContent leading={option.leadingVisual}>
                {option.label}
              </DropdownMenuItemContent>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("Input", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })

  it.each<InputVariant>([
    "default",
    "icon-leading",
    "tags",
  ])("renders the %s design variant independently of native input type", (variant) => {
    const markup = renderToStaticMarkup(
      <Field label="Example">
        <Input
          variant={variant}
          type="email"
          tagOptions={[{ value: "react", label: "React" }]}
          selectedTagValues={["react"]}
        />
      </Field>,
    )

    expect(markup).toContain(`data-variant="${variant}"`)
    expect(markup).toContain('type="email"')
  })

  it("uses exact default icon slots and permits ReactNode overrides or null", () => {
    const defaultMarkup = renderToStaticMarkup(
      <Field label="Search">
        <Input variant="icon-leading" />
      </Field>,
    )
    const customMarkup = renderToStaticMarkup(
      <Field label="Search">
        <Input
          variant="icon-leading"
          leadingIcon={<span data-testid="custom-leading-icon">L</span>}
          statusIcon={<span data-testid="custom-status-icon">S</span>}
        />
      </Field>,
    )
    const hiddenMarkup = renderToStaticMarkup(
      <Field label="Search">
        <Input
          variant="icon-leading"
          leadingIcon={null}
          statusIcon={null}
        />
      </Field>,
    )

    expect(defaultMarkup).toContain('data-slot="input-field-leading-icon"')
    expect(defaultMarkup).toContain('data-slot="input-field-status-icon"')
    expect(defaultMarkup).toContain("text-foreground-subtle")

    const defaultHost = document.createElement("div")
    defaultHost.innerHTML = defaultMarkup

    expect(
      defaultHost.querySelector('[data-slot="input-field-leading-icon"] svg'),
    ).not.toBeNull()
    expect(
      defaultHost.querySelector('[data-slot="input-field-status-icon"] svg'),
    ).not.toBeNull()

    expect(customMarkup).toContain('data-testid="custom-leading-icon"')
    expect(customMarkup).toContain('data-testid="custom-status-icon"')

    const customHost = document.createElement("div")
    customHost.innerHTML = customMarkup

    expect(
      customHost.querySelector('[data-slot="input-field-leading-icon"] svg'),
    ).toBeNull()
    expect(
      customHost.querySelector('[data-slot="input-field-status-icon"] svg'),
    ).toBeNull()

    expect(hiddenMarkup).not.toContain('data-slot="input-field-leading-icon"')
    expect(hiddenMarkup).not.toContain('data-slot="input-field-status-icon"')
  })

  it("marks errors invalid and links the error text to the input", () => {
    const markup = renderToStaticMarkup(
      <Field label="Email address" error="Enter a valid email address">
        <Input id="email-address" aria-invalid={false} />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const input = host.querySelector<HTMLInputElement>("#email-address")
    const error = host.querySelector<HTMLElement>("#email-address-error")

    expect(input?.getAttribute("aria-invalid")).toBe("true")
    expect(input?.getAttribute("aria-describedby")?.split(" ")).toContain(
      "email-address-error",
    )
    expect(error?.textContent).toBe("Enter a valid email address")
    expect(
      host.querySelector('[data-slot="input-field-control"]')?.getAttribute(
        "data-invalid",
      ),
    ).toBe("true")
    expect(host.querySelector('[data-slot="input-field-status-icon"]')?.className).toContain(
      "text-input-field-error",
    )
  })

  it("treats boolean Field content as absent", () => {
    const markup = renderToStaticMarkup(
      <Field label={false} hint={false} error={false}>
        <Input id="optional-metadata" />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const input = host.querySelector<HTMLInputElement>("#optional-metadata")

    expect(host.querySelector("label")).toBeNull()
    expect(host.querySelector('[data-slot="field-description"]')).toBeNull()
    expect(input?.getAttribute("aria-invalid")).toBeNull()
    expect(host.querySelector('[data-slot="input-field-control"]')).toBeNull()
  })

  it("associates a Field label with an explicit Input id on the first render", () => {
    const markup = renderToStaticMarkup(
      <Field label="Account name">
        <Input id="account-name" />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const label = host.querySelector<HTMLLabelElement>(
      'label[for="account-name"]',
    )
    const input = host.querySelector<HTMLInputElement>("#account-name")

    expect(label?.textContent).toBe("Account name")
    expect(label?.htmlFor).toBe(input?.id)
    expect(label?.getAttribute("for")).toBe("account-name")
  })

  it("finds the control through fragments and wrappers for initial IDs and metrics", () => {
    const markup = renderToStaticMarkup(
      <Field label="Teams" hint="Choose one or more teams.">
        <>
          <div id="unrelated-wrapper">
            <Input
              id="wrapped-teams"
              variant="tags"
              defaultValue="Corelia"
              maxLength={10}
              selectedTagValues={["engineering"]}
              tagOptions={[
                { value: "engineering", label: "Engineering" },
              ]}
            />
          </div>
        </>
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const label = host.querySelector<HTMLLabelElement>(
      'label[for="wrapped-teams"]',
    )
    const input = host.querySelector<HTMLInputElement>("#wrapped-teams")

    expect(label?.htmlFor).toBe(input?.id)
    expect(input?.getAttribute("aria-describedby")?.split(" ")).toContain(
      "wrapped-teams-counter",
    )
    expect(host.querySelector("#wrapped-teams-hint")).toBeNull()
    expect(host.querySelector("#wrapped-teams-counter")?.textContent).toBe(
      "7/10",
    )
    expect(label?.htmlFor).not.toBe("unrelated-wrapper")
  })

  it("does not use an arbitrary wrapper ID as the Field control ID", () => {
    const markup = renderToStaticMarkup(
      <Field label="Unassociated content">
        <div id="not-the-control" />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const label = host.querySelector<HTMLLabelElement>("[data-slot='field-label']")

    expect(label?.htmlFor).not.toBe("not-the-control")
  })

  it("suppresses the initial tag hint in static markup when tags are preselected", () => {
    const markup = renderToStaticMarkup(
      <Field label="Teams" hint="Choose one or more teams.">
        <Input
          variant="tags"
          selectedTagValues={["engineering"]}
          tagOptions={[{ value: "engineering", label: "Engineering" }]}
        />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup

    expect(host.querySelector('[id$="-hint"]')).toBeNull()
    expect(markup).not.toContain("Choose one or more teams.")
    expect(markup).toContain("Engineering")
  })

  it("keeps the original standalone Input as a native control without Field metadata", () => {
    const standaloneProps: InputProps = {
      id: "standalone-input",
      type: "search",
      placeholder: "Search courses",
      "aria-label": "Search courses",
    }
    const markup = renderToStaticMarkup(<Input {...standaloneProps} />)
    const host = document.createElement("div")
    host.innerHTML = markup
    const input = host.querySelector<HTMLInputElement>("#standalone-input")

    expect(input?.type).toBe("search")
    expect(input?.getAttribute("aria-label")).toBe("Search courses")
    expect(host.querySelector('[data-slot="field"]')).toBeNull()
    expect(host.querySelector('[data-slot="field-label"]')).toBeNull()
    expect(host.querySelector('[data-slot="input-field-control"]')).toBeNull()
  })

  it("preserves the existing layout-only FieldLabel and Input composition", () => {
    const markup = renderToStaticMarkup(
      <Field className="legacy-field-layout">
        <FieldLabel htmlFor="legacy-control">Legacy label</FieldLabel>
        <Input id="legacy-control" />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const field = host.querySelector<HTMLElement>('[data-slot="field"]')
    const label = host.querySelector<HTMLLabelElement>(
      'label[for="legacy-control"]',
    )
    const input = host.querySelector<HTMLInputElement>("#legacy-control")

    expect(field?.className).toContain("legacy-field-layout")
    expect(field?.children).toHaveLength(2)
    expect(field?.children[0]).toBe(label)
    expect(field?.children[1]).toBe(input)
    expect(label?.htmlFor).toBe(input?.id)
    expect(label?.getAttribute("for")).toBe("legacy-control")
    expect(host.querySelector('[data-slot="input-field-control"]')).toBeNull()
  })

  it("lets Field own required, hint, and counter presentation", async () => {
    const view = render(
      <Field
        label="Display name"
        required
        hint="Use up to eight characters"
      >
        <Input id="display-name" defaultValue="Corelia" maxLength={8} />
      </Field>,
    )
    await view.mount()

    const input = view.container.querySelector<HTMLInputElement>("#display-name")
    const label = view.container.querySelector<HTMLLabelElement>(
      'label[for="display-name"]',
    )

    expect(label?.textContent).toContain("Display name")
    expect(label?.textContent).toContain("*")
    expect(input?.labels).toHaveLength(1)
    expect(input?.required).toBe(true)
    expect(input?.getAttribute("aria-describedby")?.split(" ")).toContain(
      "display-name-hint",
    )
    expect(view.container.querySelector("#display-name-hint")?.textContent).toBe(
      "Use up to eight characters",
    )
    expect(view.container.querySelector("#display-name-counter")?.textContent).toBe(
      "7/8",
    )
    expect(
      view.container
        .querySelector("#display-name-counter")
        ?.closest('[data-slot="input-field-control"]'),
    ).toBeNull()

    await view.unmount()
  })

  it("does not set a character limit or counter by default", async () => {
    const view = render(
      <Field label="Text input">
        <Input id="free-text" defaultValue="Corelia learner" />
      </Field>,
    )
    await view.mount()

    const input = view.container.querySelector<HTMLInputElement>("#free-text")

    expect(input?.hasAttribute("maxLength")).toBe(false)
    expect(view.container.querySelector("#free-text-counter")).toBeNull()

    await view.unmount()
  })

  it("renders and updates a maxLength counter without other Field metadata", async () => {
    const view = render(
      <Field>
        <Input id="standalone-counter" defaultValue="A" maxLength={5} />
      </Field>,
    )
    await view.mount()

    const input = view.container.querySelector<HTMLInputElement>(
      "#standalone-counter",
    )
    const counter = () =>
      view.container.querySelector("#standalone-counter-counter")?.textContent

    expect(input?.maxLength).toBe(5)
    expect(counter()).toBe("1/5")

    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set
    await act(async () => {
      if (input && setNativeValue) setNativeValue.call(input, "text")
      input?.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(counter()).toBe("4/5")
    await view.unmount()
  })

  it("keeps legacy FieldLabel and Input IDs associated when Field owns metadata", () => {
    const markup = renderToStaticMarkup(
      <Field hint="Legacy hint" disabled>
        <FieldLabel htmlFor="legacy-associated-input">Legacy label</FieldLabel>
        <Input id="legacy-associated-input" />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const label = host.querySelector<HTMLLabelElement>(
      'label[for="legacy-associated-input"]',
    )
    const input = host.querySelector<HTMLInputElement>(
      "#legacy-associated-input",
    )

    expect(label?.htmlFor).toBe(input?.id)
    expect(input?.disabled).toBe(true)
    expect(input?.getAttribute("aria-describedby")?.split(" ")).toContain(
      "legacy-associated-input-hint",
    )
    expect(host.querySelector("#legacy-associated-input-hint")?.textContent).toBe(
      "Legacy hint",
    )
  })

  it("composes an auto-grow textarea through Field", () => {
    const markup = renderToStaticMarkup(
      <Field label="Biography">
        <Input
          id="biography"
          fieldType="auto-grow"
          defaultValue="A short biography"
        />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const label = host.querySelector<HTMLLabelElement>(
      'label[for="biography"]',
    )
    const textarea = host.querySelector<HTMLTextAreaElement>("#biography")

    expect(label?.htmlFor).toBe(textarea?.id)
    expect(textarea?.getAttribute("rows")).toBe("1")
    expect(host.querySelector('[data-slot="input-field-control"]')).not.toBeNull()
  })

  it("passes Field disabled and invalid state to consumer-rendered accessories", () => {
    const markup = renderToStaticMarkup(
      <Field label="Phone number" disabled error="Invalid number">
        <Input
          id="disabled-phone"
          renderLeadingContent={(state) => (
            <TestSelector
              state={state}
              side="leading"
              ariaLabel="Country code"
              options={[{ value: "+91", label: "+91" }]}
            />
          )}
        />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const input = host.querySelector<HTMLInputElement>("#disabled-phone")
    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Country code"]',
    )
    const accessory = host.querySelector<HTMLElement>("[data-accessory-disabled]")

    expect(input?.disabled).toBe(true)
    expect(trigger?.disabled).toBe(true)
    expect(accessory?.getAttribute("data-accessory-invalid")).toBe("true")
  })

  it("shows the hidden tag count as total selected minus displayed", () => {
    const markup = renderToStaticMarkup(
      <Field label="Tags">
        <Input
          variant="tags"
          maxVisibleTags={2}
          selectedTagValues={["react", "typescript", "vite", "testing", "design"]}
          tagOptions={[
            { value: "react", label: "React" },
            { value: "typescript", label: "TypeScript" },
            { value: "vite", label: "Vite" },
            { value: "testing", label: "Testing" },
            { value: "design", label: "Design" },
          ]}
        />
      </Field>,
    )

    expect(markup).toContain("React")
    expect(markup).toContain("TypeScript")
    expect(markup).toContain("+3")
    expect(markup).toContain('aria-label="3 hidden tags"')
    expect(markup).not.toContain("overflow-hidden")
    expect(markup).not.toContain("+2")
    expect(markup).not.toContain(">Vite</span>")
  })

  it("expands selected tags while the dropdown is open, then restores the overflow count", async () => {
    const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("data-slot") === "tag") {
          const index = Array.from(this.parentElement?.children ?? []).indexOf(
            this,
          )

          return new DOMRect(0, index < 2 ? 0 : 32, 80, 24)
        }

        return getBoundingClientRect.call(this)
      },
    )
    const tagOptions = [
      { value: "react", label: "React" },
      { value: "typescript", label: "TypeScript" },
      { value: "vite", label: "Vite" },
      { value: "design", label: "Design" },
    ]
    const view = render(
      <Field label="Tags">
        <Input
          variant="tags"
          maxVisibleTags={1}
          selectedTagValues={tagOptions.map((option) => option.value)}
          tagOptions={tagOptions}
          renderTagMenu={(menu) => <TestTagMenu menu={menu} />}
        />
      </Field>,
    )
    await view.mount()

    const control = view.container.querySelector<HTMLElement>(
      '[data-slot="input-field-control"]',
    )
    const trigger = view.container.querySelector<HTMLButtonElement>("button")
    const tagList = trigger?.querySelector<HTMLElement>("span")

    expect(trigger?.textContent).toContain("+3")
    expect(trigger?.querySelectorAll('[data-slot="tag"]')).toHaveLength(2)

    await act(async () => trigger?.click())

    expect(trigger?.textContent).not.toContain("+3")
    const expandedTags = Array.from(
      trigger?.querySelectorAll<HTMLElement>('[data-slot="tag"]') ?? [],
    )
    expect(expandedTags.map((tag) => tag.textContent?.trim())).toEqual([
      "React",
      "TypeScript",
      "Vite",
      "Design",
    ])
    expect(expandedTags.every((tag) => tag.classList.contains("shrink-0"))).toBe(
      true,
    )
    expect(tagList?.className).toContain("flex-wrap")
    expect(control?.className).toContain("h-auto")
    expect(control?.className).toContain("px-lg")
    expect(control?.className).toContain("gap-md")
    expect(control?.className).toContain("py-md")
    expect(tagList?.className).toContain("gap-x-sm")
    expect(tagList?.className).toContain("gap-y-xs")

    await act(async () => trigger?.click())

    expect(trigger?.textContent).toContain("+3")
    expect(control?.className).toContain("h-10")
    expect(control?.className).not.toContain("py-md")
    await view.unmount()
  })

  it.each([
    { name: "no selected tags", selectedTagValues: [] },
    { name: "one selected tag", selectedTagValues: ["react"] },
  ])(
    "keeps tag field height unchanged with $name while open",
    async ({ selectedTagValues }) => {
      const view = render(
        <Field label="Tags">
          <Input
            variant="tags"
            selectedTagValues={selectedTagValues}
            tagOptions={[{ value: "react", label: "React" }]}
            renderTagMenu={(menu) => <TestTagMenu menu={menu} />}
          />
        </Field>,
      )
      await view.mount()

      const control = view.container.querySelector<HTMLElement>(
        '[data-slot="input-field-control"]',
      )
      const trigger = view.container.querySelector<HTMLButtonElement>("button")

      await act(async () => trigger?.click())

      expect(control?.className).toContain("h-10")
      expect(control?.className).toContain("px-lg")
      expect(control?.className).not.toContain("py-md")
      expect(trigger?.querySelector("span")?.className).not.toContain("flex-wrap")

      await view.unmount()
    },
  )

  it("allows consumers to override the expanded tag area height", async () => {
    const view = render(
      <Field label="Tags">
        <Input
          variant="tags"
          expandedTagsMaxHeight="8rem"
          maxVisibleTags={1}
          selectedTagValues={["react", "typescript"]}
          tagOptions={[
            { value: "react", label: "React" },
            { value: "typescript", label: "TypeScript" },
          ]}
          renderTagMenu={(menu) => <TestTagMenu menu={menu} />}
        />
      </Field>,
    )
    await view.mount()

    const trigger = view.container.querySelector<HTMLButtonElement>("button")
    await act(async () => trigger?.click())

    expect(trigger?.querySelector("span")?.getAttribute("style")).toContain(
      "max-height: 8rem",
    )
    await view.unmount()
  })

  it("lets each consumer compose its leading and trailing selector", () => {
    const leadingMarkup = renderToStaticMarkup(
      <Field label="Phone number">
        <Input
          renderLeadingContent={(state) => (
            <TestSelector
              state={state}
              side="leading"
              ariaLabel="Country code"
              options={[{ value: "+91", label: "+91" }]}
            />
          )}
        />
      </Field>,
    )
    const trailingMarkup = renderToStaticMarkup(
      <Field label="Sale amount">
        <Input
          renderTrailingContent={(state) => (
            <TestSelector
              state={state}
              side="trailing"
              ariaLabel="Currency"
              options={[{ value: "INR", label: "INR" }]}
            />
          )}
        />
      </Field>,
    )
    const leadingHost = document.createElement("div")
    const trailingHost = document.createElement("div")
    leadingHost.innerHTML = leadingMarkup
    trailingHost.innerHTML = trailingMarkup

    expect(
      leadingHost.querySelector('button[aria-label="Country code"]')?.className,
    ).toContain("gap-xs")
    expect(
      trailingHost.querySelector('button[aria-label="Currency"]')?.className,
    ).toContain("gap-md")
  })

  it("keeps disabled tags at their Figma appearance and shows the hidden count", () => {
    const markup = renderToStaticMarkup(
      <Field label="Teams" disabled>
        <Input
          variant="tags"
          maxVisibleTags={1}
          selectedTagValues={["engineering", "design", "product"]}
          tagOptions={[
            {
              value: "engineering",
              label: "Engineering",
              leadingVisual: <span>Avatar</span>,
            },
            { value: "design", label: "Design" },
            { value: "product", label: "Product" },
          ]}
          renderTagMenu={(menu) => <TestTagMenu menu={menu} />}
        />
      </Field>,
    )
    const host = document.createElement("div")
    host.innerHTML = markup
    const tags = Array.from(
      host.querySelectorAll<HTMLElement>('[data-slot="tag"]'),
    )
    const avatar = tags[0]?.querySelector<HTMLElement>(
      '[data-slot="tag-leading-visual"]',
    )
    const trigger = host.querySelector<HTMLButtonElement>("button")

    expect(tags).toHaveLength(2)
    expect(tags[0]?.className).toContain("bg-tag-background")
    expect(tags[0]?.className).toContain("text-tag-foreground")
    expect(tags[1]?.className).toContain("bg-tag-overflow-background")
    expect(tags[1]?.className).toContain("text-tag-overflow-foreground")
    expect(tags.every((tag) => !tag.hasAttribute("data-disabled"))).toBe(true)
    expect(avatar?.classList.contains("opacity-50")).toBe(false)
    expect(trigger?.disabled).toBe(true)
    expect(
      host
        .querySelector('[data-slot="input-field-control"]')
        ?.getAttribute("data-disabled"),
    ).toBe("true")
    expect(markup).toContain("+2")
  })

  it("shows the tag placeholder only while no tags are selected", () => {
    const tagProps = {
      variant: "tags" as const,
      placeholder: "Choose teams",
      tagOptions: [{ value: "engineering", label: "Engineering" }],
    }
    const selectedMarkup = renderToStaticMarkup(
      <Field label="Teams">
        <Input {...tagProps} selectedTagValues={["engineering"]} />
      </Field>,
    )
    const emptyMarkup = renderToStaticMarkup(
      <Field label="Teams">
        <Input {...tagProps} selectedTagValues={[]} />
      </Field>,
    )

    expect(selectedMarkup).toContain("Engineering")
    expect(selectedMarkup).not.toContain("Choose teams")
    expect(emptyMarkup).toContain("Choose teams")
    expect(emptyMarkup).not.toContain('placeholder="Choose teams"')
    expect(selectedMarkup).not.toContain('aria-haspopup="menu"')
    expect(emptyMarkup).not.toContain('aria-haspopup="menu"')
  })

  it("opens the dropdown, exposes accessible choices, and reports the selected value", async () => {
    const onDropdownValueChange = vi.fn()
    const view = render(
      <Field label="Amount">
        <Input
          id="currency-amount"
          type="number"
          renderTrailingContent={(state) => (
            <TestSelector
              state={state}
              side="trailing"
              ariaLabel="Currency"
              options={[
                { value: "usd", label: "US Dollar" },
                { value: "eur", label: "Euro" },
              ]}
              onValueChange={onDropdownValueChange}
            />
          )}
        />
      </Field>,
    )
    await view.mount()

    const input = view.container.querySelector<HTMLInputElement>("#currency-amount")
    const trigger = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Currency"]',
    )
    expect(input?.type).toBe("number")
    expect(input?.labels).toHaveLength(1)
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu")

    await act(async () => trigger?.click())
    const searchInput = document.body.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )

    expect(searchInput?.getAttribute("data-slot")).toBe("input")
    expect(
      searchInput?.closest('[data-slot="input-field-control"]')?.getAttribute(
        "data-variant",
      ),
    ).toBe("icon-leading")
    expect(searchInput?.closest('[data-slot="field"]')).toBeNull()

    const choices = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-item"]',
      ),
    )
    const euroChoice = choices.find((choice) => choice.textContent?.includes("Euro"))

    expect(euroChoice).toBeDefined()
    expect(euroChoice?.getAttribute("role")).toBe("menuitem")

    await act(async () => euroChoice?.click())
    expect(onDropdownValueChange).toHaveBeenCalledWith("eur")

    await view.unmount()
  })

  it("uses the checkbox dropdown to report tag selection changes", async () => {
    const onSelectedTagValuesChange = vi.fn()
    const view = render(
      <Field label="Tags" hint="Choose one or more tags.">
        <Input
          variant="tags"
          tagOptions={[
            { value: "react", label: "React" },
            { value: "typescript", label: "TypeScript" },
          ]}
          onSelectedTagValuesChange={onSelectedTagValuesChange}
          renderTagMenu={(menu) => <TestTagMenu menu={menu} />}
        />
      </Field>,
    )
    await view.mount()
    expect(view.container.textContent).toContain("Choose one or more tags.")

    const input = view.container.querySelector<HTMLInputElement>("input")
    const trigger = view.container.querySelector<HTMLButtonElement>("button")
    expect(input?.labels).toHaveLength(1)
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu")

    await act(async () => trigger?.click())
    const choices = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-checkbox-item"]',
      ),
    )
    const reactChoice = choices.find((choice) => choice.textContent?.includes("React"))

    expect(reactChoice).toBeDefined()
    expect(reactChoice?.getAttribute("role")).toBe("menuitemcheckbox")

    await act(async () => reactChoice?.click())
    expect(onSelectedTagValuesChange).toHaveBeenCalledWith(["react"])
    expect(view.container.textContent).not.toContain("Choose one or more tags.")

    await view.unmount()
  })
})

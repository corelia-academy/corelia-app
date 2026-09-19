// @vitest-environment happy-dom
import { act } from "react"
import * as React from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IconToggle, Toggle } from "./toggle"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const testIcon = <span aria-hidden data-testid="test-icon" />

function render(ui: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  return {
    container,
    root,
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
  vi.restoreAllMocks()
})

describe("Toggle", () => {
  it("covers the 12 standard Figma variants", async () => {
    const cases = [
      { checked: false, disabled: false, size: "small" as const, variant: "default" as const },
      { checked: false, disabled: false, size: "large" as const, variant: "default" as const },
      { checked: false, disabled: true, size: "small" as const, variant: "default" as const },
      { checked: false, disabled: true, size: "large" as const, variant: "default" as const },
      { checked: true, disabled: false, size: "small" as const, variant: "default" as const },
      { checked: true, disabled: false, size: "large" as const, variant: "default" as const },
      { checked: true, disabled: false, size: "small" as const, variant: "alternative" as const },
      { checked: true, disabled: false, size: "large" as const, variant: "alternative" as const },
      { checked: true, disabled: true, size: "small" as const, variant: "default" as const },
      { checked: true, disabled: true, size: "large" as const, variant: "default" as const },
      { checked: true, disabled: true, size: "small" as const, variant: "alternative" as const },
      { checked: true, disabled: true, size: "large" as const, variant: "alternative" as const },
    ]
    const view = render(
      <>
        {cases.map((item, index) => (
          <Toggle
            key={index}
            aria-label={`toggle-${index}`}
            data-testid={`toggle-${index}`}
            defaultChecked={item.checked}
            disabled={item.disabled}
            size={item.size}
            variant={item.variant}
          />
        ))}
      </>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>(
      '[data-slot="toggle"]',
    )
    expect(controls).toHaveLength(cases.length)

    cases.forEach((item, index) => {
      const control = controls[index]
      const thumb = control.querySelector('[data-slot="toggle-thumb"]')

      expect(control.getAttribute("role")).toBe("switch")
      expect(control.getAttribute("aria-checked")).toBe(String(item.checked))
      expect(control.hasAttribute("data-checked")).toBe(item.checked)
      expect(control.hasAttribute("data-disabled")).toBe(item.disabled)
      expect(control.getAttribute("data-size")).toBe(item.size)
      expect(control.getAttribute("data-variant")).toBe(item.variant)
      expect(control.className).toContain(
        item.checked
          ? item.variant === "alternative"
            ? item.disabled
              ? "data-[checked]:data-[variant=alternative]:data-[disabled]:bg-toggle-track-alternative-disabled"
              : "data-[checked]:data-[variant=alternative]:bg-toggle-track-alternative"
            : item.disabled
              ? "data-[checked]:data-[disabled]:bg-toggle-track-checked-disabled"
              : "data-[checked]:bg-toggle-track-checked"
          : item.disabled
            ? "data-[disabled]:bg-toggle-track-disabled"
            : "bg-toggle-track",
      )
      expect(thumb?.className).not.toContain("translate-x-3")
    })

    await view.unmount()
  })

  it("supports uncontrolled click and controlled keyboard interaction", async () => {
    const onCheckedChange = vi.fn()
    const view = render(<Toggle aria-label="Uncontrolled toggle" />)
    await view.render()

    const uncontrolled = view.container.querySelector<HTMLElement>(
      '[data-slot="toggle"]',
    )
    await act(async () => uncontrolled?.click())
    expect(uncontrolled?.getAttribute("aria-checked")).toBe("true")

    function ControlledToggle() {
      const [checked, setChecked] = React.useState(false)

      return (
        <Toggle
          aria-label="Controlled toggle"
          checked={checked}
          onCheckedChange={(nextChecked) => {
            onCheckedChange(nextChecked)
            setChecked(nextChecked)
          }}
        />
      )
    }

    await act(async () => view.root.render(<ControlledToggle />))
    const controlled = view.container.querySelector<HTMLElement>(
      '[data-slot="toggle"]',
    )
    await act(async () => {
      controlled?.focus()
      controlled?.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      )
      controlled?.dispatchEvent(
        new KeyboardEvent("keyup", { key: " ", bubbles: true }),
      )
    })

    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(controlled?.getAttribute("aria-checked")).toBe("true")

    await view.unmount()
  })

  it("keeps disabled controls unchanged", async () => {
    const onCheckedChange = vi.fn()
    const view = render(
      <Toggle
        aria-label="Disabled toggle"
        defaultChecked
        disabled
        onCheckedChange={onCheckedChange}
      />,
    )
    await view.render()

    const control = view.container.querySelector<HTMLElement>(
      '[data-slot="toggle"]',
    )
    await act(async () => {
      control?.click()
      control?.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      )
    })

    expect(control?.getAttribute("aria-checked")).toBe("true")
    expect(onCheckedChange).not.toHaveBeenCalled()

    await view.unmount()
  })

  it("associates label and supporting text and submits through a form", async () => {
    const view = render(
      <form>
        <Toggle
          defaultChecked
          id="email-notifications"
          label="Email notifications"
          name="notifications"
          supportingText="Receive product updates"
          value="enabled"
        />
      </form>,
    )
    await view.render()

    const control = view.container.querySelector<HTMLElement>(
      '[data-slot="toggle"]',
    )
    const form = view.container.querySelector("form")
    const labelId = control?.getAttribute("aria-labelledby")
    const descriptionId = control?.getAttribute("aria-describedby")
    const input = view.container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )

    expect(control?.getAttribute("role")).toBe("switch")
    expect(document.getElementById(labelId ?? "")?.textContent).toBe(
      "Email notifications",
    )
    expect(document.getElementById(descriptionId ?? "")?.textContent).toBe(
      "Receive product updates",
    )
    expect(input?.labels).toHaveLength(1)
    expect(new FormData(form ?? undefined).get("notifications")).toBe("enabled")

    await view.unmount()
  })

  it("supports Figma left and right label visibility", async () => {
    const view = render(
      <Toggle
        aria-label="Right label toggle"
        label="Label"
        showLeftLabel={false}
        showRightLabel
      />,
    )
    await view.render()

    const wrapper = view.container.querySelector('[data-slot="toggle-label"]')
    const text = wrapper?.querySelector('[data-slot="toggle-text"]')

    expect(wrapper?.querySelector('[data-side="left"]')).toBeNull()
    expect(wrapper?.querySelector('[data-side="right"]')).toBe(text)
    expect(text?.textContent).toBe("Label")

    await view.unmount()
  })
})

describe("IconToggle", () => {
  it("covers the four Figma state variants with button-toggle semantics", async () => {
    const cases = [
      {
        pressed: false,
        disabled: false,
        stateClasses: ["text-foreground"],
      },
      {
        pressed: false,
        disabled: true,
        stateClasses: ["data-[disabled]:text-toggle-icon-disabled"],
      },
      {
        pressed: true,
        disabled: false,
        stateClasses: [
          "data-[pressed]:bg-toggle-pressed-background",
          "data-[pressed]:text-toggle-pressed-foreground",
        ],
      },
      {
        pressed: true,
        disabled: true,
        stateClasses: [
          "data-[pressed]:data-[disabled]:bg-toggle-pressed-disabled-background",
          "data-[pressed]:data-[disabled]:text-toggle-pressed-disabled-foreground",
        ],
      },
    ]
    const view = render(
      <>
        {cases.map((item, index) => (
          <IconToggle
            key={index}
            aria-label={`icon-toggle-${index}`}
            data-testid={`icon-toggle-${index}`}
            defaultPressed={item.pressed}
            disabled={item.disabled}
            icon={testIcon}
          />
        ))}
      </>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLButtonElement>(
      '[data-slot="icon-toggle"]',
    )
    expect(controls).toHaveLength(cases.length)

    cases.forEach((item, index) => {
      const control = controls[index]

      expect(control.tagName).toBe("BUTTON")
      expect(control.getAttribute("aria-label")).toBe(`icon-toggle-${index}`)
      expect(control.getAttribute("aria-pressed")).toBe(String(item.pressed))
      expect(control.hasAttribute("data-pressed")).toBe(item.pressed)
      expect(control.hasAttribute("data-disabled")).toBe(item.disabled)
      item.stateClasses.forEach((stateClass) => {
        expect(control.className).toContain(stateClass)
      })
      expect(control.className).toContain("size-10")
      expect(control.className).toContain("rounded-md")
      expect(control.querySelector('[data-testid="test-icon"]')).not.toBeNull()
    })

    await view.unmount()
  })

  it("supports default, controlled, and uncontrolled pressed state", async () => {
    const onPressedChange = vi.fn()
    const view = render(
      <IconToggle
        aria-label="Default pressed filter"
        defaultPressed
        icon={testIcon}
        onPressedChange={onPressedChange}
      />,
    )
    await view.render()

    const uncontrolled = view.container.querySelector<HTMLButtonElement>(
      '[data-slot="icon-toggle"]',
    )
    expect(uncontrolled?.getAttribute("aria-pressed")).toBe("true")

    await act(async () => uncontrolled?.click())
    expect(uncontrolled?.getAttribute("aria-pressed")).toBe("false")
    expect(onPressedChange).toHaveBeenCalledWith(false, expect.anything())

    function ControlledIconToggle() {
      const [pressed, setPressed] = React.useState(false)

      return (
        <IconToggle
          aria-label="Controlled filter"
          icon={testIcon}
          pressed={pressed}
          onPressedChange={(nextPressed) => setPressed(nextPressed)}
        />
      )
    }

    await act(async () => view.root.render(<ControlledIconToggle />))
    const controlled = view.container.querySelector<HTMLButtonElement>(
      '[data-slot="icon-toggle"]',
    )
    await act(async () => controlled?.click())
    expect(controlled?.getAttribute("aria-pressed")).toBe("true")

    await view.unmount()
  })

  it("does not change when disabled and accepts a custom icon", async () => {
    const onPressedChange = vi.fn()
    const view = render(
      <IconToggle
        aria-label="Disabled custom filter"
        data-testid="custom-icon-toggle"
        defaultPressed
        disabled
        icon={<span data-testid="custom-icon">custom</span>}
        onPressedChange={onPressedChange}
      />,
    )
    await view.render()

    const control = view.container.querySelector<HTMLButtonElement>(
      '[data-testid="custom-icon-toggle"]',
    )
    await act(async () => control?.click())

    expect(control?.getAttribute("aria-pressed")).toBe("true")
    expect(onPressedChange).not.toHaveBeenCalled()
    expect(control?.querySelector('[data-testid="custom-icon"]')).not.toBeNull()
    expect(control?.querySelector("svg")).toBeNull()

    await view.unmount()
  })

  it("focuses the button and toggles with Space, while disabled controls do not respond", async () => {
    const onPressedChange = vi.fn()
    const view = render(
      <>
        <IconToggle
          aria-label="Enabled keyboard filter"
          data-testid="enabled-keyboard-toggle"
          icon={testIcon}
          onPressedChange={onPressedChange}
        />
        <IconToggle
          aria-label="Disabled keyboard filter"
          data-testid="disabled-keyboard-toggle"
          disabled
          icon={testIcon}
          onPressedChange={onPressedChange}
        />
      </>,
    )
    await view.render()

    const enabled = view.container.querySelector<HTMLButtonElement>(
      '[data-testid="enabled-keyboard-toggle"]',
    )
    const disabled = view.container.querySelector<HTMLButtonElement>(
      '[data-testid="disabled-keyboard-toggle"]',
    )

    await act(async () => enabled?.focus())
    expect(document.activeElement).toBe(enabled)

    await act(async () => {
      enabled?.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "Space",
          key: " ",
          bubbles: true,
        }),
      )
      enabled?.dispatchEvent(
        new KeyboardEvent("keyup", {
          code: "Space",
          key: " ",
          bubbles: true,
        }),
      )
      // happy-dom does not synthesize a native button click from keyboard events.
      // A real browser performs this activation for a focused button on Space.
      enabled?.click()
    })

    expect(enabled?.getAttribute("aria-pressed")).toBe("true")
    expect(onPressedChange).toHaveBeenCalledWith(true, expect.anything())

    await act(async () => {
      disabled?.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "Space",
          key: " ",
          bubbles: true,
        }),
      )
      disabled?.dispatchEvent(
        new KeyboardEvent("keyup", {
          code: "Space",
          key: " ",
          bubbles: true,
        }),
      )
    })

    expect(disabled?.getAttribute("aria-pressed")).toBe("false")
    expect(onPressedChange).toHaveBeenCalledTimes(1)

    await view.unmount()
  })
})

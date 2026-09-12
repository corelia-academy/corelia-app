// @vitest-environment happy-dom
import { act } from "react"
import * as React from "react"
import { createRoot } from "react-dom/client"
import { RadioGroup } from "@base-ui/react/radio-group"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Checkbox, CheckboxCard, Radio, RadioCard } from "./selection"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

describe("Checkbox", () => {
  it("covers Small and Large enabled, checked, indeterminate, and disabled states", async () => {
    const cases = [
      { size: "small" as const, checked: false, indeterminate: false, disabled: false },
      { size: "small" as const, checked: true, indeterminate: false, disabled: false },
      { size: "small" as const, checked: false, indeterminate: true, disabled: false },
      { size: "small" as const, checked: false, indeterminate: false, disabled: true },
      { size: "small" as const, checked: true, indeterminate: false, disabled: true },
      { size: "small" as const, checked: false, indeterminate: true, disabled: true },
      { size: "large" as const, checked: false, indeterminate: false, disabled: false },
      { size: "large" as const, checked: true, indeterminate: false, disabled: false },
      { size: "large" as const, checked: false, indeterminate: true, disabled: false },
      { size: "large" as const, checked: false, indeterminate: false, disabled: true },
      { size: "large" as const, checked: true, indeterminate: false, disabled: true },
      { size: "large" as const, checked: false, indeterminate: true, disabled: true },
    ]
    const view = render(
      <>
        {cases.map((item, index) => (
          <Checkbox
            key={`${item.size}-${index}`}
            aria-label={`${item.size}-${index}`}
            defaultChecked={item.checked}
            disabled={item.disabled}
            indeterminate={item.indeterminate}
            size={item.size}
          />
        ))}
      </>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>('[role="checkbox"]')
    expect(controls).toHaveLength(cases.length)

    cases.forEach((item, index) => {
      const control = controls[index]
      const expectedAriaChecked = item.indeterminate ? "mixed" : String(item.checked)

      expect(control.getAttribute("aria-checked")).toBe(expectedAriaChecked)
      expect(control.hasAttribute("data-disabled")).toBe(item.disabled)
      expect(control.classList.contains(item.size === "small" ? "size-5" : "size-6")).toBe(true)
      expect(control.className).toContain("group/checkbox")
      expect(control.querySelector('[data-slot="checkbox-unchecked-frame"]')).not.toBeNull()
      expect(control.querySelector('[data-slot="checkbox-checked-frame"]')).not.toBeNull()
      expect(control.querySelector('[data-slot="checkbox-indeterminate-frame"]')).not.toBeNull()

      expect(control.querySelector('[data-slot="checkbox-unchecked-frame"] svg')).not.toBeNull()
      expect(control.querySelector('[data-slot="checkbox-checked-frame"] svg')).not.toBeNull()
      expect(control.querySelector('[data-slot="checkbox-indeterminate-frame"] svg')).not.toBeNull()

      if (item.indeterminate) {
        const indeterminateFrame = control.querySelector<HTMLElement>(
          '[data-slot="checkbox-indeterminate-frame"]',
        )
        expect(indeterminateFrame?.querySelector("svg")).not.toBeNull()
      }
    })

    await view.unmount()
  })

  it("renders small and large controls with the expected semantic states", async () => {
    const view = render(
      <>
        <Checkbox aria-label="Small checkbox" size="small" />
        <Checkbox aria-label="Large checkbox" size="large" defaultChecked />
      </>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>('[role="checkbox"]')
    expect(controls).toHaveLength(2)
    expect(controls[0].getAttribute("aria-checked")).toBe("false")
    expect(controls[0].classList.contains("size-5")).toBe(true)
    expect(controls[1].getAttribute("aria-checked")).toBe("true")
    expect(controls[1].classList.contains("size-6")).toBe(true)

    await view.unmount()
  })

  it("supports uncontrolled toggling and controlled change callbacks", async () => {
    const onCheckedChange = vi.fn()
    const view = render(<Checkbox aria-label="Uncontrolled checkbox" />)
    await view.render()

    const uncontrolled = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    await act(async () => uncontrolled?.click())
    expect(uncontrolled?.getAttribute("aria-checked")).toBe("true")

    function ControlledCheckbox() {
      const [checked, setChecked] = React.useState(false)

      return (
        <Checkbox
          aria-label="Controlled checkbox"
          checked={checked}
          onCheckedChange={(nextChecked) => {
            onCheckedChange(nextChecked)
            setChecked(nextChecked)
          }}
        />
      )
    }

    await act(async () => view.root.render(<ControlledCheckbox />))
    const controlled = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    await act(async () => controlled?.click())
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(controlled?.getAttribute("aria-checked")).toBe("true")

    await view.unmount()
  })

  it("exposes an indeterminate state to assistive technology and the native input", async () => {
    const view = render(<Checkbox aria-label="Mixed checkbox" indeterminate />)
    await view.render()

    const control = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    const input = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(control?.getAttribute("aria-checked")).toBe("mixed")
    expect(control?.hasAttribute("data-indeterminate")).toBe(true)
    expect(input?.indeterminate).toBe(true)
    expect(
      view.container.querySelector('[data-slot="checkbox-indeterminate-frame"]'),
    ).not.toBeNull()

    await view.unmount()
  })

  it("resolves a controlled indeterminate state after parent interaction", async () => {
    function ParentSelection() {
      const [children, setChildren] = React.useState([true, false])
      const selectedCount = children.filter(Boolean).length
      const allChecked = selectedCount === children.length
      const isIndeterminate = selectedCount > 0 && !allChecked

      return (
        <Checkbox
          aria-label="Select all"
          checked={allChecked}
          indeterminate={isIndeterminate}
          onCheckedChange={() => setChildren([true, true])}
        />
      )
    }

    const view = render(<ParentSelection />)
    await view.render()

    const control = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    expect(control?.getAttribute("aria-checked")).toBe("mixed")

    await act(async () => control?.click())

    expect(control?.getAttribute("aria-checked")).toBe("true")

    await view.unmount()
  })

  it("renders interaction feedback for hover and press states", async () => {
    const view = render(<Checkbox aria-label="Interactive checkbox" />)
    await view.render()

    const feedback = view.container.querySelector(
      '[data-slot="checkbox-interaction-feedback"]',
    )

    expect(feedback).not.toBeNull()
    expect(feedback?.className).toContain("group-hover/checkbox:opacity-100")
    expect(feedback?.className).toContain("group-active/checkbox:opacity-100")

    await view.unmount()
  })

  it("keeps disabled controls unavailable for interaction", async () => {
    const onCheckedChange = vi.fn()
    const view = render(
      <Checkbox aria-label="Disabled checkbox" disabled onCheckedChange={onCheckedChange} />,
    )
    await view.render()

    const control = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    const input = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    await act(async () => control?.click())
    expect(control?.hasAttribute("data-disabled")).toBe(true)
    expect(input?.disabled).toBe(true)
    expect(onCheckedChange).not.toHaveBeenCalled()

    await view.unmount()
  })

  it("keeps labels associated and submits native form values", async () => {
    const view = render(
      <form>
        <Checkbox label="Accept terms" name="terms" value="accepted" defaultChecked />
      </form>,
    )
    await view.render()

    const control = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    const input = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    const form = view.container.querySelector("form")
    const labelId = control?.getAttribute("aria-labelledby")
    expect(document.getElementById(labelId ?? "")?.textContent).toBe("Accept terms")
    expect(input?.labels).toHaveLength(1)
    expect(new FormData(form ?? undefined).get("terms")).toBe("accepted")

    await view.unmount()
  })
})

describe("Radio", () => {
  it("covers Small and Large enabled, checked, and disabled states", async () => {
    const cases = [
      { size: "small" as const, checked: false, disabled: false },
      { size: "small" as const, checked: true, disabled: false },
      { size: "small" as const, checked: false, disabled: true },
      { size: "small" as const, checked: true, disabled: true },
      { size: "large" as const, checked: false, disabled: false },
      { size: "large" as const, checked: true, disabled: false },
      { size: "large" as const, checked: false, disabled: true },
      { size: "large" as const, checked: true, disabled: true },
    ]
    const view = render(
      <>
        {cases.map((item, index) => {
          const value = `radio-${index}`

          return (
            <RadioGroup key={value} defaultValue={item.checked ? value : undefined}>
              <Radio
                aria-label={value}
                disabled={item.disabled}
                size={item.size}
                value={value}
              />
            </RadioGroup>
          )
        })}
      </>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>('[role="radio"]')
    expect(controls).toHaveLength(cases.length)

    cases.forEach((item, index) => {
      const control = controls[index]

      expect(control.getAttribute("aria-checked")).toBe(String(item.checked))
      expect(control.hasAttribute("data-disabled")).toBe(item.disabled)
      expect(control.classList.contains(item.size === "small" ? "size-5" : "size-6")).toBe(true)
      expect(control.querySelector('[data-slot="radio-unchecked-icon"]')).not.toBeNull()

      if (item.checked) {
        expect(control.querySelector('[data-slot="radio-checked-icon"]')).not.toBeNull()
      } else {
        expect(control.querySelector('[data-slot="radio-checked-icon"]')).toBeNull()
      }
    })

    await view.unmount()
  })

  it("supports group selection, sizes, and keyboard interaction", async () => {
    const view = render(
      <RadioGroup defaultValue="large">
        <Radio aria-label="Small radio" size="small" value="small" />
        <Radio aria-label="Large radio" size="large" value="large" />
      </RadioGroup>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>('[role="radio"]')
    expect(controls).toHaveLength(2)
    expect(controls[0].getAttribute("aria-checked")).toBe("false")
    expect(controls[0].classList.contains("size-5")).toBe(true)
    expect(controls[1].getAttribute("aria-checked")).toBe("true")
    expect(controls[1].classList.contains("size-6")).toBe(true)

    await act(async () => {
      controls[0]?.focus()
      controls[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      controls[0]?.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }))
    })
    expect(controls[0].getAttribute("aria-checked")).toBe("true")

    await view.unmount()
  })

  it("can deselect the active radio when allowDeselect is enabled", async () => {
    const view = render(<ToggleableRadioExample />)
    await view.render()

    const control = view.container.querySelector<HTMLElement>('[role="radio"]')
    const label = view.container.querySelector<HTMLElement>('[data-slot="radio-label"]')
    expect(control?.getAttribute("aria-checked")).toBe("true")

    await act(async () => label?.click())

    expect(control?.getAttribute("aria-checked")).toBe("false")

    await view.unmount()
  })

  it("keeps disabled and read-only radios from changing group selection", async () => {
    const onValueChange = vi.fn()
    const view = render(
      <RadioGroup defaultValue="enabled" onValueChange={onValueChange}>
        <Radio aria-label="Disabled radio" disabled value="disabled" />
        <Radio aria-label="Read only radio" readOnly value="readonly" />
        <Radio aria-label="Enabled radio" value="enabled" />
      </RadioGroup>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>('[role="radio"]')
    await act(async () => {
      controls[0]?.click()
      controls[1]?.click()
    })

    expect(controls[0].hasAttribute("data-disabled")).toBe(true)
    expect(controls[0].getAttribute("aria-checked")).toBe("false")
    expect(controls[1].getAttribute("aria-readonly")).toBe("true")
    expect(controls[2].getAttribute("aria-checked")).toBe("true")
    expect(onValueChange).not.toHaveBeenCalled()

    await view.unmount()
  })

  it("keeps labels associated and submits the selected radio value", async () => {
    const view = render(
      <form>
        <RadioGroup name="plan" defaultValue="pro" required>
          <Radio label="Free plan" value="free" />
          <Radio label="Pro plan" value="pro" />
        </RadioGroup>
      </form>,
    )
    await view.render()

    const controls = view.container.querySelectorAll<HTMLElement>('[role="radio"]')
    const inputs = view.container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    const form = view.container.querySelector("form")
    const labelId = controls[1].getAttribute("aria-labelledby")
    expect(document.getElementById(labelId ?? "")?.textContent).toBe("Pro plan")
    expect(inputs[1].labels).toHaveLength(1)
    expect(inputs[1].required).toBe(true)
    expect(new FormData(form ?? undefined).get("plan")).toBe("pro")

    await view.unmount()
  })
})

function ToggleableRadioExample() {
  const [value, setValue] = React.useState<string | undefined>("starter")

  return (
    <RadioGroup value={value ?? ""} onValueChange={setValue}>
      <Radio
        allowDeselect
        aria-label="Starter plan"
        label="Starter plan"
        onDeselect={() => setValue(undefined)}
        value="starter"
      />
      <Radio aria-label="Pro plan" value="pro" />
    </RadioGroup>
  )
}

describe("Selection cards", () => {
  it("deselects an active radio card when its card is clicked", async () => {
    function ToggleableRadioCardExample() {
      const [value, setValue] = React.useState<string | undefined>("starter")

      return (
        <RadioGroup value={value ?? ""} onValueChange={setValue}>
          <RadioCard
            allowDeselect
            label="Starter plan"
            onDeselect={() => setValue(undefined)}
            value="starter"
          />
        </RadioGroup>
      )
    }

    const view = render(<ToggleableRadioCardExample />)
    await view.render()

    const card = view.container.querySelector<HTMLElement>('[data-slot="select-card"]')
    const control = view.container.querySelector<HTMLElement>('[role="radio"]')
    expect(control?.getAttribute("aria-checked")).toBe("true")

    await act(async () => card?.click())

    expect(control?.getAttribute("aria-checked")).toBe("false")

    await view.unmount()
  })

  it("renders checkbox cards in horizontal and vertical layouts", async () => {
    const view = render(
      <>
        <CheckboxCard
          label="Accept terms"
          orientation="horizontal"
          supportingText="Required to continue"
        />
        <CheckboxCard
          checked
          disabled
          label="Pro plan"
          orientation="vertical"
          showSupportingText={false}
          size="large"
          supportingText="Billed monthly"
        />
      </>,
    )
    await view.render()

    const cards = view.container.querySelectorAll<HTMLElement>('[data-slot="select-card"]')
    const controls = view.container.querySelectorAll<HTMLElement>('[role="checkbox"]')
    expect(cards[0].dataset.orientation).toBe("horizontal")
    expect(cards[1].dataset.orientation).toBe("vertical")
    expect(cards[1].dataset.size).toBe("large")
    expect(cards[1].hasAttribute("data-disabled")).toBe(true)
    expect(controls[1].getAttribute("aria-checked")).toBe("true")
    expect(cards[1].className).toContain("has-data-[checked]:border-blue-600")
    expect(cards[1].className).toContain(
      "has-data-[disabled]:has-data-[checked]:border-transparent",
    )
    expect(view.container.querySelectorAll('[data-slot="select-card-supporting-text"]')).toHaveLength(1)

    await view.unmount()
  })

  it("keeps the whole checkbox card clickable and form-compatible", async () => {
    const onCheckedChange = vi.fn()
    const view = render(
      <form>
        <CheckboxCard
          label="Remember choice"
          name="remember"
          onCheckedChange={onCheckedChange}
          value="yes"
        />
      </form>,
    )
    await view.render()

    const card = view.container.querySelector<HTMLElement>('[data-slot="select-card"]')
    const control = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    const form = view.container.querySelector("form")
    await act(async () => card?.click())
    expect(control?.getAttribute("aria-checked")).toBe("true")
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
    expect(new FormData(form ?? undefined).get("remember")).toBe("yes")

    await view.unmount()
  })

  it("toggles a checkbox card when supporting text is clicked", async () => {
    const view = render(
      <CheckboxCard label="Remember choice" supportingText="Click this supporting text" />,
    )
    await view.render()

    const supportingText = view.container.querySelector<HTMLElement>(
      '[data-slot="select-card-supporting-text"]',
    )
    const control = view.container.querySelector<HTMLElement>('[role="checkbox"]')
    expect(control?.getAttribute("aria-checked")).toBe("false")

    await act(async () => supportingText?.click())

    expect(control?.getAttribute("aria-checked")).toBe("true")

    await view.unmount()
  })

  it("composes radio cards inside a RadioGroup and preserves single selection", async () => {
    const onValueChange = vi.fn()
    const view = render(
      <form>
        <RadioGroup defaultValue="pro" name="plan" onValueChange={onValueChange}>
          <RadioCard label="Free plan" value="free" />
          <RadioCard label="Pro plan" supportingText="For teams" value="pro" />
        </RadioGroup>
      </form>,
    )
    await view.render()

    const cards = view.container.querySelectorAll<HTMLElement>('[data-slot="select-card"]')
    const controls = view.container.querySelectorAll<HTMLElement>('[role="radio"]')
    const form = view.container.querySelector("form")
    expect(controls).toHaveLength(2)
    expect(controls[0].getAttribute("aria-checked")).toBe("false")
    expect(controls[1].getAttribute("aria-checked")).toBe("true")
    expect(cards[1].className).toContain("has-data-[checked]:border-blue-600")
    expect(new FormData(form ?? undefined).get("plan")).toBe("pro")

    await act(async () => cards[0]?.click())
    expect(onValueChange).toHaveBeenCalledWith("free", expect.anything())
    expect(controls[0].getAttribute("aria-checked")).toBe("true")
    expect(controls[1].getAttribute("aria-checked")).toBe("false")
    expect(new FormData(form ?? undefined).get("plan")).toBe("free")

    await view.unmount()
  })
})

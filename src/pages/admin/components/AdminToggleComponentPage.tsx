import { useState } from "react";
import { FunnelIcon } from "@phosphor-icons/react/dist/csr/Funnel";

import { IconToggle, Toggle } from "@/components/ui/toggle";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const sizes = ["small", "large"] as const;
const variants = ["default", "alternative"] as const;
const checkedStates = [false, true] as const;
const availability = [
  { id: "enabled", label: "Enable", disabled: false },
  { id: "disabled", label: "Disabled", disabled: true },
] as const;

type AdminToggleComponentPageProps = {
  embedded?: boolean;
};

export default function AdminToggleComponentPage({
  embedded = false,
}: AdminToggleComponentPageProps) {
  // const [checked, setChecked] = useState(false);
  const [pressed, setPressed] = useState(true);
  const filterIcon = <FunnelIcon weight="regular" className="size-5" />;

  return (
    <ComponentShowcaseLayout
      title="Toggle"
      description="Inspect Toggle and IconToggle variants, sizes, pressed states, and disabled behavior."
      embedded={embedded}
    >
      <ShowcaseSection title="Variants and sizes" criterion="Default/alternative variants cover small/large states.">
        <div
          data-testid="toggle-variants-reference"
          className="grid grid-cols-[auto_repeat(2,minmax(0,1fr))] gap-x-4 gap-y-4"
        >
          <p className="text-body-small text-foreground-muted">Size</p>
          {availability.map(({ id, label }) => (
            <p key={id} className="text-center text-body-small text-foreground-muted">
              {label}
            </p>
          ))}
          {sizes.map((size) => (
            <div key={size} className="contents">
              <p className="self-start text-body-small text-foreground-muted">{size}</p>
              {availability.map(({ id, disabled }) => (
                <div
                  key={`${size}-${id}`}
                  data-testid={`toggle-group-${size}-${id}`}
                  className="grid gap-3 rounded-lg border border-border p-4"
                >
                  {variants.flatMap((variant) => checkedStates.map((isChecked) => (
                    <div
                      key={`${size}-${id}-${variant}-${isChecked}`}
                      data-testid={`toggle-sample-${size}-${id}-${variant}-${isChecked ? "checked" : "unchecked"}`}
                      className="flex min-h-14 items-center justify-center p-3"
                    >
                      <Toggle
                        data-testid={`toggle-${size}-${id}-${variant}-${isChecked ? "checked" : "unchecked"}`}
                        size={size}
                        variant={variant}
                        label="Enable feature"
                        defaultChecked={isChecked}
                        disabled={disabled}
                      />
                    </div>
                  )))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </ShowcaseSection>
      {/* <ShowcaseSection title="States" criterion="Checked and disabled controls must remain interactive or explicitly unavailable.">
        <div data-testid="toggle-interactive-states" className="grid gap-4 sm:grid-cols-3">
          <div data-testid="toggle-state-enabled" className="flex min-h-14 items-center justify-center rounded-md border border-border-subtle bg-surface-raised p-3">
            <Toggle label="Enable feature" checked={checked} onCheckedChange={setChecked} />
          </div>
          <div data-testid="toggle-state-unchecked-disabled" className="flex min-h-14 items-center justify-center rounded-md border border-border-subtle bg-surface-raised p-3">
            <Toggle label="Enable feature" checked={false} disabled />
          </div>
          <div data-testid="toggle-state-checked-disabled" className="flex min-h-14 items-center justify-center rounded-md border border-border-subtle bg-surface-raised p-3">
            <Toggle label="Disabled toggle" checked disabled />
          </div>
        </div>
      </ShowcaseSection> */}
      <ShowcaseSection title="IconToggle" criterion="Pressed and disabled icon states must remain visible.">
        <div data-testid="icon-toggle-reference" className="grid gap-4 rounded-lg border border-border-subtle bg-surface-base p-4 sm:grid-cols-2">
          <div data-testid="icon-toggle-group-enabled" className="grid gap-3 rounded-md border border-border-subtle bg-surface-base p-4">
            <p className="text-body-small text-foreground-muted">Enable</p>
            <div className="flex items-center gap-4">
              <div data-testid="icon-toggle-sample-enabled-pressed" className="p-2">
                <IconToggle icon={filterIcon} aria-label="Toggle filter" pressed={pressed} onPressedChange={setPressed} />
              </div>
              <div data-testid="icon-toggle-sample-enabled-unpressed" className="p-2">
                <IconToggle icon={filterIcon} aria-label="Toggle filter" defaultPressed={false} />
              </div>
            </div>
          </div>
          <div data-testid="icon-toggle-group-disabled" className="grid gap-3 rounded-md border border-border-subtle bg-surface-base p-4">
            <p className="text-body-small text-foreground-muted">Disabled</p>
            <div className="flex items-center gap-4">
              <div data-testid="icon-toggle-sample-disabled-pressed" className="p-2">
                <IconToggle icon={filterIcon} aria-label="Disabled toggle" pressed disabled />
              </div>
              <div data-testid="icon-toggle-sample-disabled-unpressed" className="p-2">
                <IconToggle icon={filterIcon} aria-label="Disabled toggle" disabled />
              </div>
            </div>
          </div>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}

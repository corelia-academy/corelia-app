import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { Toggle as ToggleButtonPrimitive } from "@base-ui/react/toggle"
import { FunnelIcon } from "@phosphor-icons/react/dist/csr/Funnel"

import { cn } from "@/lib/utils"

export type ToggleSize = "small" | "large"
export type ToggleVariant = "default" | "alternative"
export type ToggleLabelPosition = "start" | "end"

export type IconToggleProps = Omit<
  ToggleButtonPrimitive.Props,
  "children" | "className"
> & {
  className?: string
  icon?: React.ReactNode
}

export type ToggleProps = Omit<
  SwitchPrimitive.Root.Props,
  "children" | "className"
> & {
  className?: string
  label?: React.ReactNode
  labelClassName?: string
  labelPosition?: ToggleLabelPosition
  size?: ToggleSize
  supportingText?: React.ReactNode
  variant?: ToggleVariant
}

const sizeStyles: Record<
  ToggleSize,
  { label: string; textGap: string; controlGap: string }
> = {
  small: {
    label: "text-label-medium",
    textGap: "gap-xs",
    controlGap: "gap-lg",
  },
  large: {
    label: "text-label-large",
    textGap: "gap-sm",
    controlGap: "gap-xl",
  },
}

export const Toggle = React.forwardRef<HTMLElement, ToggleProps>(
  (
    {
      className,
      id,
      label,
      labelClassName,
      labelPosition = "start",
      size = "small",
      supportingText,
      variant = "default",
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const controlId = id ?? `toggle-${generatedId}`
    const labelId = `${controlId}-label`
    const supportingTextId = `${controlId}-supporting-text`
    const hasLabel = label !== undefined && label !== null
    const hasSupportingText =
      supportingText !== undefined && supportingText !== null
    const disabled = props.disabled ?? false
    const { ["aria-describedby"]: externalDescribedBy, ["aria-labelledby"]: externalLabelledBy, ...rootProps } = props
    const ariaLabelledBy = [hasLabel ? labelId : undefined, externalLabelledBy]
      .filter(Boolean)
      .join(" ")
    const ariaDescribedBy = [
      hasSupportingText ? supportingTextId : undefined,
      externalDescribedBy,
    ]
      .filter(Boolean)
      .join(" ")
    const labelledByProps = ariaLabelledBy
      ? { "aria-labelledby": ariaLabelledBy }
      : {}
    const describedByProps = ariaDescribedBy
      ? { "aria-describedby": ariaDescribedBy }
      : {}

    const control = (
      <SwitchPrimitive.Root
        ref={ref}
        id={controlId}
        data-slot="toggle"
        data-size={size}
        data-variant={variant}
        className={cn(
          "group/toggle relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center overflow-clip rounded-xl border-0 bg-toggle-track p-0.5 outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[checked]:justify-end data-[checked]:bg-toggle-track-checked data-[checked]:data-[variant=alternative]:bg-toggle-track-alternative data-[disabled]:cursor-not-allowed data-[disabled]:bg-toggle-track-disabled data-[checked]:data-[disabled]:bg-toggle-track-checked-disabled data-[checked]:data-[variant=alternative]:data-[disabled]:bg-toggle-track-alternative-disabled motion-reduce:transition-none",
          className,
        )}
        {...rootProps}
        {...labelledByProps}
        {...describedByProps}
      >
        <SwitchPrimitive.Thumb
          data-slot="toggle-thumb"
          className="block h-4 w-5 shrink-0 rounded-full bg-toggle-thumb transition-transform duration-150 ease-out group-data-[disabled]/toggle:bg-toggle-thumb-disabled motion-reduce:transition-none"
        />
      </SwitchPrimitive.Root>
    )

    if (!hasLabel && !hasSupportingText) {
      return control
    }

    const text = (
      <span
        data-slot="toggle-text"
        className={cn(
          "flex min-w-0 flex-col font-body",
          sizeStyles[size].textGap,
          sizeStyles[size].label,
          disabled ? "text-toggle-text-disabled" : "text-toggle-text",
          labelClassName,
        )}
      >
        {hasLabel && <span id={labelId}>{label}</span>}
        {hasSupportingText && (
          <span
            id={supportingTextId}
            className="text-body-small font-body text-foreground-muted"
          >
            {supportingText}
          </span>
        )}
      </span>
    )

    return (
      <label
        data-slot="toggle-label"
        data-disabled={disabled ? "" : undefined}
        data-size={size}
        className={cn(
          "inline-flex select-none items-center",
          sizeStyles[size].controlGap,
          disabled && "cursor-not-allowed",
        )}
      >
        {labelPosition === "start" ? (
          <>
            {text}
            {control}
          </>
        ) : (
          <>
            {control}
            {text}
          </>
        )}
      </label>
    )
  },
)

Toggle.displayName = "Toggle"

export const IconToggle = React.forwardRef<
  HTMLButtonElement,
  IconToggleProps
>(({ className, icon, ...props }, ref) => (
  <ToggleButtonPrimitive
    ref={ref}
    data-slot="icon-toggle"
    className={cn(
      "inline-flex size-10 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground outline-none transition-colors duration-150 ease-out",
      "data-[pressed]:bg-toggle-pressed-background data-[pressed]:text-toggle-pressed-foreground",
      "data-[disabled]:cursor-not-allowed data-[disabled]:text-toggle-icon-disabled",
      "data-[pressed]:data-[disabled]:bg-toggle-pressed-disabled-background data-[pressed]:data-[disabled]:text-toggle-pressed-disabled-foreground",
      "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "motion-reduce:transition-none",
      className,
    )}
    {...props}
  >
    <span aria-hidden className="flex size-5 items-center justify-center">
      {icon ?? <FunnelIcon weight="regular" className="size-5" />}
    </span>
  </ToggleButtonPrimitive>
))

IconToggle.displayName = "IconToggle"

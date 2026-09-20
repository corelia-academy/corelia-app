import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { cn } from "@/lib/utils"

type SelectionSize = "small" | "large"
type SelectionCardOrientation = "horizontal" | "vertical"

const sizeStyles: Record<
  SelectionSize,
  { control: string; label: string }
> = {
  small: {
    control: "size-5",
    label: "text-label-medium font-body",
  },
  large: {
    control: "size-6",
    label: "text-label-large font-body",
  },
}

type SelectionIconState = "unchecked" | "checked" | "indeterminate"
type SelectionIconKind = "checkbox" | "radio"

type SelectionIconProps = {
  className?: string
  dataSlot: string
  kind: SelectionIconKind
  size: SelectionSize
  disabled: boolean
  state: SelectionIconState
}

// function SelectionIcon({
//   className,
//   dataSlot,
//   kind,
//   size,
//   disabled,
//   state,
// }: SelectionIconProps) {
//   const iconSize = size === "small" ? 20 : 24
//   const color = disabled
//     ? "var(--selection-disabled)"
//     : state === "unchecked"
//       ? "var(--selection-unchecked)"
//       : "var(--selection-active)"

//   const iconMap: Record<
//     SelectionIconKind,
//     Record<SelectionIconState, React.ElementType | null>
//   > = {
//     checkbox: {
//       unchecked: Square,
//       checked: CheckSquare,
//       indeterminate: MinusSquare,
//     },
//     radio: {
//       unchecked: Circle,
//       checked: null,
//       indeterminate: null,
//     },
//   }

//   if (kind === "radio" && state === "checked") {
//     const innerIconSize = Math.round(iconSize * 0.5)

//     return (
//       <span
//         aria-hidden
//         className={cn(
//           className,
//           "pointer-events-none relative inline-flex size-full items-center justify-center",
//         )}
//         data-slot={dataSlot}
//       >
//         <Circle color={color} size={iconSize} weight="regular" />
//         <span
//           data-slot="radio-checked-dot"
//           className="pointer-events-none absolute inset-0 inline-flex items-center justify-center"
//           aria-hidden="true"
//         >
//           <Circle color={color} size={innerIconSize} weight="fill" />
//         </span>
//       </span>
//     )
//   }

//   const Icon = iconMap[kind][state]

//   if (!Icon) {
//     return null
//   }

//   return (
//     <span
//       aria-hidden
//       className={cn(
//         "pointer-events-none inline-flex size-full items-center justify-center",
//         className,
//       )}
//       data-slot={dataSlot}
//     >
//       <Icon color={color} size={iconSize} weight="regular" />
//     </span>
//   )
// )}

  function SelectionIcon({
    className,
    dataSlot,
    kind,
    size,
    disabled,
    state,
  }: SelectionIconProps) {
    const iconSize = size === "small" ? 20 : 24
    const color = disabled
      ? "var(--selection-disabled)"
      : state === "unchecked"
        ? "var(--selection-unchecked)"
        : "var(--selection-active)"
    const markColor = disabled ? "var(--neutral-400)" : "var(--blue-50)"

    if (kind === "checkbox") {
      const isSmall = size === "small"
      const viewBox = isSmall ? "0 0 20 20" : "0 0 24 24"

      return (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none inline-flex size-full items-center justify-center",
            className,
          )}
          data-slot={dataSlot}
        >
          <svg
            viewBox={viewBox}
            width={iconSize}
            height={iconSize}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-full"
          >
            {state === "unchecked" && (
              <rect
                x="0.75"
                y="0.75"
                width={isSmall ? "18.5" : "22.5"}
                height={isSmall ? "18.5" : "22.5"}
                rx={isSmall ? 4.25 : 5}
                stroke={color}
                strokeWidth="1.5"
              />
            )}

            {state === "checked" && (
              <>
                <rect
                  width={isSmall ? 20 : 24}
                  height={isSmall ? 20 : 24}
                  rx={5}
                  fill={color}
                />
                <path
                  d={isSmall ? "M15 6.25L8.125 13.125L5 10" : "M18 7.5L9.75 15.75L6 12"}
                  stroke={markColor}
                  strokeWidth="1.6666"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {state === "indeterminate" && (
              <>
                <rect
                  x="0.75"
                  y="0.75"
                  width={isSmall ? "18.5" : "22.5"}
                  height={isSmall ? "18.5" : "22.5"}
                  rx={isSmall ? 4.25 : 5}
                  stroke={color}
                  strokeWidth="1.5"
                />
                <path
                  d={isSmall ? "M5 10H15" : "M6 12H18"}
                  stroke={color}
                  strokeWidth="1.67"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>
        </span>
      )
    }

    if (kind === "radio") {
      const center = iconSize / 2
      const radius = center - 0.75
      const dotRadius = size === "small" ? 5 : 6

      return (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none inline-flex size-full items-center justify-center",
            className,
          )}
          data-slot={dataSlot}
        >
          <svg
            viewBox={`0 0 ${iconSize} ${iconSize}`}
            width={iconSize}
            height={iconSize}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="block size-full"
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
            />
            {state === "checked" && (
              <circle
                data-slot="radio-checked-dot"
                cx={center}
                cy={center}
                r={dotRadius}
                fill={color}
              />
            )}
          </svg>
        </span>
      )
    }
    return null
  }

export type CheckboxProps = Omit<
  CheckboxPrimitive.Root.Props,
  "children" | "className"
> & {
  className?: string
  label?: React.ReactNode
  labelClassName?: string
  showLabel?: boolean
  size?: SelectionSize
  trailing?: React.ReactNode
}

export type RadioProps = Omit<
  RadioPrimitive.Root.Props,
  "children" | "className"
> & {
  allowDeselect?: boolean
  className?: string
  label?: React.ReactNode
  labelClassName?: string
  onDeselect?: () => void
  showLabel?: boolean
  size?: SelectionSize
  trailing?: React.ReactNode
}

type RadioDeselectOptions = {
  allowDeselect: boolean
  disabled: boolean
  onDeselect?: () => void
  readOnly?: boolean
}

type RadioClickEvent = Parameters<
  NonNullable<RadioPrimitive.Root.Props["onClick"]>
>[0]

function handleRadioDeselect(
  event: React.MouseEvent<HTMLElement>,
  radioElement: HTMLElement | null,
  { allowDeselect, disabled, onDeselect, readOnly }: RadioDeselectOptions,
) {
  if (
    !allowDeselect ||
    !onDeselect ||
    disabled ||
    readOnly ||
    radioElement?.getAttribute("aria-checked") !== "true"
  ) {
    return
  }

  event.preventDefault()
  onDeselect()
}

type SelectionCardCommonProps = {
  className?: string
  label: React.ReactNode
  orientation?: SelectionCardOrientation
  showSupportingText?: boolean
  size?: SelectionSize
  supportingText?: React.ReactNode
}

export type CheckboxCardProps = SelectionCardCommonProps &
  Omit<
    CheckboxProps,
    | "aria-describedby"
    | "aria-labelledby"
    | "className"
    | "indeterminate"
    | "label"
    | "labelClassName"
    | "showLabel"
    | "size"
    | "trailing"
  >

export type RadioCardProps = SelectionCardCommonProps &
  Omit<
    RadioProps,
    | "aria-describedby"
    | "aria-labelledby"
    | "className"
    | "label"
    | "labelClassName"
    | "showLabel"
    | "size"
    | "trailing"
    | "value"
  > & {
    value: string
  }

function SelectionLabelContent({
  control,
  hasLabel,
  hasVisibleLabel,
  label,
  labelId,
  labelClassName,
  onLabelClick,
  size,
  trailing,
  wrapperSlot,
}: {
  control: React.ReactNode
  hasLabel: boolean
  hasVisibleLabel: boolean
  label?: React.ReactNode
  labelId: string
  labelClassName?: string
  onLabelClick?: React.MouseEventHandler<HTMLLabelElement>
  size: SelectionSize
  trailing?: React.ReactNode
  wrapperSlot: "checkbox" | "radio"
}) {
  if (!hasVisibleLabel && trailing === undefined) {
    if (hasLabel) {
      return (
        <>
          {control}
          <span id={labelId} className="sr-only">
            {label}
          </span>
        </>
      )
    }

    return control
  }

  const content = (
    <>
      {control}
      {hasLabel && (
        <span id={labelId} className={hasVisibleLabel ? undefined : "sr-only"}>
          {label}
        </span>
      )}
      {trailing}
    </>
  )

  const wrapperClassName = cn(
    "inline-flex items-center gap-md select-none has-data-[disabled]:cursor-not-allowed has-data-[disabled]:text-foreground-muted",
    hasVisibleLabel && sizeStyles[size].label,
    labelClassName,
  )

  if (!hasVisibleLabel) {
    return (
      <span data-slot={`${wrapperSlot}-wrapper`} className={wrapperClassName}>
        {content}
      </span>
    )
  }

  return (
    <label
      data-slot={`${wrapperSlot}-label`}
      className={wrapperClassName}
      onClick={onLabelClick}
    >
      {content}
    </label>
  )
}

export const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(
  (
    {
      className,
      id,
      indeterminate = false,
      label,
      labelClassName,
      showLabel = true,
      size = "small",
      trailing,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const labelId = `${inputId}-label`
    const hasLabel = label !== undefined && label !== null
    const hasVisibleLabel = showLabel && hasLabel
    const { ["aria-labelledby"]: externalLabelledBy, ...rootProps } = props
    const ariaLabelledBy = [hasLabel ? labelId : undefined, externalLabelledBy]
      .filter(Boolean)
      .join(" ")
    const labelledByProps = ariaLabelledBy
      ? { "aria-labelledby": ariaLabelledBy }
      : {}
    const styles = sizeStyles[size]
    const disabled = props.disabled ?? false

    const control = (
      <CheckboxPrimitive.Root
        ref={ref}
        id={inputId}
        data-slot="checkbox"
        indeterminate={indeterminate}
        className={cn(
          "group/checkbox relative inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed",
          styles.control,
          className,
        )}
        {...rootProps}
        {...labelledByProps}
      >
        <span
          data-slot="checkbox-interaction-feedback"
          aria-hidden
          className="pointer-events-none absolute -inset-2 scale-90 rounded-md bg-selection-feedback opacity-0 transition-[opacity,transform,background-color] duration-150 ease-out group-hover/checkbox:scale-100 group-hover/checkbox:opacity-100 group-focus-visible/checkbox:scale-100 group-focus-visible/checkbox:opacity-100 group-active/checkbox:scale-100 group-active/checkbox:opacity-100 group-active/checkbox:bg-selection-feedback-pressed group-data-[disabled]/checkbox:opacity-0 motion-reduce:transition-none"
        />
        <SelectionIcon
          dataSlot="checkbox-unchecked-frame"
          kind="checkbox"
          size={size}
          disabled={disabled}
          state="unchecked"
          className="pointer-events-none absolute inset-0 size-full transition-[opacity,transform] duration-150 ease-out group-data-[checked]/checkbox:scale-95 group-data-[checked]/checkbox:opacity-0 group-data-[indeterminate]/checkbox:scale-95 group-data-[indeterminate]/checkbox:opacity-0 motion-reduce:transition-none"
        />
        <SelectionIcon
          dataSlot="checkbox-checked-frame"
          kind="checkbox"
          size={size}
          disabled={disabled}
          state="checked"
          className="pointer-events-none absolute inset-0 size-full scale-95 opacity-0 transition-[opacity,transform] duration-150 ease-out group-data-[checked]/checkbox:scale-100 group-data-[checked]/checkbox:opacity-100 motion-reduce:transition-none"
        />
        <SelectionIcon
          dataSlot="checkbox-indeterminate-frame"
          kind="checkbox"
          size={size}
          disabled={disabled}
          state="indeterminate"
          className="pointer-events-none absolute inset-0 size-full scale-95 opacity-0 transition-[opacity,transform] duration-150 ease-out group-data-[indeterminate]/checkbox:scale-100 group-data-[indeterminate]/checkbox:opacity-100 motion-reduce:transition-none"
        />
      </CheckboxPrimitive.Root>
    )

    return (
      <SelectionLabelContent
        control={control}
        hasLabel={hasLabel}
        hasVisibleLabel={hasVisibleLabel}
        label={label}
        labelId={labelId}
        labelClassName={labelClassName}
        size={size}
        trailing={trailing}
        wrapperSlot="checkbox"
      />
    )
  },
)

Checkbox.displayName = "Checkbox"

export const Radio = React.forwardRef<HTMLElement, RadioProps>(
  (
    {
      allowDeselect = false,
      className,
      id,
      label,
      labelClassName,
      onClick,
      onDeselect,
      showLabel = true,
      size = "small",
      trailing,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const labelId = `${inputId}-label`
    const hasLabel = label !== undefined && label !== null
    const hasVisibleLabel = showLabel && hasLabel
    const { ["aria-labelledby"]: externalLabelledBy, ...rootProps } = props
    const ariaLabelledBy = [hasLabel ? labelId : undefined, externalLabelledBy]
      .filter(Boolean)
      .join(" ")
    const labelledByProps = ariaLabelledBy
      ? { "aria-labelledby": ariaLabelledBy }
      : {}
    const styles = sizeStyles[size]
    const disabled = props.disabled ?? false
    const radioDeselectOptions = {
      allowDeselect,
      disabled,
      onDeselect,
      readOnly: props.readOnly,
    }
    const handleClick = (event: RadioClickEvent) => {
      onClick?.(event)
      handleRadioDeselect(event, event.currentTarget, radioDeselectOptions)
    }
    const handleLabelClick = (event: React.MouseEvent<HTMLLabelElement>) => {
      if (event.defaultPrevented) {
        return
      }

      handleRadioDeselect(
        event,
        event.currentTarget.querySelector<HTMLElement>('[data-slot="radio"]'),
        radioDeselectOptions,
      )
    }

    const control = (
      <RadioPrimitive.Root
        ref={ref}
        id={inputId}
        data-slot="radio"
        className={cn(
          "group/radio inline-flex shrink-0 items-center justify-center border-0 bg-transparent outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed",
          styles.control,
          className,
        )}
        {...rootProps}
        onClick={handleClick}
        {...labelledByProps}
      >
        <SelectionIcon
          dataSlot="radio-unchecked-icon"
          kind="radio"
          size={size}
          disabled={disabled}
          state="unchecked"
          className="block size-full group-data-[checked]/radio:hidden"
        />
        <RadioPrimitive.Indicator
          data-slot="radio-indicator"
          className="block size-full"
        >
          <SelectionIcon
            dataSlot="radio-checked-icon"
            kind="radio"
            size={size}
            disabled={disabled}
            state="checked"
            className="block size-full"
          />
        </RadioPrimitive.Indicator>
      </RadioPrimitive.Root>
    )

    return (
      <SelectionLabelContent
        control={control}
        hasLabel={hasLabel}
        hasVisibleLabel={hasVisibleLabel}
        label={label}
        labelId={labelId}
        labelClassName={labelClassName}
        onLabelClick={hasVisibleLabel ? handleLabelClick : undefined}
        size={size}
        trailing={trailing}
        wrapperSlot="radio"
      />
    )
  },
)

Radio.displayName = "Radio"

function useSelectionCardIds(id?: string) {
  const generatedId = React.useId()
  const controlId = id ?? `select-card-${generatedId}`

  return {
    controlId,
    labelId: `${controlId}-label`,
    supportingTextId: `${controlId}-supporting-text`,
  }
}

function SelectionCardShell({
  className,
  control,
  disabled,
  hasSupportingText,
  label,
  labelId,
  onClick,
  orientation,
  size,
  supportingText,
  supportingTextId,
}: SelectionCardCommonProps & {
  control: React.ReactNode
  disabled: boolean
  hasSupportingText: boolean
  labelId: string
  onClick?: React.MouseEventHandler<HTMLLabelElement>
  supportingTextId: string
}) {
  return (
    <label
      data-slot="select-card"
      data-disabled={disabled ? "" : undefined}
      data-orientation={orientation}
      data-size={size}
      className={cn(
        "group/select-card flex w-full min-w-0 cursor-pointer rounded-md border border-transparent bg-surface-raised p-lg text-foreground outline-none transition-colors duration-150 ease-out select-none focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-background has-data-[checked]:border-selection-card-selected-border has-data-[disabled]:cursor-not-allowed has-data-[disabled]:border-transparent has-data-[disabled]:text-foreground-muted has-data-[disabled]:has-data-[checked]:border-transparent",
        orientation === "horizontal" ? "flex-col gap-xs" : "flex-col gap-md",
        className,
      )}
      onClick={onClick}
    >
      <span
        data-slot="select-card-content"
        className={cn(
          "flex min-w-0",
          orientation === "horizontal"
            ? "w-full items-center gap-md"
            : "w-full flex-col items-start gap-md",
        )}
      >
        {control}
        <span
          className={cn(
            "min-w-0 text-inherit",
            orientation === "vertical" && "flex w-full flex-col gap-xs",
          )}
        >
          <span
            id={labelId}
            data-slot="select-card-label"
            className={cn(
              "break-words text-inherit font-body",
              size === "small" ? "text-label-medium" : "text-label-large",
            )}
          >
            {label}
          </span>
          {orientation === "vertical" && hasSupportingText && (
            <span
              id={supportingTextId}
              data-slot="select-card-supporting-text"
              className="break-words text-body-small font-body text-foreground-muted"
            >
              {supportingText}
            </span>
          )}
        </span>
      </span>
      {orientation === "horizontal" && hasSupportingText && (
        <span
          id={supportingTextId}
          data-slot="select-card-supporting-text"
          className={cn(
            "w-full break-words text-body-small font-body text-foreground-muted",
            size === "small" ? "pl-4xl" : "pl-5xl",
          )}
        >
          {supportingText}
        </span>
      )}
    </label>
  )
}

function handleSelectionCardClick(
  event: React.MouseEvent<HTMLLabelElement>,
) {
  if (
    event.defaultPrevented ||
    event.currentTarget.hasAttribute("data-disabled")
  ) {
    return
  }

  const target = event.target

  if (
    target instanceof HTMLElement &&
    target.closest(
      '[data-slot="checkbox"], [data-slot="radio"], input[type="checkbox"], input[type="radio"]',
    )
  ) {
    return
  }

  event.preventDefault()
  event.currentTarget
    .querySelector<HTMLElement>('[data-slot="checkbox"], [data-slot="radio"]')
    ?.click()
}

export const CheckboxCard = React.forwardRef<HTMLElement, CheckboxCardProps>((props, ref) => {
  const {
    className,
    id,
    label,
    orientation = "horizontal",
    showSupportingText = true,
    size = "small",
    supportingText,
    ...checkboxProps
  } = props
  const { controlId, labelId, supportingTextId } = useSelectionCardIds(id)
  const hasSupportingText = showSupportingText && supportingText !== undefined && supportingText !== null

  return (
    <SelectionCardShell
      className={className}
      control={
        <Checkbox
          {...checkboxProps}
          ref={ref}
          id={controlId}
          aria-describedby={hasSupportingText ? supportingTextId : undefined}
          aria-labelledby={labelId}
          className="shrink-0"
          showLabel={false}
          size={size}
        />
      }
      disabled={Boolean(checkboxProps.disabled)}
      hasSupportingText={hasSupportingText}
      label={label}
      labelId={labelId}
      onClick={handleSelectionCardClick}
      orientation={orientation}
      size={size}
      supportingText={supportingText}
      supportingTextId={supportingTextId}
    />
  )
})

CheckboxCard.displayName = "CheckboxCard"

export const RadioCard = React.forwardRef<HTMLElement, RadioCardProps>((props, ref) => {
  const {
    className,
    id,
    label,
    orientation = "horizontal",
    showSupportingText = true,
    size = "small",
    supportingText,
    ...radioProps
  } = props
  const { controlId, labelId, supportingTextId } = useSelectionCardIds(id)
  const hasSupportingText = showSupportingText && supportingText !== undefined && supportingText !== null
  const handleCardClick = (event: React.MouseEvent<HTMLLabelElement>) => {
    if (event.defaultPrevented) {
      return
    }

    const target = event.target
    const clickedRadio =
      target instanceof HTMLElement &&
      target.closest('[data-slot="radio"]')

    if (!clickedRadio) {
      handleSelectionCardClick(event)
      return
    }

    handleRadioDeselect(
      event,
      event.currentTarget.querySelector<HTMLElement>('[data-slot="radio"]'),
      {
        allowDeselect: radioProps.allowDeselect ?? false,
        disabled: Boolean(radioProps.disabled),
        onDeselect: radioProps.onDeselect,
        readOnly: radioProps.readOnly,
      },
    )
  }

  return (
    <SelectionCardShell
      className={className}
      control={
        <Radio
          {...radioProps}
          ref={ref}
          id={controlId}
          aria-describedby={hasSupportingText ? supportingTextId : undefined}
          aria-labelledby={labelId}
          className="shrink-0"
          showLabel={false}
          size={size}
        />
      }
      disabled={Boolean(radioProps.disabled)}
      hasSupportingText={hasSupportingText}
      label={label}
      labelId={labelId}
      onClick={handleCardClick}
      orientation={orientation}
      size={size}
      supportingText={supportingText}
      supportingTextId={supportingTextId}
    />
  )
})

RadioCard.displayName = "RadioCard"

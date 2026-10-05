import * as React from "react"

import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import {
  FIELD_CONTROL_MARKER,
  FieldContextConsumer,
  type FieldContextValue,
} from "@/components/ui/field"
import { Tag } from "@/components/ui/tag"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

export type InputVariant =
  | "default"
  | "icon-leading"
  | "tags"

export type InputOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export type InputTagOption = InputOption & {
  leadingVisual?: React.ReactNode
}

function getOptionLabelText(label: React.ReactNode): string {
  if (typeof label === "string" || typeof label === "number") {
    return String(label)
  }

  if (Array.isArray(label)) {
    return label.map(getOptionLabelText).filter(Boolean).join(" ")
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(label)) {
    return getOptionLabelText(label.props.children)
  }

  return ""
}

export type InputAccessoryState = {
  disabled: boolean
  invalid: boolean
}

export type InputTagMenuState = {
  trigger: React.ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
  options: readonly InputTagOption[]
  selectedValues: readonly string[]
  onSelectedValuesChange: (values: string[]) => void
  disabled: boolean
  triggerAriaLabel: string
}

type InputDesignProps = {
  variant?: InputVariant
  leadingIcon?: React.ReactNode | null
  leadingIconClassName?: string
  statusIcon?: React.ReactNode | null
  controlClassName?: string
  renderLeadingContent?: (state: InputAccessoryState) => React.ReactNode
  renderTrailingContent?: (state: InputAccessoryState) => React.ReactNode
  tagOptions?: readonly InputTagOption[]
  selectedTagValues?: readonly string[]
  onSelectedTagValuesChange?: (values: string[]) => void
  renderTagMenu?: (state: InputTagMenuState) => React.ReactNode
  maxVisibleTags?: number
  expandedTagsMaxHeight?: React.CSSProperties["maxHeight"]
}

export type InputSingleLineProps =
  React.ComponentPropsWithoutRef<"input"> &
  InputDesignProps & {
    fieldType?: "single-line"
  }

export type InputAutoGrowProps =
  React.ComponentPropsWithoutRef<"textarea"> &
  InputDesignProps & {
    fieldType: "auto-grow"
    type?: never
  }

export type InputProps = InputSingleLineProps | InputAutoGrowProps

type InputComponent = {
  (
    props: InputSingleLineProps & React.RefAttributes<HTMLInputElement>,
  ): React.ReactElement | null
  (
    props: InputAutoGrowProps & React.RefAttributes<HTMLTextAreaElement>,
  ): React.ReactElement | null
}

function IconSlot({
  children,
  className,
  dataSlot,
}: {
  children: React.ReactNode
  className?: string
  dataSlot: string
}) {
  if (children === null || children === undefined) {
    return null
  }

  return (
    <span
      aria-hidden="true"
      data-slot={dataSlot}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center select-none [&_*]:select-none [&>svg]:size-5",
        className,
      )}
    >
      {children}
    </span>
  )
}

const InputImplementation = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>(
  (props, forwardedRef) => {
    return (
      <FieldContextConsumer>
        {(fieldContext) => (
          <InputImplementationContent
            fieldContext={fieldContext}
            forwardedRef={forwardedRef}
            props={props}
          />
        )}
      </FieldContextConsumer>
    )
  },
)

function InputImplementationContent({
  fieldContext,
  forwardedRef,
  props,
}: {
  fieldContext: FieldContextValue | null
  forwardedRef: React.ForwardedRef<HTMLInputElement | HTMLTextAreaElement>
  props: InputProps
}) {
    const {
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      className,
      controlClassName,
      defaultValue,
      disabled: inputDisabled = false,
      expandedTagsMaxHeight,
      fieldType = "single-line",
      id,
      leadingIcon,
      leadingIconClassName,
      maxLength,
      maxVisibleTags = 1,
      onChange,
      onClick,
      onFocus,
      onSelectedTagValuesChange,
      placeholder,
      required: inputRequired = false,
      renderLeadingContent,
      renderTagMenu,
      renderTrailingContent,
      selectedTagValues,
      statusIcon,
      tagOptions = [],
      type,
      value,
      variant = "default",
      ...inputProps
    } = props
    const disabled = Boolean(fieldContext?.disabled || inputDisabled)
    const required = Boolean(fieldContext?.required || inputRequired)
    const label = fieldContext?.label
    const hint = fieldContext?.hint
    const error = fieldContext?.error
    const { t } = useTranslation("common")
    const generatedId = React.useId()
    const inputId = fieldContext?.controlId ?? id ?? generatedId
    const hintId = fieldContext?.hintId ?? `${inputId}-hint`
    const errorId = fieldContext?.errorId ?? `${inputId}-error`
    const counterId = fieldContext?.counterId ?? `${inputId}-counter`
    const [uncontrolledLength, setUncontrolledLength] = React.useState(() =>
      String(defaultValue ?? "").length,
    )
    const [uncontrolledSelectedTags, setUncontrolledSelectedTags] =
      React.useState<readonly string[]>(() => selectedTagValues ?? [])
    const [tagMenuOpen, setTagMenuOpen] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const tagTriggerRef = React.useRef<HTMLSpanElement | null>(null)
    const [tagsAreWrapped, setTagsAreWrapped] = React.useState(false)

    React.useImperativeHandle(
      forwardedRef,
      () =>
        (fieldType === "auto-grow"
          ? textareaRef.current
          : inputRef.current)!,
      [fieldType],
    )

    const resizeTextarea = React.useCallback(
      (textarea: HTMLTextAreaElement) => {
        textarea.style.height = "auto"
        textarea.style.height = `${textarea.scrollHeight}px`
      },
      [],
    )

    const setTextareaRef = React.useCallback(
      (textarea: HTMLTextAreaElement | null) => {
        textareaRef.current = textarea

        if (textarea) resizeTextarea(textarea)
      },
      [resizeTextarea],
    )

    const setInputRef = React.useCallback(
      (input: HTMLInputElement | null) => {
        inputRef.current = input
      },
      [],
    )

    React.useLayoutEffect(() => {
      if (fieldType === "auto-grow" && textareaRef.current) {
        resizeTextarea(textareaRef.current)
      }
    }, [defaultValue, fieldType, resizeTextarea, value])

    React.useEffect(() => {
      if (disabled) setTagMenuOpen(false)
    }, [disabled])

    const activeSelectedTags = selectedTagValues ?? uncontrolledSelectedTags

    const hasError = error !== null && error !== undefined
    const hasHint = hint !== null && hint !== undefined
    const hasVisibleHint =
      hasHint &&
      !hasError &&
      (variant !== "tags" || activeSelectedTags.length === 0)
    const hasFieldMode =
      fieldContext !== null ||
      variant !== "default" ||
      leadingIcon !== undefined ||
      leadingIconClassName !== undefined ||
      statusIcon !== undefined ||
      renderLeadingContent !== undefined ||
      renderTrailingContent !== undefined ||
      renderTagMenu !== undefined ||
      tagOptions.length > 0 ||
      fieldType === "auto-grow" ||
      controlClassName !== undefined
    const isInvalid =
      hasError ||
      ariaInvalid === true ||
      ariaInvalid === "true" ||
      ariaInvalid === "grammar" ||
      ariaInvalid === "spelling"
    const hasCounter =
      hasFieldMode && maxLength !== null && maxLength !== undefined
    const currentLength =
      value !== null && value !== undefined
        ? String(value).length
        : uncontrolledLength
    const describedBy = [
      ariaDescribedBy,
      hasVisibleHint ? hintId : undefined,
      hasError ? errorId : undefined,
      hasCounter ? counterId : undefined,
    ]
      .filter(Boolean)
      .join(" ")

    const reportControlState = fieldContext?.reportControlState

    React.useLayoutEffect(() => {
      if (!reportControlState) return

      reportControlState({
        currentLength,
        maxLength: hasCounter ? maxLength : undefined,
        hasSelectedTags: variant === "tags" && activeSelectedTags.length > 0,
      })
    }, [
      reportControlState,
      currentLength,
      maxLength,
      hasCounter,
      variant,
      activeSelectedTags.length,
    ])

    const visibleTagLimit = Math.max(0, Math.floor(maxVisibleTags))
    const selectedTags = activeSelectedTags.map((selectedValue) => {
      const option = tagOptions.find((tag) => tag.value === selectedValue)
      return option ?? { value: selectedValue, label: selectedValue }
    })
    const visibleTags = selectedTags.slice(0, visibleTagLimit)
    const hasTagMenu =
      variant === "tags" && renderTagMenu !== undefined && tagOptions.length > 0
    const showAllSelectedTags = hasTagMenu && tagMenuOpen
    const hasHiddenTags = selectedTags.length > visibleTags.length
    const showAllSelectedLayout = showAllSelectedTags && hasHiddenTags
    const isTagsExpanded = showAllSelectedLayout && tagsAreWrapped
    const renderedTags = showAllSelectedTags ? selectedTags : visibleTags
    const tagLayoutSignature = renderedTags
      .map((tag) => `${tag.value}:${getOptionLabelText(tag.label)}`)
      .join("\u001f")
    const hiddenTagCount = showAllSelectedTags
      ? 0
      : selectedTags.length - visibleTags.length
    React.useLayoutEffect(() => {
      const tagTriggerElement = tagTriggerRef.current

      if (!showAllSelectedLayout || !tagTriggerElement) {
        setTagsAreWrapped(false)
        return
      }

      const measureTagRows = () => {
        const rowTops = Array.from(tagTriggerElement.children, (item) =>
          Math.round(item.getBoundingClientRect().top),
        )
        const firstRowTop = rowTops[0]
        const wrapped =
          firstRowTop !== undefined && rowTops.some((top) => top !== firstRowTop)

        setTagsAreWrapped(wrapped)
      }

      measureTagRows()
      if (typeof ResizeObserver === "undefined") return

      const observer = new ResizeObserver(measureTagRows)
      observer.observe(tagTriggerElement)
      Array.from(tagTriggerElement.children).forEach((item) =>
        observer.observe(item),
      )

      return () => observer.disconnect()
    }, [showAllSelectedLayout, tagLayoutSignature, expandedTagsMaxHeight])
    const labelText = getOptionLabelText(label)
    const generatedTagOptionsAriaLabel = labelText
      ? t("combobox.tagOptionsForLabel", { label: labelText })
      : t("combobox.tagOptionsLabel")

    const handleInputChange = (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (hasCounter && (value === null || value === undefined)) {
        setUncontrolledLength(event.currentTarget.value.length)
      }

      if (fieldType === "auto-grow") {
        resizeTextarea(event.currentTarget as HTMLTextAreaElement)
        ;(
          onChange as
            | React.ChangeEventHandler<HTMLTextAreaElement>
            | undefined
        )?.(event as React.ChangeEvent<HTMLTextAreaElement>)
      } else {
        ;(
          onChange as
            | React.ChangeEventHandler<HTMLInputElement>
            | undefined
        )?.(event as React.ChangeEvent<HTMLInputElement>)
      }
    }

    const handleInputFocus = (
      event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (
        variant === "tags" &&
        renderTagMenu &&
        tagOptions.length > 0 &&
        !disabled
      ) {
        setTagMenuOpen(true)
      }

      if (fieldType === "auto-grow") {
        ;(
          onFocus as
            | React.FocusEventHandler<HTMLTextAreaElement>
            | undefined
        )?.(event as React.FocusEvent<HTMLTextAreaElement>)
      } else {
        ;(
          onFocus as React.FocusEventHandler<HTMLInputElement> | undefined
        )?.(event as React.FocusEvent<HTMLInputElement>)
      }
    }

    const handleInputClick = (
      event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (
        variant === "tags" &&
        renderTagMenu &&
        tagOptions.length > 0 &&
        !disabled
      ) {
        setTagMenuOpen(true)
      }

      if (fieldType === "auto-grow") {
        ;(
          onClick as
            | React.MouseEventHandler<HTMLTextAreaElement>
            | undefined
        )?.(event as React.MouseEvent<HTMLTextAreaElement>)
      } else {
        ;(
          onClick as React.MouseEventHandler<HTMLInputElement> | undefined
        )?.(event as React.MouseEvent<HTMLInputElement>)
      }
    }

    const handleTagMenuOpenChange = (open: boolean) => {
      setTagMenuOpen(!disabled && open)
    }

    const handleSelectedTagValuesChange = (nextValues: string[]) => {
      if (selectedTagValues === undefined) {
        setUncontrolledSelectedTags(nextValues)
      }

      onSelectedTagValuesChange?.(nextValues)
    }

    const defaultLeadingIcon =
      variant === "icon-leading" ? (
        <MagnifyingGlass size={20} weight="duotone" />
      ) : null
    const defaultLeadingIconClassName =
      variant === "icon-leading"
        ? disabled
          ? "text-input-field-disabled-icon"
          : "text-foreground-subtle"
        : undefined
    const resolvedLeadingIcon =
      leadingIcon === undefined ? defaultLeadingIcon : leadingIcon
    const statusIconClass = disabled
      ? "text-input-field-disabled-icon"
      : isInvalid
        ? "text-input-field-error"
        : "text-foreground-subtle"
    const resolvedStatusIcon = statusIcon

    const tagTrigger = (
      <span
        ref={tagTriggerRef}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-x-sm gap-y-xs",
          showAllSelectedLayout && "flex w-full flex-wrap",
          disabled && "select-none [&_*]:select-none",
        )}
        style={
          showAllSelectedLayout && expandedTagsMaxHeight !== undefined
            ? { maxHeight: expandedTagsMaxHeight }
            : undefined
        }
      >
        {renderedTags.map((tag) => (
          <Tag
            key={tag.value}
            type="label"
            size="small"
            leadingVisual={tag.leadingVisual}
            className={cn(
              "min-w-0 max-w-32 truncate",
              showAllSelectedLayout ? "shrink-0" : "shrink",
            )}
          >
            {tag.label}
          </Tag>
        ))}
        {hiddenTagCount > 0 ? (
          <Tag
            type="label"
            size="small"
            className="shrink-0 pl-md pr-md py-xs leading-[1.4] bg-tag-overflow-background text-tag-overflow-foreground"
            aria-label={t("combobox.hiddenTagsLabel", {
              count: hiddenTagCount,
            })}
          >
            +{hiddenTagCount}
          </Tag>
        ) : null}
        {selectedTags.length === 0 && placeholder ? (
          <span
            className={cn(
              "truncate text-body-large font-body text-foreground-subtle",
              disabled && "text-input-field-disabled-foreground",
            )}
          >
            {placeholder}
          </span>
        ) : null}
      </span>
    )

    const tagMenuTrigger = (
      <button
        type="button"
        aria-label={generatedTagOptionsAriaLabel}
        disabled={disabled}
        className={cn(
          "inline-flex h-full min-w-0 max-w-full shrink items-center rounded-sm bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-input-field-focus-ring disabled:cursor-not-allowed",
          showAllSelectedLayout && "h-auto min-h-10 flex-1 self-stretch",
        )}
      >
        {tagTrigger}
      </button>
    )

    const inputElement = fieldType === "auto-grow" ? (
      <textarea
        {...(inputProps as React.ComponentPropsWithoutRef<"textarea">)}
        ref={setTextareaRef}
        id={hasFieldMode ? inputId : id}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onClick={handleInputClick}
        onKeyDown={(event) => {
          const userHandler = (
            inputProps as React.ComponentPropsWithoutRef<"textarea">
          ).onKeyDown

          userHandler?.(event)

          if (
            event.defaultPrevented ||
            event.key !== "Enter" ||
            event.shiftKey ||
            event.nativeEvent.isComposing
          ) {
            return
          }

          event.preventDefault()
          event.currentTarget.form?.requestSubmit()
        }}
        readOnly={variant === "tags" || inputProps.readOnly}
        tabIndex={variant === "tags" ? -1 : inputProps.tabIndex}
        aria-invalid={hasError ? true : ariaInvalid}
        aria-describedby={describedBy || undefined}
        placeholder={
          variant === "tags" && tagOptions.length > 0
            ? undefined
            : placeholder
        }
        rows={(inputProps as React.ComponentPropsWithoutRef<"textarea">).rows ?? 1}
        data-slot="input"
        className={cn(
          "min-h-0 min-w-0 flex-1 resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 text-body-large font-body leading-[1.4] tracking-[0.02em] text-foreground shadow-none outline-none placeholder:text-foreground-subtle focus-visible:border-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-100 disabled:text-input-field-disabled-foreground disabled:placeholder:text-input-field-disabled-foreground aria-invalid:border-0 aria-invalid:ring-0",
          className,
        )}
      />
    ) : (
      <input
        {...(inputProps as React.ComponentPropsWithoutRef<"input">)}
        ref={setInputRef}
        id={hasFieldMode ? inputId : id}
        type={type}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onClick={handleInputClick}
        readOnly={variant === "tags" || inputProps.readOnly}
        tabIndex={variant === "tags" ? -1 : inputProps.tabIndex}
        aria-invalid={hasError ? true : ariaInvalid}
        aria-describedby={describedBy || undefined}
        placeholder={
          variant === "tags" && tagOptions.length > 0
            ? undefined
            : placeholder
        }
        data-slot="input"
        className={cn(
          showAllSelectedLayout
            ? "h-0 w-0 min-w-0 flex-none overflow-hidden opacity-0"
            : hasFieldMode
              ? "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-body-large font-body leading-[1.4] tracking-[0.02em] text-foreground shadow-none outline-none placeholder:text-foreground-subtle focus-visible:border-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-100 disabled:text-input-field-disabled-foreground disabled:placeholder:text-input-field-disabled-foreground aria-invalid:border-0 aria-invalid:ring-0"
              : "flex h-9 w-full rounded-lg border border-border bg-surface-base px-lg py-md text-body-medium font-body text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15",
          className,
        )}
      />
    )

    if (!hasFieldMode) return inputElement

    const controlElement = (
      <div
        data-slot="input-field-control"
        data-variant={variant}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
        className={cn(
          "group/input-field relative flex h-10 w-full items-center gap-md rounded-md border border-input-field-border bg-surface-base px-lg transition-colors",
          isTagsExpanded && "h-auto min-h-10 py-md",
          fieldType === "auto-grow" && "h-auto min-h-10 items-start py-md",
          "focus-within:ring-2 focus-within:ring-input-field-focus-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
          isInvalid &&
            "border-input-field-error focus-within:ring-input-field-error",
          "data-[disabled]:cursor-not-allowed data-[disabled]:select-none data-[disabled]:border-input-field-disabled-border data-[disabled]:bg-input-field-disabled-surface",
          controlClassName,
        )}
      >
          {renderLeadingContent?.({ disabled, invalid: isInvalid })}

          {resolvedLeadingIcon !== null && resolvedLeadingIcon !== undefined ? (
            <IconSlot
              dataSlot="input-field-leading-icon"
              className={cn(defaultLeadingIconClassName, leadingIconClassName)}
            >
              {resolvedLeadingIcon}
            </IconSlot>
          ) : null}

          {variant === "tags"
            ? hasTagMenu && renderTagMenu
              ? renderTagMenu({
                  trigger: tagMenuTrigger,
                  open: !disabled && tagMenuOpen,
                  onOpenChange: handleTagMenuOpenChange,
                  options: tagOptions,
                  selectedValues: activeSelectedTags,
                  onSelectedValuesChange: handleSelectedTagValuesChange,
                  disabled,
                  triggerAriaLabel: generatedTagOptionsAriaLabel,
                })
              : tagTrigger
            : null}

          {inputElement}

          {resolvedStatusIcon !== null && resolvedStatusIcon !== undefined ? (
            <IconSlot
              dataSlot="input-field-status-icon"
              className={statusIconClass}
            >
              {resolvedStatusIcon}
            </IconSlot>
          ) : null}

          {renderTrailingContent?.({ disabled, invalid: isInvalid })}

          {disabled ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 z-10 cursor-not-allowed select-none"
            />
          ) : null}
      </div>
    )

    return controlElement
}

InputImplementation.displayName = "Input"

const InputImplementationWithFieldMarker = InputImplementation as typeof InputImplementation & {
  [FIELD_CONTROL_MARKER]?: true
}
InputImplementationWithFieldMarker[FIELD_CONTROL_MARKER] = true

const Input = InputImplementationWithFieldMarker as unknown as InputComponent

export { Input }

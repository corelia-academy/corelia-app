import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Check, ChevronRight, Minus, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Checkbox, type CheckboxProps } from "@/components/ui/selection"
import { cn } from "@/lib/utils"

type DropdownMenuContentLayout = "default" | "multiple-list"
type DropdownMenuCheckboxItemPointerDownHandler = NonNullable<
  MenuPrimitive.CheckboxItem.Props["onPointerDown"]
>
type DropdownMenuCheckboxItemKeyDownHandler = NonNullable<
  MenuPrimitive.CheckboxItem.Props["onKeyDown"]
>

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

type DropdownMenuItemContentProps = {
  children: React.ReactNode
  leading?: React.ReactNode
  supportingText?: React.ReactNode
  badge?: React.ReactNode
  trailingIcon?: React.ReactNode
  showTrailingIcon?: boolean
  trailingIconHitArea?: "icon" | "control"
}

function DropdownMenuItemContent({
  children,
  leading,
  supportingText,
  badge,
  trailingIcon,
  showTrailingIcon = true,
  trailingIconHitArea = "icon",
}: DropdownMenuItemContentProps) {
  return (
    <>
      {leading ? (
        <span className="flex size-6 shrink-0 items-center justify-center">
          {leading}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span
          data-slot="dropdown-menu-item-title"
          className="truncate text-[16px] font-medium leading-[1.4] tracking-[0] text-dropdown-title"
        >
          {children}
        </span>

        {supportingText ? (
          <span
            data-slot="dropdown-menu-item-supporting"
            className="truncate text-xs font-normal leading-[1.25] tracking-[0.24px] text-dropdown-supporting"
          >
            {supportingText}
          </span>
        ) : null}
      </span>

      {badge ? (
        <span data-slot="dropdown-menu-item-badge" className="shrink-0">
          {badge}
        </span>
      ) : null}

      {showTrailingIcon && trailingIcon != null ? (
        <span
          data-slot="dropdown-menu-item-trailing-icon"
          data-hit-area={trailingIconHitArea}
          className={cn(
            "flex shrink-0 items-center justify-center text-dropdown-supporting",
            trailingIconHitArea === "control" ? "size-11" : "size-4",
          )}
        >
          {trailingIcon}
        </span>
      ) : null}
    </>
  )
}

type DropdownMenuHeaderProps = {
  title: React.ReactNode
  supportingText?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function DropdownMenuHeader({
  title,
  supportingText,
  action,
  className,
}: DropdownMenuHeaderProps) {
  return (
    <div
      data-slot="dropdown-menu-header"
      className={cn("flex items-start gap-md px-md", className)}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-medium leading-[1.4] tracking-[0] text-dropdown-title">
          {title}
        </div>

        {supportingText ? (
          <div className="truncate text-xs font-normal leading-[1.25] tracking-[0.24px] text-dropdown-supporting">
            {supportingText}
          </div>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  layout = "default",
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & {
    layout?: DropdownMenuContentLayout
  }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          data-layout={layout}
          className={cn(
            "z-50 origin-(--transform-origin) text-body-small font-body duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
            layout === "multiple-list"
              ? "flex max-h-(--available-height) w-[296px] min-w-0 flex-col gap-2 overflow-hidden rounded-xl border-[0.5px] border-dropdown-container-border bg-dropdown-surface px-[6px] py-3 text-dropdown-title shadow-dropdown"
              : "max-h-(--available-height) w-(--anchor-width) min-w-32 overflow-x-hidden overflow-y-auto scrollbar-design rounded-lg border border-border bg-surface-overlay text-foreground",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-md py-md text-label-small font-body text-foreground-muted data-inset:pl-4xl",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-md rounded-md px-md py-md text-body-small font-body outline-hidden select-none focus:bg-surface-raised focus:text-foreground data-inset:pl-4xl data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive-muted data-[variant=destructive]:focus:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-md rounded-md px-md py-md text-body-small font-body outline-hidden select-none focus:bg-surface-raised focus:text-foreground data-inset:pl-4xl data-popup-open:bg-surface-raised data-popup-open:text-foreground data-open:bg-surface-raised data-open:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" aria-hidden />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "w-auto min-w-[96px] rounded-lg border border-border bg-surface-overlay text-body-small font-body text-foreground duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  disabled,
  indeterminate = false,
  inset,
  variant = "default",
  selectionMode = "full-row",
  onCheckedChange,
  onPointerDown,
  onKeyDown,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean
  variant?: "default" | "warning"
  indeterminate?: boolean
  selectionMode?: "full-row" | "checkbox-only"
}) {
  const selectionTargetRef = React.useRef(false)
  const isCheckedAndDisabled = checked === true && disabled === true

  function handlePointerDown(
    event: Parameters<DropdownMenuCheckboxItemPointerDownHandler>[0],
  ) {
    selectionTargetRef.current =
      selectionMode === "full-row" ||
      (event.target instanceof Element &&
        Boolean(
          event.target.closest(
            '[data-slot="dropdown-menu-checkbox-item-indicator"]',
          ),
        ));

    onPointerDown?.(event)
  }

  function handleKeyDown(
    event: Parameters<DropdownMenuCheckboxItemKeyDownHandler>[0],
  ) {
    if (event.key === "Enter" || event.key === " ") {
      selectionTargetRef.current = true
    }

    onKeyDown?.(event)
  }

  function handleCheckedChange(
    nextChecked: boolean,
    eventDetails: Parameters<NonNullable<MenuPrimitive.CheckboxItem.Props["onCheckedChange"]>>[1],
  ) {
    const canSelect =
      selectionMode === "full-row" || selectionTargetRef.current

    selectionTargetRef.current = false

    if (!canSelect) {
      eventDetails.cancel()
      return
    }

    onCheckedChange?.(nextChecked, eventDetails)
  }

  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      data-indeterminate={indeterminate || undefined}
      data-variant={variant}
      data-selection-mode={selectionMode}
      className={cn(
        "group/dropdown-menu-checkbox-item relative flex min-h-[59px] w-full items-center gap-lg rounded-xl px-lg py-2md text-body-small font-body outline-hidden select-none hover:rounded-xl hover:bg-dropdown-hover focus-visible:z-10 focus-visible:rounded-xl focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-[-1px] focus-visible:after:z-10 focus-visible:after:rounded-xl focus-visible:after:border-2 focus-visible:after:border-dropdown-focus focus-visible:after:content-[''] data-checked:rounded-xl data-inset:pl-4xl data-disabled:cursor-not-allowed data-disabled:hover:rounded-xl data-disabled:hover:bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        selectionMode === "checkbox-only" ? "cursor-default" : "cursor-pointer",
        className
      )}
      checked={checked}
      disabled={disabled}
      {...(indeterminate ? { "aria-checked": "mixed" } : {})}
      onCheckedChange={handleCheckedChange}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <span
        data-slot="dropdown-menu-checkbox-item-indicator"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[5px]",
          isCheckedAndDisabled
            ? "border-0 bg-dropdown-checkbox-disabled-active text-dropdown-checkbox-disabled-mark"
            : "border-[1.5px] border-dropdown-checkbox-unchecked text-dropdown-checkbox-mark group-data-[checked]/dropdown-menu-checkbox-item:border-dropdown-checkbox-active group-data-[checked]/dropdown-menu-checkbox-item:bg-dropdown-checkbox-active group-data-[disabled]/dropdown-menu-checkbox-item:border-dropdown-disabled group-data-[disabled]/dropdown-menu-checkbox-item:bg-transparent",
          selectionMode === "checkbox-only"
            ? "pointer-events-auto cursor-pointer"
            : "pointer-events-none",
          indeterminate && "border-dropdown-checkbox-active",
        )}
      >
        {indeterminate ? (
          <Minus className="size-3 text-dropdown-checkbox-active" aria-hidden />
        ) : (
          <MenuPrimitive.CheckboxItemIndicator className="flex size-4 items-center justify-center">
            <Check className="size-4" aria-hidden />
          </MenuPrimitive.CheckboxItemIndicator>
        )}
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuSearch({
  className,
  type = "search",
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className="w-full px-1">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-10 size-5 -translate-y-1/2 text-dropdown-supporting"
          aria-hidden
        />
        <Input
          {...props}
          type={type}
          className={cn(
            "h-10 rounded-lg border-dropdown-input-border bg-dropdown-surface pl-10 text-[16px] text-dropdown-title placeholder:text-dropdown-supporting",
            className
          )}
        />
      </div>
    </div>
  )
}

function DropdownMenuSelectAll({
  className,
  label,
  ...props
}: Omit<CheckboxProps, "label" | "showLabel" | "size"> & {
  label: React.ReactNode
}) {
  return (
    <div className="flex w-full flex-col gap-lg px-md pt-md">
      <Checkbox
        {...props}
        size="small"
        label={label}
        showLabel
        className={className}
      />
      <DropdownMenuSeparator className="mx-0 w-full bg-dropdown-divider" />
    </div>
  )
}

function DropdownMenuList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-list"
      className={cn(
        "flex min-h-0 max-h-[295px] w-full flex-col gap-px overflow-y-auto scrollbar-design rounded-lg px-1 py-px",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-md rounded-md py-md pr-5xl pl-md text-body-small font-body outline-hidden select-none focus:bg-surface-raised focus:text-foreground data-inset:pl-4xl data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <Check aria-hidden />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-xs h-px bg-border-subtle", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-body-small font-body text-foreground-muted group-focus/dropdown-menu-item:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemContent,
  DropdownMenuHeader,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSearch,
  DropdownMenuSelectAll,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}

export type {
  DropdownMenuContentLayout,
  DropdownMenuItemContentProps,
  DropdownMenuHeaderProps,
}

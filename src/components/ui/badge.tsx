import type { ComponentProps, ReactNode } from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border font-body font-medium whitespace-nowrap select-none",
  {
    variants: {
      size: {
        xsmall: "h-[18px] gap-0 px-[6px] py-[4px] text-[10px] leading-none",
        small: "h-6 gap-1 px-2 py-1 text-xs leading-none",
        medium: "h-7 gap-1 px-[10px] py-[6px] text-sm leading-none tracking-[-0.07px]",
        large: "h-8 gap-1 px-3 py-2 text-base leading-none",
      },
      color: {
        primary: "border-badge-primary text-badge-primary",
        warning: "border-badge-warning text-badge-warning",
        success: "border-badge-success text-badge-success",
        gold: "border-badge-gold text-badge-gold",
        limeGreen: "border-badge-lime-green text-badge-lime-green",
        cyan: "border-badge-cyan text-badge-cyan",
        error: "border-badge-error text-badge-error",
        gray: "border-badge-gray text-badge-gray",
        disabled: "border-badge-disabled text-badge-disabled",
      },
      variant: {
        outline: "bg-badge-outline-background",
        filled: "border-transparent",
      },
    },
    compoundVariants: [
      {
        color: "primary",
        variant: "filled",
        className: "border-transparent bg-badge-primary-filled text-badge-primary-filled-foreground",
      },
      {
        color: "warning",
        variant: "filled",
        className: "border-transparent bg-badge-warning-filled text-badge-warning-filled-foreground",
      },
      {
        color: "success",
        variant: "filled",
        className: "border-transparent bg-badge-success-filled text-badge-success-filled-foreground",
      },
      {
        color: "gold",
        variant: "filled",
        className: "border-transparent bg-badge-gold-filled text-badge-gold-filled-foreground",
      },
      {
        color: "limeGreen",
        variant: "filled",
        className: "border-transparent bg-badge-lime-green-filled text-badge-lime-green-filled-foreground",
      },
      {
        color: "cyan",
        variant: "filled",
        className: "border-transparent bg-badge-cyan-filled text-badge-cyan-filled-foreground",
      },
      {
        color: "error",
        variant: "filled",
        className: "border-transparent bg-badge-error-filled text-badge-error-filled-foreground",
      },
      {
        color: "gray",
        variant: "filled",
        className: "border-transparent bg-badge-gray-filled text-badge-gray-filled-foreground",
      },
      {
        color: "disabled",
        variant: "filled",
        className: "border-transparent bg-badge-disabled-filled text-badge-disabled-filled-foreground",
      },
    ],
    defaultVariants: {
      color: "gray",
      size: "small",
      variant: "outline",
    },
  },
)

type BadgeSize = "xsmall" | "small" | "medium" | "large"
type BadgeColor =
  | "primary"
  | "warning"
  | "success"
  | "gold"
  | "limeGreen"
  | "cyan"
  | "error"
  | "gray"
  | "disabled"
type BadgeVariant = "outline" | "filled"

type BadgeCommonProps = Omit<ComponentProps<"span">, "children" | "color"> & {
  color?: BadgeColor
  variant?: BadgeVariant
  children: ReactNode
}

type BadgeProps =
  | (BadgeCommonProps & {
      size: "xsmall"
      leadingIcon?: never
      trailingIcon?: never
    })
  | (BadgeCommonProps & {
      size?: Exclude<BadgeSize, "xsmall">
      leadingIcon?: ReactNode
      trailingIcon?: ReactNode
    })

const badgeIconClassName =
  "flex size-4 shrink-0 items-center justify-center [&>img]:size-full [&>svg]:size-full"

function Badge({
  className,
  color = "gray",
  size = "small",
  variant = "outline",
  leadingIcon,
  trailingIcon,
  children,
  onClick,
  ...props
}: BadgeProps) {
  const supportsIcons = size !== "xsmall"
  const isDisabled = color === "disabled"

  return (
    <span
      data-slot="badge"
      data-disabled={isDisabled ? "true" : undefined}
      aria-disabled={isDisabled || undefined}
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        badgeVariants({ color, size, variant }),
        isDisabled && "cursor-not-allowed select-none",
        className,
      )}
      {...props}
    >
      {supportsIcons && leadingIcon ? (
        <span className={badgeIconClassName} aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span>{children}</span>
      {supportsIcons && trailingIcon ? (
        <span className={badgeIconClassName} aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </span>
  )
}

export {
  Badge,
  type BadgeColor,
  type BadgeProps,
  type BadgeSize,
  type BadgeVariant,
}

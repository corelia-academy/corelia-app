import type { ComponentProps, ReactNode } from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border font-body font-medium whitespace-nowrap",
  {
    variants: {
      size: {
        xsmall: "h-[18px] gap-0 px-[6px] py-[4px] text-[10px] leading-none",
        small: "h-6 gap-1 px-2 py-1 text-xs leading-none",
        medium: "h-7 gap-1 px-[10px] py-[6px] text-sm leading-none tracking-[-0.07px]",
        large: "h-8 gap-1 px-3 py-2 text-base leading-none",
      },
      color: {
        primary: "border-blue-400 text-blue-400",
        warning: "border-warning-500 text-warning-500",
        success: "border-success-500 text-success-500",
        gold: "border-accent-yellow-500 text-accent-yellow-500",
        limeGreen: "border-accent-teal-500 text-accent-teal-500",
        cyan: "border-accent-sky-500 text-accent-sky-500",
        error: "border-error-500 text-error-500",
        gray: [
          "border-neutral-600 text-neutral-600",
          "dark:border-neutral-200 dark:text-neutral-200",
        ].join(" "),
        disabled: [
          "border-neutral-400 text-neutral-400",
          "dark:border-neutral-500 dark:text-neutral-500",
        ].join(" "),
      },
      variant: {
        outline: "bg-neutral-50/5",
        filled: "border-transparent",
      },
    },
    compoundVariants: [
      {
        color: "primary",
        variant: "filled",
        className: "border-transparent bg-blue-400 text-neutral-900",
      },
      {
        color: "warning",
        variant: "filled",
        className: "border-transparent bg-warning-700 text-neutral-50",
      },
      {
        color: "success",
        variant: "filled",
        className: "border-transparent bg-success-700 text-neutral-50",
      },
      {
        color: "gold",
        variant: "filled",
        className: "border-transparent bg-accent-yellow-500 text-neutral-900",
      },
      {
        color: "limeGreen",
        variant: "filled",
        className: "border-transparent bg-accent-teal-900 text-accent-teal-50",
      },
      {
        color: "cyan",
        variant: "filled",
        className: "border-transparent bg-accent-sky-100 text-neutral-900",
      },
      {
        color: "error",
        variant: "filled",
        className: "border-transparent bg-error-700 text-neutral-50",
      },
      {
        color: "gray",
        variant: "filled",
        className: [
          "border-transparent bg-neutral-200 text-neutral-800",
          "dark:bg-neutral-600 dark:text-neutral-100",
        ].join(" "),
      },
      {
        color: "disabled",
        variant: "filled",
        className: [
          "border-transparent bg-neutral-100 text-neutral-400",
          "dark:bg-neutral-800 dark:text-neutral-500",
        ].join(" "),
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
  ...props
}: BadgeProps) {
  const supportsIcons = size !== "xsmall"

  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ color, size, variant }), className)}
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

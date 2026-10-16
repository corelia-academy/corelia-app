import type { ComponentProps, ReactNode } from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const informativeIconVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full",
  {
    variants: {
      color: {
        error:
          "bg-[var(--informative-icon-error-surface)] border-[var(--informative-icon-error-outline)]",
        warning:
          "bg-[var(--informative-icon-warning-surface)] border-[var(--informative-icon-warning-outline)]",
        success:
          "bg-[var(--informative-icon-success-surface)] border-[var(--informative-icon-success-outline)]",
        blue:
          "bg-[var(--informative-icon-blue-surface)] border-[var(--informative-icon-blue-outline)]",
      },
      size: {
        xs: "size-6 p-[6px] border-2 [&>svg]:size-3",
        sm: "size-8 p-2 border-4 [&>svg]:size-4",
        md: "size-10 p-[10px] border-6 [&>svg]:size-5",
        lg: "size-12 p-3 border-8 [&>svg]:size-6",
        xl: "size-14 p-[14px] border-10 [&>svg]:size-7",
      },
      type: {
        circle: "border-0",
        "circle-outline": "border-solid p-1",
      },
    },
    defaultVariants: {
      color: "success",
      size: "xs",
      type: "circle",
    },
  },
)

type InformativeIconColor = "error" | "warning" | "success" | "blue"
type InformativeIconSize = "xs" | "sm" | "md" | "lg" | "xl"
type InformativeIconType = "circle" | "circle-outline"
type InformativeIconProps = Omit<ComponentProps<"span">, "children" | "role" | "aria-hidden"> & {
  color?: InformativeIconColor
  size?: InformativeIconSize
  type?: InformativeIconType
}

const icons: Record<InformativeIconColor, ReactNode> = {
  success: (
    <svg aria-hidden="true" data-icon="success" fill="none" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="10" fill="var(--informative-icon-success-content)" />
      <path
        d="m8.25 12.25 2.45 2.45 5.05-5.2"
        stroke="var(--informative-icon-success-surface)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.25"
      />
    </svg>
  ),
  warning: (
    <svg aria-hidden="true" data-icon="warning" fill="none" viewBox="0 0 24 24" focusable="false">
      <path
        d="M10.27 3.72a2 2 0 0 1 3.46 0l8.1 14.02a2 2 0 0 1-1.73 3H3.9a2 2 0 0 1-1.73-3l8.1-14.02Z"
        fill="var(--informative-icon-warning-content)"
      />
      <path
        d="M12 8.4v5.25"
        stroke="var(--informative-icon-warning-surface)"
        strokeLinecap="round"
        strokeWidth="2.25"
      />
      <circle cx="12" cy="17" r="1.2" fill="var(--informative-icon-warning-surface)" />
    </svg>
  ),
  error: (
    <svg aria-hidden="true" data-icon="error" fill="none" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="10" fill="var(--informative-icon-error-content)" />
      <path
        d="m9 9 6 6m0-6-6 6"
        stroke="var(--informative-icon-error-surface)"
        strokeLinecap="round"
        strokeWidth="2.25"
      />
    </svg>
  ),
  blue: (
    <svg aria-hidden="true" data-icon="blue" fill="none" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="10" fill="var(--informative-icon-blue-content)" />
      <path
        d="M12 10.5v6"
        stroke="var(--informative-icon-blue-surface)"
        strokeLinecap="round"
        strokeWidth="2.25"
      />
      <circle cx="12" cy="7.5" r="1.2" fill="var(--informative-icon-blue-surface)" />
    </svg>
  ),
}

function InformativeIcon({
  "aria-label": ariaLabel,
  className,
  color = "success",
  size = "xs",
  type = "circle",
  ...props
}: InformativeIconProps) {
  return (
    <span
      data-slot="informative-icon"
      data-color={color}
      data-size={size}
      data-type={type}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? "img" : undefined}
      className={cn(informativeIconVariants({ color, size, type }), className)}
      {...props}
    >
      {icons[color]}
    </span>
  )
}

export {
  InformativeIcon,
  type InformativeIconColor,
  type InformativeIconProps,
  type InformativeIconSize,
  type InformativeIconType,
}

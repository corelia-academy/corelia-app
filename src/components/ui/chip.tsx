import type { ComponentProps, ReactNode } from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-body font-medium whitespace-nowrap select-none",
  {
    variants: {
      size: {
        xsmall: "h-5 min-w-[21px] rounded-[4px] px-1.5 py-0.5 text-xs leading-4 tracking-normal",
        small: "h-6 min-w-[30px] rounded-[6px] px-1.5 py-0.5 text-sm leading-5 tracking-[-0.5px]",
        medium: "h-7 min-w-[34px] rounded-[6px] px-2 py-1 text-sm leading-5 tracking-[-0.5px]",
        large: "h-8 min-w-[38px] rounded-[6px] px-2.5 py-1.5 text-sm leading-5 tracking-[-0.5px]",
      },
      shape: {
        rounded: "",
        circle: "rounded-full",
      },
      disabled: {
        false: "bg-tag-overflow-background text-tag-overflow-foreground",
        true: "bg-tag-disabled-background text-tag-disabled-foreground",
      },
    },
    defaultVariants: {
      size: "small",
      shape: "rounded",
      disabled: false,
    },
  },
)

type ChipSize = "xsmall" | "small" | "medium" | "large"
type ChipShape = "rounded" | "circle"

type ChipProps = Omit<ComponentProps<"span">, "children"> & {
  size?: ChipSize
  shape?: ChipShape
  disabled?: boolean
  children: ReactNode
}

function Chip({
  className,
  size = "small",
  shape = "rounded",
  disabled = false,
  children,
  onClick,
  ...spanProps
}: ChipProps) {
  return (
    <span
      {...spanProps}
      data-slot="chip"
      data-disabled={disabled ? "true" : undefined}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        chipVariants({ size, shape, disabled }),
        disabled && "cursor-not-allowed select-none",
        className,
      )}
    >
      {children}
    </span>
  )
}

export { Chip, type ChipProps, type ChipShape, type ChipSize }

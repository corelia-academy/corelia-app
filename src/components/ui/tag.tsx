import type { ComponentProps, ReactNode } from "react"
import { cva } from "class-variance-authority"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const tagVariants = cva(
  "inline-flex shrink-0 items-center rounded-sm font-body text-sm font-medium leading-none tracking-[-0.07px] whitespace-nowrap",
  {
    variants: {
      type: {
        label: "",
        datetime: "gap-md",
      },
      size: {
        small: "pl-md pr-sm py-xs",
        medium: "pl-md pr-sm py-sm",
        large: "p-md",
      },
      disabled: {
        false: "bg-neutral-700 text-neutral-200",
        true: "bg-neutral-800 text-neutral-500",
      },
      leadingVisual: {
        false: "",
        true: "",
      },
    },
    compoundVariants: [
      { type: "datetime", size: "small", className: "h-6" },
      { type: "datetime", size: "medium", className: "h-7" },
      { type: "datetime", size: "large", className: "h-8" },
      { type: "label", size: "small", leadingVisual: true, className: "h-6 pl-xs" },
      { type: "label", size: "medium", leadingVisual: true, className: "h-7 pl-sm" },
      { type: "label", size: "large", leadingVisual: true, className: "h-8" },
    ],
    defaultVariants: {
      type: "label",
      size: "small",
      disabled: false,
    },
  },
)

type TagSize = "small" | "medium" | "large"
type TagType = "label" | "datetime"

type TagCommonProps = Omit<ComponentProps<"span">, "children"> & {
  size?: TagSize
  disabled?: boolean
}

type LabelTagProps = TagCommonProps & {
  type: "label"
  children: ReactNode
  date?: never
  leadingVisual?: ReactNode
  time?: never
}

type DatetimeValueProps =
  | {
      date: ReactNode
      time?: ReactNode
    }
  | {
      date?: ReactNode
      time: ReactNode
    }

type DatetimeTagProps = TagCommonProps &
  DatetimeValueProps & {
    type: "datetime"
    children?: never
    leadingVisual?: never
  }

type TagProps = LabelTagProps | DatetimeTagProps

function Tag({
  className,
  size = "small",
  disabled = false,
  type,
  children,
  date,
  leadingVisual,
  time,
  ...spanProps
}: TagProps) {
  const hasLeadingVisual = type === "label" && leadingVisual != null
  const hasDate = type === "datetime" && date != null
  const hasTime = type === "datetime" && time != null

  return (
    <span
      {...spanProps}
      data-slot="tag"
      data-disabled={disabled ? "true" : undefined}
      data-has-leading-visual={hasLeadingVisual ? "true" : undefined}
      className={cn(
        tagVariants({ type, size, disabled, leadingVisual: hasLeadingVisual }),
        className,
      )}
    >
      {type === "label" ? (
        hasLeadingVisual ? (
          <span
            data-slot="tag-content"
            className={cn(
              "inline-flex shrink-0 items-center",
              size === "small" ? "gap-[5px]" : "gap-sm",
            )}
          >
            <span
              data-slot="tag-leading-visual"
              aria-hidden="true"
              className={cn(
                "flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full [&>img]:block [&>img]:size-full [&>img]:rounded-full [&>img]:object-cover [&>svg]:block [&>svg]:size-full",
                disabled && "opacity-50",
              )}
            >
              {leadingVisual}
            </span>
            <span>{children}</span>
          </span>
        ) : (
          children
        )
      ) : (
        <>
          {hasDate ? <span>{date}</span> : null}
          {hasDate && hasTime ? (
            <Separator
              orientation="vertical"
              className="border-neutral-600"
              aria-hidden="true"
            />
          ) : null}
          {hasTime ? <span>{time}</span> : null}
        </>
      )}
    </span>
  )
}

export {
  Tag,
  type TagProps,
  type TagSize,
  type TagType,
}

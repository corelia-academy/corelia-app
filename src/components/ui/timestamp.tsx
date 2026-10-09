import type { ComponentProps, ReactNode } from "react"
import { cva } from "class-variance-authority"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const timestampVariants = cva(
  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-body font-normal not-italic text-center",
  {
    variants: {
      size: {
        large: "text-sm leading-[1.4] tracking-[0.28px]",
        medium: "text-xs leading-[1.25] tracking-[0.24px]",
        small: "text-[10px] leading-[1.2] tracking-[0.2px]",
      },
      destructive: {
        false: "text-foreground-subtle",
        true: "text-badge-error",
      },
    },
    defaultVariants: {
      size: "large",
      destructive: false,
    },
  },
)

type TimestampType =
  | "full"
  | "today"
  | "date-only"
  | "time-only"
  | "some-time-ago"

type TimestampSize = "large" | "medium" | "small"

type TimestampProps = Omit<ComponentProps<"div">, "children"> & {
  "data-testid"?: string
  type?: TimestampType
  size?: TimestampSize
  date?: ReactNode
  time?: ReactNode
  relativeText?: ReactNode
  timezone?: ReactNode
  destructive?: boolean
}

function hasTimestampContent(value: ReactNode) {
  return (
    value !== null &&
    value !== undefined &&
    value !== false &&
    value !== true &&
    value !== ""
  )
}

function Timestamp({
  className,
  type = "full",
  size = "large",
  date,
  time,
  relativeText,
  timezone,
  destructive = false,
  ...divProps
}: TimestampProps) {
  const showDate =
    (type === "full" || type === "date-only") && hasTimestampContent(date)
  const showRelativeText =
    (type === "today" || type === "some-time-ago") &&
    hasTimestampContent(relativeText)
  const showTime =
    (type === "full" || type === "today" || type === "time-only") &&
    hasTimestampContent(time)
  const showTimezone =
    (type === "full" || type === "time-only") && showTime && hasTimestampContent(timezone)
  const showDivider =
    (type === "full" && showDate && showTime) ||
    (type === "today" && showRelativeText && showTime)

  if (!showDate && !showRelativeText && !showTime) return null

  return (
    <div
      {...divProps}
      data-slot="timestamp"
      data-type={type}
      data-size={size}
      data-destructive={destructive ? "true" : undefined}
      className={cn(timestampVariants({ size, destructive }), className)}
    >
      {showDate ? <div>{date}</div> : null}
      {showRelativeText ? <div>{relativeText}</div> : null}
      {showDivider ? (
        <Separator
          orientation="vertical"
          className="border-stroke-divider"
          aria-hidden="true"
        />
      ) : null}
      {showTime ? <div>{time}</div> : null}
      {showTimezone ? <div>{timezone}</div> : null}
    </div>
  )
}

export {
  Timestamp,
  type TimestampProps,
  type TimestampSize,
  type TimestampType,
}

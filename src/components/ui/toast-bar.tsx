import type { ComponentProps, ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { InformativeIcon, type InformativeIconColor } from "@/components/ui/informative-icon"

const toastBarVariants = cva(
  "inline-flex w-[348px] max-w-full shrink-0 items-center gap-3 rounded-xl bg-toast-bar-surface px-4 py-2.5 shadow-2xl select-none font-body text-sm font-normal text-toast-bar-foreground transition-all",
  {
    variants: {
      position: {
        top: "data-[position=top]:animate-in data-[position=top]:slide-in-from-top-2",
        bottom: "data-[position=bottom]:animate-in data-[position=bottom]:slide-in-from-bottom-2",
      },
      variant: {
        success: "",
        warning: "",
        info: "",
        error: "",
      },
    },
    defaultVariants: {
      position: "top",
      variant: "success",
    },
  },
)

const variantColorMap: Record<NonNullable<VariantProps<typeof toastBarVariants>["variant"]>, InformativeIconColor> = {
  success: "success",
  warning: "warning",
  info: "blue",
  error: "error",
}

export type ToastBarVariant = NonNullable<VariantProps<typeof toastBarVariants>["variant"]>
export type ToastBarPosition = NonNullable<VariantProps<typeof toastBarVariants>["position"]>

export type ToastBarProps = ComponentProps<"div"> &
  VariantProps<typeof toastBarVariants> & {
    children?: ReactNode
  }

export function ToastBar({
  className,
  variant = "success",
  position = "top",
  children,
  ...props
}: ToastBarProps) {
  const activeVariant = variant ?? "success"
  const iconColor = variantColorMap[activeVariant]

  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="toast-bar"
      data-variant={activeVariant}
      data-position={position}
      className={cn(toastBarVariants({ variant, position }), className)}
      {...props}
    >
      <InformativeIcon color={iconColor} size="xs" type="circle-outline" aria-hidden="true" />
      <span className="leading-5">{children}</span>
    </div>
  )
}

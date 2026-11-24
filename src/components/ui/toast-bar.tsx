import type { ComponentProps, ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { InformativeIcon, type InformativeIconColor } from "@/components/ui/informative-icon"

const toastBarVariants = cva(
  "inline-flex w-[400px] max-w-full shrink-0 items-center gap-6 rounded-xl border-[0.5px] border-toast-bar-border bg-toast-bar-surface px-4 py-3 shadow-[8px_4px_25px_rgba(2,4,7,0.8)] select-none font-body text-sm font-medium tracking-[-0.07px] text-toast-bar-foreground transition-all",
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
      <InformativeIcon color={iconColor} size="sm" type="circle-outline" aria-hidden="true" />
      <span className="leading-5">{children}</span>
    </div>
  )
}

import type { ComponentProps, ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { InformativeIcon, type InformativeIconColor } from "@/components/ui/informative-icon"

export const toastBarVariants = cva(
  "inline-flex w-[400px] max-w-full shrink-0 items-center gap-6 rounded-xl border-[0.5px] border-toast-bar-border bg-toast-bar-surface px-4 py-3 shadow-toast-bar select-none font-body text-sm font-medium tracking-[-0.07px] text-toast-bar-foreground transition-all",
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

/** Text style of the toast message; shared with the sonner toaster. */
export const toastBarTextClassName = "leading-5"

/** Default leading icon of a toast, chosen by its variant. */
export function ToastBarIcon({ variant }: { variant: ToastBarVariant }) {
  return (
    <InformativeIcon
      color={variantColorMap[variant]}
      size="sm"
      type="circle-outline"
      aria-hidden="true"
    />
  )
}

export type ToastBarProps = ComponentProps<"div"> &
  VariantProps<typeof toastBarVariants> & {
    children?: ReactNode
    /** Replaces the default leading icon; pass `null` to hide it. */
    icon?: ReactNode
  }

export function ToastBar({
  className,
  variant = "success",
  position = "top",
  icon,
  children,
  ...props
}: ToastBarProps) {
  const activeVariant = variant ?? "success"

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
      {icon === undefined ? <ToastBarIcon variant={activeVariant} /> : icon}
      <span className={toastBarTextClassName}>{children}</span>
    </div>
  )
}

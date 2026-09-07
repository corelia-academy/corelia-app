import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-cta-medium font-cta whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-raised aria-expanded:bg-surface-raised",
        secondary:
          "bg-surface-raised text-foreground border border-border hover:bg-surface-overlay aria-expanded:bg-surface-overlay",
        ghost:
          "text-foreground-muted hover:text-foreground hover:bg-surface-raised aria-expanded:bg-surface-raised",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-80 focus-visible:ring-destructive/40",
      },
      size: {
        default:
          "h-8 gap-md px-lg has-data-[icon=inline-end]:pr-lg has-data-[icon=inline-start]:pl-lg",
        xs: "h-6 gap-xs px-md text-cta-small has-data-[icon=inline-end]:pr-md has-data-[icon=inline-start]:pl-md [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-xs px-lg text-cta-medium has-data-[icon=inline-end]:pr-md has-data-[icon=inline-start]:pl-md [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-md px-xl text-cta-large has-data-[icon=inline-end]:pr-xl has-data-[icon=inline-start]:pl-xl",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }

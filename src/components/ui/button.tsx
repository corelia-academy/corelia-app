import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-cta-medium font-cta whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        cta: "",
        destructive: "",
        floating: "rounded-full",
      },
      size: {
        large:
          "h-12 gap-md rounded-lg px-3xl text-cta-large [&_svg:not([class*='size-'])]:size-5",
        medium:
          "h-10 gap-md rounded-lg px-2xl text-cta-medium [&_svg:not([class*='size-'])]:size-4",
        small:
          "h-8 gap-md rounded-md px-xl text-cta-medium [&_svg:not([class*='size-'])]:size-4",
        xsmall:
          "h-6 gap-md rounded-md px-md text-cta-small [&_svg:not([class*='size-'])]:size-3",
      },
      hierarchy: {
        primary: "",
        secondary: "",
        tertiary: "",
      },
      iconOnly: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: ["cta", "floating"],
        hierarchy: "primary",
        className:
          "bg-button-primary text-button-primary-foreground hover:bg-button-primary-hover active:bg-button-primary-active disabled:bg-button-primary-disabled disabled:text-button-primary-disabled-foreground focus-visible:ring-button-primary/40",
      },
      {
        variant: "cta",
        hierarchy: "secondary",
        className:
          "border-button-secondary-border bg-transparent text-button-secondary-foreground hover:bg-button-secondary-hover active:bg-button-secondary-active aria-expanded:bg-button-secondary-hover disabled:bg-transparent disabled:border-button-secondary-disabled-border disabled:text-button-secondary-disabled-foreground focus-visible:ring-button-secondary-foreground/40",
      },
      {
        variant: "cta",
        hierarchy: "tertiary",
        className:
          "bg-transparent text-button-tertiary-foreground hover:bg-button-tertiary-hover active:bg-button-tertiary-active aria-expanded:bg-button-tertiary-hover disabled:bg-transparent disabled:text-button-tertiary-disabled-foreground focus-visible:ring-button-tertiary-foreground/40",
      },
      {
        variant: "destructive",
        hierarchy: "primary",
        className:
          "bg-button-destructive-primary text-button-destructive-primary-foreground hover:bg-button-destructive-primary-hover active:bg-button-destructive-primary-active disabled:bg-button-destructive-primary-disabled disabled:text-button-destructive-primary-disabled-foreground focus-visible:ring-button-destructive-primary/40",
      },
      {
        variant: "destructive",
        hierarchy: "secondary",
        className:
          "border-button-destructive-secondary-border bg-transparent text-button-destructive-secondary-foreground hover:bg-button-destructive-secondary-hover active:bg-button-destructive-secondary-active disabled:bg-transparent disabled:border-button-destructive-secondary-disabled-border disabled:text-button-destructive-secondary-disabled-foreground focus-visible:ring-button-destructive-secondary-foreground/40",
      },
      {
        variant: "destructive",
        hierarchy: "tertiary",
        className:
          "bg-transparent text-button-destructive-tertiary-foreground hover:bg-button-destructive-tertiary-hover active:bg-button-destructive-tertiary-active disabled:bg-transparent disabled:text-button-destructive-tertiary-disabled-foreground focus-visible:ring-button-destructive-tertiary-foreground/40",
      },
      {
        variant: ["cta", "destructive", "floating"],
        size: ["large", "medium", "small", "xsmall"],
        className: "hover:opacity-100 active:opacity-100 disabled:opacity-100",
      },
      {
        variant: ["cta", "destructive"],
        size: ["small", "xsmall"],
        className:
          "pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:rounded-[inherit]",
      },
      {
        variant: "floating",
        size: "large",
        iconOnly: false,
        className:
          "h-14 w-60 rounded-full px-3xl text-cta-large shadow-button-floating-large [&_svg:not([class*='size-'])]:size-5",
      },
      {
        variant: "floating",
        size: "large",
        iconOnly: true,
        className:
          "size-14 rounded-full px-0 shadow-button-floating-large [&_svg:not([class*='size-'])]:size-6",
      },
      {
        variant: "floating",
        size: "medium",
        iconOnly: false,
        className:
          "h-11 w-60 rounded-full px-2xl text-cta-medium shadow-button-floating-medium [&_svg:not([class*='size-'])]:size-4",
      },
      {
        variant: "floating",
        size: "medium",
        iconOnly: true,
        className:
          "size-11 rounded-full px-0 shadow-button-floating-medium [&_svg:not([class*='size-'])]:size-5",
      },
      {
        variant: ["cta", "destructive"],
        size: "large",
        iconOnly: true,
        className: "size-12 px-0 [&_svg:not([class*='size-'])]:size-6",
      },
      {
        variant: ["cta", "destructive"],
        size: "medium",
        iconOnly: true,
        className: "size-10 px-0 [&_svg:not([class*='size-'])]:size-5",
      },
      {
        variant: ["cta", "destructive"],
        size: "small",
        iconOnly: true,
        className: "size-8 px-0 [&_svg:not([class*='size-'])]:size-4",
      },
      {
        variant: ["cta", "destructive"],
        size: "xsmall",
        iconOnly: true,
        className: "size-6 px-0 [&_svg:not([class*='size-'])]:size-3",
      },
    ],
    defaultVariants: {
      variant: "cta",
      size: "medium",
      hierarchy: "primary",
      iconOnly: false,
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    leadingIcon?: ReactNode | null
    trailingIcon?: ReactNode | null
  }

function ButtonIconSlot({
  children,
  position,
}: {
  children: ReactNode
  position: "start" | "end"
}) {
  if (children === null || children === undefined) return null

  return (
    <span
      data-icon={`inline-${position}`}
      className="inline-flex shrink-0 items-center justify-center"
    >
      {children}
    </span>
  )
}

function Button({
  className,
  variant = "cta",
  size = "medium",
  hierarchy = "primary",
  iconOnly = false,
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({
          variant,
          size,
          hierarchy: variant === "floating" ? "primary" : hierarchy,
          iconOnly,
          className,
        })
      )}
      {...props}
    >
      <ButtonIconSlot position="start">{leadingIcon}</ButtonIconSlot>
      {children}
      <ButtonIconSlot position="end">{trailingIcon}</ButtonIconSlot>
    </ButtonPrimitive>
  )
}

export { Button }

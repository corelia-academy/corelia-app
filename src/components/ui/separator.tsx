"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

type SeparatorProps = SeparatorPrimitive.Props & {
  variant?: "solid" | "dashed"
}

function Separator({
  className,
  orientation = "horizontal",
  variant = "solid",
  ...props
}: SeparatorProps) {
  const isVertical = orientation === "vertical"

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 border-border",
        isVertical ? "self-stretch w-px border-s" : "h-px w-full border-t",
        variant === "dashed" ? "border-dashed" : "border-solid",
        className
      )}
      {...props}
    />
  )
}

/*
  orientation="horizontal": đường ngang, đây là giá trị mặc định.
  orientation="vertical": đường dọc.
  variant="solid": nét liền, mặc định.
  variant="dashed": nét đứt.
*/

export { Separator }

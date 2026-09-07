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
        isVertical ? "h-full w-px border-s" : "h-px w-full border-t",
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

// function Separator({
//   className,
//   orientation = "horizontal",
//   ...props
// }: SeparatorPrimitive.Props) {
//   return (
//     <SeparatorPrimitive
//       data-slot="separator"
//       orientation={orientation}
//       className={cn(
//         "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
//         className
//       )}
//       {...props}
//     />
//   )
// }

export { Separator }

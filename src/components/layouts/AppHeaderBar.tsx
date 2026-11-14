import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Tổng chiều cao khung header (đã gồm border-b 1px). Nguồn duy nhất cho MainLayout. */
export const APP_HEADER_HEIGHT = "64px";

export function AppHeaderBar({ className, children, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn("relative h-16 w-full shrink-0 border-b border-border bg-background", className)}
      {...props}
    >
      <div className="mx-auto flex h-full w-full max-w-[1990px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-2xl">
        {children}
      </div>
    </header>
  );
}

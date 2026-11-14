import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { useEffect, useRef, type ReactElement } from "react"

import { cn } from "@/lib/utils"

/** How long the thumb stays visible after the last scroll event. */
const ACTIVE_MS = 1000

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  /** Fade the thumb out unless the area is scrolling or the track is hovered. */
  autoHide?: boolean
  /** Element rendered as the scrolling viewport, e.g. `<main />` to keep landmark semantics. */
  viewportRender?: ReactElement
  viewportClassName?: string
  contentClassName?: string
}

/** Floating scrollbar: markup only, the look comes from `.scrollbar-overlay*` in styles/scrollbar.css. */
function ScrollArea({
  className,
  viewportClassName,
  contentClassName,
  viewportRender,
  autoHide = false,
  children,
  ...props
}: ScrollAreaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Listen to the real scroll event: Base UI's own `data-scrolling` ignores scrolls it cannot attribute to user input.
  useEffect(() => {
    const root = rootRef.current
    const viewport = viewportRef.current
    if (!autoHide || !root || !viewport) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      root.setAttribute("data-active", "")
      clearTimeout(timer)
      timer = setTimeout(() => root.removeAttribute("data-active"), ACTIVE_MS)
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      viewport.removeEventListener("scroll", onScroll)
      clearTimeout(timer)
      root.removeAttribute("data-active")
    }
  }, [autoHide])

  return (
    <ScrollAreaPrimitive.Root
      className={cn("scrollbar-overlay relative min-h-0 min-w-0 flex-1 overflow-hidden", className)}
      {...props}
      ref={rootRef}
    >
      <ScrollAreaPrimitive.Viewport ref={viewportRef} render={viewportRender} className={cn("size-full", viewportClassName)}>
        <ScrollAreaPrimitive.Content className={contentClassName}>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        data-autohide={autoHide ? "" : undefined}
        className="scrollbar-overlay-track"
      >
        <ScrollAreaPrimitive.Thumb className="scrollbar-overlay-thumb" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  )
}

export { ScrollArea }

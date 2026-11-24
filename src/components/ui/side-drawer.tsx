"use client"

import { useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react"
import { gsap } from "gsap"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type SideDrawerSize = "30vw" | "50vw"

type SideDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Figma widths: 30vw = 480 px, 50vw = 720 px (never wider than the viewport). */
  size?: SideDrawerSize
  title: ReactNode
  description?: ReactNode
  /** Content slot below the header; scrolls when it overflows. */
  children?: ReactNode
  /** Accessible name of the close button; pass the translated text. */
  closeLabel?: string
  /** Forwarded to the dialog popup: which element gets focus when it opens. */
  initialFocus?: ComponentProps<typeof DialogPrimitive.Popup>["initialFocus"]
  className?: string
}

const SIZE_CLASS: Record<SideDrawerSize, string> = {
  "30vw": "w-[min(480px,100vw)]",
  "50vw": "w-[min(720px,100vw)]",
}

/** Reveals the header text and the slot content piece by piece each time the drawer opens. */
function RevealOnOpen() {
  const markerRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const marker = markerRef.current
    const popup = marker?.closest<HTMLElement>('[data-slot="side-drawer"]')
    if (!marker || !popup || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return
    const targets = Array.from(popup.querySelectorAll<HTMLElement>("[data-reveal]"))
    const slot = marker.parentElement
    // Content without its own `data-reveal` markers falls back to the slot's direct children.
    if (slot && !slot.querySelector("[data-reveal]")) {
      targets.push(...Array.from(slot.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el !== marker))
    }
    if (!targets.length) return
    const tween = gsap.from(targets, {
      autoAlpha: 0,
      y: 14,
      duration: 0.38,
      ease: "power3.out",
      delay: 0.06,
      stagger: { each: 0.035, amount: 0.4 },
      clearProps: "opacity,visibility,transform",
    })
    return () => {
      tween.kill()
      gsap.set(targets, { clearProps: "opacity,visibility,transform" })
    }
  }, [])
  return <span ref={markerRef} hidden aria-hidden />
}

function SideDrawer({
  open,
  onOpenChange,
  size = "30vw",
  title,
  description,
  children,
  closeLabel = "Close",
  initialFocus,
  className,
}: SideDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="side-drawer-overlay"
          className="fixed inset-0 z-50 bg-side-drawer-overlay transition-opacity duration-300 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
        <DialogPrimitive.Popup
          data-slot="side-drawer"
          data-size={size}
          initialFocus={initialFocus}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-dvh flex-col gap-2xl overflow-hidden border-l border-stroke-divider bg-side-drawer-surface text-side-drawer-title outline-none transition-[translate,opacity] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:translate-x-full data-ending-style:opacity-0 data-starting-style:translate-x-full data-starting-style:opacity-0",
            SIZE_CLASS[size],
            className,
          )}
        >
          <div
            data-slot="side-drawer-header"
            className="flex shrink-0 items-start justify-between gap-xl p-3xl"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-sm break-words">
              <DialogPrimitive.Title
                data-slot="side-drawer-title"
                data-reveal=""
                className="text-heading-medium font-display text-side-drawer-title"
              >
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description
                  data-slot="side-drawer-description"
                  data-reveal=""
                  className="font-body text-[14px] leading-[1.4] tracking-[0.28px] text-side-drawer-description"
                >
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              data-slot="side-drawer-close"
              className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-side-drawer-title outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">{closeLabel}</span>
            </DialogPrimitive.Close>
          </div>
          <div
            data-slot="side-drawer-slot"
            className="flex min-h-0 flex-1 flex-col gap-3xl overflow-y-auto px-3xl pb-3xl scrollbar-design"
          >
            <RevealOnOpen />
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { SideDrawer, type SideDrawerProps, type SideDrawerSize }

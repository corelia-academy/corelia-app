import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown"

import { cn } from "@/lib/utils"

export type TooltipArrow =
  | "none"
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right"
  | "left"
  | "right"

type TooltipArrowPosition = {
  side: NonNullable<TooltipPrimitive.Positioner.Props["side"]>
  align: NonNullable<TooltipPrimitive.Positioner.Props["align"]>
}

const tooltipArrowPositions: Record<TooltipArrow, TooltipArrowPosition> = {
  none: { side: "top", align: "center" },
  "bottom-center": { side: "top", align: "center" },
  "bottom-left": { side: "top", align: "start" },
  "bottom-right": { side: "top", align: "end" },
  "top-center": { side: "bottom", align: "center" },
  "top-left": { side: "bottom", align: "start" },
  "top-right": { side: "bottom", align: "end" },
  left: { side: "right", align: "center" },
  right: { side: "left", align: "center" },
}

function tooltipArrowForSide(
  side: NonNullable<TooltipPrimitive.Positioner.Props["side"]>,
): TooltipArrow {
  switch (side) {
    case "bottom":
      return "top-center"
    case "left":
    case "inline-start":
      return "right"
    case "right":
    case "inline-end":
      return "left"
    default:
      return "bottom-center"
  }
}

type TooltipArrowGeometry = {
  slot: string
  artwork: string
  artworkOffsetX: number
  artworkWidth: number
}

const tooltipArrowArtworkWidths = {
  standard: 13.5564,
  wide: 14.1863,
} as const

const tooltipArrowGeometry: Record<
  Exclude<TooltipArrow, "none">,
  TooltipArrowGeometry
> = {
  "bottom-center": {
    slot: "h-[8.51471px] w-4",
    artwork: "h-[8.51471px] w-4",
    artworkOffsetX: 0,
    artworkWidth: tooltipArrowArtworkWidths.standard,
  },
  "bottom-left": {
    slot: "h-[8.51471px] w-7",
    artwork: "h-[8.51471px] w-7",
    artworkOffsetX: 6.315,
    artworkWidth: tooltipArrowArtworkWidths.wide,
  },
  "bottom-right": {
    slot: "h-[8.51471px] w-7",
    artwork: "h-[8.51471px] w-7",
    artworkOffsetX: -6,
    artworkWidth: tooltipArrowArtworkWidths.standard,
  },
  "top-center": {
    slot: "h-[8.51471px] w-4",
    artwork: "h-[8.51471px] w-4",
    artworkOffsetX: 0,
    artworkWidth: tooltipArrowArtworkWidths.standard,
  },
  "top-left": {
    slot: "h-[8.51471px] w-7",
    artwork: "h-[8.51471px] w-7",
    artworkOffsetX: -6,
    artworkWidth: tooltipArrowArtworkWidths.standard,
  },
  "top-right": {
    slot: "h-[8.51471px] w-[28.5878px]",
    artwork: "h-[8.51471px] w-[28.5878px]",
    artworkOffsetX: 7.53585,
    artworkWidth: tooltipArrowArtworkWidths.wide,
  },
  left: {
    slot: "h-4 w-[8.51471px]",
    artwork: "h-[8.51471px] w-4",
    artworkOffsetX: 0,
    artworkWidth: tooltipArrowArtworkWidths.standard,
  },
  right: {
    slot: "h-4 w-[8.51471px]",
    artwork: "h-[8.51471px] w-4",
    artworkOffsetX: 0,
    artworkWidth: tooltipArrowArtworkWidths.standard,
  },
}

const tooltipArrowSupportingGeometry: Partial<
  Record<Exclude<TooltipArrow, "none">, TooltipArrowGeometry>
> = {
  "top-right": {
    slot: "h-[8.51471px] w-7",
    artwork: "h-[8.51471px] w-7",
    artworkOffsetX: 6.315,
    artworkWidth: tooltipArrowArtworkWidths.wide,
  },
}

const tooltipArrowTipOffsetX: Record<Exclude<TooltipArrow, "none">, number> = {
  "bottom-center": 0.70711,
  "bottom-left": 6.70711,
  "bottom-right": -5.29289,
  "top-center": 0.70711,
  "top-left": -5.29289,
  "top-right": 7.9279,
  left: 0.70711,
  right: 0.70711,
}

function tooltipArrowAlignmentStyle(
  arrowType: TooltipArrow,
  hasSupportingText: boolean,
  side: TooltipPrimitive.Arrow.State["side"],
) {
  if (arrowType === "none") return undefined

  const tipOffsetX =
    arrowType === "top-right" && hasSupportingText
      ? 6.70711
      : tooltipArrowTipOffsetX[arrowType]
  const opticalCorrectionX =
    arrowType === "top-left" || arrowType === "top-right" ? -2 : 0

  if (side === "bottom") {
    return { marginLeft: tipOffsetX + opticalCorrectionX }
  }
  if (side === "top") {
    return { marginLeft: -tipOffsetX + opticalCorrectionX }
  }
  if (side === "left" || side === "inline-start") {
    return { marginTop: tipOffsetX }
  }
  if (side === "right" || side === "inline-end") {
    return { marginTop: -tipOffsetX }
  }

  return undefined
}

type TooltipSurfaceProps = {
  children: ReactNode
  supportingText?: ReactNode
}

function TooltipSurface({ children, supportingText }: TooltipSurfaceProps) {
  const hasSupportingText = supportingText !== undefined && supportingText !== null

  return (
    <div
      className={cn(
        "flex flex-col rounded-md bg-(--tooltip-surface) text-(--tooltip-foreground) shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]",
        hasSupportingText
          ? "w-80 max-w-[calc(100vw-3rem)] items-start gap-2 px-3 py-3"
          : "w-fit max-w-xs items-center px-3 py-2 text-center",
      )}
    >
      <div className="break-words text-sm font-medium leading-[1.4] tracking-[-0.005em]">
        {children}
      </div>
      {hasSupportingText ? (
        <div className="w-full break-words text-xs font-normal leading-[1.25] tracking-[0.02em]">
          {supportingText}
        </div>
      ) : null}
    </div>
  )
}

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & {
    arrow?: TooltipArrow
    isOpen?: boolean
    supportingText?: ReactNode
  }

type TooltipPreviewProps = {
  arrow: TooltipArrow
  children: ReactNode
  side?: NonNullable<TooltipPrimitive.Positioner.Props["side"]>
  trigger: ReactNode
  triggerLabel: string
  supportingText?: ReactNode
  triggerClassName?: string
}

let tooltipGsapPromise: Promise<typeof import("gsap")> | undefined

function loadTooltipGsap() {
  return (tooltipGsapPromise ??= import("gsap"))
}

function TooltipArrowShape({
  className,
  offsetX,
  width,
}: {
  className: string
  offsetX: number
  width: number
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 block max-w-none -translate-x-1/2 -translate-y-1/2 group-data-[side=bottom]:rotate-180 group-data-[side=left]:-rotate-90 group-data-[side=inline-start]:-rotate-90 group-data-[side=right]:rotate-90 group-data-[side=inline-end]:rotate-90",
        className,
      )}
    >
      <CaretDown
        aria-hidden="true"
        color="var(--tooltip-surface)"
        preserveAspectRatio="none"
        viewBox="40 88 176 96"
        weight="fill"
        className="absolute left-1/2 top-1/2 block h-[7.77818px] max-w-none -translate-x-1/2 -translate-y-1/2"
        style={{ marginLeft: offsetX, width }}
      />
    </span>
  )
}

function TooltipPreview({
  arrow,
  children,
  side,
  supportingText,
  trigger,
  triggerLabel,
  triggerClassName,
}: TooltipPreviewProps) {
  const [open, setOpen] = useState(false)
  const pressedPointer = useRef(false)
  const hoveredPointer = useRef(false)
  const touchPointer = useRef(false)
  const touchPressHandled = useRef(false)

  useEffect(() => {
    void loadTooltipGsap()
  }, [])

  const handleOpenChange = (
    nextOpen: boolean,
    eventDetails: TooltipPrimitive.Root.ChangeEventDetails,
  ) => {
    if (
      touchPressHandled.current &&
      eventDetails.reason === "trigger-press"
    ) {
      touchPressHandled.current = false
      eventDetails.cancel()
      return
    }

    if (touchPointer.current || (!nextOpen && pressedPointer.current)) return
    setOpen(nextOpen)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") {
      touchPressHandled.current = false
      touchPointer.current = true
      return
    }

    if (event.button === 0) {
      pressedPointer.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setOpen(true)
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") {
      if (!touchPointer.current) return

      touchPointer.current = false
      touchPressHandled.current = true
      setOpen((currentOpen) => !currentOpen)
      return
    }

    pressedPointer.current = false
    const pointerTarget = document.elementFromPoint(event.clientX, event.clientY)
    hoveredPointer.current = pointerTarget
      ? event.currentTarget.contains(pointerTarget)
      : false
    if (!hoveredPointer.current) setOpen(false)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") {
      touchPointer.current = false
      touchPressHandled.current = false
      return
    }

    pressedPointer.current = false
    if (!hoveredPointer.current) setOpen(false)
  }

  return (
    <TooltipProvider delay={0}>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger
          type="button"
          aria-label={triggerLabel}
          className={cn(
            "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-primary",
            triggerClassName,
          )}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch") hoveredPointer.current = true
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") hoveredPointer.current = false
          }}
        >
          {trigger}
        </TooltipTrigger>
        <TooltipContent
          arrow={arrow}
          isOpen={open}
          side={side}
          supportingText={supportingText}
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TooltipProvider({
  delay = 200,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  arrow,
  isOpen = false,
  supportingText,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  const [popup, setPopup] = useState<HTMLDivElement | null>(null)
  const hasSupportingText = supportingText !== undefined && supportingText !== null
  const position = arrow === undefined || arrow === "none"
    ? { side, align }
    : tooltipArrowPositions[arrow]
  const arrowType = arrow ?? tooltipArrowForSide(position.side)
  useLayoutEffect(() => {
    if (!isOpen || !popup) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let cancelled = false
    let killTween: (() => void) | undefined

    void loadTooltipGsap().then(({ gsap }) => {
      if (cancelled) return

      const tween = gsap.fromTo(
        popup,
        { autoAlpha: 0, y: 4, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.18,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(popup, { clearProps: "opacity,visibility,transform" })
          },
        },
      )

      killTween = () => tween.kill()
    })

    return () => {
      cancelled = true
      killTween?.()
    }
  }, [isOpen, popup])

  const arrowGeometry = arrowType === "none"
    ? undefined
    : hasSupportingText
      ? tooltipArrowSupportingGeometry[arrowType] ?? tooltipArrowGeometry[arrowType]
      : tooltipArrowGeometry[arrowType]

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={position.align}
        alignOffset={alignOffset}
        side={position.side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          ref={setPopup}
          data-slot="tooltip-content"
          className={cn(
            "z-50 origin-(--transform-origin) data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <TooltipSurface supportingText={supportingText}>{children}</TooltipSurface>
          {arrowGeometry ? (
            <TooltipPrimitive.Arrow
              data-slot="tooltip-arrow"
              style={(state) =>
                tooltipArrowAlignmentStyle(
                  arrowType,
                  hasSupportingText,
                  state.side,
                )
              }
              className={cn(
                "group z-50 overflow-visible",
                "data-[side=bottom]:top-0 data-[side=bottom]:translate-y-[calc(-100%_+_1px)]",
                "data-[side=top]:bottom-0 data-[side=top]:translate-y-[calc(100%_-_1px)]",
                "data-[side=left]:right-0 data-[side=left]:translate-x-[calc(100%_-_1px)]",
                "data-[side=right]:left-0 data-[side=right]:translate-x-[calc(-100%_+_1px)]",
                "data-[side=inline-start]:right-0 data-[side=inline-start]:translate-x-[calc(100%_-_1px)]",
                "data-[side=inline-end]:left-0 data-[side=inline-end]:translate-x-[calc(-100%_+_1px)]",
                arrowGeometry.slot,
              )}
            >
              <TooltipArrowShape
                offsetX={arrowGeometry.artworkOffsetX}
                width={arrowGeometry.artworkWidth}
                className={arrowGeometry.artwork}
              />
            </TooltipPrimitive.Arrow>
          ) : null}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPreview }

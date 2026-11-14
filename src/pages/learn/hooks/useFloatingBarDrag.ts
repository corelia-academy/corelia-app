import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"

import {
  clamp,
  prefersReducedMotion,
  readStored,
  runSpring,
  writeStored,
  type Point,
} from "../utils/dockPhysics"

const STORAGE_KEY = "learn-dock-bar-v1"
const KEY_STEP = 16
// Same press-and-hold feel as the image reorder in the project editor.
const LONG_PRESS_MS = 250
const TOUCH_SLOP = 8
const MOUSE_SLOP = 4
// How long the reset button stays mounted while it animates out; keep in sync with its duration in Learn.tsx.
const EXIT_MS = 200
const ORIGIN: Point = { x: 0, y: 0 }
// The bar can travel hundreds of px, so the same spring overshoots it by far more than the small edge tab.
export const BAR_DAMPING = 22

type DragState = { id: number; startX: number; startY: number; start: Point; active: boolean }

/**
 * Floating action bar that can be dragged anywhere inside its bounds and sprung back to its default place.
 * The position is kept as an offset from the default spot (stored as a ratio of the bounds), so a reset
 * is simply offset 0 and the default stays correct when the viewport changes.
 * Attach `barRef` to the bar element; the bounds are the grandparent (bar -> positioning strip -> container).
 */
export function useFloatingBarDrag() {
  const barElRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const offsetRef = useRef<Point>(ORIGIN)
  const dragRef = useRef<DragState | null>(null)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelSpringRef = useRef<(() => void) | null>(null)
  const [isMoved, setIsMoved] = useState(false)
  const [resetClosing, setResetClosing] = useState(false)
  const movedRef = useRef(false)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const api = useMemo(() => {
    const boundsOf = (bar: HTMLElement) => bar.parentElement?.parentElement ?? null

    const applyOffset = (offset: Point) => {
      const bar = barElRef.current
      offsetRef.current = offset
      if (bar) {
        bar.style.transform = offset.x === 0 && offset.y === 0 ? "" : `translate3d(${offset.x}px,${offset.y}px,0)`
      }
    }

    const clampOffset = (offset: Point): Point => {
      const bar = barElRef.current
      const box = bar ? boundsOf(bar) : null
      if (!bar || !box) return offset
      const barRect = bar.getBoundingClientRect()
      // Hidden bar (no slots yet) has no size; leave the offset alone until it becomes visible.
      if (barRect.width === 0 || barRect.height === 0) return offset
      const boxRect = box.getBoundingClientRect()
      const current = offsetRef.current
      return {
        x: clamp(offset.x, boxRect.left - (barRect.left - current.x), boxRect.right - (barRect.right - current.x)),
        y: clamp(offset.y, boxRect.top - (barRect.top - current.y), boxRect.bottom - (barRect.bottom - current.y)),
      }
    }

    const setMoved = (moved: boolean) => {
      const wasMoved = movedRef.current
      movedRef.current = moved
      if (closingTimerRef.current) {
        clearTimeout(closingTimerRef.current)
        closingTimerRef.current = null
      }
      if (moved || !wasMoved || prefersReducedMotion()) {
        setResetClosing(false)
      } else {
        setResetClosing(true)
        closingTimerRef.current = setTimeout(() => {
          closingTimerRef.current = null
          setResetClosing(false)
        }, EXIT_MS)
      }
      setIsMoved(moved)
    }

    const commit = (offset: Point) => {
      applyOffset(offset)
      const bar = barElRef.current
      const box = bar ? boundsOf(bar) : null
      const moved = Math.abs(offset.x) > 0.5 || Math.abs(offset.y) > 0.5
      setMoved(moved)
      if (!box || box.clientWidth === 0 || box.clientHeight === 0) return
      writeStored(STORAGE_KEY, moved ? { x: offset.x / box.clientWidth, y: offset.y / box.clientHeight } : null)
    }

    const restore = () => {
      const bar = barElRef.current
      const box = bar ? boundsOf(bar) : null
      const stored = readStored<Point>(STORAGE_KEY)
      if (!box || !stored || !Number.isFinite(stored.x) || !Number.isFinite(stored.y)) return
      const offset = { x: stored.x * box.clientWidth, y: stored.y * box.clientHeight }
      applyOffset(offset)
      applyOffset(clampOffset(offset))
      setMoved(true)
    }

    const reclamp = () => {
      if (dragRef.current) return
      applyOffset(clampOffset(offsetRef.current))
    }

    const reset = () => {
      cancelSpringRef.current?.()
      if (prefersReducedMotion()) {
        commit(ORIGIN)
        return
      }
      cancelSpringRef.current = runSpring(offsetRef.current, applyOffset, () => commit(ORIGIN), BAR_DAMPING)
    }

    const nudge = (dx: number, dy: number) => {
      cancelSpringRef.current?.()
      const current = offsetRef.current
      commit(clampOffset({ x: current.x + dx, y: current.y + dy }))
    }

    const preventTouchScroll = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault()
    }

    function onWindowBlur() {
      endGesture(true)
    }

    const endGesture = (commitMove: boolean) => {
      const drag = dragRef.current
      dragRef.current = null
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current)
        pressTimerRef.current = null
      }
      window.removeEventListener("touchmove", preventTouchScroll)
      window.removeEventListener("blur", onWindowBlur)
      barElRef.current?.removeAttribute("data-dragging")
      if (drag?.active && commitMove) commit(offsetRef.current)
    }

    const activate = (drag: DragState) => {
      drag.active = true
      barElRef.current?.setAttribute("data-dragging", "")
      window.addEventListener("touchmove", preventTouchScroll, { passive: false })
      window.addEventListener("blur", onWindowBlur)
    }

    return { restore, reclamp, reset, applyOffset, clampOffset, commit, nudge, endGesture, activate }
  }, [])

  const barRef = useCallback(
    (el: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      cancelSpringRef.current?.()
      api.endGesture(false)
      barElRef.current = el
      if (!el) return
      api.restore()
      if (typeof ResizeObserver === "undefined") return
      const observer = new ResizeObserver(api.reclamp)
      observer.observe(el)
      const box = el.parentElement?.parentElement
      if (box) observer.observe(box)
      observerRef.current = observer
    },
    [api],
  )

  const gripProps = useMemo(
    () => ({
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return
        cancelSpringRef.current?.()
        api.endGesture(false) // drop anything left over from a lost pointer
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          return // the pointer may already have been canceled by the browser
        }
        const drag: DragState = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          start: offsetRef.current,
          active: false,
        }
        dragRef.current = drag
        if (event.pointerType === "touch") {
          pressTimerRef.current = setTimeout(() => {
            pressTimerRef.current = null
            api.activate(drag)
          }, LONG_PRESS_MS)
        }
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (!drag.active) {
          const distance = Math.hypot(dx, dy)
          if (event.pointerType === "touch") {
            // Moved before the hold finished: this is a scroll, not a drag.
            if (distance > TOUCH_SLOP) api.endGesture(false)
            return
          }
          if (distance <= MOUSE_SLOP) return
          api.activate(drag)
        }
        api.applyOffset(api.clampOffset({ x: drag.start.x + dx, y: drag.start.y + dy }))
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        api.endGesture(true)
      },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        const step: Record<string, Point> = {
          ArrowLeft: { x: -KEY_STEP, y: 0 },
          ArrowRight: { x: KEY_STEP, y: 0 },
          ArrowUp: { x: 0, y: -KEY_STEP },
          ArrowDown: { x: 0, y: KEY_STEP },
        }
        const move = step[event.key]
        if (!move) return
        event.preventDefault()
        api.nudge(move.x, move.y)
      },
    }),
    [api],
  )

  return {
    barRef,
    gripProps: { ...gripProps, onPointerCancel: gripProps.onPointerUp, onLostPointerCapture: gripProps.onPointerUp },
    isMoved,
    /** Lifecycle of the reset button: it stays mounted ("closing") while it animates out. */
    resetState: (isMoved ? "open" : resetClosing ? "closing" : "closed") as "open" | "closing" | "closed",
    reset: api.reset,
  }
}

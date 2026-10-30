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
const ORIGIN: Point = { x: 0, y: 0 }
// The bar can travel hundreds of px, so the same spring overshoots it by far more than the small edge tab.
export const BAR_DAMPING = 22

type DragState = { id: number; startX: number; startY: number; start: Point }

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
  const cancelSpringRef = useRef<(() => void) | null>(null)
  const [isMoved, setIsMoved] = useState(false)

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

    const commit = (offset: Point) => {
      applyOffset(offset)
      const bar = barElRef.current
      const box = bar ? boundsOf(bar) : null
      const moved = Math.abs(offset.x) > 0.5 || Math.abs(offset.y) > 0.5
      setIsMoved(moved)
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
      setIsMoved(true)
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

    return { restore, reclamp, reset, applyOffset, clampOffset, commit, nudge }
  }, [])

  const barRef = useCallback(
    (el: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      cancelSpringRef.current?.()
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
        dragRef.current = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          start: offsetRef.current,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        api.applyOffset(
          api.clampOffset({
            x: drag.start.x + event.clientX - drag.startX,
            y: drag.start.y + event.clientY - drag.startY,
          }),
        )
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        dragRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        api.commit(offsetRef.current)
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
    gripProps: { ...gripProps, onPointerCancel: gripProps.onPointerUp },
    isMoved,
    reset: api.reset,
  }
}

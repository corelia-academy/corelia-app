import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react"

import { clamp, prefersReducedMotion, readStored, rubberBand, runSpring, writeStored } from "../utils/dockPhysics"

const STORAGE_KEY = "learn-dock-tab-v1"
const DRAG_THRESHOLD = 4
const KEY_STEP = 16

type DragState = { id: number; startX: number; startY: number; startTop: number; active: boolean }

/**
 * Edge tab that behaves like a magnet on the right edge: it follows a pull to the left with growing
 * resistance, springs back on release, and keeps the height it was dropped at (stored as a ratio).
 * Attach `ref` and `handlers` to a wrapper positioned `absolute right-0`; the wrapper's parent is the bounds.
 */
export function useEdgeTabDrag() {
  const elRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const pullRef = useRef(0)
  const suppressClickRef = useRef(false)
  const cancelSpringRef = useRef<(() => void) | null>(null)
  const stopListeningRef = useRef<(() => void) | null>(null)

  const applyStoredTop = useCallback(() => {
    const el = elRef.current
    const ratio = readStored<number>(STORAGE_KEY)
    if (!el || typeof ratio !== "number" || !Number.isFinite(ratio)) return
    const parentHeight = el.parentElement?.clientHeight ?? 0
    el.style.top = `${clamp(ratio * parentHeight, 0, Math.max(0, parentHeight - el.offsetHeight))}px`
  }, [])

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      cancelSpringRef.current?.()
      stopListeningRef.current?.()
      elRef.current = el
      if (el) applyStoredTop()
    },
    [applyStoredTop],
  )

  useEffect(() => {
    window.addEventListener("resize", applyStoredTop)
    return () => window.removeEventListener("resize", applyStoredTop)
  }, [applyStoredTop])

  const handlers = useMemo(() => {
    const maxTop = (el: HTMLElement) => Math.max(0, (el.parentElement?.clientHeight ?? 0) - el.offsetHeight)
    const writePull = (el: HTMLElement, pull: number) => {
      el.style.transform = pull === 0 ? "" : `translate3d(${-pull}px,0,0)`
    }
    const persistTop = (el: HTMLElement) => {
      const parentHeight = el.parentElement?.clientHeight ?? 0
      if (parentHeight > 0) writeStored(STORAGE_KEY, el.offsetTop / parentHeight)
    }

    // Move/up are listened on window so a fast flick that leaves the small tab is still followed.
    const handleMove = (event: globalThis.PointerEvent) => {
      const el = elRef.current
      const drag = dragRef.current
      if (!el || !drag || drag.id !== event.pointerId) return
      const pullX = drag.startX - event.clientX
      const moveY = event.clientY - drag.startY
      if (!drag.active) {
        if (Math.hypot(pullX, moveY) < DRAG_THRESHOLD) return
        drag.active = true
        suppressClickRef.current = true
        // Capture keeps events flowing over iframes; only for a real drag so a tap still clicks the button.
        el.setPointerCapture(event.pointerId)
      }
      el.style.top = `${clamp(drag.startTop + moveY, 0, maxTop(el))}px`
      pullRef.current = rubberBand(pullX)
      writePull(el, pullRef.current)
    }

    const handleEnd = (event: globalThis.PointerEvent) => {
      const el = elRef.current
      const drag = dragRef.current
      if (!drag || drag.id !== event.pointerId) return
      dragRef.current = null
      stopListeningRef.current?.()
      if (!el || !drag.active) return
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
      // The click that follows a drag fires in the same task; clear the flag afterwards.
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      persistTop(el)
      if (prefersReducedMotion() || pullRef.current === 0) {
        pullRef.current = 0
        writePull(el, 0)
        return
      }
      cancelSpringRef.current = runSpring(
        { x: pullRef.current, y: 0 },
        ({ x }) => {
          pullRef.current = x
          writePull(el, x)
        },
        () => {
          pullRef.current = 0
          writePull(el, 0)
        },
      )
    }

    return {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        const el = elRef.current
        if (!el || (event.pointerType === "mouse" && event.button !== 0)) return
        cancelSpringRef.current?.()
        stopListeningRef.current?.()
        pullRef.current = 0
        writePull(el, 0)
        suppressClickRef.current = false
        dragRef.current = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startTop: el.offsetTop,
          active: false,
        }
        window.addEventListener("pointermove", handleMove)
        window.addEventListener("pointerup", handleEnd)
        window.addEventListener("pointercancel", handleEnd)
        stopListeningRef.current = () => {
          window.removeEventListener("pointermove", handleMove)
          window.removeEventListener("pointerup", handleEnd)
          window.removeEventListener("pointercancel", handleEnd)
          stopListeningRef.current = null
        }
      },
      onClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (!suppressClickRef.current) return
        suppressClickRef.current = false
        event.preventDefault()
        event.stopPropagation()
      },
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const el = elRef.current
        if (!el || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
        event.preventDefault()
        const delta = event.key === "ArrowUp" ? -KEY_STEP : KEY_STEP
        el.style.top = `${clamp(el.offsetTop + delta, 0, maxTop(el))}px`
        persistTop(el)
      },
    }
  }, [])

  return { ref, handlers }
}

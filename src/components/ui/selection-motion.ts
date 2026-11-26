import * as React from "react"

type Kind = "checkbox" | "radio"
type CheckboxState = "unchecked" | "checked" | "indeterminate"
type Gsap = (typeof import("gsap"))["gsap"]

let gsapPromise: Promise<typeof import("gsap")> | undefined
const loadGsap = () => (gsapPromise ??= import("gsap"))

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false

function readState(root: HTMLElement): CheckboxState {
  if (root.hasAttribute("data-indeterminate")) return "indeterminate"
  return root.hasAttribute("data-checked") ? "checked" : "unchecked"
}

function playCheckbox(
  gsap: Gsap,
  root: HTMLElement,
  from: CheckboxState,
  to: CheckboxState,
) {
  const frame = (state: CheckboxState) =>
    root.querySelector(`[data-slot="checkbox-${state}-frame"]`)
  const outgoing = frame(from)
  const incoming = frame(to)
  const outMark = outgoing?.querySelector("path") ?? null
  const mark = incoming?.querySelector("path") ?? null
  const frames = [outgoing, incoming].filter((el): el is Element => el !== null)
  const marks = [outMark, mark].filter((el): el is SVGPathElement => el !== null)
  // The tick is an SVG path: only its stroke and the --tick-scale variable are
  // animated, never an SVG transform (which GSAP cannot resolve outside a browser).
  const clear = () => {
    gsap.set(frames, { clearProps: "opacity,transform,scale" })
    gsap.set(marks, { clearProps: "strokeDasharray,strokeDashoffset,--tick-scale" })
  }
  const timeline = gsap.timeline({ onComplete: clear, onInterrupt: clear })

  if (outgoing) {
    timeline.fromTo(
      outgoing,
      { opacity: 1 },
      { opacity: 0, duration: 0.18, ease: "power1.in" },
      0,
    )
  }
  if (outMark) {
    // Unchecking: the tick shrinks away.
    timeline.fromTo(
      outMark,
      { "--tick-scale": 1 },
      { "--tick-scale": 0, duration: 0.16, ease: "power2.in" },
      0,
    )
  }
  if (incoming) {
    timeline.fromTo(
      incoming,
      { opacity: 0 },
      { opacity: 1, duration: 0.12, ease: "none" },
      0,
    )
    timeline.fromTo(
      incoming,
      { scale: 0.6 },
      { scale: 1, duration: 0.25, ease: "back.out(1)" },
      0,
    )
  }
  if (mark) {
    // The tick grows to exactly its own size (no overshoot) while its stroke is drawn.
    timeline.fromTo(
      mark,
      { "--tick-scale": 0 },
      { "--tick-scale": 1, duration: 0.22, ease: "power3.out" },
      0.04,
    )
    // Separate ease: back.out would push the dash offset below 0 and clip the tick start.
    timeline.fromTo(
      mark,
      { strokeDasharray: "1 2", strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.18, ease: "power2.out" },
      0.03,
    )
  }
  return timeline
}

function playRadio(gsap: Gsap, root: HTMLElement) {
  const dot = root.querySelector('[data-slot="radio-checked-dot"]')
  if (!dot) return null
  const radius = Number(dot.getAttribute("r"))
  if (!Number.isFinite(radius) || radius <= 0) return null
  // Grow the circle's radius instead of an SVG transform: no transform-origin to manage.
  const restore = () => dot.setAttribute("r", String(radius))
  return gsap.fromTo(
    dot,
    { attr: { r: 0 } },
    {
      attr: { r: radius },
      duration: 0.2,
      ease: "power3.out",
      onComplete: restore,
      onInterrupt: restore,
    },
  )
}

/**
 * Animates a Base UI checkbox/radio when its data-checked / data-indeterminate
 * attributes change, and gives a press-and-bounce feedback on pointer down/up.
 * CSS already holds the final state; GSAP only plays the transition and then
 * clears its inline styles. Nothing runs on first mount or when the user
 * prefers reduced motion.
 */
export function useSelectionMotion<T extends HTMLElement>(
  kind: Kind,
  forwardedRef: React.ForwardedRef<T>,
) {
  const rootRef = React.useRef<T | null>(null)

  // Expose the same element to the caller's forwarded ref without mutating it.
  React.useImperativeHandle(forwardedRef, () => rootRef.current as T, [])

  React.useEffect(() => {
    const root = rootRef.current
    if (!root || typeof MutationObserver === "undefined") return

    if (!prefersReducedMotion()) void loadGsap() // warm up so the first click is not late

    let cancelled = false
    let previous = readState(root)
    let active: { kill: () => void } | null = null
    let press: { kill: () => void } | null = null

    const observer = new MutationObserver(() => {
      const from = previous
      const next = readState(root)
      previous = next
      if (kind === "checkbox" && from === next) return
      if (prefersReducedMotion()) return

      void loadGsap().then(({ gsap }) => {
        if (cancelled) return
        active?.kill()
        active =
          kind === "checkbox"
            ? playCheckbox(gsap, root, from, next)
            : playRadio(gsap, root)
      })
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-checked", "data-indeterminate"],
    })

    const release = () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      void loadGsap().then(({ gsap }) => {
        if (cancelled) return
        press?.kill()
        press = gsap.to(root, {
          scale: 1,
          duration: 0.5,
          ease: "elastic.out(1, 0.45)",
          clearProps: "transform,scale",
        })
      })
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || root.hasAttribute("data-disabled")) return
      if (prefersReducedMotion()) return
      window.addEventListener("pointerup", release)
      window.addEventListener("pointercancel", release)
      void loadGsap().then(({ gsap }) => {
        if (cancelled) return
        press?.kill()
        press = gsap.to(root, { scale: 0.86, duration: 0.1, ease: "power2.out" })
      })
    }
    root.addEventListener("pointerdown", handlePointerDown)

    return () => {
      cancelled = true
      observer.disconnect()
      root.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      active?.kill()
      press?.kill()
    }
  }, [kind])

  return rootRef
}

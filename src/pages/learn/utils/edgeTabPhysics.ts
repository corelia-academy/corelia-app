export const SPRING = { stiffness: 260, damping: 17, resistance: 110 } as const

const SETTLE_DISTANCE = 0.2
const SETTLE_SPEED = 2
const MAX_FRAME_SECONDS = 0.032

export type Point = { x: number; y: number }

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Rubber band: the further the pull, the heavier it feels; pulling the other way does not move. */
export const rubberBand = (pull: number, resistance: number = SPRING.resistance) =>
  pull <= 0 ? 0 : (pull * resistance) / (pull + resistance)

/** One spring step: acceleration = -stiffness * offset - damping * velocity. */
export function springStep(offset: number, velocity: number, dt: number, damping: number = SPRING.damping) {
  const acceleration = -SPRING.stiffness * offset - damping * velocity
  const nextVelocity = velocity + acceleration * dt
  return { offset: offset + nextVelocity * dt, velocity: nextVelocity }
}

export const isSettled = (offset: number, velocity: number) =>
  Math.abs(offset) < SETTLE_DISTANCE && Math.abs(velocity) < SETTLE_SPEED

export const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Pulls `from` back to the origin with the spring. Returns a cancel function. */
export function runSpring(
  from: Point,
  onFrame: (point: Point) => void,
  onDone: () => void,
  damping: number = SPRING.damping,
): () => void {
  let x = from.x
  let y = from.y
  let vx = 0
  let vy = 0
  let last = performance.now()
  let raf = 0
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS)
    last = now
    const stepX = springStep(x, vx, dt, damping)
    const stepY = springStep(y, vy, dt, damping)
    x = stepX.offset
    vx = stepX.velocity
    y = stepY.offset
    vy = stepY.velocity
    if (isSettled(x, vx) && isSettled(y, vy)) {
      onFrame({ x: 0, y: 0 })
      onDone()
      return
    }
    onFrame({ x, y })
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

/** localStorage can throw (private mode, blocked site data), so the layout must work without it. */
export function readStored<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Position is a convenience only; ignore storage failures.
  }
}

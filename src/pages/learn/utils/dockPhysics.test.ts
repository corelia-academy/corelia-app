// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import { clamp, isSettled, readStored, rubberBand, runSpring, springStep, writeStored } from "./dockPhysics"

const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage")

function setStorage(storage: Partial<Storage> | (() => never)) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: typeof storage === "function" ? storage : () => storage,
  })
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(window, "localStorage", originalStorage)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("runSpring", () => {
  function fakeFrames() {
    let now = 0
    const queue: FrameRequestCallback[] = []
    vi.spyOn(performance, "now").mockImplementation(() => now)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback))
    const cancel = vi.fn()
    vi.stubGlobal("cancelAnimationFrame", cancel)
    const run = (maxFrames = 2000) => {
      for (let i = 0; i < maxFrames && queue.length > 0; i += 1) {
        now += 16
        queue.shift()!(now)
      }
    }
    return { run, cancel, pending: () => queue.length }
  }

  it("pulls both axes back to the origin, ending exactly there and calling onDone once", () => {
    const frames = fakeFrames()
    const points: Array<{ x: number; y: number }> = []
    const onDone = vi.fn()
    runSpring({ x: 80, y: -120 }, point => points.push(point), onDone)
    frames.run()

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(points.at(-1)).toEqual({ x: 0, y: 0 })
    expect(frames.pending()).toBe(0)
    expect(Math.abs(points[0].x)).toBeLessThan(80)
  })

  it("overshoots less when run with a higher damping", () => {
    const deepestOvershoot = (damping: number) => {
      const frames = fakeFrames()
      let deepest = 0
      runSpring({ x: 300, y: 0 }, point => { deepest = Math.min(deepest, point.x) }, vi.fn(), damping)
      frames.run()
      return Math.abs(deepest)
    }

    expect(deepestOvershoot(22)).toBeLessThan(deepestOvershoot(14))
  })

  it("stops scheduling frames after cancel", () => {
    const frames = fakeFrames()
    const cancel = runSpring({ x: 80, y: 0 }, vi.fn(), vi.fn())
    cancel()

    expect(frames.cancel).toHaveBeenCalledTimes(1)
  })
})

describe("rubberBand", () => {
  it("grows with the pull but never reaches the resistance limit", () => {
    const small = rubberBand(20)
    const large = rubberBand(2000)
    expect(small).toBeGreaterThan(0)
    expect(large).toBeGreaterThan(small)
    expect(large).toBeLessThan(110)
  })

  it("does not move when pulled the other way", () => {
    expect(rubberBand(0)).toBe(0)
    expect(rubberBand(-50)).toBe(0)
  })
})

describe("clamp", () => {
  it("keeps the value inside the range", () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe("springStep", () => {
  it("pulls an offset back to the origin and settles", () => {
    let offset = 80
    let velocity = 0
    for (let i = 0; i < 600; i += 1) {
      const next = springStep(offset, velocity, 1 / 60)
      offset = next.offset
      velocity = next.velocity
    }
    expect(isSettled(offset, velocity)).toBe(true)
  })

  it("overshoots less with a higher damping", () => {
    const deepestOvershoot = (damping: number) => {
      let offset = 300
      let velocity = 0
      let deepest = 0
      for (let i = 0; i < 600; i += 1) {
        const next = springStep(offset, velocity, 1 / 60, damping)
        offset = next.offset
        velocity = next.velocity
        deepest = Math.min(deepest, offset)
      }
      return Math.abs(deepest)
    }

    expect(deepestOvershoot(22)).toBeLessThan(deepestOvershoot(17))
    expect(deepestOvershoot(17)).toBeLessThan(deepestOvershoot(14))
  })

  it("overshoots the origin before settling", () => {
    let offset = 80
    let velocity = 0
    let crossed = false
    for (let i = 0; i < 600; i += 1) {
      const next = springStep(offset, velocity, 1 / 60)
      offset = next.offset
      velocity = next.velocity
      if (offset < 0) crossed = true
    }
    expect(crossed).toBe(true)
  })
})

describe("stored position", () => {
  it("round-trips a value and removes it when null", () => {
    const data = new Map<string, string>()
    setStorage({
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    })

    writeStored("k", { x: 0.1 })
    expect(readStored<{ x: number }>("k")).toEqual({ x: 0.1 })
    writeStored("k", null)
    expect(readStored("k")).toBeNull()
  })

  it("survives a storage that throws", () => {
    setStorage(() => {
      throw new Error("blocked")
    })
    expect(readStored("k")).toBeNull()
    expect(() => writeStored("k", 1)).not.toThrow()
  })
})

// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CourseLesson } from "@/types/courses"

import { LessonCurriculum, type CurriculumGroup } from "./LessonCurriculum"

const gsapMocks = vi.hoisted(() => ({
  set: vi.fn(),
  to: vi.fn(),
  fromTo: vi.fn(),
  killTweensOf: vi.fn(),
}))

vi.mock("gsap", () => ({ gsap: gsapMocks }))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const lesson = (id: string, sectionId: string) =>
  ({ id, section_id: sectionId, title: `Lesson ${id}`, duration_seconds: 900, lesson_format: "video", order: 0, published: true }) as unknown as CourseLesson

const groups: CurriculumGroup[] = ["s1", "s2"].map((id, index) => ({
  section: { id, title: `Section ${id}`, order: index },
  lessons: [lesson(`${id}-a`, id), lesson(`${id}-b`, id)],
}))

async function mount() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LessonCurriculum
          courseId="course"
          groups={groups}
          visibleSectionCount={2}
          visibleLessonsCount={4}
          sortedLessonsCount={4}
          currentLessonTitle={null}
          currentLessonId={null}
          progressPercent={0}
          completedIds={new Set()}
          completedCount={0}
          lessonTotal={4}
          nextLessonTitle={null}
          hasFullCourseAccess
          translate={key => key}
          variant="sidebar"
        />
      </MemoryRouter>,
    ),
  )
}

const headers = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"))
const regionOf = (header: HTMLButtonElement) => document.getElementById(header.getAttribute("aria-controls")!)!
const toggle = (header: HTMLButtonElement) => act(async () => header.click())

beforeEach(() => {
  setReducedMotion(false)
  for (const mock of Object.values(gsapMocks)) mock.mockReset()
  // Apply what the real gsap.set would write, so the DOM state can be asserted.
  gsapMocks.set.mockImplementation((element: HTMLElement, vars: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(vars)) {
      if (name === "clearProps") String(value).split(",").forEach(property => element.style.removeProperty(property))
      else element.style.setProperty(name, String(value))
    }
  })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("CurriculumSection open and close", () => {
  it("does not animate on the first render", async () => {
    await mount()

    expect(gsapMocks.to).not.toHaveBeenCalled()
    expect(gsapMocks.fromTo).not.toHaveBeenCalled()
    expect(gsapMocks.set).not.toHaveBeenCalled()
  })

  it("links each header to the region it controls", async () => {
    await mount()
    const [first, second] = headers()

    expect(first.getAttribute("aria-expanded")).toBe("true")
    expect(regionOf(first)).not.toBeNull()
    expect(regionOf(first).id).not.toBe(regionOf(second).id)
    expect(regionOf(first).hasAttribute("inert")).toBe(false)
  })

  it("keeps the lessons in the DOM when a section is closed", async () => {
    setReducedMotion(true)
    await mount()
    const [first] = headers()
    await toggle(first)

    expect(regionOf(first).querySelectorAll("a")).toHaveLength(2)
  })

  it("collapses the height to zero and hides the region once the close tween completes", async () => {
    await mount()
    const [first] = headers()
    await toggle(first)

    expect(gsapMocks.killTweensOf).toHaveBeenCalledWith(regionOf(first))
    expect(first.getAttribute("aria-expanded")).toBe("false")
    expect(regionOf(first).hasAttribute("inert")).toBe(true)
    expect(gsapMocks.to).toHaveBeenCalledTimes(1)
    const [target, vars] = gsapMocks.to.mock.calls[0]
    expect(target).toBe(regionOf(first))
    expect(vars).toMatchObject({ height: 0 })
    expect(regionOf(first).style.display).toBe("block")

    act(() => vars.onComplete())
    expect(regionOf(first).style.display).toBe("none")
  })

  it("expands from zero to auto and clears the inline styles when reopened", async () => {
    await mount()
    const [first] = headers()
    await toggle(first)
    gsapMocks.to.mockClear()
    await toggle(first)

    expect(first.getAttribute("aria-expanded")).toBe("true")
    expect(regionOf(first).hasAttribute("inert")).toBe(false)
    expect(gsapMocks.fromTo).toHaveBeenCalledTimes(1)
    const [target, from, to] = gsapMocks.fromTo.mock.calls[0]
    expect(target).toBe(regionOf(first))
    expect(from).toEqual({ height: 0 })
    expect(to).toMatchObject({ height: "auto", clearProps: "display,height,overflow" })
  })

  it("only touches the section that was clicked", async () => {
    await mount()
    const [first, second] = headers()
    await toggle(first)

    expect(second.getAttribute("aria-expanded")).toBe("true")
    expect(regionOf(second).hasAttribute("inert")).toBe(false)
    expect(gsapMocks.to.mock.calls.every(([target]) => target === regionOf(first))).toBe(true)
  })

  it("skips the tween and switches instantly when reduced motion is preferred", async () => {
    setReducedMotion(true)
    await mount()
    const [first] = headers()

    await toggle(first)
    expect(gsapMocks.to).not.toHaveBeenCalled()
    expect(regionOf(first).style.display).toBe("none")
    expect(regionOf(first).hasAttribute("inert")).toBe(true)

    await toggle(first)
    expect(gsapMocks.fromTo).not.toHaveBeenCalled()
    expect(regionOf(first).style.display).toBe("")
    expect(regionOf(first).hasAttribute("inert")).toBe(false)
  })
})

"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { useLayoutEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type DashPattern = {
  dashLength: number
  gapLength: number
}

type DashMetrics = {
  width: number
  height: number
  borderTop: number
  borderLeft: number
  borderWidth: number
  radius: number
  color: string
}

type SeparatorProps = SeparatorPrimitive.Props & {
  variant?: "solid" | "dashed"
  shape?: "line" | "frame"
  dashPattern?: DashPattern
}

function Separator({
  className,
  orientation = "horizontal",
  variant = "solid",
  shape = "line",
  dashPattern,
  style,
  ...props
}: SeparatorProps) {
  const isVertical = orientation === "vertical"
  const isFrame = shape === "frame"
  const isValidDashPattern =
    dashPattern !== undefined &&
    Number.isFinite(dashPattern.dashLength) &&
    dashPattern.dashLength > 0 &&
    Number.isFinite(dashPattern.gapLength) &&
    dashPattern.gapLength > 0
  const usesCustomDashPattern = variant === "dashed" && isValidDashPattern
  const separatorRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const frameRef = useRef<SVGRectElement>(null)
  const lineRef = useRef<SVGPathElement>(null)
  const dashLength = dashPattern?.dashLength
  const gapLength = dashPattern?.gapLength
  const geometryClassName = isFrame
    ? "h-full w-full border"
    : isVertical
      ? "self-stretch w-px border-s"
      : "h-px w-full border-t"

  useLayoutEffect(() => {
    if (!usesCustomDashPattern || dashLength === undefined || gapLength === undefined) return

    const element = separatorRef.current
    const svg = svgRef.current
    if (!element || !svg) return

    const updatePattern = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const previousBorderColor = element.style.borderColor
      element.style.borderColor = ""
      const computedStyle = window.getComputedStyle(element)
      const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0
      const borderLeft = Number.parseFloat(computedStyle.borderLeftWidth) || 0
      const borderWidth = Number.parseFloat(
        isFrame
          ? computedStyle.borderTopWidth
          : isVertical
            ? computedStyle.borderLeftWidth
            : computedStyle.borderTopWidth,
      ) || 0
      const metrics: DashMetrics = {
        width: rect.width,
        height: rect.height,
        borderTop,
        borderLeft,
        borderWidth,
        radius: Number.parseFloat(computedStyle.borderTopLeftRadius) || 0,
        color:
          typeof style?.borderColor === "string"
            ? style.borderColor
            : computedStyle.borderTopColor,
      }
      element.style.borderColor = previousBorderColor

      if (metrics.borderWidth <= 0) {
        svg.style.display = "none"
        return
      }

      svg.style.display = ""
      svg.setAttribute("width", String(metrics.width))
      svg.setAttribute("height", String(metrics.height))
      svg.setAttribute("viewBox", `0 0 ${metrics.width} ${metrics.height}`)
      svg.style.left = `${-metrics.borderLeft}px`
      svg.style.top = `${-metrics.borderTop}px`
      svg.style.width = `${metrics.width}px`
      svg.style.height = `${metrics.height}px`

      const shape = isFrame ? frameRef.current : lineRef.current
      if (!shape) return

      shape.setAttribute("stroke", metrics.color)
      shape.setAttribute("stroke-width", String(metrics.borderWidth))
      shape.setAttribute("stroke-dasharray", `${dashLength} ${gapLength}`)

      if (isFrame) {
        shape.setAttribute("x", String(metrics.borderWidth / 2))
        shape.setAttribute("y", String(metrics.borderWidth / 2))
        shape.setAttribute("width", String(metrics.width - metrics.borderWidth))
        shape.setAttribute("height", String(metrics.height - metrics.borderWidth))
        shape.setAttribute(
          "rx",
          String(Math.max(0, metrics.radius - metrics.borderWidth / 2)),
        )
      } else {
        shape.setAttribute(
          "d",
          isVertical
            ? `M ${metrics.width / 2} 0 V ${metrics.height}`
            : `M 0 ${metrics.height / 2} H ${metrics.width}`,
        )
      }
    }

    updatePattern()
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(updatePattern)
    if (resizeObserver) {
      resizeObserver.observe(element)
    } else {
      window.addEventListener("resize", updatePattern)
    }

    return () => {
      if (!resizeObserver) window.removeEventListener("resize", updatePattern)
      resizeObserver?.disconnect()
    }
  }, [
    className,
    dashLength,
    gapLength,
    isFrame,
    isVertical,
    style?.borderColor,
    usesCustomDashPattern,
  ])

  return (
    <SeparatorPrimitive
      ref={separatorRef}
      data-slot="separator"
      data-dash-pattern={
        usesCustomDashPattern
          ? `${dashLength} ${gapLength}`
          : undefined
      }
      orientation={orientation}
      className={cn(
        "pointer-events-none select-none shrink-0 border-border",
        usesCustomDashPattern && "relative",
        geometryClassName,
        variant === "dashed" ? "border-dashed" : "border-solid",
        className
      )}
      {...props}
      style={
        usesCustomDashPattern
          ? { ...style, borderColor: "transparent" }
          : style
      }
      aria-hidden={isFrame ? true : props["aria-hidden"]}
    >
      {usesCustomDashPattern ? (
        <svg
          ref={svgRef}
          aria-hidden="true"
          data-slot="separator-dash-pattern"
          className="pointer-events-none absolute"
          style={{ left: 0, top: 0, width: "100%", height: "100%" }}
        >
          {isFrame ? (
            <rect
              ref={frameRef}
              fill="none"
            />
          ) : (
            <path
              ref={lineRef}
              fill="none"
            />
          )}
        </svg>
      ) : null}
    </SeparatorPrimitive>
  )
}

/*
  orientation="horizontal": đường ngang, đây là giá trị mặc định.
  orientation="vertical": đường dọc.
  variant="solid": nét liền, mặc định.
  variant="dashed": nét đứt.
  dashPattern={{ dashLength: 6, gapLength: 4 }}: chỉ chỉnh mẫu gạch khi variant="dashed".
*/

export { Separator }

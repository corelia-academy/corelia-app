import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StepperStepState = "Default" | "Focused" | "Passed" | "Error";
export type StepperOrientation = "Horizontal" | "Vertical";
export type StepperStyle = "Text" | "Icon";

export type StepperStep = {
  id?: string;
  title: ReactNode;
  caption?: ReactNode;
  state?: StepperStepState;
  stateLabel?: string;
};

type StepperProps = Omit<HTMLAttributes<HTMLOListElement>, "children"> & {
  steps: readonly StepperStep[];
  orientation?: StepperOrientation;
  markerStyle?: StepperStyle;
  animated?: boolean;
};

const markerAssets: Record<StepperStepState, string> = {
  Default: new URL("../../assets/ui/stepper/step-default.png", import.meta.url).href,
  Focused: new URL("../../assets/ui/stepper/step-focused.png", import.meta.url).href,
  Passed: new URL("../../assets/ui/stepper/step-passed.png", import.meta.url).href,
  Error: new URL("../../assets/ui/stepper/step-error.png", import.meta.url).href,
};

function getConnectorClass(
  before: StepperStep | undefined,
  after: StepperStep | undefined,
  beforeIndex: number,
) {
  if (before?.state === "Error" || after?.state === "Error") {
    return "bg-[var(--error-500)]";
  }

  if (
    before?.state === "Passed" ||
    after?.state === "Passed" ||
    after?.state === "Focused" ||
    (beforeIndex === 0 && before?.state === "Focused")
  ) {
    return "bg-[var(--neutral-400)]";
  }

  return "bg-[rgba(250,251,251,0.2)]";
}

function StepMarker({
  index,
  state,
  style,
  animated,
}: {
  index: number;
  state: StepperStepState;
  style: StepperStyle;
  animated: boolean;
}) {
  const usesFigmaIcon = style === "Icon" || state === "Passed" || state === "Error";
  const markerBackground = state === "Focused"
    ? "bg-[var(--neutral-50)]"
    : state === "Error"
      ? "bg-[var(--error-400)]"
      : "bg-[var(--neutral-700)]";
  const numberColor = state === "Focused"
    ? "text-[var(--neutral-900)]"
    : "text-[var(--neutral-400)]";
  const focusRingColor = style === "Icon"
    ? "border-[var(--neutral-700)]"
    : "border-[var(--neutral-500)]";
  const ringColor = state === "Focused"
    ? focusRingColor
    : state === "Passed"
      ? "border-[var(--success-600)]"
      : "border-[var(--error-500)]";
  const hasRing = state !== "Default";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
        !usesFigmaIcon && markerBackground,
        animated && "transition-colors duration-300 ease-out motion-reduce:transition-none",
      )}
      data-slot="stepper-marker"
      data-state={state}
    >
      {usesFigmaIcon ? (
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <img
            alt=""
            className={cn(
              "absolute max-w-none",
              state === "Default" ? "inset-0 size-full" : "-left-1.5 -top-1.5 size-9",
            )}
            src={markerAssets[state]}
          />
        </span>
      ) : (
        <span
          className={cn(
            "relative font-medium text-xs leading-4 tracking-[-0.28px]",
            numberColor,
          )}
        >
          {index + 1}
        </span>
      )}
      {hasRing ? (
        <span
          className={cn(
            "pointer-events-none absolute -inset-[6px] rounded-full border-[3px]",
            ringColor,
            animated && "transition-colors duration-300 ease-out motion-reduce:transition-none",
          )}
        />
      ) : null}
    </span>
  );
}

export function Stepper({
  className,
  steps,
  orientation = "Horizontal",
  markerStyle = "Text",
  animated = false,
  ...props
}: StepperProps) {
  const isHorizontal = orientation === "Horizontal";

  return (
    <ol
      {...props}
      className={cn(
        "flex w-full",
        isHorizontal ? "items-start" : "flex-col",
        className,
      )}
      data-orientation={orientation}
      data-slot="stepper"
      data-style={markerStyle}
    >
      {steps.map((step, index) => {
        const state = step.state ?? "Default";
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;
        const before = steps[index - 1];
        const after = steps[index + 1];
        const beforeClass = getConnectorClass(before, step, index - 1);
        const afterClass = getConnectorClass(step, after, index);
        const lineMotion = animated
          ? "transition-colors duration-300 ease-out motion-reduce:transition-none"
          : "";

        return (
          <li
            key={step.id ?? index}
            aria-current={state === "Focused" ? "step" : undefined}
            className={cn(
              "min-w-0",
              isHorizontal
                ? "flex flex-1 flex-col items-center gap-2"
                : "flex min-h-[82px] w-full items-center gap-2",
            )}
            data-state={state}
            data-step-index={index}
          >
            {step.stateLabel ? <span className="sr-only">{step.stateLabel}</span> : null}
            <div
              className={cn(
                "flex shrink-0",
                isHorizontal
                  ? "w-full items-center gap-2"
                  : "h-[82px] flex-col items-center justify-center gap-2",
              )}
              data-slot="stepper-track"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "min-w-px",
                  isHorizontal ? "h-[2px] flex-1" : "w-[2px] flex-1",
                  !isFirst && beforeClass,
                  lineMotion,
                )}
                data-slot="stepper-connector-before"
              />
              <StepMarker
                animated={animated}
                index={index}
                state={state}
                style={markerStyle}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "min-w-px",
                  isHorizontal ? "h-[2px] flex-1" : "w-[2px] flex-1",
                  !isLast && afterClass,
                  lineMotion,
                )}
                data-slot="stepper-connector-after"
              />
            </div>
            <div
              className={cn(
                "min-w-0",
                isHorizontal
                  ? "w-full px-2 text-center"
                  : "flex-1 px-2",
              )}
              data-slot="stepper-content"
            >
              <div className="truncate font-[var(--font-display)] text-sm font-semibold leading-5 tracking-[0.14px] text-[var(--neutral-200)]">
                {step.title}
              </div>
              {step.caption ? (
                <div className="mt-0.5 truncate font-[var(--font-body)] text-[10px] leading-[1.2] tracking-[0.2px] text-[var(--neutral-400)]">
                  {step.caption}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import type { HTMLAttributes, ReactNode } from "react";

import { Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type StepperStepState = "Default" | "Focused" | "Passed" | "Error";
export type StepperOrientation = "Horizontal" | "Vertical";
export type StepperStyle = "Text" | "Icon";
export type StepperConnectorState = "Default" | "Active" | "Error";

export type StepperStep = {
  id?: string;
  title: ReactNode;
  caption?: ReactNode;
  state?: StepperStepState;
  stateLabel?: string;
  icon?: ReactNode;
  connectorBefore?: StepperConnectorState;
  connectorAfter?: StepperConnectorState;
};

type StepperProps = Omit<HTMLAttributes<HTMLOListElement>, "children"> & {
  steps: readonly StepperStep[];
  orientation?: StepperOrientation;
  markerStyle?: StepperStyle;
  animated?: boolean;
};

function getConnectorClass(state: StepperConnectorState = "Default") {
  if (state === "Error") {
    return "bg-[var(--stepper-connector-error)]";
  }

  if (state === "Active") {
    return "bg-[var(--stepper-connector-active)]";
  }

  return "bg-[var(--stepper-connector-default)]";
}

function StepMarker({
  index,
  icon,
  state,
  style,
  animated,
}: {
  index: number;
  icon?: ReactNode;
  state: StepperStepState;
  style: StepperStyle;
  animated: boolean;
}) {
  const markerBackground = state === "Focused"
    ? "bg-stepper-focused-surface"
    : state === "Error"
      ? "bg-stepper-error-surface"
      : "bg-[var(--neutral-700)]";
  const markerContentColor = state === "Focused"
    ? "text-stepper-focused-content"
    : state === "Default" && style === "Icon"
      ? "text-stepper-default-icon-content"
      : "text-stepper-default-content";
  const markerContent = style === "Icon" ? icon ?? index + 1 : index + 1;
  const focusRingColor = "border-stepper-focused-ring";
  const ringColor = state === "Focused"
    ? focusRingColor
    : state === "Passed"
      ? "border-stepper-passed-outline"
      : "border-stepper-error-outline";
  const hasRing = state !== "Default";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
        state === "Focused" && "text-stepper-focused-content",
        state !== "Error" && state !== "Passed" && markerBackground,
        animated && "transition-colors duration-300 ease-out motion-reduce:transition-none",
      )}
      data-slot="stepper-marker"
      data-state={state}
    >
      {state === "Passed" ? (
        <span
          role="img"
          aria-label="Completed"
          className="relative inline-flex size-6 shrink-0"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 block size-full overflow-visible text-[var(--stepper-passed-surface)]"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="stroke-stepper-passed-outline"
              cx="12"
              cy="12"
              r="16.5"
              fill="none"
              strokeWidth={3}
            />
            <circle cx="12" cy="12" r="12" fill="currentColor" />
            <g
              className="text-[var(--progress-circle-icon)]"
              transform="translate(-0.25 -0.25)"
            >
              <path
                d="M18.8538 9.32875L10.8288 17.3537C10.7824 17.4002 10.7272 17.4371 10.6666 17.4623C10.6059 17.4874 10.5408 17.5004 10.4751 17.5004C10.4094 17.5004 10.3443 17.4874 10.2836 17.4623C10.2229 17.4371 10.1678 17.4002 10.1213 17.3537L5.64633 12.8537C5.55263 12.76 5.5 12.6329 5.5 12.5003C5.5 12.3678 5.55263 12.2406 5.64633 12.1469L7.14633 10.6469C7.19277 10.6004 7.24791 10.5635 7.30861 10.5383C7.36931 10.5132 7.43437 10.5002 7.50008 10.5002C7.56579 10.5002 7.63085 10.5132 7.69155 10.5383C7.75225 10.5635 7.80739 10.6004 7.85383 10.6469L10.5001 13.2144L16.6463 7.14625C16.6928 7.09976 16.7479 7.06288 16.8086 7.03772C16.8693 7.01255 16.9344 6.9996 17.0001 6.9996C17.0658 6.9996 17.1309 7.01255 17.1916 7.03772C17.2523 7.06288 17.3074 7.09976 17.3538 7.14625L18.8538 8.62125C18.9003 8.66768 18.9372 8.72283 18.9624 8.78353C18.9875 8.84423 19.0005 8.90929 19.0005 8.975C19.0005 9.0407 18.9875 9.10577 18.9624 9.16647C18.9372 9.22717 18.9004 9.28231 18.8538 9.32875Z"
                fill="currentColor"
              />
              <path
                d="M19.2049 8.26499L17.7049 6.79249C17.5175 6.60567 17.2636 6.50076 16.999 6.50076C16.7343 6.50076 16.4805 6.60567 16.293 6.79249L10.4999 12.5144L8.20677 10.2894C8.01895 10.1031 7.76499 9.99892 7.5005 9.99951C7.23601 10.0001 6.98252 10.1054 6.79552 10.2925L5.29552 11.7925C5.10832 11.98 5.00317 12.2341 5.00317 12.4991C5.00317 12.764 5.10832 13.0181 5.29552 13.2056L9.77177 17.7056C9.86463 17.7985 9.97488 17.8722 10.0962 17.9224C10.2176 17.9727 10.3476 17.9986 10.479 17.9986C10.6103 17.9986 10.7404 17.9727 10.8617 17.9224C10.983 17.8722 11.0933 17.7985 11.1861 17.7056L19.208 9.68186C19.3011 9.58875 19.3748 9.47818 19.4251 9.3565C19.4753 9.23482 19.501 9.10442 19.5007 8.97278C19.5004 8.84114 19.4741 8.71085 19.4234 8.58939C19.3726 8.46793 19.2984 8.35769 19.2049 8.26499ZM10.4761 17L5.9999 12.5L7.4999 11C7.50172 11.0015 7.50339 11.0032 7.5049 11.005L10.1518 13.5731C10.2452 13.6645 10.3707 13.7157 10.5015 13.7157C10.6322 13.7157 10.7577 13.6645 10.8511 13.5731L17.0036 7.49999L18.4999 8.97499L10.4761 17Z"
                fill="currentColor"
              />
            </g>
          </svg>
        </span>
      ) : state === "Error" ? (
        <svg
          aria-hidden="true"
          className={cn(
            "absolute inset-0 block size-full overflow-visible",
            animated && "transition-colors duration-300 ease-out motion-reduce:transition-none",
          )}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="16.5"
            fill="none"
            stroke="var(--stepper-error-outline)"
            strokeWidth={3}
          />
          <circle cx="12" cy="12" r="12" fill="var(--stepper-error-surface)" />
          <Warning
            x={4}
            y={4}
            width={16}
            height={16}
            className="text-[var(--stepper-error-icon)]"
            weight="duotone"
          />
        </svg>
      ) : (
        <span
          className={cn(
            "relative font-medium text-xs leading-4 tracking-[-0.28px]",
            markerContentColor,
          )}
        >
          {markerContent}
        </span>
      )}
      {hasRing && state !== "Passed" && state !== "Error" ? (
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
        const beforeClass = getConnectorClass(step.connectorBefore);
        const afterClass = getConnectorClass(step.connectorAfter);
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
                icon={step.icon}
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
              <div className="truncate font-[var(--font-display)] text-sm font-semibold leading-5 tracking-[0.14px] text-[var(--stepper-title)]">
                {step.title}
              </div>
              {step.caption ? (
                <div className="mt-0.5 truncate font-[var(--font-body)] text-[10px] leading-[1.2] tracking-[0.2px] text-[var(--stepper-caption)]">
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

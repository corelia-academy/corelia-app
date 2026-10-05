import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ProgressLevel = "None" | "Low" | "Medium" | "Good" | "Done";
export type ProgressTheme = "Neutral" | "Accent" | "Status";
export type ProgressCircleColorVariant = "Default" | "90" | "70" | "50" | "40" | "30" | "10";

type ProgressBarProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  animated?: boolean;
  label?: boolean;
  progress?: number;
  statusLevel?: Exclude<ProgressLevel, "None">;
  text?: string;
  theme?: ProgressTheme;
};

type LessonProgressBarProps = Omit<ProgressBarProps, "theme">;

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

const statusFillColorClasses: Record<Exclude<ProgressLevel, "None">, string> = {
  Low: "bg-[var(--progress-status-low)]",
  Medium: "bg-[var(--progress-status-medium)]",
  Good: "bg-[var(--progress-status-good)]",
  Done: "bg-[var(--progress-status-done)]",
};

function getProgressFillColorClass(
  theme: ProgressTheme,
  statusLevel: Exclude<ProgressLevel, "None">,
) {
  if (theme === "Neutral") return "bg-[var(--progress-neutral-fill)]";
  if (theme === "Accent") return "bg-[var(--progress-accent-fill)]";
  return statusFillColorClasses[statusLevel];
}

function ProgressBarBase(
  {
    className,
    animated = false,
    label = true,
    progress = 100,
    statusLevel = "Done",
    text = "Label",
    theme = "Neutral",
    "aria-label": ariaLabel,
    ...props
  }: ProgressBarProps,
  compact: boolean,
) {
  const value = clampProgress(progress);
  const fillColorClass = getProgressFillColorClass(theme, statusLevel);

  return (
    <div
      {...props}
      role="progressbar"
      aria-label={ariaLabel ?? text}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn(
        "relative inline-flex max-w-full shrink-0 items-center gap-2",
        compact ? "h-[15px] w-[252px]" : "h-5 w-[376px] text-foreground",
        className,
      )}
      data-progress={value}
      data-status-level={theme === "Status" ? statusLevel : undefined}
      data-size={compact ? "compact" : "standard"}
      data-slot={compact ? "lesson-progress-bar" : "progress-bar"}
      data-theme={theme}
    >
      <div
        aria-hidden="true"
        className={cn(
          "relative block min-w-0 overflow-hidden bg-[var(--progress-track)]",
          compact
            ? "h-1 w-[210px] flex-[0_1_210px] rounded-none"
            : "h-2 w-[328px] flex-[0_1_328px] rounded-full",
        )}
        data-slot="progress-bar-track"
      >
        {value > 0 || animated ? (
          <div
            className={cn(
              "absolute inset-y-0 start-0 rounded-[inherit]",
              fillColorClass,
              animated &&
                "transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none",
            )}
            data-slot="progress-bar-fill"
            style={{ width: value + "%" }}
          />
        ) : null}
      </div>
      {label ? (
        <span
          aria-hidden="true"
          className={cn(
            "box-border inline-flex shrink-0 items-center justify-center overflow-hidden text-center whitespace-nowrap font-[var(--font-body)]",
            compact
              ? "h-[15px] w-[34px] flex-[0_0_34px] text-xs leading-[1.25] text-[var(--foreground-muted)]"
              : "h-5 w-10 flex-[0_0_40px] text-sm leading-[1.4] tracking-[0.02em] text-foreground",
          )}
          data-slot="progress-bar-label"
        >
          {text}
        </span>
      ) : null}
    </div>
  );
}

export function ProgressBar(props: ProgressBarProps) {
  return ProgressBarBase(props, false);
}

export function LessonProgressBar(props: LessonProgressBarProps) {
  return ProgressBarBase({ ...props, theme: "Accent" }, true);
}

type ProgressCircleProps = Omit<HTMLAttributes<HTMLSpanElement>, "aria-label"> & {
  "aria-label": string;
  colored?: boolean;
  done?: boolean;
  failed?: boolean;
  percentage?: number;
  colorVariant?: ProgressCircleColorVariant;
  process?: boolean;
};

const progressCircleColorClasses: Record<ProgressCircleColorVariant, string> = {
  Default: "text-[var(--progress-neutral)]",
  "90": "text-[var(--progress-circle-success)]",
  "70": "text-[var(--progress-circle-blue)]",
  "50": "text-[var(--progress-circle-purple)]",
  "40": "text-[var(--progress-circle-sky)]",
  "30": "text-[var(--progress-circle-yellow)]",
  "10": "text-[var(--progress-circle-neutral)]",
};

const progressCircleRingColorClasses: Record<ProgressCircleColorVariant, string> = {
  Default: "text-[var(--progress-circle-ring-default)]",
  "90": "text-[var(--progress-circle-ring-success)]",
  "70": "text-[var(--progress-circle-ring-blue)]",
  "50": "text-[var(--progress-circle-ring-purple)]",
  "40": "text-[var(--progress-circle-ring-sky)]",
  "30": "text-[var(--progress-circle-ring-yellow)]",
  "10": "text-[var(--progress-circle-ring-neutral)]",
};

function getProgressSectorPath(value: number) {
  const radius = 7.2;
  const endAngle = (value / 100) * Math.PI * 2 - Math.PI / 2;
  const endX = 12 + radius * Math.cos(endAngle);
  const endY = 12 + radius * Math.sin(endAngle);
  const largeArcFlag = value > 50 ? 1 : 0;

  return [
    "M 12 12",
    "L 12 4.8",
    "A 7.2 7.2 0",
    largeArcFlag,
    "1",
    endX.toFixed(3),
    endY.toFixed(3),
    "Z",
  ].join(" ");
}

export function ProgressCircle({
  className,
  colored = false,
  done = false,
  failed = false,
  percentage = 100,
  colorVariant = "Default",
  process = false,
  "aria-label": ariaLabel,
  ...props
}: ProgressCircleProps) {
  const isColored = process && colored;
  const isFilled = done || failed;
  const state = failed ? "failed" : done ? "done" : process ? "process" : "default";
  const value = done ? 100 : clampProgress(percentage);
  const circleColorClass = failed
    ? "text-[var(--progress-circle-error)]"
    : done && colorVariant === "Default"
      ? "text-[var(--progress-circle-success)]"
      : done && colorVariant === "10"
        ? "text-[var(--progress-circle-done-neutral)]"
        : isColored || done
          ? progressCircleColorClasses[colorVariant]
          : progressCircleColorClasses.Default;
  const ringColorClass =
    progressCircleRingColorClasses[isColored ? colorVariant : "Default"];
  const doneIconColorClass =
    colorVariant === "30" || colorVariant === "40"
      ? "text-[var(--progress-circle-icon-on-bright)]"
      : "text-[var(--progress-circle-icon)]";

  return (
    <span
      {...props}
      role="img"
      aria-label={ariaLabel}
      className={cn("relative inline-flex size-6 shrink-0", circleColorClass, className)}
      data-colored={isColored ? "true" : "false"}
      data-percentage={value}
      data-color-variant={colorVariant}
      data-slot="progress-circle"
      data-state={state}
    >
      <svg
        aria-hidden="true"
        className="block size-full overflow-visible"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {isFilled ? (
          <circle cx="12" cy="12" r="12" fill="currentColor" />
        ) : (
          <>
            <circle
              cx="12"
              cy="12"
              r="10.8"
              stroke="currentColor"
              strokeWidth="2.4"
              className={ringColorClass}
            />
            {process && value > 0 ? (
              value >= 100 ? (
                <circle
                  cx="12"
                  cy="12"
                  r="7.2"
                  fill="currentColor"
                  className={circleColorClass}
                />
              ) : (
                <path
                  d={getProgressSectorPath(value)}
                  fill="currentColor"
                  className={circleColorClass}
                />
              )
            ) : null}
          </>
        )}
      </svg>
      {done ? (
        <svg
          aria-hidden="true"
          className={cn("absolute inset-0 block size-full", doneIconColorClass)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M18.8538 9.32875L10.8288 17.3537C10.7824 17.4002 10.7272 17.4371 10.6666 17.4623C10.6059 17.4874 10.5408 17.5004 10.4751 17.5004C10.4094 17.5004 10.3443 17.4874 10.2836 17.4623C10.2229 17.4371 10.1678 17.4002 10.1213 17.3537L5.64633 12.8537C5.55263 12.76 5.5 12.6329 5.5 12.5003C5.5 12.3678 5.55263 12.2406 5.64633 12.1469L7.14633 10.6469C7.19277 10.6004 7.24791 10.5635 7.30861 10.5383C7.36931 10.5132 7.43437 10.5002 7.50008 10.5002C7.56579 10.5002 7.63085 10.5132 7.69155 10.5383C7.75225 10.5635 7.80739 10.6004 7.85383 10.6469L10.5001 13.2144L16.6463 7.14625C16.6928 7.09976 16.7479 7.06288 16.8086 7.03772C16.8693 7.01255 16.9344 6.9996 17.0001 6.9996C17.0658 6.9996 17.1309 7.01255 17.1916 7.03772C17.2523 7.06288 17.3074 7.09976 17.3538 7.14625L18.8538 8.62125C18.9003 8.66768 18.9372 8.72283 18.9624 8.78353C18.9875 8.84423 19.0005 8.90929 19.0005 8.975C19.0005 9.0407 18.9875 9.10577 18.9624 9.16647C18.9372 9.22717 18.9003 9.28231 18.8538 9.32875Z"
            fill="currentColor"
          />
          <path
            d="M19.2049 8.26499L17.7049 6.79249C17.5175 6.60567 17.2636 6.50076 16.999 6.50076C16.7343 6.50076 16.4805 6.60567 16.293 6.79249L10.4999 12.5144L8.20677 10.2894C8.01895 10.1031 7.76499 9.99892 7.5005 9.99951C7.23601 10.0001 6.98252 10.1054 6.79552 10.2925L5.29552 11.7925C5.10832 11.98 5.00317 12.2341 5.00317 12.4991C5.00317 12.764 5.10832 13.0181 5.29552 13.2056L9.77177 17.7056C9.86463 17.7985 9.97488 17.8722 10.0962 17.9224C10.2176 17.9727 10.3476 17.9986 10.479 17.9986C10.6103 17.9986 10.7404 17.9727 10.8617 17.9224C10.983 17.8722 11.0933 17.7985 11.1861 17.7056L19.208 9.68186C19.3011 9.58875 19.3748 9.47818 19.4251 9.3565C19.4753 9.23482 19.501 9.10442 19.5007 8.97278C19.5004 8.84114 19.4741 8.71085 19.4234 8.58939C19.3726 8.46793 19.2984 8.35769 19.2049 8.26499ZM10.4761 17L5.9999 12.5L7.4999 11C7.50172 11.0015 7.50339 11.0032 7.5049 11.005L10.1518 13.5731C10.2452 13.6645 10.3707 13.7157 10.5015 13.7157C10.6322 13.7157 10.7577 13.6645 10.8511 13.5731L17.0036 7.49999L18.4999 8.97499L10.4761 17Z"
            fill="currentColor"
          />
        </svg>
      ) : null}
      {failed ? (
        <svg
          aria-hidden="true"
          className="absolute inset-0 block size-full text-[var(--progress-circle-icon)]"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15.798 6.29173L17.298 7.76423C17.3914 7.85693 17.4657 7.96717 17.5164 8.08863C17.5672 8.21009 17.5935 8.34038 17.5938 8.47201C17.5941 8.60365 17.5684 8.73405 17.5181 8.85574C17.4679 8.97742 17.3942 9.08799 17.3011 9.1811L9.20229 17.2811C8.80727 17.6762 8.16513 17.671 7.77656 17.2696L6.28146 15.7249C5.9001 15.3309 5.90716 14.7033 6.29728 14.318L14.3861 6.29173C14.5735 6.1049 14.8274 6 15.092 6C15.3567 6 15.6105 6.1049 15.798 6.29173Z"
            fill="currentColor"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M7.79581 6.29173L6.29581 7.76423C6.20234 7.85693 6.1281 7.96717 6.07734 8.08863C6.02658 8.21009 6.00031 8.34038 6.00002 8.47201C5.99973 8.60365 6.02543 8.73405 6.07565 8.85574C6.12587 8.97742 6.19963 9.08799 6.29268 9.1811L14.3915 17.2811C14.7865 17.6762 15.4286 17.671 15.8172 17.2696L17.3123 15.7249C17.6937 15.3309 17.6866 14.7033 17.2965 14.318L9.20768 6.29173C9.02024 6.1049 8.76639 6 8.50174 6C8.2371 6 7.98325 6.1049 7.79581 6.29173Z"
            fill="currentColor"
          />
        </svg>
      ) : null}
    </span>
  );
}

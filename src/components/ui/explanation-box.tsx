import type { ComponentProps, ReactNode } from "react"
import { ProgressCircle } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type ExplanationBoxProps = Omit<ComponentProps<"div">, "title"> & {
  status: "correct" | "incorrect"
  title: ReactNode
  /** ProgressCircle requires an accessible name for the status icon. */
  statusLabel: string
}

function ExplanationBox({ className, status, title, statusLabel, children, ...props }: ExplanationBoxProps) {
  const correct = status === "correct"
  return (
    <div
      data-slot="explanation-box"
      data-status={status}
      className={cn("flex flex-col gap-md rounded-xl border border-border-subtle overflow-clip bg-explanation-box-surface p-2xl", className)}
      {...props}
    >
      <div className="flex items-center gap-[10px]">
        <p className={cn("text-body-large font-medium leading-6 tracking-[-0.02em]", correct ? "text-success" : "text-destructive")}>{title}</p>
        <ProgressCircle className="size-4" done={correct} failed={!correct} aria-label={statusLabel} />
      </div>
      {children !== undefined && children !== null ? (
        <div className="text-body-medium leading-[1.4] text-action-text">{children}</div>
      ) : null}
    </div>
  )
}

export { ExplanationBox, type ExplanationBoxProps }

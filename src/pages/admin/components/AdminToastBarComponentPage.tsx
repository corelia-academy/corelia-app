import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ToastBar, type ToastBarPosition, type ToastBarVariant } from "@/components/ui/toast-bar"

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout"

const variants: { variant: ToastBarVariant; label: string; text: string }[] = [
  { variant: "success", label: "Success", text: "Đã cập nhật thay đổi thành công" },
  { variant: "warning", label: "Warning", text: "Đã cập nhật thay đổi thành công" },
  { variant: "info", label: "Info", text: "Đã cập nhật thay đổi thành công" },
  { variant: "error", label: "Error", text: "Đã cập nhật thay đổi thành công" },
]

const positions: { position: ToastBarPosition; title: string; criterion: string }[] = [
  {
    position: "top",
    title: "Position at Top",
    criterion: "Displaying all 4 feedback variants configured for top-screen notifications.",
  },
  {
    position: "bottom",
    title: "Position at Bottom",
    criterion: "Displaying all 4 feedback variants configured for bottom-screen notifications.",
  },
]

type AdminToastBarComponentPageProps = {
  embedded?: boolean
}

export default function AdminToastBarComponentPage({
  embedded = false,
}: AdminToastBarComponentPageProps) {
  const [lastTriggered, setLastTriggered] = useState<string | null>(null)

  const triggerToast = (variant: ToastBarVariant) => {
    setLastTriggered(variant)
    switch (variant) {
      case "success":
        toast.success("Đã cập nhật thay đổi thành công")
        break
      case "warning":
        toast.warning("Đã cập nhật thay đổi thành công")
        break
      case "info":
        toast.info("Đã cập nhật thay đổi thành công")
        break
      case "error":
        toast.error("Đã cập nhật thay đổi thành công")
        break
    }
  }

  return (
    <ComponentShowcaseLayout
      title="Toast Bar"
      description="All 8 Figma models across Top/Bottom positioning and 4 feedback states with InformativeIcon."
      embedded={embedded}
    >
      {positions.map(({ position, title, criterion }) => (
        <ShowcaseSection key={position} title={title} criterion={criterion}>
          <div
            data-testid={`toast-bar-${position}-group`}
            className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-base p-6"
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {variants.map(({ variant, label, text }) => (
                <div
                  key={`${position}-${variant}`}
                  data-testid={`toast-bar-${position}-${variant}`}
                  className="flex flex-col gap-2"
                >
                  <span className="text-body-small font-medium text-foreground-muted">
                    {label}
                  </span>
                  <div className="flex items-center">
                    <ToastBar position={position} variant={variant}>
                      {text}
                    </ToastBar>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ShowcaseSection>
      ))}

      <ShowcaseSection
        title="Live Trigger Simulation"
        criterion="Trigger interactive notification alerts to verify dynamic toast popups."
      >
        <div className="flex flex-wrap items-center gap-3">
          {variants.map(({ variant, label }) => (
            <Button
              key={`trigger-${variant}`}
              type="button"
              size="small"
              variant={variant === "error" ? "destructive" : "cta"}
              hierarchy="secondary"
              onClick={() => triggerToast(variant)}
              data-testid={`trigger-toast-${variant}`}
            >
              Trigger {label}
            </Button>
          ))}
          {lastTriggered && (
            <span className="text-body-small text-foreground-muted">
              Last triggered: <strong className="text-foreground">{lastTriggered}</strong>
            </span>
          )}
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  )
}

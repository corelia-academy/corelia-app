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

const sonnerForms: { id: string; label: string; fire: () => void }[] = [
  { id: "success", label: "Success", fire: () => toast.success("Đã cập nhật thay đổi thành công") },
  { id: "error", label: "Error", fire: () => toast.error("Không thể lưu thay đổi") },
  { id: "info", label: "Info", fire: () => toast.info("Có phiên bản mới của bài học") },
  { id: "warning", label: "Warning", fire: () => toast.warning("Bài nộp sắp hết hạn") },
  { id: "message", label: "Message (no icon)", fire: () => toast.message("Vui lòng đăng nhập để tiếp tục") },
  { id: "loading", label: "Loading", fire: () => toast.loading("Đang lưu thay đổi...", { duration: 4000 }) },
  {
    id: "description",
    label: "With description",
    fire: () => toast.success("Đã lưu hồ sơ", { description: "Các thay đổi sẽ hiển thị sau vài giây." }),
  },
  {
    id: "action",
    label: "With action",
    fire: () => toast.success("Đã ẩn công việc", { action: { label: "Xem việc đã ẩn", onClick: () => {} } }),
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

      <ShowcaseSection
        title="All sonner forms in use"
        criterion="Real toasts from the global Toaster, the same ones users see. Compare each with the Toast Bar above."
      >
        <div className="flex flex-wrap items-center gap-3" data-testid="sonner-forms">
          {sonnerForms.map(({ id, label, fire }) => (
            <Button
              key={id}
              type="button"
              size="small"
              variant="cta"
              hierarchy="secondary"
              onClick={fire}
              data-testid={`trigger-sonner-${id}`}
            >
              {label}
            </Button>
          ))}
          <Button
            type="button"
            size="small"
            variant="cta"
            hierarchy="primary"
            onClick={() => sonnerForms.forEach(({ fire }, index) => window.setTimeout(fire, index * 250))}
          >
            Fire all
          </Button>
          <Button type="button" size="small" variant="cta" hierarchy="tertiary" onClick={() => toast.dismiss()}>
            Dismiss all
          </Button>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  )
}

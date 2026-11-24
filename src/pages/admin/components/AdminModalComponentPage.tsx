import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, type ModalType } from "@/components/ui/modal"

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout"

type ModalExample = {
  type: ModalType
  label: string
  criterion: string
  title: string
  description: string
}

const examples: readonly ModalExample[] = [
  {
    type: "confirmation",
    label: "Confirmation",
    criterion: "Success featured icon, title, supporting text, Cancel and Confirm.",
    title: "Hoàn thành bài học này?",
    description: "Tiến độ khoá học sẽ được cập nhật ngay sau khi bạn xác nhận.",
  },
  {
    type: "destructive",
    label: "Destructive Action",
    criterion: "Warning featured icon and a destructive Confirm button; focus starts on Cancel.",
    title: "Xoá khoá học?",
    description: "Hành động này không thể hoàn tác. Toàn bộ bài học sẽ bị xoá.",
  },
  {
    type: "form",
    label: "Form",
    criterion: "No featured icon; the content slot holds a form field.",
    title: "Đổi tên khoá học",
    description: "Tên mới sẽ hiển thị cho tất cả học viên.",
  },
  {
    type: "status",
    label: "Status",
    criterion: "Centered illustration and text, no buttons.",
    title: "Đang xử lý yêu cầu",
    description: "Quá trình này có thể mất vài phút, bạn có thể quay lại sau.",
  },
  {
    type: "slot",
    label: "Slot (520 px)",
    criterion: "Wide layout: header with close on the right, free content area, button bar at the bottom.",
    title: "Chọn thành viên",
    description: "Chọn những người sẽ được thêm vào nhóm.",
  },
]

type AdminModalComponentPageProps = {
  embedded?: boolean
}

export default function AdminModalComponentPage({
  embedded = false,
}: AdminModalComponentPageProps) {
  const [openType, setOpenType] = useState<ModalType | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const close = () => setOpenType(null)

  return (
    <ComponentShowcaseLayout
      title="Modal"
      description="Five Figma modal templates: Confirmation, Destructive Action, Form, Status, and Slot."
      embedded={embedded}
    >
      <ShowcaseSection
        title="Modal types"
        criterion="Open each type to review the overlay, spacing, featured icon, content slot, and button bar."
      >
        <div className="flex flex-wrap items-center gap-3">
          {examples.map(({ type, label }) => (
            <Button
              key={type}
              type="button"
              size="small"
              variant={type === "destructive" ? "destructive" : "cta"}
              hierarchy="secondary"
              data-testid={`modal-trigger-${type}`}
              onClick={() => setOpenType(type)}
            >
              Open {label}
            </Button>
          ))}
          {lastAction ? (
            <span className="text-body-small text-foreground-muted">
              Last action: <strong className="text-foreground">{lastAction}</strong>
            </span>
          ) : null}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2" data-testid="modal-criteria">
          {examples.map(({ type, label, criterion }) => (
            <div
              key={type}
              className="rounded-xl border border-border-subtle bg-surface-base p-4"
            >
              <dt className="text-title-small font-display">{label}</dt>
              <dd className="mt-1 text-body-small text-foreground-muted">{criterion}</dd>
            </div>
          ))}
        </dl>
      </ShowcaseSection>

      {examples.map(({ type, title, description }) => {
        const common = {
          open: openType === type,
          onOpenChange: (open: boolean) => {
            if (!open) close()
          },
          title,
          description,
        }

        if (type === "status") {
          return <Modal key={type} {...common} type="status" />
        }

        return (
          <Modal
            key={type}
            {...common}
            type={type}
            cancelLabel="Huỷ"
            confirmLabel="Xác nhận"
            onCancel={() => setLastAction(`${type} / cancel`)}
            onConfirm={() => {
              setLastAction(`${type} / confirm`)
              close()
            }}
          >
            {type === "form" ? (
              <Input aria-label="Tên khoá học" placeholder="Tên khoá học" />
            ) : null}
            {type === "slot" ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border-strong text-body-small text-foreground-muted">
                Content slot
              </div>
            ) : null}
          </Modal>
        )
      })}
    </ComponentShowcaseLayout>
  )
}

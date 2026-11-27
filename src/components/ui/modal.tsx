"use client"

import { useRef, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import awaitingIllustrationSvg from "@/assets/illustrations/illus-awaiting.svg?raw"
import { Button } from "@/components/ui/button"
import { InformativeIcon } from "@/components/ui/informative-icon"
import { cn } from "@/lib/utils"

type ModalType = "confirmation" | "destructive" | "form" | "status" | "slot"

type ModalBaseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Optional content slot, rendered between the text and the button bar. */
  children?: ReactNode
  /** Accessible name of the close button; pass the translated text. */
  closeLabel?: string
  showCloseButton?: boolean
  className?: string
}

type ModalActionProps = ModalBaseProps & {
  type?: Exclude<ModalType, "status">
  /** Button labels come from the caller so they can be translated. */
  cancelLabel: ReactNode
  confirmLabel: ReactNode
  onCancel?: () => void
  /** Does not close the modal; the caller decides when to call `onOpenChange(false)`. */
  onConfirm?: () => void
  confirmDisabled?: boolean
  illustration?: never
}

type ModalStatusProps = ModalBaseProps & {
  type: "status"
  /** Replaces the default Awaiting illustration. */
  illustration?: ReactNode
  cancelLabel?: never
  confirmLabel?: never
  onCancel?: never
  onConfirm?: never
  confirmDisabled?: never
}

type ModalProps = ModalActionProps | ModalStatusProps

const FEATURED_ICON_COLOR = {
  confirmation: "success",
  destructive: "warning",
} as const

const TEXT_ALIGN: Record<ModalType, string> = {
  confirmation: "",
  destructive: "",
  form: "",
  slot: "",
  status: "items-center text-center",
}

function ModalCloseButton({
  label,
  inline,
}: {
  label: string
  inline: boolean
}) {
  return (
    <DialogPrimitive.Close
      data-slot="modal-close"
      render={
        inline ? (
          <button
            type="button"
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-modal-title outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        ) : (
          <Button
            variant="cta"
            hierarchy="tertiary"
            iconOnly
            size="small"
            className="absolute top-xl right-xl rounded-[4px] text-modal-title"
          />
        )
      }
    >
      <X className={inline ? "size-5" : "size-4"} aria-hidden />
      <span className="sr-only">{label}</span>
    </DialogPrimitive.Close>
  )
}

function ModalIllustration({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="modal-illustration"
      aria-hidden="true"
      className="relative size-[240px] shrink-0 select-none"
    >
      {children ?? (
        <div
          className="absolute inset-[10.92%_9.26%_12.55%_20%] [&_svg]:block [&_svg]:size-full [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: awaitingIllustrationSvg }}
        />
      )}
    </div>
  )
}

function Modal({
  open,
  onOpenChange,
  type = "confirmation",
  title,
  description,
  children,
  illustration,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  closeLabel = "Close",
  showCloseButton = true,
  className,
}: ModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isStatus = type === "status"
  const isSlot = type === "slot"
  const featuredIconColor =
    type === "confirmation" || type === "destructive"
      ? FEATURED_ICON_COLOR[type]
      : null
  const mutedText = isStatus || isSlot

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const text = (
    <div
      data-slot="modal-text"
      className={cn(
        "flex w-full min-w-0 flex-col break-words",
        isStatus ? "gap-md" : "gap-sm",
        TEXT_ALIGN[type],
        showCloseButton && !featuredIconColor && !isStatus && !isSlot && "pr-xl",
      )}
    >
      <DialogPrimitive.Title
        data-slot="modal-title"
        className={cn(
          "text-heading-medium font-display",
          isSlot ? "text-modal-description" : "text-modal-title",
        )}
      >
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description
          data-slot="modal-description"
          className={cn(
            "font-body text-[14px] leading-[1.4] tracking-[0.28px]",
            mutedText ? "text-modal-description-muted" : "text-modal-description",
          )}
        >
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  )

  const buttons = isStatus ? null : (
    <div data-slot="modal-actions" className="flex w-full gap-xl">
      <Button
        ref={cancelRef}
        type="button"
        variant="cta"
        hierarchy="tertiary"
        className="min-w-0 flex-1"
        onClick={handleCancel}
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        variant={type === "destructive" ? "destructive" : "cta"}
        className={cn(
          "min-w-0 flex-1",
          type === "destructive" && "shadow-[0_1px_3px_0_rgb(16_24_40/0.15)]",
        )}
        disabled={confirmDisabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  )

  let body: ReactNode

  if (isStatus) {
    body = (
      <div className="flex flex-col items-center gap-2xl px-3xl py-4xl">
        <ModalIllustration>{illustration}</ModalIllustration>
        {text}
        {children}
      </div>
    )
  } else if (isSlot) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-4xl px-3xl py-4xl">
        <div className="flex items-start justify-between gap-xl">
          {text}
          {showCloseButton ? (
            <ModalCloseButton label={closeLabel} inline />
          ) : null}
        </div>
        <div
          data-slot="modal-slot"
          // p-1 chừa chỗ cho viền focus (vẽ lấn ra ngoài ô 3px); -m-1 bù lại để bố cục không đổi
          className="-m-1 min-h-0 flex-1 overflow-y-auto p-1 scrollbar-design"
        >
          {children}
        </div>
        {buttons}
      </div>
    )
  } else {
    body = (
      <>
        <div className="flex min-h-0 flex-col gap-2xl overflow-y-auto p-3xl scrollbar-design">
          {featuredIconColor ? (
            <InformativeIcon
              color={featuredIconColor}
              size="lg"
              type="circle-outline"
            />
          ) : null}
          {text}
          {children ? (
            <div data-slot="modal-slot" className="w-full">
              {children}
            </div>
          ) : null}
        </div>
        <div className="px-3xl py-xl">{buttons}</div>
      </>
    )
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="modal-overlay"
          className="fixed inset-0 isolate z-50 bg-modal-overlay duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="modal"
          data-type={type}
          initialFocus={type === "destructive" ? cancelRef : undefined}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-modal-surface text-modal-title outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            isSlot
              ? "max-h-[calc(100svh-8rem)] max-w-[520px]"
              : "max-h-[calc(100svh-2rem)] max-w-[440px]",
            className,
          )}
        >
          {body}
          {showCloseButton && !isSlot ? (
            <ModalCloseButton label={closeLabel} inline={false} />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { Modal, type ModalProps, type ModalType }

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Loader2 } from "lucide-react"

import { InformativeIcon } from "@/components/ui/informative-icon"

const Toaster = ({ position = "top-center", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      icons={{
        success: (
          <InformativeIcon color="success" size="xs" type="circle-outline" aria-hidden="true" />
        ),
        info: (
          <InformativeIcon color="blue" size="xs" type="circle-outline" aria-hidden="true" />
        ),
        warning: (
          <InformativeIcon color="warning" size="xs" type="circle-outline" aria-hidden="true" />
        ),
        error: (
          <InformativeIcon color="error" size="xs" type="circle-outline" aria-hidden="true" />
        ),
        loading: (
          <Loader2 className="size-5 animate-spin text-[var(--accent-sky-400)]" aria-hidden="true" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--toast-bar-surface)",
          "--normal-text": "var(--toast-bar-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !w-[348px] !max-w-full !rounded-xl !bg-toast-bar-surface !px-4 !py-2.5 !min-h-[44px] !shadow-2xl !select-none !font-body !text-sm !font-normal !text-toast-bar-foreground !border-0 !gap-3",
          title: "!text-toast-bar-foreground !text-sm !font-normal !leading-5",
          description: "!text-toast-bar-foreground/80 !text-xs",
          icon: "!m-0 !p-0 !self-center",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

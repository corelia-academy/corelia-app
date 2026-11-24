import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Loader2 } from "lucide-react"

import {
  ToastBarIcon,
  toastBarTextClassName,
  toastBarVariants,
} from "@/components/ui/toast-bar"

const Toaster = ({ position = "top-center", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      // Sonner sizes every toast with --width (356px by default); match the 400px Toast Bar.
      style={{ "--width": "400px" } as React.CSSProperties}
      icons={{
        success: <ToastBarIcon variant="success" />,
        info: <ToastBarIcon variant="info" />,
        warning: <ToastBarIcon variant="warning" />,
        error: <ToastBarIcon variant="error" />,
        loading: (
          <Loader2 className="size-5 animate-spin text-[var(--accent-sky-400)]" aria-hidden="true" />
        ),
      }}
      toastOptions={{
        unstyled: true,
        // The look comes from the Toast Bar; the icon, content and description classes only adapt
        // sonner's own markup to it. `relative` keeps sonner's absolutely positioned loader inside
        // the icon slot, in front of the text.
        classNames: {
          toast: toastBarVariants(),
          icon: "relative flex size-8 shrink-0 items-center justify-center",
          // min-h-8 = the icon slot height, so a toast without an icon is as tall as the Toast Bar.
          content: "flex min-h-8 min-w-0 flex-1 flex-col justify-center",
          title: `${toastBarTextClassName} break-words`,
          description: "text-toast-bar-foreground/80 text-xs mt-1",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

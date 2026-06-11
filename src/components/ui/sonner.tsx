import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
} from "lucide-react"

const Toaster = ({ position = "top-center", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      icons={{
        success: (
          <CheckCircle2 className="size-4" aria-hidden />
        ),
        info: (
          <Info className="size-4" aria-hidden />
        ),
        warning: (
          <AlertTriangle className="size-4" aria-hidden />
        ),
        error: (
          <XCircle className="size-4" aria-hidden />
        ),
        loading: (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--surface-float)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

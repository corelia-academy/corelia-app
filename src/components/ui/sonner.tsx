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
          <InformativeIcon color="success" size="sm" type="circle-outline" aria-hidden="true" />
        ),
        info: (
          <InformativeIcon color="blue" size="sm" type="circle-outline" aria-hidden="true" />
        ),
        warning: (
          <InformativeIcon color="warning" size="sm" type="circle-outline" aria-hidden="true" />
        ),
        error: (
          <InformativeIcon color="error" size="sm" type="circle-outline" aria-hidden="true" />
        ),
        loading: (
          <Loader2 className="size-5 animate-spin text-[var(--accent-sky-400)]" aria-hidden="true" />
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-[400px] max-w-full rounded-xl border-[0.5px] border-toast-bar-border bg-toast-bar-surface px-4 py-3 shadow-toast-bar select-none font-body text-sm font-medium tracking-[-0.07px] text-toast-bar-foreground flex items-center gap-6",
          icon: "shrink-0 self-center flex items-center justify-center p-0 m-0 size-8",
          content: "flex flex-col flex-1 min-w-0 justify-center",
          title: "text-toast-bar-foreground text-sm font-medium leading-5 tracking-[-0.07px] break-words",
          description: "text-toast-bar-foreground/80 text-xs mt-1",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

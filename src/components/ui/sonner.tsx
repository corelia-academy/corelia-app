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
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-[348px] max-w-full rounded-xl bg-toast-bar-surface px-4 py-2.5 shadow-2xl select-none font-body text-sm font-normal text-toast-bar-foreground border-0 flex items-center gap-3",
          icon: "shrink-0 self-center flex items-center justify-center p-0 m-0 size-6",
          content: "flex flex-col flex-1 min-w-0 justify-center",
          title: "text-toast-bar-foreground text-sm font-normal leading-5 break-words",
          description: "text-toast-bar-foreground/80 text-xs mt-1",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

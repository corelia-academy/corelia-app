import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export const USER_STATES = ["Default", "Hover", "Clicked"] as const
export type UserState = (typeof USER_STATES)[number]

type UserProps = Omit<React.ComponentProps<"button">, "children"> & {
  addSlot?: React.ReactNode
  avatar?: React.ReactNode
  children?: React.ReactNode
  showAvatar?: boolean
  showDropdown?: boolean
  state?: UserState
}

function User({
  addSlot,
  avatar,
  children,
  className,
  showAvatar = true,
  showDropdown = false,
  state = "Default",
  ...props
}: UserProps) {
  return (
    <button
      type="button"
      data-slot="user"
      data-state={state}
      data-user-state={state}
      aria-expanded={showDropdown ? state === "Clicked" : undefined}
      aria-haspopup={showDropdown ? "menu" : undefined}
      className={cn(
        "group/user inline-flex h-10 w-fit items-center gap-1 overflow-visible rounded-full border border-border bg-background p-1 text-foreground transition-colors",
        "hover:bg-action-hover data-[state=Hover]:bg-action-hover data-[state=Clicked]:bg-user-clicked data-[state=Clicked]:border-user-clicked-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      {showAvatar && avatar != null ? (
        <span
          data-slot="user-avatar-slot"
          className="relative flex size-8 shrink-0 items-center justify-end overflow-visible"
        >
          {avatar}
        </span>
      ) : null}
      <span
        data-slot="user-label"
        className="mr-1 flex flex-none items-center justify-center px-1 text-center font-body text-[16px] font-medium leading-[1.4] text-current"
      >
        {children}
      </span>
      {addSlot ? <span data-slot="user-add-slot">{addSlot}</span> : null}
      {showDropdown ? (
        <span data-slot="user-dropdown" className="mr-1 inline-flex shrink-0">
          <ChevronDown aria-hidden="true" className="size-4" />
        </span>
      ) : null}
    </button>
  )
}

export { User }
export type { UserProps }

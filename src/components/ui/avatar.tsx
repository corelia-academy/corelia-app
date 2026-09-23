import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { Pencil, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

export const AVATAR_SIZES = [
  "Xsmall",
  "Small",
  "Medium",
  "Large",
  "XLarge",
  "1.5XLarge",
  "2XLarge",
  "3XLarge",
  "4XLarge",
] as const

export const AVATAR_TYPES = [
  "Set avatar",
  "User",
  "Text",
  "Disabled",
  "Icon",
  "Brand Logos",
] as const

export type AvatarType = (typeof AVATAR_TYPES)[number]

type LegacyAvatarSize = "default" | "sm" | "lg"
type AvatarSizeKey =
  | "xsmall"
  | "small"
  | "medium"
  | "large"
  | "xlarge"
  | "xlarge-1-5"
  | "xlarge-2"
  | "xlarge-3"
  | "xlarge-4"
type AvatarTypeKey =
  | "user"
  | "disabled"
  | "text"
  | "icon"
  | "set-avatar"
  | "brand-logos"

type AvatarCSSProperties = React.CSSProperties & {
  "--avatar-icon-size": string
  "--avatar-text-font-family": string
  "--avatar-text-font-size": string
  "--avatar-text-font-weight": string
  "--avatar-text-letter-spacing": string
  "--avatar-text-line-height": string
  "--avatar-text-padding": string
}

export type AvatarSize =
  | (typeof AVATAR_SIZES)[number]
  | LegacyAvatarSize

const avatarSizeClasses: Record<AvatarSize, string> = {
  Xsmall: "size-4",
  Small: "size-6",
  Medium: "size-8",
  Large: "size-10",
  XLarge: "size-12",
  "1.5XLarge": "size-14",
  "2XLarge": "size-16",
  "3XLarge": "size-[72px]",
  "4XLarge": "size-20",

  // Backward compatibility — tương thích ngược
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
}

const avatarSizeKeys: Record<AvatarSize, AvatarSizeKey> = {
  Xsmall: "xsmall",
  Small: "small",
  Medium: "medium",
  Large: "large",
  XLarge: "xlarge",
  "1.5XLarge": "xlarge-1-5",
  "2XLarge": "xlarge-2",
  "3XLarge": "xlarge-3",
  "4XLarge": "xlarge-4",
  sm: "small",
  default: "medium",
  lg: "large",
}

const avatarTypeKeys: Record<AvatarType, AvatarTypeKey> = {
  User: "user",
  Disabled: "disabled",
  Text: "text",
  Icon: "icon",
  "Set avatar": "set-avatar",
  "Brand Logos": "brand-logos",
}

const avatarContentStyles: Record<AvatarSize, AvatarCSSProperties> = {
  Xsmall: {
    "--avatar-icon-size": "8px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "8px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "10px",
    "--avatar-text-padding": "0px",
  },
  Small: {
    "--avatar-icon-size": "12px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "10px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "12px",
    "--avatar-text-padding": "4px",
  },
  Medium: {
    "--avatar-icon-size": "16px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "12px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "16px",
    "--avatar-text-padding": "8px",
  },
  Large: {
    "--avatar-icon-size": "20px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "14px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "20px",
    "--avatar-text-padding": "10px",
  },
  XLarge: {
    "--avatar-icon-size": "24px",
    "--avatar-text-font-family": '"Akt", sans-serif',
    "--avatar-text-font-size": "16px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0.16px",
    "--avatar-text-line-height": "20px",
    "--avatar-text-padding": "12px",
  },
  "1.5XLarge": {
    "--avatar-icon-size": "28px",
    "--avatar-text-font-family": '"Noto Sans", sans-serif',
    "--avatar-text-font-size": "16px",
    "--avatar-text-font-weight": "600",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "24px",
    "--avatar-text-padding": "14px",
  },
  "2XLarge": {
    "--avatar-icon-size": "32px",
    "--avatar-text-font-family": '"Akt", sans-serif',
    "--avatar-text-font-size": "18px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "24px",
    "--avatar-text-padding": "16px",
  },
  "3XLarge": {
    "--avatar-icon-size": "36px",
    "--avatar-text-font-family": '"Akt", sans-serif',
    "--avatar-text-font-size": "18px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "24px",
    "--avatar-text-padding": "16px",
  },
  "4XLarge": {
    "--avatar-icon-size": "40px",
    "--avatar-text-font-family": '"Akt", sans-serif',
    "--avatar-text-font-size": "18px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "24px",
    "--avatar-text-padding": "20px",
  },
  sm: {
    "--avatar-icon-size": "12px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "10px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "12px",
    "--avatar-text-padding": "4px",
  },
  default: {
    "--avatar-icon-size": "16px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "12px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "16px",
    "--avatar-text-padding": "8px",
  },
  lg: {
    "--avatar-icon-size": "20px",
    "--avatar-text-font-family": '"Be Vietnam Pro", sans-serif',
    "--avatar-text-font-size": "14px",
    "--avatar-text-font-weight": "500",
    "--avatar-text-letter-spacing": "0px",
    "--avatar-text-line-height": "20px",
    "--avatar-text-padding": "10px",
  },
}

type AvatarContextValue = {
  size: AvatarSize
  type: AvatarType
}

const AvatarContext = React.createContext<AvatarContextValue | null>(null)

const avatarActionSizes: readonly AvatarSize[] = [
  "XLarge",
  "1.5XLarge",
  "2XLarge",
  "3XLarge",
  "4XLarge",
]

function Avatar({
  className,
  size = "default",
  type = "User",
  style,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: AvatarSize
  type?: AvatarType
}) {
  const isLegacySize = size === "sm" || size === "default" || size === "lg"

  return (
    <AvatarContext.Provider value={{ size, type }}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        data-size={size}
        data-avatar-size={avatarSizeKeys[size]}
        data-avatar-type={avatarTypeKeys[type]}
        className={cn(
          "group/avatar relative flex shrink-0 overflow-visible rounded-full bg-background select-none",
          isLegacySize &&
            "after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-full after:border after:border-border after:mix-blend-darken dark:after:mix-blend-lighten",
          avatarSizeClasses[size],
          className
        )}
        style={{ ...avatarContentStyles[size], ...style }}
        {...props}
      />
    </AvatarContext.Provider>
  )
}

function AvatarImage({ className, src, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      key={src ?? "__no-src__"}
      data-slot="avatar-image"
      src={src}
      className={cn(
        "pointer-events-none absolute inset-0 z-10 aspect-square size-full rounded-full object-cover",
        "group-data-[avatar-type=brand-logos]/avatar:object-contain",
        "group-data-[avatar-type=disabled]/avatar:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "absolute inset-0 z-0 flex size-full items-center justify-center overflow-hidden rounded-full bg-surface-raised text-sm text-foreground-muted group-data-[size=sm]/avatar:text-xs",
        "group-data-[avatar-type=text]/avatar:bg-avatar-filled group-data-[avatar-type=text]/avatar:text-avatar-text group-data-[avatar-type=text]/avatar:font-medium",
        "group-data-[avatar-type=icon]/avatar:bg-avatar-filled group-data-[avatar-type=icon]/avatar:text-avatar-icon",
        "group-data-[avatar-type=set-avatar]/avatar:bg-avatar-set group-data-[avatar-type=set-avatar]/avatar:text-avatar-icon",
        "group-data-[avatar-type=brand-logos]/avatar:bg-background group-data-[avatar-type=brand-logos]/avatar:[&>img]:size-full group-data-[avatar-type=brand-logos]/avatar:[&>img]:object-contain",
        "group-data-[avatar-type=disabled]/avatar:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[avatar-size=xsmall]/avatar:size-1.5 group-data-[avatar-size=xsmall]/avatar:[&>svg]:hidden",
        "group-data-[avatar-size=small]/avatar:size-2 group-data-[avatar-size=small]/avatar:[&>svg]:hidden",
        "group-data-[avatar-size=medium]/avatar:size-2.5 group-data-[avatar-size=medium]/avatar:[&>svg]:size-2",
        "group-data-[avatar-size=large]/avatar:size-3 group-data-[avatar-size=large]/avatar:[&>svg]:size-2",
        "group-data-[avatar-size=xlarge]/avatar:size-3 group-data-[avatar-size=xlarge]/avatar:[&>svg]:size-2",
        "group-data-[avatar-size=xlarge-1-5]/avatar:size-3.5 group-data-[avatar-size=xlarge-1-5]/avatar:[&>svg]:size-3",
        "group-data-[avatar-size=xlarge-2]/avatar:size-4 group-data-[avatar-size=xlarge-2]/avatar:[&>svg]:size-3",
        "group-data-[avatar-size=xlarge-3]/avatar:size-[18px] group-data-[avatar-size=xlarge-3]/avatar:[&>svg]:size-4",
        "group-data-[avatar-size=xlarge-4]/avatar:size-5 group-data-[avatar-size=xlarge-4]/avatar:[&>svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-[var(--corelia-spacing-md)] *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs text-foreground-muted ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        "group-has-data-[avatar-size=xsmall]/avatar-group:size-4 group-has-data-[avatar-size=xsmall]/avatar-group:[&>svg]:size-2",
        "group-has-data-[avatar-size=small]/avatar-group:size-6 group-has-data-[avatar-size=small]/avatar-group:[&>svg]:size-3",
        "group-has-data-[avatar-size=medium]/avatar-group:size-8 group-has-data-[avatar-size=medium]/avatar-group:[&>svg]:size-4",
        "group-has-data-[avatar-size=large]/avatar-group:size-10 group-has-data-[avatar-size=large]/avatar-group:[&>svg]:size-5",
        "group-has-data-[avatar-size=xlarge]/avatar-group:size-12 group-has-data-[avatar-size=xlarge]/avatar-group:[&>svg]:size-6",
        "group-has-data-[avatar-size=xlarge-1-5]/avatar-group:size-14 group-has-data-[avatar-size=xlarge-1-5]/avatar-group:[&>svg]:size-7",
        "group-has-data-[avatar-size=xlarge-2]/avatar-group:size-16 group-has-data-[avatar-size=xlarge-2]/avatar-group:[&>svg]:size-8",
        "group-has-data-[avatar-size=xlarge-3]/avatar-group:size-[72px] group-has-data-[avatar-size=xlarge-3]/avatar-group:[&>svg]:size-9",
        "group-has-data-[avatar-size=xlarge-4]/avatar-group:size-20 group-has-data-[avatar-size=xlarge-4]/avatar-group:[&>svg]:size-10",
        className
      )}
      {...props}
    />
  )
}

type AvatarActionKind = "edit" | "add"

export type AvatarActionProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  kind: AvatarActionKind
  "aria-label": string
}

function AvatarAction({
  className,
  kind,
  "aria-label": ariaLabel,
  disabled,
  ...props
}: AvatarActionProps) {
  const avatar = React.useContext(AvatarContext)
  const actionIsAllowed =
    !avatar ||
    (avatarActionSizes.includes(avatar.size) &&
      ((kind === "edit" && (avatar.type === "User" || avatar.type === "Text")) ||
        (kind === "add" && avatar.type === "Set avatar")))

  if (!actionIsAllowed) {
    return null
  }

  const isAvatarDisabled = avatar?.type === "Disabled"
  const Icon = kind === "edit" ? Pencil : Plus

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={isAvatarDisabled || undefined}
      disabled={disabled || isAvatarDisabled}
      data-slot="avatar-action"
      data-avatar-action={kind}
      className={cn(
        "absolute right-0 bottom-0 z-20 inline-flex size-4 shrink-0 items-center justify-center rounded-full p-0 shadow-avatar-action focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-avatar-action-focus disabled:pointer-events-none disabled:opacity-50",
        "overflow-visible before:absolute before:-inset-3.5 before:rounded-full before:content-['']",
        "data-[avatar-action=edit]:border data-[avatar-action=edit]:border-avatar-action-edit-border data-[avatar-action=edit]:bg-avatar-action-edit data-[avatar-action=edit]:text-avatar-icon",
        "data-[avatar-action=add]:bg-avatar-action-add data-[avatar-action=add]:text-avatar-icon",
        "group-data-[avatar-size=xlarge]/avatar:size-4",
        "group-data-[avatar-size=xlarge-1-5]/avatar:size-5",
        "group-data-[avatar-size=xlarge-2]/avatar:size-5",
        "group-data-[avatar-size=xlarge-3]/avatar:size-6",
        "group-data-[avatar-size=xlarge-4]/avatar:size-6",
        "group-data-[avatar-size=xlarge-1-5]/avatar:before:-inset-3",
        "group-data-[avatar-size=xlarge-2]/avatar:before:-inset-3",
        "group-data-[avatar-size=xlarge-3]/avatar:before:-inset-2.5",
        "group-data-[avatar-size=xlarge-4]/avatar:before:-inset-2.5",
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3" />
    </button>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
  AvatarAction,
}

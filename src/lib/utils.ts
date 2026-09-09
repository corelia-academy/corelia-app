import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const coreliaSpacing = [
  "none",
  "xxs",
  "xs",
  "sm",
  "md",
  "2md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
  "10xl",
  "11xl",
  "12xl",
  "13xl",
  "14xl",
  "15xl",
] as const;

const coreliaTypography = [
  "display-large",
  "display-medium",
  "display-small",
  "heading-large",
  "heading-medium",
  "heading-small",
  "title-large",
  "title-medium",
  "title-small",
  "title-xsmall",
  "body-large",
  "body-medium",
  "body-small",
  "body-xsmall",
  "cta-large",
  "cta-medium",
  "cta-small",
  "cta-link",
  "label-large",
  "label-medium",
  "label-small",
  "label-xsmall",
  "note-regular",
  "note-medium",
  "note-italic",
] as const

const twMergeCorelia = extendTailwindMerge({
  extend: {
    theme: {
      text: coreliaTypography,
      spacing: coreliaSpacing,
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMergeCorelia(clsx(inputs))
}

/** Loại bỏ các trường có giá trị undefined trước khi tạo persistence payload. */
export function removeUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
}

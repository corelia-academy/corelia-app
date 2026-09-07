import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

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

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

const twMergeCorelia = extendTailwindMerge({
  extend: {
    theme: {
      spacing: coreliaSpacing,
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMergeCorelia(clsx(inputs))
}

/** Loại bỏ các trường có giá trị undefined trước khi tạo persistence payload. */
export function removeUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
}

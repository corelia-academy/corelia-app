import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The video picture is at most 80vh tall in 16:9, so at most 80vh × 16/9 wide.
// The text column follows it so their edges line up, and never gets narrower than 64rem (the current look on laptops).
export const LESSON_MEDIA_MAX_HEIGHT = "80vh";

// One column for every lesson format: frame, quiz/practice/code, footer and skeleton all use it so they stay aligned.
export const LESSON_COLUMN = "mx-auto w-full px-4 sm:px-6 md:px-8xl";

export function LessonColumn({ className, style, ...props }: ComponentProps<"div">) {
  return <div data-lesson-column className={cn(LESSON_COLUMN, className)}
    style={{ maxWidth: `max(64rem, calc(${LESSON_MEDIA_MAX_HEIGHT} * 16 / 9))`, ...style }} {...props} />;
}

import { flushSync } from "react-dom";

/** Đổi theme với hiệu ứng mờ chéo toàn trang; trình duyệt không hỗ trợ hoặc giảm chuyển động thì đổi tức thì. */
export function setThemeWithTransition(setTheme: (theme: string) => void, next: string) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !document.startViewTransition) return setTheme(next);
  document.startViewTransition(() => flushSync(() => setTheme(next)));
}

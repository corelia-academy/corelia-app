import { useEffect, useState } from "react";

/**
 * Becomes true once the browser is idle after mount (or after `timeout` ms at the latest).
 * Gate background work that the current page does not render with it, so it does not compete
 * with the page's own chunks and data on first load.
 */
export function useBrowserIdle(timeout = 3000): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const done = () => setIdle(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(done, { timeout });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(done, Math.min(timeout, 1500));
    return () => window.clearTimeout(id);
  }, [timeout]);

  return idle;
}

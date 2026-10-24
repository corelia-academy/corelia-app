import { useEffect, useState, useSyncExternalStore } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { isAppSplashHidden, subscribeAppSplashHidden } from "@/components/loading/appSplash";

const SETTLE_TIMEOUT_MS = 5000;

/**
 * Becomes true (and stays true) once the first page has loaded: the splash is gone, its queries
 * have settled (or `SETTLE_TIMEOUT_MS` passed) and the browser is idle. Gate background work the
 * current page does not render with it, so it does not compete with the page's chunks and data.
 */
export function useFirstLoadSettled(): boolean {
  const splashHidden = useSyncExternalStore(subscribeAppSplashHidden, isAppSplashHidden, () => false);
  const fetching = useIsFetching();
  const [timedOut, setTimedOut] = useState(false);
  const [settled, setSettled] = useState(false);
  const ready = splashHidden && (fetching === 0 || timedOut);

  useEffect(() => {
    if (!splashHidden || settled) return;
    const id = window.setTimeout(() => setTimedOut(true), SETTLE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [splashHidden, settled]);

  useEffect(() => {
    if (!ready || settled) return;
    const done = () => setSettled(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(done, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(done, 200);
    return () => window.clearTimeout(id);
  }, [ready, settled]);

  return settled;
}

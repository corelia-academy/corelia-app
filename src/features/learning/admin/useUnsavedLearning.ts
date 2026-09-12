import { useCallback, useEffect } from "react";
import { useBlocker, type BlockerFunction } from "react-router";

export function useUnsavedLearning(dirty: boolean) {
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) =>
    dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), [dirty]);
  const blocker = useBlocker(shouldBlock);
  useEffect(() => {
    if (!dirty) return;
    // The router covers SPA history; the browser owns confirmation for reload,
    // tab close and full-document/external navigation.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  return blocker;
}

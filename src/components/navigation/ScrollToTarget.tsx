import { useEffect } from "react";
import { useLocation } from "react-router";

const MAX_WAIT_MS = 3000;

/**
 * Scrolls to the element whose id is passed through router state (`state.scrollTo`),
 * centers it, focuses it and highlights it. Waits for the element to mount because
 * the destination route can be lazy-loaded or render after profile data. The highlight
 * stays until the user clicks or touches the screen.
 */
export function ScrollToTarget() {
  const location = useLocation();
  const targetId = (location.state as { scrollTo?: string } | null)?.scrollTo;

  useEffect(() => {
    if (!targetId) return;

    const startedAt = performance.now();
    let frame = 0;
    let target: HTMLElement | null = null;

    const clearHighlight = () => {
      target?.removeAttribute("data-scroll-highlight");
      document.removeEventListener("pointerdown", clearHighlight, true);
    };

    const run = () => {
      target = document.getElementById(targetId);
      if (!target) {
        if (performance.now() - startedAt < MAX_WAIT_MS) frame = requestAnimationFrame(run);
        return;
      }
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      target.focus({ preventScroll: true });
      target.setAttribute("data-scroll-highlight", "true");
      document.addEventListener("pointerdown", clearHighlight, true);
    };

    frame = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(frame);
      clearHighlight();
    };
  }, [location.key, targetId]);

  return null;
}

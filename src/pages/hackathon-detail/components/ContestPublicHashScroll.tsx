import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";
import { isNavigationReload } from "@/pages/hackathon-detail/utils/isNavigationReload";

/** Scrolls to `location.hash` element on the canonical `/hackathons/:slug` page. */
export function ContestPublicHashScroll({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  /** Skip exactly one programmatic scroll when refreshing with a hash (avoid stacking with browser fragment scroll). */
  const skipInitialProgrammaticScrollRef = useRef<boolean | null>(null);
  if (skipInitialProgrammaticScrollRef.current === null) {
    const raw = location.hash.replace(/^#/, "").trim();
    skipInitialProgrammaticScrollRef.current =
      Boolean(enabled && raw && isNavigationReload());
  }

  useLayoutEffect(() => {
    if (!enabled) return;
    const raw = location.hash.replace(/^#/, "").trim();
    if (!raw || !isNavigationReload()) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [enabled, location.pathname, location.hash]);

  useEffect(() => {
    if (!enabled) return;
    const raw = location.hash.replace(/^#/, "").trim();
    if (!raw) return;
    const id = decodeURIComponent(raw);
    if (id === "participant-submission") return;

    if (skipInitialProgrammaticScrollRef.current) {
      skipInitialProgrammaticScrollRef.current = false;
      return;
    }

    const run = () => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    };
    const handle = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(handle);
  }, [enabled, location.pathname, location.hash]);

  return null;
}

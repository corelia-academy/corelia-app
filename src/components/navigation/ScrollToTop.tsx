import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

export function ScrollToTop() {
  const location = useLocation();
  const prevRef = useRef<{ pathname: string; hash: string } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = {
      pathname: location.pathname,
      hash: location.hash,
    };

    if (
      prev &&
      prev.pathname === location.pathname &&
      prev.hash !== location.hash
    ) {
      return;
    }

    const publicHackathonTabRe = /^\/hackathons\/([^/]+)\/(?:overview|prizes|timeline|resources|projects)$/;
    const prevManage = prev?.pathname.match(publicHackathonTabRe);
    const nextManage = location.pathname.match(publicHackathonTabRe);
    if (
      prev &&
      prevManage &&
      nextManage &&
      prevManage[1] === nextManage[1] &&
      prev.pathname !== location.pathname
    ) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.hash]);

  return null;
}

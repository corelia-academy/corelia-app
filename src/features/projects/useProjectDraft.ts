import { useEffect, useRef, useState } from "react";
import type { ProjectDraft } from "./projectEditorDraft";

// Recover text and selections on Back/refresh. Uploaded images stay in the
// current editor only: temporary signed URLs must not be restored after expiry.
function recoverable(draft: ProjectDraft) {
  return { description: draft.description, progress: draft.progress, pitchVideo: draft.pitchVideo, title: draft.title, slug: draft.slug, summary: draft.summary, demo: draft.demo, repo: draft.repo, slide: draft.slide, video: draft.video, visibility: draft.visibility, tracks: draft.tracks, sectors: draft.sectors, tech: draft.tech };
}

export function useProjectDraft(key: string, initial: ProjectDraft, leaveMessage: string) {
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (raw && raw.base === JSON.stringify(recoverable(initial)) && raw.value) {
        const value = raw.value;
        const strings = ["title", "slug", "summary", "demo", "repo", "slide", "video", "description", "progress", "pitchVideo"];
        const arrays = ["tracks", "sectors", "tech"];
        if (strings.every(k => typeof value[k] === "string") && arrays.every(k => Array.isArray(value[k]) && value[k].every((id: unknown) => typeof id === "string")) && ["public", "private", "unlisted"].includes(value.visibility)) {
          return { ...initial, ...value, logo: initial.logo, screenshots: initial.screenshots } as ProjectDraft;
        }
      }
    } catch { /* Storage may be disabled. Editing remains available. */ }
    return initial;
  });
  const [wasRecovered] = useState(() => JSON.stringify(recoverable(draft)) !== JSON.stringify(recoverable(initial)));
  const [baseline] = useState(initial);
  const committed = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    if (committed.current) return;
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ base: JSON.stringify(recoverable(baseline)), value: recoverable(draft) }));
      else sessionStorage.removeItem(key);
    } catch { /* Storage is optional. */ }
  }, [draft, dirty, key, baseline]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty || committed.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function onLink(event: MouseEvent) {
      if (!dirty || committed.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, location.href);
      if (destination.pathname === location.pathname && destination.search === location.search) return;
      if (!window.confirm(leaveMessage)) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onLink, true); };
  }, [dirty, leaveMessage]);

  const recovered = wasRecovered && !restored;
  function clear() {
    committed.current = true;
    try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
  }
  return { draft, setDraft, dirty, clear, recovered, dismissRecovery: () => setRestored(true) };
}

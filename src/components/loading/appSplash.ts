// The splash in index.html (#app-splash) paints with the HTML, before any JavaScript. Global
// loading screens hold it while the app boots and loads the first route, then it fades out
// once nothing holds it, revealing the page underneath.

let holders = 0;
let releaseTimer: number | undefined;

function splashElement(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById("app-splash");
}

/** True while the splash is shown (not yet fading out). */
export function hasAppSplash(): boolean {
  const splash = splashElement();
  return splash !== null && !splash.hasAttribute("data-hidden");
}

function hideAppSplash() {
  const splash = splashElement();
  if (!splash) return;
  splash.setAttribute("data-hidden", "");
  const remove = () => splash.remove();
  splash.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 400);
}

/**
 * Fade the splash out after `delay` ms unless a loading screen holds it by then. The delay
 * bridges commits where one loading screen unmounts just before the next one mounts.
 */
export function scheduleAppSplashRelease(delay = 50) {
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    if (holders === 0) hideAppSplash();
  }, delay);
}

/** Keep the splash visible; returns the release callback. */
export function holdAppSplash(): () => void {
  holders += 1;
  window.clearTimeout(releaseTimer);
  return () => {
    holders -= 1;
    scheduleAppSplashRelease();
  };
}

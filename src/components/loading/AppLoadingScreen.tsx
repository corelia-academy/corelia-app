import { useLayoutEffect, useState } from "react";
import { appPath } from "@/lib/appUrl";
import { cn } from "@/lib/utils";
import { hasAppSplash, holdAppSplash } from "./appSplash";
import { skeletonRevealClass } from "./skeletonReveal";

/**
 * Global loading screen: the Corelia logo centred on the page background. Covers app boot, the
 * session/MFA check on /login and the first route's chunk loads, so the first visit shows one
 * loading state instead of a chain of layout skeletons. Data loading keeps its own skeletons.
 *
 * While the HTML splash (`#app-splash`) is still up, this only keeps it visible; the splash
 * fades out once no loading screen is mounted. Later (in-app navigation) it draws a blurred
 * overlay with the same logo.
 */
export function AppLoadingScreen() {
  const [underSplash] = useState(hasAppSplash);
  useLayoutEffect(() => (underSplash ? holdAppSplash() : undefined), [underSplash]);

  if (underSplash) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-md",
        skeletonRevealClass(),
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <img src={appPath("/logo/corelia-logo-black.svg")} alt="" aria-hidden className="size-20 dark:hidden" />
      <img src={appPath("/logo/corelia-logo-white.svg")} alt="" aria-hidden className="hidden size-20 dark:block" />
    </div>
  );
}

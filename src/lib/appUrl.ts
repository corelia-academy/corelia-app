// The SPA is served under a path prefix (Vite `base`, e.g. "/learn/").
// Router paths stay prefix-free; anything that leaves React Router —
// full-page navigations, absolute links, static asset URLs — goes through here.

/** Path prefix without a trailing slash: "/learn", or "" when served at the root. */
export const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Prefix an in-app path ("/courses/x") or public asset ("/logo/x.svg") with the base path. */
export function appPath(path: string): string {
  return `${APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Production origin, used when there is no browser location (tests, non-DOM code). */
export const DEFAULT_APP_ORIGIN = "https://corelia.academy";

/** Absolute URL for an in-app path, e.g. for auth redirects and share links. */
export function appUrl(
  path: string,
  origin: string = typeof window === "undefined" ? DEFAULT_APP_ORIGIN : window.location.origin,
): string {
  return `${origin}${appPath(path)}`;
}

/** Absolute URL on the landing site (domain root), which renders the public, indexable pages. */
export function landingUrl(
  path: string,
  origin: string = typeof window === "undefined" ? DEFAULT_APP_ORIGIN : window.location.origin,
): string {
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute app root without a trailing slash, e.g. "https://corelia.academy/learn". */
export function appBaseUrl(): string {
  return appUrl("/").replace(/\/$/, "");
}

/** Strip the base path from a browser pathname so it can be matched against router paths. */
export function stripAppBasePath(pathname: string): string {
  if (!APP_BASE_PATH) return pathname;
  if (pathname === APP_BASE_PATH) return "/";
  return pathname.startsWith(`${APP_BASE_PATH}/`) ? pathname.slice(APP_BASE_PATH.length) : pathname;
}

/** Current router-relative pathname, for code that runs outside the router. */
export function currentAppPathname(): string {
  return stripAppBasePath(window.location.pathname);
}

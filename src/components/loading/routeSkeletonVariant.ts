export type RouteSkeletonVariant = "home" | "list" | "detail" | "form" | "table" | "learn";

/** Best-effort skeleton variant for a URL, used before the router mounts (auth bootstrap). */
export function routeSkeletonVariantForPath(pathname: string): RouteSkeletonVariant {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path.startsWith("/study/")) return "learn";
  if (
    path === "/admin/branding" ||
    /^\/admin\/hackathons\/(new|[^/]+\/edit)$/.test(path) ||
    /^\/instructor\/(profile|courses\/(new|[^/]+\/edit))$/.test(path)
  ) return "form";
  if (/^\/admin\/instructors\/[^/]+$/.test(path)) return "detail";
  if (path.startsWith("/admin") || path.startsWith("/instructor/")) return "table";
  if (path.startsWith("/account") || /^\/projects\/(new|[^/]+\/edit)$/.test(path)) return "form";
  if (/^\/(courses|instructors|projects|hackathons)\/[^/]+/.test(path)) return "detail";
  return "list";
}

/** Full-page routes outside MainLayout whose page draws its own loading screen (login, OCID). */
export function isStandalonePlaceholderPath(pathname: string): boolean {
  return /^\/(login|ocid-redirect)\/?$/.test(pathname);
}

/** Admin / instructor workspace routes rendered inside their own sidebar + top-bar layout. */
export function isWorkspacePath(pathname: string): boolean {
  return /^\/(admin|instructor)(\/|$)/.test(pathname);
}

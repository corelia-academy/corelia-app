export type RouteSkeletonVariant = "home" | "list" | "detail" | "form" | "table" | "learn";

/** Best-effort skeleton variant for a URL, used before the router mounts (auth bootstrap). */
export function routeSkeletonVariantForPath(pathname: string): RouteSkeletonVariant {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path.startsWith("/learn/")) return "learn";
  if (path.startsWith("/admin") || path.startsWith("/instructor/")) return "table";
  if (path.startsWith("/account") || /^\/projects\/(new|[^/]+\/edit)$/.test(path)) return "form";
  if (/^\/(courses|instructors|projects|hackathons)\/[^/]+/.test(path)) return "detail";
  return "list";
}

/** Public content sizing only; navigation and brand colors are shared across all routes. */
export function isPublicPresentation(pathname: string, authenticated: boolean): boolean {
  const parts = pathname.split("/").filter(Boolean);
  const [root, second] = parts;
  if (!root) return !authenticated;
  if (["learn", "feed", "account", "achievements", "admin", "instructor", "teaching"].includes(root)) return false;
  if (root === "jobs" && ["saved", "applied", "hidden"].includes(second)) return false;
  if (root === "projects" && (second === "new" || parts.includes("edit"))) return false;
  if (root === "hackathons" && (second === "new" || parts.includes("manage"))) return false;
  return true;
}

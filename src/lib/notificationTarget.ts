export function notificationTarget(payload: Record<string, unknown>): string {
  const path = payload.target_path;
  return typeof path === "string" && /^\/(?![\\/])/.test(path) && !path.includes("\\") && ![...path].some(char => char.charCodeAt(0) < 32) ? path : "/notifications";
}

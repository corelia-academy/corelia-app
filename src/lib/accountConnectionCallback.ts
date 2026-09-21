/** Read only OAuth error fields; retain unrelated navigation parameters. */
export function readAccountConnectionError(search: string, hash: string) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const source = query.has("error") ? query : fragment.has("error") ? fragment : null;
  if (!source) return null;
  const cancelled = source.get("error") === "access_denied" || source.get("error_code") === "access_denied";
  for (const params of [query, fragment]) {
    for (const key of ["error", "error_code", "error_description", "error_uri"]) params.delete(key);
    if (params.get("sb") === "") params.delete("sb");
  }
  return {
    messageKey: cancelled ? "xp.connections.oauthCancelled" as const : "xp.connections.oauthFailed" as const,
    search: query.size ? `?${query}` : "",
    hash: hash.includes("=") ? fragment.size ? `#${fragment}` : "" : hash,
  };
}

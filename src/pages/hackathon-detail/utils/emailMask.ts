/** Mask `local@domain` as `l***@domain` for unobtrusive display. */
export function maskEmailAddress(email: string): string {
  const t = email.trim();
  const at = t.indexOf("@");
  if (at <= 0) return "•••";
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  if (!domain) return "•••";
  if (local.length <= 1) return `•@${domain}`;
  return `${local[0]}***@${domain}`;
}

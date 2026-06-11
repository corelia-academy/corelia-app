import type { PublicProfile } from "@/types/database";

export function readableProfileText(value: string | null | undefined): string | null {
  const next = value
    ?.replace(/\p{C}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!next) return null;
  return /[\p{L}\p{N}]/u.test(next) ? next : null;
}

export function profileTitle(p: PublicProfile): string {
  return (
    readableProfileText(p.full_name) ||
    readableProfileText(p.username) ||
    readableProfileText(p.ocid) ||
    p.id
  );
}

export function profileHandle(p: PublicProfile): string | null {
  const u = readableProfileText(p.username);
  if (u) return `@${u}`;
  const ocid = readableProfileText(p.ocid);
  if (ocid) return ocid;
  return null;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

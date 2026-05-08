import type { PublicProfile } from "@/types/database";

export function profileTitle(p: PublicProfile): string {
  return p.full_name?.trim() || p.username?.trim() || p.ocid?.trim() || p.id;
}

export function profileHandle(p: PublicProfile): string | null {
  const u = p.username?.trim();
  if (u) return `@${u}`;
  const ocid = p.ocid?.trim();
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

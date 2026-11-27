import { GithubLogo, LinkedinLogo } from "@phosphor-icons/react";
import type { InstructorSocialLink, InstructorSocialPlatform, PublicProfile } from "@/types/database";

export const LINK_ICONS: Partial<Record<InstructorSocialPlatform, typeof GithubLogo>> = { github: GithubLogo, linkedin: LinkedinLogo };
export const LINK_NAMES: Partial<Record<InstructorSocialPlatform, string>> = { github: "GitHub", linkedin: "LinkedIn" };

/** GitHub và LinkedIn đứng đầu theo Figma; link khác giữ nguyên nền tảng và nhãn. */
export function toLinkFields(links: InstructorSocialLink[]): InstructorSocialLink[] {
  const rest = [...links];
  const take = (platform: InstructorSocialPlatform): InstructorSocialLink => {
    const index = rest.findIndex((link) => link.platform === platform);
    return index < 0 ? { platform, url: "" } : rest.splice(index, 1)[0];
  };
  return [take("github"), take("linkedin"), ...rest];
}

export function filledLinks(links: InstructorSocialLink[]) {
  return links.map((link) => ({ ...link, url: link.url.trim() })).filter((link) => link.url);
}

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

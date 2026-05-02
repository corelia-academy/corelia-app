import type { Contest } from "@/types/contests";

/** Image for catalog rows / compact chips (falls back to banner if no thumbnail). */
export function contestListImageUrl(contest: Contest): string | null {
  const thumb = contest.thumbnail_url?.trim();
  if (thumb) return thumb;
  const banner = contest.cover_image_url?.trim();
  return banner || null;
}

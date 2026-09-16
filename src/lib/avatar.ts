import multiavatar from "@multiavatar/multiavatar/esm";

export function getGeneratedAvatarSeed(
  userId: string | null | undefined,
  avatarSeed?: string | null,
): string | null {
  return avatarSeed?.trim() || userId?.trim() || null;
}

export function getGeneratedAvatarDataUrl(
  userId: string | null | undefined,
  avatarSeed?: string | null,
): string | null {
  const seed = getGeneratedAvatarSeed(userId, avatarSeed);
  if (!seed) return null;

  try {
    const svg = multiavatar(seed);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}

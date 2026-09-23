import { createAvatar } from "@humation/core";
import { avatarAssets } from "@/lib/avatarAssets";
import { safeAvatarConfig, type AvatarConfig } from "../../shared/avatarConfig";

export type { AvatarConfig } from "../../shared/avatarConfig";

export function getGeneratedAvatarSeed(
  userId: string | null | undefined,
  avatarSeed?: string | null,
): string | null {
  return avatarSeed?.trim() || userId?.trim() || null;
}

export function getGeneratedAvatarDataUrl(
  userId: string | null | undefined,
  avatarSeed?: string | null,
  avatarConfig?: AvatarConfig | null,
): string | null {
  const seed = getGeneratedAvatarSeed(userId, avatarSeed);
  if (!seed) return null;

  try {
    const config = safeAvatarConfig(avatarConfig, avatarAssets);
    const svg = createAvatar(avatarAssets, { seed, ...config, background: config.colors.background }).toString();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}

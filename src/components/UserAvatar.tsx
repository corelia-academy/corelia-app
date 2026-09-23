import { useMemo, type ReactNode } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  type AvatarSize,
} from "@/components/ui/avatar";
import { getGeneratedAvatarDataUrl } from "@/lib/avatar";
import type { AvatarConfig } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  userId?: string | null;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  avatarConfig?: AvatarConfig | null;
  alt: string;
  fallback?: ReactNode;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  size?: AvatarSize;
};

export function UserAvatar({
  userId,
  avatarUrl,
  avatarSeed,
  avatarConfig,
  alt,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
  size,
}: UserAvatarProps) {
  const generatedUrl = useMemo(
    () => getGeneratedAvatarDataUrl(userId, avatarSeed, avatarConfig),
    [userId, avatarSeed, avatarConfig],
  );
  void avatarUrl; // Legacy prop retained until all consumers stop supplying uploaded images.

  return (
    <Avatar className={className} size={size}>
      <AvatarFallback className={cn(fallbackClassName)}>
        {fallback}
      </AvatarFallback>
      {generatedUrl ? (
        <AvatarImage
          key={generatedUrl}
          src={generatedUrl}
          alt={alt}
          className={cn(
            imageClassName,
          )}
        />
      ) : null}
    </Avatar>
  );
}
